# 14: Exportar Leads a CSV

**What to build:** Un Tenant User descarga en CSV los Leads que está viendo, con
las respuestas del quiz incluidas, para trabajarlos fuera del dashboard. Como es
la principal vía de salida masiva de datos personales, cada exportación queda
registrada.

**Blocked by:** None (can start immediately)

**Status:** IMPLEMENTADO en `dev` (2026-09-10).

- [x] Exporta exactamente los Leads que los filtros activos están mostrando, no todo el Tenant
- [x] Incluye los campos fijos del Lead más una columna por pregunta del quiz, usando el orden y los encabezados del quiz de ese Tenant
- [x] El archivo abre en Excel en español con los acentos correctos
- [x] Cada exportación queda registrada: quién, cuándo, cuántos Leads y con qué filtros
- [x] Un Tenant User no puede exportar Leads de otro Tenant

## Notas de implementación

- **`GET /api/tenant-dashboard/leads/export`**, junto al resto de las rutas del
  dashboard y con el mismo molde: el Tenant sale del host (ADR 0002), la sesión
  tiene que ser de ese Tenant, y la consulta se scopea a mano con
  `overrideAccess: true`. No hay ningún parámetro con el que el cliente pueda
  nombrar otro Tenant.
- **Un solo lugar traduce los filtros a una consulta.** Se extrajo
  `buildLeadsWhere` a `leadDashboardFilters.ts` y ahora lo comparten el listado,
  los conteos del Kanban y la exportación. Es lo que hace cierto el primer
  criterio: no son "los mismos filtros" por disciplina, son literalmente la
  misma función. Dos lecturas separadas se habrían despegado con el tiempo.
- **La etapa es lo único que se descarta.** En el Kanban están abiertas todas
  las columnas a la vez, así que "lo que estoy viendo" es el tablero completo,
  no la columna que se tuviera al frente.
- **El formato es el que espera Excel en español, no el de la especificación:**
  separador `;` (el "separador de listas" en es-MX y es-ES; con comas, un Excel
  en español mete el renglón entero en la columna A), BOM UTF-8 al inicio (sin
  él lee ANSI y "Martínez" sale como "MartÃ­nez") y fin de línea CRLF. Nada de
  esto le estorba a Google Sheets ni a un import a un CRM, que detectan las tres
  cosas solas.
- **Un texto que empieza con `=`, `+`, `-` o `@` se neutraliza** con un
  apóstrofo. Las respuestas del quiz las escribe el lead, así que ese contenido
  viene de afuera, y Excel ejecutaría la fórmula al abrir el archivo.
- **Los encabezados salen del quiz del Tenant**, con el título de cada pregunta
  limpio de HTML (`quizSteps.title` admite HTML simple, y un `<br>` dentro de
  una celda no es un encabezado). Las respuestas de opción se traducen del
  `value` guardado a la etiqueta que el lead vio: nadie quiere leer
  `2-recamaras` en su hoja de cálculo.
- **Se pagina de 500 en 500 escribiendo a un stream**, en vez de juntar el
  archivo entero en memoria: un Tenant con decenas de miles de Leads tiene que
  poder exportar sin tumbar la función.
- **La bitácora es la colección `lead-exports`** (migración
  `20260910_224316_exportar_leads_csv`), con `create`/`update`/`delete` en
  `false`: se escribe solo desde la ruta, y desde el panel no se corrige ni se
  borra. Una bitácora que el interesado puede reescribir no responde nada.
- **Se registra la petición, no la entrega.** Si la descarga se corta a la
  mitad, los datos ya salieron igual; una bitácora que solo anota las descargas
  completas es una bitácora con huecos.
- **El botón vive en la barra del Kanban y se esconde en móvil.** El `hidden` va
  en un `<div>` contenedor y no en el `<Button>`: el reset del dashboard trae un
  `.dashboard-root button { display: flex }` que le gana en especificidad a la
  clase `.hidden` de Tailwind. Puesta en el botón, no lo esconde — y falla en
  silencio.
- **El `down` de la migración está editado a mano.** El generador lo dejaba
  dropeando `lead_exports` con `CASCADE` y acto seguido dropeando por su nombre
  una llave foránea que ese mismo `CASCADE` ya se había llevado, así que
  revertir tronaba a la mitad. Está anotado en el archivo.

## Lo que se verificó

Contra la base de desarrollo y el dashboard real del tenant `ntrs`, con un
Tenant User desechable creado y borrado al final (y las filas de bitácora que
generó, borradas también):

- sin sesión, con la sesión de otro Tenant, y en un host sin subdominio: 401 en
  los tres casos, sin llegar siquiera a consultar Leads;
- descarga con `status=won&since=3m`: 2 Leads de 51, o sea el filtro aplicado;
- el archivo abrió con los acentos correctos, con una columna por pregunta del
  quiz de `ntrs` y las etapas y resultados en palabras;
- la bitácora quedó con el correo de quien descargó, el conteo (2, y 51 en la
  descarga sin filtros) y los filtros en texto legible;
- desde la interfaz: el botón dispara la petición y responde 200, sin errores en
  consola;
- a 375px el botón no se pinta; a 1280px sí.

La migración se aplicó sobre una base desechable creada para eso —`up`, `down` y
`up` otra vez— en vez de con `npm run db:reset`, que habría tirado los 51 Leads
de la base de desarrollo.

`npm run lint` sin errores y `npm test` en 78/78, con un archivo nuevo
(`tests/int/leadsExport.int.spec.ts`): cae en dos de las tres áreas del
CLAUDE.md, autorización y aislamiento entre Tenants.

## Lo que queda fuera

- **El orden del toolbar no se respeta.** El archivo siempre sale por fecha de
  alta descendente. En una hoja de cálculo reordenar una columna es un clic, y
  un orden fijo hace que dos exportaciones seguidas se puedan comparar.
- **La columna "Otras respuestas" casi siempre va vacía.** Recoge lo que quedó
  en `answers` sin pregunta que lo reclame: preguntas renombradas o borradas del
  quiz después de que ese Lead lo contestara. Es una columna de ruido para un
  Tenant con el quiz limpio, y es el precio de que cambiar el quiz nunca haga
  desaparecer en silencio lo que alguien contestó. En los datos reales de `ntrs`
  sí trae cosas (`city`, `state`, `list` de una importación vieja).
- **Las fechas van en hora de la Ciudad de México, fija.** El Tenant no guarda
  zona horaria en ningún lado. El día que haya un cliente en otro huso, eso
  tendrá que salir del Tenant.
- **La bitácora no se ve desde el Dashboard de Cliente**, solo desde el panel de
  Payload. Un Owner no puede auditar hoy quién de su equipo exportó qué; se
  responde preguntándonos a nosotros.
- **No hay límite ni control de frecuencia.** Un Tenant User puede descargar
  todos sus Leads las veces que quiera. Lo que hay es el registro de que lo
  hizo.
