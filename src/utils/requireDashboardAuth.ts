import type { NextRequest } from 'next/server'
import { getTenantBySubdomain, type TenantDoc } from '@/utils/getTenant'
import { verifyDashboardToken, DASHBOARD_COOKIE_NAME } from '@/utils/dashboardAuth'

/**
 * Punto único de autorización para las rutas /api/tenant-dashboard/*.
 * Lee la cookie de sesión, la valida contra el `subdomain` que llega en la
 * request (querystring o body, según la ruta) y, si todo cuadra, regresa el
 * tenant completo (para poder scoping por `tenant.id` en la query a
 * `leads`). Si algo no cuadra regresa `null`: la ruta que llama a esto debe
 * responder 401/404 sin filtrar información.
 */
export async function requireDashboardTenant(
  req: NextRequest,
  subdomain: string | null | undefined,
): Promise<TenantDoc | null> {
  if (!subdomain) return null

  const normalized = subdomain.toLowerCase()
  const token = req.cookies.get(DASHBOARD_COOKIE_NAME)?.value

  if (!verifyDashboardToken(token, normalized)) return null

  const tenant = await getTenantBySubdomain(normalized)
  if (!tenant || !tenant.dashboardPassword) return null

  return tenant
}
