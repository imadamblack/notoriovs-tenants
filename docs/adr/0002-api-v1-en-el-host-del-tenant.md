# El tenant de una petición se deriva del host, nunca de un parámetro

> **Superada por el ADR 0007.** Esta API nunca se construyó. La regla sigue
> valiendo para la credencial de un Tenant; para una llave de plataforma, no.

Toda la API del producto vive en `{subdomain}.notoriovs.com/api/v1/*`. Esa
ruta acepta **dos** tipos de Actor —una sesión de navegador de un Tenant User
y una API Key de máquina— pero el `tenantId` se resuelve **siempre desde el
host de la petición** y jamás desde el body o el query string. Un único
`resolveActor(req)` es el único lugar del código que lee credenciales.

Reemplaza el esquema anterior, en el que `/api/tenant-dashboard/*` recibía el
subdominio como query param (`?subdomain=xxx`): ahí el cliente le dice al
servidor a qué tenant pertenece, que es exactamente el patrón que produce
fugas entre tenants en cuanto aparece una segunda forma de autenticarse.
El host, en cambio, no lo puede falsificar el navegador.

## Consecuencias

- `src/middleware.ts` ya no puede dejar pasar `/api/*` sin tocar: el host
  tiene que llegar a la ruta.
- Payload sirve un catch-all en `/api/[...slug]`; `/api/v1/*` gana por ser
  segmento estático, pero hay que confirmarlo en el build.
- Las API Keys se guardan **hasheadas**. El esquema anterior guardaba la
  contraseña del dashboard en texto plano en `tenants.dashboardPassword`
  (campo ya retirado); eso no se repite.
