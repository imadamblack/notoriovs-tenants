# 06: Filtro de periodo en los KPIs, resuelto en la base

**What to build:** El filtro de periodo que ya existe en el listado de Leads pasa
a aplicar también a los KPIs. Los KPIs derivados de Leads respetan el rango
elegido; los de marketing muestran semanas completas con su propio rango
etiquetado a la vista, porque un Marketing Report semanal partido a la mitad
daría números que no cuadran con la plataforma de anuncios. De paso, los conteos
se resuelven agregando en la base en vez de traer todos los Leads del Tenant a
memoria.

**Blocked by:** None (can start immediately)

**Status:** hecho en `dev`, sin desplegar

- [x] El filtro de periodo ofrece presets y afecta los KPIs derivados de Leads
- [x] La sección de marketing muestra el rango real de semanas completas que está representando
- [x] Los conteos por Stage y por Status se calculan agregando en la base, sin traer filas
- [x] Con cero Leads en el rango, la vista pinta los ceros reales más un aviso del porqué (se decidió sobre la marcha: un cero es un dato, esconderlo obliga a adivinar si la vista está vacía o rota)
- [x] Los números coinciden con los del listado de Leads bajo el mismo filtro

Hecho en `feat/periodo-en-kpis-y-conteos-agregados` (3 commits). El periodo
subió a `DashboardApp` y lo comparten las dos pestañas; la aritmética de
fechas vive en `src/utils/dashboardPeriod.ts`, con 16 tests. La ruta de KPIs
resuelve todo con `payload.count()` y se le cayó el `limit: 5000`.

Dos cosas salieron del uso, ya arregladas: el reporte se repintaba entero en
cada recarga (ahora `refreshing` deja los números viejos hasta que llegan los
nuevos, con guard de respuestas fuera de orden), y un KPI en cero se escondía
detrás de un estado vacío en vez de pintarse como cero.

Pendiente: verificar los números contra datos reales. No se pudo hacer en
local (hace falta sesión de tenant y acceso a la base de Neon).
