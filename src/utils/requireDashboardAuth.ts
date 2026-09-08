import type { NextRequest } from 'next/server'
import { getTenantBySubdomain, type TenantView } from '@/utils/getTenant'
import { verifyDashboardToken, DASHBOARD_COOKIE_NAME } from '@/utils/dashboardAuth'

/**
 * Punto único de autorización para las rutas /api/tenant-dashboard/*.
 * Lee la cookie de sesión, la valida contra el `subdomain` que llega en la
 * request (querystring o body, según la ruta) y, si todo cuadra, regresa el
 * tenant proyectado a lo que estas rutas usan: `id` para el scoping de la
 * query a `leads`, más el pipeline y el corte de "estancado". Si algo no
 * cuadra regresa `null`: la ruta que llama a esto debe responder 401/404 sin
 * filtrar información.
 */
export async function requireDashboardTenant(
  req: NextRequest,
  subdomain: string | null | undefined,
): Promise<TenantView<'dashboardApi'> | null> {
  if (!subdomain) return null

  const normalized = subdomain.toLowerCase()
  const token = req.cookies.get(DASHBOARD_COOKIE_NAME)?.value

  if (!verifyDashboardToken(token, normalized)) return null

  const tenant = await getTenantBySubdomain(normalized, 'dashboardApi')
  if (!tenant || !tenant.dashboardPassword) return null

  return tenant
}
