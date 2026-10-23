# 28: El panel de Payload deja de servirse en los hosts de los Tenants

**Ola:** 2 (después de cobrar)

**What to build:** Hoy el middleware deja pasar `/admin` y la API de Payload en
**todos** los hosts, así que el panel interno está montado en el subdominio de
cada cliente. Nadie de fuera entra —`TenantUsers.access.admin` es falso y el
control de acceso de cada colección exige un Internal User—, pero la puerta no
tiene por qué estar ahí, y estando ahí falla feo: un Tenant User que se
autentique por `POST /api/tenant-users/login` (ruta que Payload expone sola
para toda colección auth) y luego abra `/admin` en el host de su tenant recibe
un **500**, no un redirect al login.

El 500 sale del `TenantSelectionProvider` del plugin multi-tenant, que lee
`tenants` con `overrideAccess: false` dentro del RootLayout del panel: contra
`Tenants.access.read: isInternalUser` eso es un Forbidden lanzado en el layout,
antes de que el panel alcance a correr `canAccessAdmin` y redirigir. Perseguir
ese caso dentro del panel es tapar el síntoma; lo que sobra es la puerta.

Superficie de ataque que se retira de 50+ hosts públicos: el login del panel,
el flujo de recuperación de contraseña, GraphQL y su playground, y la API REST
de todas las colecciones.

**Blocked by:** None (can start immediately)

**Status:** done — validado en local el 2026-10-22 contra el dev server:
en `acme.localhost:3000`, `/admin`, `/api/tenants`, `/api/graphql`,
`/api/users/login` responden 404; en `localhost:3000` siguen vivos; las rutas
propias (`/api/tenant-dashboard/*`, `/api/quiz-submit`) siguen respondiendo en el
host del Tenant. Falta desplegar (sin migración).

- [x] En el host de un Tenant, `/admin` y la API de Payload no existen: responden 404, no 500 ni un login
- [x] El panel sigue funcionando igual en el host donde vive hoy
- [x] Las rutas propias del Dashboard de Cliente (`/api/tenant-dashboard/*`) siguen respondiendo en el host del Tenant
- [x] El resto de rutas propias del producto (`/api/quiz-submit`, `/api/fb-event`, `/api/marketing-reports/ingest`) siguen respondiendo donde ya respondían
- [x] El Live Preview y los botones de preview del admin siguen abriendo el sitio del Tenant
- [x] Qué rutas viven en qué host se declara en un solo lugar y se puede afirmar en un test del middleware

## Notas

- **El corte no es "todo `/api`".** Bajo `/api` conviven dos cosas: las rutas
  propias del producto (`src/app/api/**`) y el catch-all de Payload
  (`src/app/(payload)/api/[...slug]`). Las primeras tienen que seguir vivas en
  el host del Tenant —el dashboard del cliente se cae sin ellas—; la segunda es
  la que sobra ahí. Hoy el middleware las trata igual, con un solo
  `pathname.startsWith('/api')`.
- Ojo con `RESERVED_SUBDOMAINS` en `src/utils/subdomain.ts` (`app`, `admin`) y
  con `ROOT_DOMAIN`: la decisión de "este host es el del panel" ya está medio
  escrita ahí y conviene que quede en un solo lugar.
- En desarrollo el panel y el sitio de un tenant se sirven desde el mismo
  puerto con distinto host (`localhost:3000` vs `acme.localhost:3000`), así que
  la regla se puede probar en local sin DNS.
- Esto **no** sustituye a `TenantUsers.access.admin: () => false` ni al
  `isInternalUser` de las colecciones. Es una capa más, por fuera: si mañana
  alguien afloja una de esas reglas, la puerta ni siquiera está montada.
- Sale de la verificación del issue 08. Ahí se cerró la parte grave (el panel
  llegaba a serializar `dashboardPassword` y `tracking.metaCapiToken` en el
  HTML del 500, arreglado con `auth.depth: 0`); esto es lo que quedó.

## Cómo quedó

- La regla vive en `src/middleware.ts` (`isPanelOnlyPath`): `/admin` y todo
  `/api` que no sea una ruta propia declarada ahí da 404 en el host de un
  Tenant. Las rutas propias van por ruta exacta, no por prefijo, porque
  `leads` y `marketing-reports` también son colecciones de Payload.
- Excepción: `/api/media/file/*` sigue sirviéndose en el host del Tenant. Es por
  donde sale el Media sin blob (desarrollo, carpeta `media/`); en producción la
  `url` ya apunta al CDN. Media es pública.
- `tests/int/middleware.int.spec.ts` recorre `src/app/api/**/route.ts`: una ruta
  propia nueva que no se declare en el middleware rompe la prueba en vez de dar
  404 en producción.
- De paso: `/administracion` (una página de Tenant que empieza con "admin") ya
  no se confunde con el panel; antes se comparaba con `startsWith('/admin')`.
