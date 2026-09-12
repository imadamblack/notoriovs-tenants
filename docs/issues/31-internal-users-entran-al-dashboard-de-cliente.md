# 31: Un Internal User entra al Dashboard de un cliente

**What to build:** Desde el panel, una persona de Notoriovs abre el Dashboard de
Cliente de un Tenant y lo ve como lo ve el cliente, sin pedirle su contraseña a
nadie y sin crearse un Tenant User de mentiras. Un `superadmin` puede entrar al
de cualquier Tenant; un `account-manager`, solo al de los Tenants que tiene
asignados — el mismo recorte que ya rige el panel (issue 09), aplicado ahora a
la otra aplicación.

Hoy no hay forma: el dashboard tiene una sola puerta y es la sesión de Tenant
User (issue 09, epílogo). Para dar soporte —"no me aparece el lead que entró
ayer"— el equipo tiene que pedirle la pantalla al cliente o inventarse un
usuario dentro de su Tenant, que además le llega en la lista de usuarios.

**Síntoma con el que se destapó:** un superadmin intenta entrar al dashboard de
un cliente con su email y contraseña del panel y recibe `Email o contraseña
incorrectos`. No es un bug ni una contraseña mal escrita: `/api/tenant-dashboard/login`
valida contra la colección `tenant-users` y un Internal User vive en `users`
(ADR 0001), así que no existe para esa puerta. El mensaje es el mismo a
propósito, para no delatar qué cuentas existen en qué subdominio. Esto **no** lo
arregla el issue 28, que va del lado contrario —sacar el panel de los hosts de
los clientes—; lo arregla este.

**Blocked by:** 09 (roles y scope de Tenants). Conviene coordinar con 28 (el
panel solo en su propio host): el salto entre hosts que este issue construye es
justo lo que 28 vuelve obligatorio, y las dos reglas de host tienen que quedar
declaradas en el mismo lugar del middleware.

**Status:** ready-for-agent

- [ ] Un `superadmin` abre desde el panel el dashboard de cualquier Tenant y ve sus Leads y sus KPIs
- [ ] Un `account-manager` puede hacerlo con un Tenant asignado, y con uno no asignado no entra (ni desde el panel ni tecleando la URL a mano)
- [ ] Quitarle a un `account-manager` un Tenant asignado lo saca del dashboard de ese Tenant de inmediato, sin esperar a que expire nada
- [ ] Estando dentro, hace todo lo que hace un `owner` —incluido borrar Leads y gestionar Usuarios de Cliente— salvo tocar la facturación
- [ ] Estando dentro, la pantalla dice de forma visible de qué cliente es el dashboard y que se está viendo como equipo de Notoriovs
- [ ] La sesión interna no se puede reusar para otro Tenant: llevarse el token o la cookie al host de otro cliente no entra
- [ ] Un Tenant User no gana nada con esto: sus permisos y su alcance quedan igual que hoy
- [ ] Salir devuelve al panel y no deja viva la sesión del dashboard

## Notas

### El problema real es el salto entre hosts, no el permiso

El permiso ya está resuelto: `isSuperadminUser` y `assignedTenantIds`
(`src/access/internalRoles.ts`) contestan quién puede entrar a qué Tenant. Lo
que no existe es cómo viaja esa sesión.

El panel vive en su host y el dashboard en `{subdomain}.notoriovs.com`. Las dos
cookies son host-only y a propósito tienen nombres distintos
(`payload-token` vs `notoriovs-tenant-token`, ver la nota larga en
`src/utils/tenantUserAuth.ts`): la del panel no llega al subdominio del cliente.
Y con el issue 28 la API de Payload deja de servirse ahí, así que el host del
Tenant tampoco va a poder preguntarle a Payload quién es el de la cookie del
panel.

La forma que encaja con lo que ya hay es un **traspaso explícito**: el panel
emite un ticket de un solo uso y vida corta, acotado a un Tenant y a un Internal
User, el navegador aterriza con él en el host del Tenant, y una ruta propia
(`/api/tenant-dashboard/*`, que sí sigue viviendo ahí) lo canjea por la cookie
de sesión de ese host. Sirve, de paso, para dejar el evento registrado: quién
entró, a qué cliente y cuándo.

### Autorizar dos veces, y en cada petición

El ticket dice a qué Tenant se emitió, pero quien manda es el host, igual que
para un Tenant User: `resolveDashboardAuth` compara contra el Tenant del
subdominio y no contra lo que traiga el cliente (ADR 0007, que supersede al 0002). Un ticket del
Tenant A presentado en el host del Tenant B no es un error de validación
elegante: no coincide y se acabó.

Y la asignación se vuelve a leer **en cada petición**, contra el documento vivo
del Internal User, no solo al emitir el ticket. Es lo mismo que ya hace
`getTenantUserSession` al verificar el JWT contra el usuario y su `sid`: si a un
account manager le quitan un cliente, o lo degradan, o lo borran, la sesión
abierta deja de valer sin esperar a que expire una cookie.

### Qué puede hacer ahí dentro (decidido)

Una sesión interna puede **todo lo que puede un `owner`, menos `billing:manage`**:
lee y edita Leads, los borra, ve los KPIs completos y gestiona los Usuarios de
Cliente de ese Tenant. La suscripción y la tarjeta son del cliente y nadie de
Notoriovs las mueve desde ahí; si algún día hace falta, se decide aparte y con
su propio rastro.

No hay diferencia entre `superadmin` y `account-manager` dentro del dashboard:
el rol interno decide **a qué clientes entra**, no qué hace una vez adentro. Un
account manager dentro de un Tenant asignado es tan capaz como el superadmin.

En el código, `DashboardSession` vuelve a ser una unión —un Tenant User o un
Internal User—, justo lo que el epílogo del 09 acababa de simplificar. Vale la
pena: son dos poblaciones distintas (ADR 0001) y meter al equipo interno en la
tabla de roles del cliente es exactamente el error que ese ADR evita. La tabla
de permisos interna vive aparte de `PERMISSIONS`, y `sessionCan` sigue siendo el
único lugar donde una ruta pregunta si la sesión puede algo.

### Detalles que muerden

- **Dos sesiones en el mismo navegador.** Si la cookie interna se llama igual
  que la del cliente, entrar a dar soporte le pisa la sesión a quien tenga el
  dashboard abierto en esa misma máquina (el caso normal en dev). Cookie con
  nombre propio, y un orden de resolución declarado.
- **Tenant inactivo.** Un Tenant inactivo le cierra el dashboard a sus Tenant
  Users (ver CONTEXT.md). Al equipo interno no debería cerrárselo: entrar a ver
  qué pasó es justo lo que se hace cuando un cliente se cae. Decidirlo aquí y
  dejarlo escrito.
- **Ojo con lo que se proyecta.** `getTenantBySubdomain(..., 'dashboardApi')`
  es la proyección que hoy alimenta al dashboard; que la sesión sea interna no
  es motivo para ampliarla. Los tokens del Tenant (`tracking.metaCapiToken`) no
  tienen por qué viajar a una página, y ese fue un hallazgo real del 09.

### Pruebas

Este issue cae de lleno en dos de las tres áreas que este repo sí prueba
(CLAUDE.md): autorización del dashboard y aislamiento entre tenants. Como
mínimo: account manager sin asignación no entra, ticket de un Tenant no sirve
en el host de otro, y la asignación revocada corta la sesión viva.
