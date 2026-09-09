import type { NextRequest } from 'next/server'
import { getTenantBySubdomain, tenantHasSharedPassword, type TenantView } from '@/utils/getTenant'
import { verifyDashboardToken, DASHBOARD_COOKIE_NAME } from '@/utils/dashboardAuth'
import { getTenantUserSession } from '@/utils/tenantUserAuth'

/**
 * Cómo entró quien está viendo el dashboard. Hoy hay dos puertas abiertas a la
 * vez: la contraseña compartida por tenant (la de siempre) y el Tenant User con
 * email y contraseña propios. La compartida se retira cuando todos los clientes
 * estén migrados; hasta entonces las dos dan exactamente el mismo acceso, y lo
 * único que cambia es de quién sabemos el nombre.
 */
export type DashboardSession =
  | { kind: 'tenant-user'; userId: string | number; email: string }
  | { kind: 'shared-password' }

export type DashboardAuth = {
  tenant: TenantView<'dashboardApi'>
  session: DashboardSession
}

/**
 * Autoriza una petición al dashboard de `subdomain` y devuelve el tenant ya
 * proyectado a lo que usan esas rutas (`id` para scopear la query a `leads`,
 * más pipeline y corte de "estancado") junto con la sesión que la autorizó.
 * `null` si no cuadra: quien llama responde 401/404 sin filtrar información.
 *
 * El tenant SIEMPRE sale del subdominio de la petición, nunca de la sesión: un
 * Tenant User de otro cliente no entra aquí porque su `tenantId` no coincide
 * con el del host, y una cookie compartida de otro tenant tampoco porque el
 * subdominio va firmado dentro del token.
 */
export async function resolveDashboardAuth(
  headers: Headers,
  sharedToken: string | undefined | null,
  subdomain: string | null | undefined,
): Promise<DashboardAuth | null> {
  if (!subdomain) return null

  const normalized = subdomain.toLowerCase()
  const tenant = await getTenantBySubdomain(normalized, 'dashboardApi')
  if (!tenant) return null

  const tenantUser = await getTenantUserSession(headers)
  if (tenantUser && tenantUser.tenantId !== null && String(tenantUser.tenantId) === String(tenant.id)) {
    return { tenant, session: { kind: 'tenant-user', userId: tenantUser.id, email: tenantUser.email } }
  }

  // La contraseña compartida solo sigue valiendo mientras el tenant tenga una
  // configurada: vaciarla en el admin corta esa puerta sin tocar a los Tenant
  // Users, que es justo como se termina la migración cliente por cliente.
  // Primero la firma (puro HMAC, sin base de datos) y solo si pasa se
  // pregunta si la puerta sigue abierta: una cookie inventada no cuesta una
  // consulta, y una sesión de Tenant User no cuesta ninguna de las dos.
  if (verifyDashboardToken(sharedToken, normalized) && (await tenantHasSharedPassword(normalized))) {
    return { tenant, session: { kind: 'shared-password' } }
  }

  return null
}

/**
 * La misma autorización, servida a las rutas /api/tenant-dashboard/*, que solo
 * necesitan el tenant.
 */
export async function requireDashboardTenant(
  req: NextRequest,
  subdomain: string | null | undefined,
): Promise<TenantView<'dashboardApi'> | null> {
  const auth = await resolveDashboardAuth(
    req.headers,
    req.cookies.get(DASHBOARD_COOKIE_NAME)?.value,
    subdomain,
  )

  return auth?.tenant ?? null
}
