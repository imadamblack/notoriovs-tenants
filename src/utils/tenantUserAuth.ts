import {
  createLocalReq,
  getPayload,
  JWTAuthentication,
  logoutOperation,
  parseCookies,
  type Payload,
} from 'payload'
import config from '@payload-config'

// Sesión de Tenant User: la auth de verdad del Dashboard de Cliente, con su
// propia colección (`tenant-users`) y el JWT firmado de Payload. Convive con
// la contraseña compartida por tenant (src/utils/dashboardAuth.ts) mientras
// dura la migración; quien decide cuál de las dos vale en cada petición es
// `requireDashboardTenant`.
//
// El token ES el JWT de Payload —así la sesión pasa por la maquinaria que ya
// trae la colección: se verifica contra el documento del usuario en cada
// petición (`findByID`) y, con `useSessions`, el `sid` del token tiene que
// seguir en el arreglo `sessions`. Borrar un Tenant User o cerrarle la sesión
// lo saca de inmediato, cosa que una cookie firmada y autocontenida no
// permite.
//
// Lo que NO se comparte con el panel es la cookie. El token viaja en
// `notoriovs-tenant-token` y se le entrega a Payload por cabecera
// (`Authorization: JWT ...`), nunca en la cookie `payload-token` que lee el
// admin. Cuando compartían nombre, bastaba con abrir el dashboard y el panel
// en el mismo host —lo normal en dev, vía localhost:3000/tenant-site/{sub}—
// para que /admin autenticara la petición como Tenant User y se cayera
// entero: el TenantSelectionProvider del plugin multi-tenant lista `tenants`
// con `overrideAccess: false` dentro del RootLayout, y contra el
// `isInternalUser` de esa colección eso es un Forbidden lanzado en el layout,
// antes de que el panel alcance a redirigir al login.
//
// La cookie es además host-only y el dashboard de cada tenant vive en su
// propio subdominio, así que la del cliente A nunca viaja al host del cliente
// B. Y `TenantUsers.access.admin` sigue en falso como última puerta.

export const TENANT_USERS_SLUG = 'tenant-users'

export type TenantUserSession = {
  id: string | number
  email: string
  /** Id del tenant al que pertenece, ya normalizado a valor plano. */
  tenantId: string | number | null
}

/** `tenant` llega como id o como documento poblado según el `depth` de la colección. */
function toTenantId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

/**
 * Nombre propio, deliberadamente distinto de `${cookiePrefix}-token`: ver la
 * nota de arriba. Payload nunca lee esta cookie; se la pasamos a mano.
 */
export const TENANT_USER_COOKIE_NAME = 'notoriovs-tenant-token'

/**
 * Le presenta a Payload el token de ESTA cookie y nada más. Si el navegador
 * trae además una sesión del panel (`payload-token`), aquí no cuenta.
 */
function tenantUserAuthHeaders(headers: Headers): Headers | null {
  const token = parseCookies(headers).get(TENANT_USER_COOKIE_NAME)
  if (!token) return null

  return new Headers({ Authorization: `JWT ${token}` })
}

/** Cuánto vive la cookie, tomado de la propia colección para no duplicar el número. */
export function tenantUserCookieMaxAge(payload: Payload): number {
  return payload.collections[TENANT_USERS_SLUG].config.auth.tokenExpiration
}

/**
 * Resuelve la sesión de Tenant User que traiga la petición, o `null`. Un token
 * de la colección interna (`users`) NO cuenta: son dos poblaciones distintas y
 * el dashboard es de una sola de ellas.
 */
export async function getTenantUserSession(headers: Headers): Promise<TenantUserSession | null> {
  const authHeaders = tenantUserAuthHeaders(headers)
  if (!authHeaders) return null

  const payload = await getPayload({ config })
  // `JWTAuthentication` en vez de `payload.auth`: hace exactamente la
  // verificación que hace falta (firma + usuario vivo + sesión vigente) sin
  // calcular además el árbol de permisos de todas las colecciones, que este
  // dashboard no consulta nunca.
  const { user } = await JWTAuthentication({ headers: authHeaders, payload })

  if (!user || user.collection !== TENANT_USERS_SLUG) return null

  return {
    id: user.id,
    email: String((user as { email?: unknown }).email ?? ''),
    tenantId: toTenantId((user as { tenant?: unknown }).tenant),
  }
}

export type TenantUserLogin = {
  session: TenantUserSession
  token: string
}

/**
 * Valida email + contraseña contra la colección de Tenant Users. Devuelve
 * `null` cuando las credenciales no sirven (usuario inexistente, contraseña
 * mala o cuenta bloqueada por intentos): quien llama responde lo mismo en los
 * tres casos, para no confirmarle a nadie qué emails existen.
 */
export async function loginTenantUser(email: string, password: string): Promise<TenantUserLogin | null> {
  const payload = await getPayload({ config })

  try {
    const { user, token } = await payload.login({
      collection: TENANT_USERS_SLUG,
      data: { email, password },
    })

    if (!token || !user) return null

    return {
      token,
      session: {
        id: user.id,
        email: String((user as { email?: unknown }).email ?? ''),
        tenantId: toTenantId((user as { tenant?: unknown }).tenant),
      },
    }
  } catch {
    return null
  }
}

/**
 * Cierra la sesión de Tenant User del lado del servidor: saca el `sid` de este
 * navegador del arreglo `sessions` del usuario, para que el token que ya salió
 * deje de valer aunque alguien se lo hubiera copiado. Borrar la cookie es
 * trabajo de la ruta que llama a esto.
 */
export async function logoutTenantUser(headers: Headers): Promise<void> {
  const authHeaders = tenantUserAuthHeaders(headers)
  if (!authHeaders) return

  const payload = await getPayload({ config })
  const { user } = await JWTAuthentication({ headers: authHeaders, payload })

  if (!user || user.collection !== TENANT_USERS_SLUG) return

  try {
    const req = await createLocalReq({ user }, payload)
    await logoutOperation({ collection: payload.collections[TENANT_USERS_SLUG], req })
  } catch (err) {
    // Si la invalidación falla, la ruta igual borra la cookie: el usuario
    // queda fuera aunque el `sid` sobreviva hasta que expire.
    payload.logger.warn(`No se pudo invalidar la sesión del tenant user ${user.id}: ${err}`)
  }
}
