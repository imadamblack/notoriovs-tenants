import type { NextRequest } from 'next/server'
import { getTenantBySubdomain, type TenantView } from '@/utils/getTenant'
import { getSubdomainFromHeaders } from '@/utils/subdomain'
import { getTenantUserSession } from '@/utils/tenantUserAuth'
import {
  permissionsForRole,
  roleCan,
  type DashboardPermission,
  type DashboardPermissions,
  type TenantUserRole,
} from '@/access/tenantUserPermissions'

/**
 * Quién está viendo el dashboard. Hay una sola puerta: un Tenant User con su
 * propio email y contraseña. La contraseña compartida por tenant, que convivió
 * con esta durante la migración, se retiró junto con el campo que la guardaba.
 */
export type DashboardSession = {
  userId: string | number
  email: string
  role: TenantUserRole
}

export type DashboardAuth = {
  tenant: TenantView<'dashboardApi'>
  session: DashboardSession
  /** El subdominio del host que autorizó, para quien necesite nombrar al tenant. */
  subdomain: string
}

/**
 * Autoriza una petición al dashboard y devuelve el tenant ya proyectado a lo
 * que usan esas rutas (`id` para scopear la query a `leads`, más pipeline y
 * corte de "estancado") junto con la sesión que la autorizó. `null` si no
 * cuadra: quien llama responde 401/404 sin filtrar información.
 *
 * De qué cliente es la petición lo dice su `Host` y nada más (ADR 0002): ni un
 * parámetro, ni el cuerpo, ni la sesión. Un Tenant User de otro cliente no
 * entra aquí porque su `tenantId` no coincide con el del host, y ya no hay
 * ningún parámetro con el que pueda decir a qué tenant cree pertenecer.
 */
export async function resolveDashboardAuth(headers: Headers): Promise<DashboardAuth | null> {
  const subdomain = getSubdomainFromHeaders(headers)
  if (!subdomain) return null

  const tenant = await getTenantBySubdomain(subdomain, 'dashboardApi')
  if (!tenant) return null

  const tenantUser = await getTenantUserSession(headers)
  if (!tenantUser || tenantUser.tenantId === null) return null
  if (String(tenantUser.tenantId) !== String(tenant.id)) return null

  return {
    tenant,
    subdomain,
    session: { userId: tenantUser.id, email: tenantUser.email, role: tenantUser.role },
  }
}

/**
 * La misma autorización, servida a las rutas /api/tenant-dashboard/*, que solo
 * necesitan el tenant.
 */
export async function requireDashboardTenant(
  req: NextRequest,
): Promise<TenantView<'dashboardApi'> | null> {
  const auth = await requireDashboardAuth(req)

  return auth?.tenant ?? null
}

/** Único lugar donde una ruta del dashboard pregunta "¿esta sesión puede X?". */
export function sessionCan(session: DashboardSession, permission: DashboardPermission): boolean {
  return roleCan(session.role, permission)
}

/** Los permisos ya resueltos, para que la UI no pinte botones que la API rechaza. */
export function sessionPermissions(session: DashboardSession): DashboardPermissions {
  return permissionsForRole(session.role)
}

/**
 * La autorización completa (tenant + sesión) para las rutas que además del
 * tenant necesitan saber QUIÉN pide y con qué rol.
 */
export async function requireDashboardAuth(req: NextRequest): Promise<DashboardAuth | null> {
  return resolveDashboardAuth(req.headers)
}
