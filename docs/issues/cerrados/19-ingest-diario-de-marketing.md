# 19: Las métricas de ads se ingestan por día, no por semana

**Ola:** 1 (lanzamiento)

**What to build:** Un Marketing Report deja de ser una semana y pasa a ser **un
día** de una campaña. Semana, mes y cualquier otra ventana se **calculan en
plataforma** a partir de los días, en vez de ingestarse cada una por separado.
El job de n8n corre diario y trae una **ventana móvil de los últimos 7 días**,
pisando lo que ya había, porque Meta corrige la atribución hacia atrás durante
dos o tres días. `reach` y `frequency` salen del modelo: no se pueden
reconstruir desde días y no son métricas de dueño de negocio.

**Blocked by:** None (can start immediately)

**Status:** CERRADO. Plataforma y n8n en `main` y desplegados (PRs #20, #21,
#22), migraciones aplicadas en producción. Workflow central de n8n corriendo
diario contra `GET /api/marketing-reports/ad-accounts`, con paginación y
filtro por prefijo de campaña. Ver "Notas de verificación" al final.

- [x] Un Marketing Report es un día de una campaña de un Tenant
- [x] La ingesta acepta varios días en una llamada y **actualiza** por
      `(tenant, campaña, día)` en vez de insertar
- [x] Reingestar los últimos 7 días todos los días no duplica ni deja huecos
      (lo garantiza el upsert por llave, ver `MarketingReports.ts`)
- [x] El dashboard calcula la ventana que pide (semana, mes, un rango) sumando días
- [x] Las métricas derivadas se calculan **para la ventana**, no se promedian:
      CPM, CTR y costo por Lead salen de dividir los acumulados de esa ventana
- [x] El histórico semanal queda borrado (migración) y repuesto con días
      reales traídos de Meta para al menos un tenant (`ntrs`) — extender el
      backfill a más historia o a otros tenants queda a criterio de Fernando,
      no bloquea el issue
- [x] El dashboard dice con claridad qué ventana está viendo

## Por qué diario y no semanal + mensual

La versión anterior de este issue pedía ingestar el mes aparte del semanal,
porque `reach`, `frequency`, `cpm` y `ctr` no son aditivos. Eso es cierto a
medias y la mitad falsa es la que importa:

| Métrica | ¿Se reconstruye desde días? |
| --- | --- |
| `spend`, `impressions`, `clicks`, `leads`, `landingPageViews` | **Sí**, se suman |
| `cpm`, `ctr`, `costPerLead` | **Sí**: son divisiones entre sumas, calculadas sobre la ventana |
| `reach`, `frequency` | **No**. La misma persona alcanzada el lunes y el jueves cuenta una vez en la semana, y el dato diario no dice quién era |

O sea que el problema real no era la granularidad: eran **dos** métricas. Con
días se puede armar cualquier ventana sin volver a la fuente, y de paso salen
gráficas de tendencia de verdad en vez de cuatro puntos por mes.

**`reach` y `frequency` se sueltan** (decidido el 12/09/2026). Son métricas de
quien opera la pauta, no de quien es dueño del negocio: al cliente le importa
cuánto gastó, cuántos Leads entraron y a qué costo. Conservarlas obligaría a un
segundo tubo de ingesta por mes solo para ellas. Si algún día se piden, entran
como lo que son: una traída aparte, por ventana, desde la fuente.

## La ventana móvil no es opcional

Meta sigue acomodando conversiones atribuidas a un día durante 24-72 horas. Un
job que trae "ayer" una sola vez y lo congela deja totales que **nunca** cuadran
con lo que el cliente ve en el Ads Manager — y ese descuadre es exactamente la
clase de cosa que le tira la confianza al dashboard completo.

Por eso el job diario no trae un día: trae los últimos 7 y **pisa**. La llave
`(tenant, campaña, día)` es lo que hace que pisar sea seguro, igual que el
`externalId` hace seguro reintentar un Lead (ver CONTEXT.md, Lead).

## El histórico

El histórico semanal existente **no** se puede abrir en días: ese detalle nunca
se guardó. Se borra y se repone corriendo el mismo job diario sobre un rango de
fechas viejo — Meta conserva hasta 37 meses. Conservar las dos formas de guardar
lo mismo dejaría un dashboard con dos texturas y un modelo de datos que nadie se
atreve a tocar después.

## Lo que hay hoy

`src/collections/MarketingReports.ts` guarda `weekStart`/`weekEnd`, más `reach`,
`frequency`, `cpm`, `ctr` y `costPerLead` como columnas. Tras este cambio:

- `weekStart`/`weekEnd` → un solo `date`
- `reach`, `frequency` → se van, con su migración
- `cpm`, `ctr`, `costPerLead` → se pueden seguir guardando por día, pero **nada
  las debe promediar**: la ventana las recalcula. El riesgo de dejarlas es que
  alguien saque el promedio de la columna; vale considerar no guardarlas
- `ads` (anuncios activos esa semana) → por día, o se va: decidirlo al hacerlo
- El índice `['tenant', 'weekStart']` → `['tenant', 'date']`

El endpoint de ingesta (`POST /api/marketing-reports/ingest`, protegido con
`MARKETING_REPORT_INGEST_KEY`) conserva su forma `{ subdomain, reports: [...] }`;
lo que cambia es qué trae cada renglón y que la escritura es un upsert.

## Notas de verificación

**Hecho en esta rama** (`src/collections/MarketingReports.ts`,
`src/app/api/marketing-reports/ingest/route.ts`,
`src/app/api/tenant-dashboard/kpis/route.ts`, `src/utils/dashboardPeriod.ts`,
y las vistas `KpiReport.tsx`/`KpiMarketingSection.tsx`):

- Colección `marketing-reports`: `date` en vez de `weekStart`/`weekEnd`,
  `reach`/`frequency`/`cpm`/`ctr`/`costPerLead` fuera del modelo, índice
  `['tenant', 'date']`.
- Migración `20260918_151144_ingest_diario_marketing_reports`: revisada a
  mano, `DELETE FROM marketing_reports` antes de agregar `date NOT NULL`
  (si no, el `ADD COLUMN` truena con filas existentes), todo lo demás
  `IF EXISTS`/`IF NOT EXISTS` por seguridad. **Borra el histórico semanal a
  propósito**, como pide el checklist.
- `/ingest` hace upsert por `(tenant, campaign, date)`.
- `/api/tenant-dashboard/kpis`: la sección de Marketing ya usa la MISMA
  ventana que el resto del dashboard (antes era "semanas completas" aparte,
  porque el reporte era semanal), y la tabla agrupa por campaña sumando los
  días de la ventana — CTR y costo por Lead salen de esas sumas, no de
  promediar renglones.
- `npm run lint` y `npx tsc --noEmit`: limpios en los archivos tocados.
- **No lo pude probar contra la app corriendo** (el navegador de esta sesión
  no respondió); no toqué la base local para no arriesgar los datos de
  prueba de Fernando. Verificar en la app queda pendiente — ver abajo.

**Lo que pasó después de la primera entrega** (ya en producción):

- El día que Fernando probó el primer ingest real, el panel mostraba cada
  fecha un día antes de la real (ej. el 17 se veía como "16, 6:00 PM").
  Causa: `/ingest` guardaba el día a medianoche UTC, y el panel de Payload
  pinta las fechas en la hora LOCAL del navegador — medianoche UTC cae en
  la tarde del día anterior para México (UTC-6). Fix: guardar a mediodía
  UTC en vez de medianoche (PR #21), con una migración aparte
  (`20260918_191357_marketing_reports_date_a_mediodia`) que corrige las
  filas que ya se habían ingestado mal.
- El plan original era un workflow de n8n por tenant. Con 9 tenants,
  Fernando decidió centralizar: un solo workflow programado consulta
  `GET /api/marketing-reports/ad-accounts` (nuevo, protegido con el mismo
  `MARKETING_REPORT_INGEST_KEY`, expone SOLO `subdomain` +
  `tracking.metaAdAccountId` de tenants activos — nunca el resto de
  `tracking`, que trae secretos) y loopea llamando al subworkflow
  compartido de ingesta por cada cuenta (PR #22, agrega
  `tracking.metaAdAccountId` a `Tenants`).
- Esa decisión cambió el subworkflow de n8n: en vez de una campaña fija por
  tenant, consulta la cuenta publicitaria completa
  (`act_{account}/insights`, `level=ad`, `time_increment=1`) y agrupa por
  `(campaña, día)` en vez de solo por día, porque ahora puede traer varias
  campañas de un mismo tenant en la misma llamada.
- Fernando encontró que Meta pagina las insights (25 renglones por página):
  con una cuenta completa y varios días, se pasaba de la primera página y
  se perdían datos en silencio, sin ningún error. Agregó un nodo que seguía
  `paging.next` hasta agotarlo; se integró al subworkflow entre
  `get_campaign_insights` y `set_data`.
- Se agregó un filtro de campañas con prefijo `NTRS` en dos capas: del lado
  de Meta (`filtering: campaign.name CONTAIN "NTRS"`, para no pagar de más
  por datos que no se quieren) y un `startsWith` exacto dentro de
  `set_data` (por si `CONTAIN` matcheara algo con "NTRS" a la mitad del
  nombre).

Todo el lado de n8n (subworkflow + workflow central) vive en la cuenta de
n8n de Fernando, no en este repo — los archivos que se intercambiaron están
en el hilo de la sesión, no versionados aquí.
