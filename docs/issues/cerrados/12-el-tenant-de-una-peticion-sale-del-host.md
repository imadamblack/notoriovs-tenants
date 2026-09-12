# 12: El tenant de una petición del dashboard sale del host

**What to build:** Las rutas `/api/tenant-dashboard/*` dejan de recibir el
subdominio del cliente —hoy va en el query string o en el body— y lo derivan
del `Host` de la petición, que el navegador no puede falsificar. Es lo único
que quedó vivo de este issue.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Ninguna ruta de `/api/tenant-dashboard/*` **que exija sesión** lee el
      subdominio de un parámetro que mande el cliente. Las tres pre-credencial
      (`login`, `forgot-password`, `reset-password`) lo conservan a propósito,
      para dejar abierta una entrada única de login — decidido y anotado en el
      ADR 0007, con su precio.
- [x] El dashboard sigue funcionando igual: Kanban, listado, detalle, edición,
      KPIs y el panel de equipo
- [x] Los componentes del dashboard dejan de arrastrar el `subdomain` solo para
      pasárselo a un `fetch`
- [x] La cookie firmada a mano y el campo de contraseña compartida desaparecen
      del código y del esquema (hecho en el 09)
- [x] Ya no es posible entrar al dashboard sin ser un Tenant User (hecho en el 09)
- [x] Confirmado que un Tenant User no alcanza datos de otro Tenant por ninguna
      ruta (hecho en el 09: la sesión y el host tienen que coincidir)

## Qué era antes este issue

Era la fase *contract* de la API v1: "el dashboard consume v1 y los endpoints
viejos se eliminan". El 11 se recortó y ya no construye v1 (ver ese issue), así
que migrar a v1 se quedó sin destino y retirar "lo viejo" sin reemplazo. De los
seis entregables originales, tres se cerraron en el 09 y tres desaparecieron
con v1.

Lo que sobrevive es el hábito que el ADR 0002 quería quitar: que el cliente le
diga al servidor a qué tenant pertenece. Hoy **no es un agujero** —
`resolveDashboardAuth` compara el `tenantId` de la sesión contra el del
subdominio y rechaza si no coinciden (`requireDashboardAuth.ts:47`), así que
el parámetro solo puede achicar el alcance— pero es un parámetro que no hace
falta, y mientras exista la regla de "el tenant sale del host" tiene una
excepción que alguien puede copiar al escribir la siguiente ruta.

## Dónde está

Seis lecturas en cuatro archivos de ruta:

- `leads/route.ts:43` (GET, query), `:131` (PATCH, body), `:192` (DELETE, query)
- `leads/counts/route.ts:16`, `kpis/route.ts:33` (query)
- `users/route.ts:24` (GET, query) y `:43` (POST, body)

El cambio de fondo cabe en `resolveDashboardAuth`: que lea el host y resuelva
el subdominio con `getSubdomainFromHost`, en vez de recibirlo como argumento.
Las rutas dejan de pasárselo y del lado del cliente se van los `?subdomain=` de
`KanbanBoard.tsx`, `DashboardApp.tsx` y `TeamPanel.tsx`.

**El middleware no estorba.** La consecuencia que el ADR 0002 anticipaba —"el
middleware ya no puede dejar pasar `/api/*` sin tocar: el host tiene que llegar
a la ruta"— no aplica: un route handler de Next lee el `Host` de su propia
petición, sin que el middleware tenga que reenviárselo. `middleware.ts:18`
puede seguir devolviendo `next()` para `/api/*` tal cual.

## Lo que cambia en desarrollo

Abrir el dashboard en `localhost:3000/tenant-site/{sub}/dashboard` deja de
funcionar: sin subdominio en el host no hay tenant y las llamadas responden
401. Hay que entrar por `{sub}.localhost:3000/dashboard`, que
`getSubdomainFromHost` ya resuelve. Vale la pena decirlo en el README si no
está.
