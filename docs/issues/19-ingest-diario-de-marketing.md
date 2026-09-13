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

**Status:** ready-for-agent

- [ ] Un Marketing Report es un día de una campaña de un Tenant
- [ ] La ingesta acepta varios días en una llamada y **actualiza** por
      `(tenant, campaña, día)` en vez de insertar
- [ ] Reingestar los últimos 7 días todos los días no duplica ni deja huecos
- [ ] El dashboard calcula la ventana que pide (semana, mes, un rango) sumando días
- [ ] Las métricas derivadas se calculan **para la ventana**, no se promedian:
      CPM, CTR y costo por Lead salen de dividir los acumulados de esa ventana
- [ ] El histórico semanal queda borrado y repuesto con días reales traídos de Meta
- [ ] El dashboard dice con claridad qué ventana está viendo

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
