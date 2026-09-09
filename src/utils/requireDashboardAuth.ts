import type { NextRequest } from 'next/server'
import { getTenantBySubdomain, tenantHasSharedPassword, type TenantView } from '@/utils/getTenant'
import { verifyDashboardToken, DASHBOARD_COOKIE_NAME } from '@/utils/dashboardAuth'
import { getTenantUserSession } from '@/utils/tenantUserAuth'
import {
  permissionsForRole,
  roleCan,
  type DashboardPermission,
  type DashboardPermissions,
  type TenantUserRole,
} from '@/access/tenantUserPermissions'

/**
 * Cómo entró quien está viendo el dashboard. Hoy hay dos puertas abiertas a la
 * vez: la contraseña compartida por tenant (la de siempre) y el Tenant User con
 * email y contraseña propios. La compartida se retira cuando todos los clientes
 * estén migrados; hasta entonces las dos dan exactamente el mismo acceso, y lo
 * único que cambia es de quién sabemos el nombre.
 */
export type DashboardSession =
  | { kind: 'tenant-user'; userId: string | number; email: string; role: TenantUserRole }
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
    return {
      tenant,
      session: {
        kind: 'tenant-user',
        userId: tenantUser.id,
        email: tenantUser.email,
        role: tenantUser.role,
      },
    }
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
  const auth = await requireDashboardAuth(req, subdomain)

  return auth?.tenant ?? null
}

/**
 * Rol con el que actúa una sesión.
 *
 * La contraseña compartida del tenant (la puerta vieja, en retirada) cuenta
 * como `owner`: es una sola credencial que hoy abre todo el dashboard, y
 * recortarla al introducir los roles les quitaría capacidades a los clientes
 * que todavía no migran. Esa puerta se cierra vaciando la contraseña, no
 * degradándola en silencio.
 */
export function sessionRole(session: DashboardSession): TenantUserRole {
  return session.kind === 'tenant-user' ? session.role : 'owner'
}

/** Único lugar donde una ruta del dashboard pregunta "¿esta sesión puede X?". */
export function sessionCan(session: DashboardSession, permission: DashboardPermission): boolean {
  return roleCan(sessionRole(session), permission)
}

/** Los permisos ya resueltos, para que la UI no pinte botones que la API rechaza. */
export function sessionPermissions(session: DashboardSession): DashboardPermissions {
  return permissionsForRole(sessionRole(session))
}

/**
 * La autorización completa (tenant + sesión) para las rutas que además del
 * tenant necesitan saber QUIÉN pide y con qué rol.
 */
export async function requireDashboardAuth(
  req: NextRequest,
  subdomain: string | null | undefined,
): Promise<DashboardAuth | null> {
  return resolveDashboardAuth(req.headers, req.cookies.get(DASHBOARD_COOKIE_NAME)?.value, subdomain)
}
