# 11: n8n mete Leads que no vienen del quiz

**What to build:** Un endpoint server-to-server para que el n8n de Notoriovs
cree Leads en el Tenant que le digamos, para los casos raros en que el Lead no
pasa por el quiz (formulario nativo de Meta Ads, mensajes de WhatsApp, una
lista que nos pasa el cliente). Mismo molde que
`/api/marketing-reports/ingest`, que ya hace exactamente esto para los KPIs:
secreto compartido en un header, `subdomain` en el body, default-deny si la
env var no está puesta.

**Blocked by:** None (can start immediately)

**Status:** HECHO en `dev` (commit e4b051c, 2026-09-09), **sin desplegar**.
Falta lo de producción: poner `LEADS_INGEST_KEY` en Vercel y correr la
migración. Esta migración solo AGREGA (tres valores al enum de `source`, la
columna `external_id`, dos índices), así que el orden seguro es migración
primero y despliegue después: el código viejo la ignora sin enterarse. Ojo con
el CLI —usar `npm run prod -- npm run migrate:debug`, como en el 09—.

Se probó sobre una base LIMPIA, no sobre la local, que viene deformada por el
push de `next dev`. El `down` también: achicar el enum revienta si quedó un
Lead con valor nuevo, así que los pasa a `manual` antes del cast.

Contra el server de dev quedó verificado el checklist entero: sin llave y con
llave equivocada, 401; subdominio inexistente, 404 sin escribir; un lote de
cuatro filas devolvió dos creadas y dos saltadas con su motivo; el reintento
actualizó el mismo Lead en vez de duplicarlo, y respetó la etapa a la que se
había movido a mano. Con `npm run lint`, `npx tsc --noEmit` y las 70 pruebas en
verde. La única rama del checklist que NO se ejercitó corriendo es la de la env
var ausente (el server de dev ya la tenía puesta): ahí el endpoint responde 503
antes de tocar la base, igual que el ingest de reportes, pero eso está leído, no
probado. No se agregaron pruebas: el endpoint no cae en ninguna de las tres áreas
que este repo prueba (ver CLAUDE.md).

Las dos decisiones que quedaban abiertas se resolvieron así:

- **`source`** gana tres valores, uno por canal —`meta`, `whatsapp`,
  `import`—, en vez de un solo `n8n`. El canal es del negocio: significa lo
  mismo si mañana cambiamos de herramienta. El endpoint rechaza que le manden
  `quiz` o `manual`.
- **`externalId`** es opcional. Con él, un reintento actualiza en vez de
  duplicar (se busca por tenant + externalId); sin él, el Lead entra igual —se
  prefirió aceptarlo a rechazarlo por falta de id—. Al actualizar no se tocan
  `stage` ni `status`.

La decisión de fondo quedó escrita en el **ADR 0007**, que supersede al 0002:
el tenant sale del host cuando la credencial es de un Tenant; una llave de
plataforma lo dice en el body, porque ahí el subdominio es ruteo y no
autorización.

Queda suelto, para quien tome el 12: como dice más abajo, el 13 y el 16 lo
declaran bloqueante y en los hechos ya no lo están.

- [x] `POST /api/leads/ingest` crea un Lead en el Tenant del `subdomain` que
      recibe, con la llave correcta en el header
- [x] Sin llave, con llave equivocada, o con la env var sin configurar en el
      servidor, no crea nada
- [x] El Lead nace en la primera etapa del Pipeline del Tenant, con status
      abierto, y queda distinguible de los del quiz por su `source`
- [x] Reintentar la misma petición no duplica el Lead
- [x] Acepta un lote, como el ingest de reportes, y dice fila por fila qué pasó
- [x] Un `subdomain` que no existe responde 404 sin crear nada

## Por qué se recortó

Lo que este issue decía antes era la fase *expand* de una API pública y
versionada en `{subdomain}.notoriovs.com/api/v1/*`: CRUD completo de Leads, dos
tipos de Actor, API Keys por Tenant guardadas hasheadas, pantalla para crearlas
y revocarlas. Nada de eso tiene hoy quien lo pida.

**No hay un tercero integrándose.** El único cliente máquina es nuestro propio
n8n, que actúa a nivel plataforma —lo que en el panel es un `superadmin`— y no
"como" un Tenant. Una API Key por Tenant existe para dársela a alguien de
afuera; mientras no haya afuera, es una colección, una pantalla, un hasheo y
una rotación que mantener sin usuario.

**El agujero que motivaba el ADR 0002 ya está tapado.** El ADR se escribió
contra `/api/tenant-dashboard/*?subdomain=xxx`, donde el cliente le dice al
servidor a qué Tenant pertenece. Pero desde el issue 09,
`resolveDashboardAuth` compara el `tenantId` de la sesión contra el del
subdominio y rechaza si no coinciden (`requireDashboardAuth.ts:47-51`): el
query param solo puede *achicar* el alcance, nunca ampliarlo. El párrafo del
ADR sigue siendo cierto en su parte importante —"en cuanto aparece una segunda
forma de autenticarse"—, y por eso este endpoint **no** es una segunda forma de
autenticarse contra las rutas del dashboard: vive aparte, con su propia llave,
y solo escribe.

**El `subdomain` en el body aquí no es una fuga.** La llave es una sola y de
plataforma: ya autoriza a todos los Tenants por definición, así que el
`subdomain` es ruteo, no autorización. La fuga que el ADR quiere evitar es
credencial-del-Tenant-A + Tenant-B-en-el-body; eso no puede pasar mientras no
existan credenciales por Tenant.

**Además ya creamos Leads así.** `/api/quiz-submit` recibe `subdomain` en el
body y crea el Lead **sin ninguna credencial**. Este endpoint agrega menos
superficie de la que ya está expuesta, y con llave.

## Lo que hay que decidir al implementarlo

- **`source`.** Hoy el select de `leads` solo tiene `quiz` y `manual`
  (`src/collections/Leads.ts:99`). Un lead de Meta Ads no es ninguno de los
  dos. Agregar una opción toca el enum en Postgres, o sea migración.
- **Idempotencia.** El ingest de reportes hace upsert por
  (tenant, semana, campaña). Para Leads el equivalente natural es un
  `externalId` que mande n8n (el id del lead en Meta): campo nuevo, misma
  migración.

## Qué pasa con el 12

El 12 era "el dashboard consume v1 y se retira lo viejo". Si no hay v1, se
queda sin destino a donde migrar y hay que repensarlo también: lo que le
quedaba de valor —confirmar que un Tenant User no alcanza datos de otro por
ninguna ruta— se cerró en el 09. El 13 y el 16 lo tienen como bloqueante; en
los hechos ya no lo están.
