import type { NextRequest } from 'next/server'
import { getTenantBySubdomain, type TenantView } from '@/utils/getTenant'
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
}

/**
 * Autoriza una petición al dashboard de `subdomain` y devuelve el tenant ya
 * proyectado a lo que usan esas rutas (`id` para scopear la query a `leads`,
 * más pipeline y corte de "estancado") junto con la sesión que la autorizó.
 * `null` si no cuadra: quien llama responde 401/404 sin filtrar información.
 *
 * El tenant SIEMPRE sale del subdominio de la petición, nunca de la sesión: un
 * Tenant User de otro cliente no entra aquí porque su `tenantId` no coincide
 * con el del host.
 */
export async function resolveDashboardAuth(
  headers: Headers,
  subdomain: string | null | undefined,
): Promise<DashboardAuth | null> {
  if (!subdomain) return null

  const normalized = subdomain.toLowerCase()
  const tenant = await getTenantBySubdomain(normalized, 'dashboardApi')
  if (!tenant) return null

  const tenantUser = await getTenantUserSession(headers)
  if (!tenantUser || tenantUser.tenantId === null) return null
  if (String(tenantUser.tenantId) !== String(tenant.id)) return null

  return {
    tenant,
    session: { userId: tenantUser.id, email: tenantUser.email, role: tenantUser.role },
  }
}

/**
 * La misma autorización, servida a las rutas /api/tenant-dashboard/*, que solo
 * necesitan el tenant.
 */
export async function requireDashboardTenant(
  req: NextRequest,
  subdomain: string | null | undefined,
): Promise<TenantView<'dashboardApi'> | null> {
  const auth = await requireDashboardAuth(req, subdomain)

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
export async function requireDashboardAuth(
  req: NextRequest,
  subdomain: string | null | undefined,
): Promise<DashboardAuth | null> {
  return resolveDashboardAuth(req.headers, subdomain)
}
