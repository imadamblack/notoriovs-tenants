# 09: Roles y scope de Tenants

**What to build:** Cada población gana sus roles. Del lado del cliente, `owner`
(ve todo lo de su Tenant, gestiona usuarios y facturación) y `member` (ve y edita
Leads y KPIs, incluido el gasto en anuncios, pero no borra Leads ni gestiona
usuarios). Del lado interno, `superadmin` (todos los Tenants) y `account-manager`
(solo los Tenants que tiene asignados). Esto último exige dejar de dar acceso
irrestricto a todos los Tenants a todo Internal User.

**Blocked by:** 08 (Tenant Users con login real)

**Status:** CERRADO. Desplegado el 2026-09-09, con las dos migraciones
aplicadas: la de roles y la que retira la contraseña compartida.

La de roles (`20260909_050114_roles_y_scope`) había entrado antes, el
2026-09-08, así que durante esos días producción corrió el código viejo contra
el esquema nuevo. Ese es el orden seguro para una migración que AGREGA
columnas: las `role` son NOT NULL y el código viejo simplemente las ignora. Al
revés —código nuevo contra esquema viejo— el panel truena entero.

Verificado en el navegador contra la base local (dashboard con sesiones `owner`
y `member`, panel con sesiones `superadmin` y `account-manager`) y con
`npm test`.

Nota de operación: `npm run prod -- npm run migrate` **no aplicó nada y no
imprimió nada** en la máquina de Adam; el CLI de Payload se traga los errores en
los comandos de migración. La migración entró con `npm run prod -- npm run
migrate:debug`, que existe justo para eso (ver el runbook de bases de datos).
Por qué el CLI falla ahí y no en otra shell, sigue sin saberse.

- [x] Un `member` puede marcar un Lead como descalificado pero no borrarlo
- [x] Un `member` ve los KPIs de gasto de anuncios
- [x] Un `member` no puede invitar ni remover usuarios
- [x] Un `account-manager` solo ve en el panel los Tenants que tiene asignados, y sus Leads y Marketing Reports
- [x] Un `superadmin` sigue viendo todo
- [x] Un `account-manager` no puede borrar Tenants

## Cómo quedó

Dos juegos de roles independientes, uno por colección de auth (ADR 0001):
`superadmin` / `account-manager` en `users`, `owner` / `member` en
`tenant-users`. La migración rellena a los que ya existen: los Internal User
quedan `superadmin` (hoy todos administran a todos, degradarlos los dejaría sin
ver un solo cliente) y los Tenant User quedan `owner`.

El recorte por cliente lo aplica `multiTenantPlugin`, al que ahora se le pasa
`userHasAccessToAllTenants: isSuperadminUser`: le agrega en AND un `tenant in
[asignados]` a todas las reglas de acceso de `leads` y `marketing-reports`, y un
`id in [asignados]` a `tenants` y a los usuarios internos. Vale también por REST,
no solo en las listas del panel.

Del lado del cliente, `src/access/tenantUserPermissions.ts` es la tabla de
permisos y `sessionCan` el único lugar donde una ruta pregunta si la sesión
puede algo.

### Lo que se hizo además, porque el issue lo destapó

- **`tenants`, `users` y `media` no tenían reglas de escritura.** Payload
  permite por omisión cualquier operación a cualquiera con sesión, y desde el
  issue 08 eso incluye a un Tenant User: con la cookie de su dashboard se podía
  borrar el Tenant de otro cliente, subir archivos al blob o —lo peor— crear un
  Internal User y entrar al panel. Ahora las tres son internas.
- **Escalación de privilegios por el propio perfil.** Payload deja que
  cualquiera edite su propio documento, así que un account manager podía
  ponerse `superadmin` o asignarse clientes. `role` y `tenants` tienen acceso de
  campo restringido a superadmin.
- **El widget de Tenants del panel leía con la Local API**, que salta el control
  de acceso: le mostraba la lista completa de clientes a un account manager con
  el resto del panel ya acotado. Ahora consulta con el usuario de la petición.
- **`GET /api/users/me` devolvía el Tenant completo** —`dashboardPassword` y
  `tracking.metaCapiToken` incluidos— dentro de `user.tenants`, porque el campo
  se resolvía con el `depth` por omisión. Era inofensivo mientras nadie tuviera
  asignaciones; este issue es justo el que empieza a llenarlas. `users.auth` va
  con `depth: 0`, igual que `tenant-users`.

### Lo que NO se hizo

Gestionar usuarios desde el Dashboard de Cliente (invitar y remover) no existe
todavía: llega con el issue 10, que trae los correos de invitación. El permiso
`users:manage` ya está definido y es de `owner`; la pantalla que lo use tiene
que preguntarlo con `sessionCan`.

La contraseña compartida del tenant contaba como `owner` mientras siguiera
viva: es una sola credencial que abría todo el dashboard, y recortarla les
habría quitado capacidades a los clientes sin migrar. **Ya no aplica:** solo
quedaba un tenant con contraseña en producción, se le creó su usuario `owner`,
se vació el campo y acto seguido se retiró la contraseña compartida entera (ver
"Epílogo"). El dashboard tiene una sola puerta.

## Epílogo: se retiró la contraseña compartida

Con un solo tenant usándola, el bloqueo que justificaba esperar al issue 10
(invitar clientes por correo, a escala) no existía. Se hizo en orden:

1. Usuario `owner` creado para ese cliente, y verificado que entra con su email.
2. Campo `dashboardPassword` vaciado desde el panel. Eso cerró la puerta al
   instante, sin desplegar nada y de forma reversible.
3. Este cambio: se va el campo, su columna, `src/utils/dashboardAuth.ts`
   (la cookie HMAC propia), la rama compartida de `resolveDashboardAuth` y de
   `/api/tenant-dashboard/login`, `tenantHasSharedPassword` y la proyección
   `dashboardLogin`. `DashboardSession` deja de ser una unión y `sessionRole`
   desaparece: el rol sale del usuario, sin caso especial.

**Orden de despliegue, al revés que en este issue.** Las migraciones del 08 y
el 09 AGREGABAN columnas, así que se podían aplicar antes de desplegar. Esta
BORRA una que el código viejo pide en el `select` de `dashboardLogin`:
aplicarla primero tumba el login del dashboard. Primero el código, después
`20260909_101800_retirar_contrasena_compartida`.

Esto adelanta uno de los entregables del issue 12, que ya no tiene que
ocuparse de ello.
