import type { NextRequest } from 'next/server'
import { getTenantBySubdomain, type TenantView } from '@/utils/getTenant'
import { getSubdomainFromHeaders } from '@/utils/subdomain'
import { getTenantUserSession } from '@/utils/tenantUserAuth'
import { getInternalDashboardSession } from '@/utils/internalDashboardSession'
import { canInternalUserEnterTenant } from '@/access/internalRoles'
import {
  canChangeAssignee,
  internalSessionCan,
  resolvePermissions,
  roleCan,
  type DashboardPermission,
  type DashboardPermissions,
  type TenantUserRole,
} from '@/access/tenantUserPermissions'

/**
 * Quién está viendo el dashboard. Dos poblaciones distintas (ADR 0001), y por
 * eso una unión y no un rol más del cliente:
 *
 *  - `tenant-user`: alguien del cliente, con su propio email y contraseña.
 *  - `internal`: alguien de Notoriovs que entró desde el panel (issue 31).
 *    No es Tenant User de nadie: no aparece en la lista de Usuarios del
 *    cliente, no es Responsable de ningún Lead y no tiene dispositivos de push.
 */
export type DashboardSession =
  | {
      kind: 'tenant-user'
      userId: string | number
      email: string
      role: TenantUserRole
    }
  | {
      kind: 'internal'
      internalUserId: string | number
      email: string
      visitId: string | number
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
 * De qué cliente es la petición lo dice su `Host` y nada más (ADR 0007): ni un
 * parámetro, ni el cuerpo, ni la sesión. Una sesión de otro cliente no entra
 * aquí porque su Tenant no coincide con el del host.
 *
 * Orden de resolución: primero la sesión interna, después la de Tenant User.
 * Las dos cookies tienen nombres distintos y pueden convivir en el mismo
 * navegador (el caso normal en dev); quien entró a propósito desde el panel ve
 * el dashboard como equipo, y al salir vuelve a aparecer la sesión del cliente
 * que hubiera, intacta. Una sesión interna que ya no vale aquí no tapa a la
 * otra: se pasa a la siguiente.
 */
export async function resolveDashboardAuth(headers: Headers): Promise<DashboardAuth | null> {
  const subdomain = getSubdomainFromHeaders(headers)
  if (!subdomain) return null

  return (await resolveInternalAuth(headers, subdomain)) ?? (await resolveTenantUserAuth(headers, subdomain))
}

/**
 * Una sesión del equipo de Notoriovs. Se autoriza dos veces, y en cada
 * petición: el ticket que la abrió tiene que ser del Tenant de este host, y el
 * Internal User —leído ahora, no al emitir el ticket— tiene que seguir
 * pudiendo entrar a él. Quitarle el Tenant a un account manager lo saca en su
 * siguiente petición.
 *
 * Un Tenant inactivo no le cierra el dashboard al equipo: entrar a ver qué
 * pasó es justo lo que se hace cuando un cliente se cae.
 */
async function resolveInternalAuth(headers: Headers, subdomain: string): Promise<DashboardAuth | null> {
  const internal = await getInternalDashboardSession(headers)
  if (!internal?.user || internal.tenantId === null) return null

  const tenant = await getTenantBySubdomain(subdomain, 'dashboardApi', { includeInactive: true })
  if (!tenant) return null
  if (String(internal.tenantId) !== String(tenant.id)) return null
  if (!canInternalUserEnterTenant(internal.user, tenant.id)) return null

  return {
    tenant,
    subdomain,
    session: {
      kind: 'internal',
      internalUserId: internal.user.id,
      email: internal.user.email,
      visitId: internal.visitId,
    },
  }
}

/** Un Tenant User de este Tenant, y el Tenant activo (`dashboardApi` lo exige). */
async function resolveTenantUserAuth(headers: Headers, subdomain: string): Promise<DashboardAuth | null> {
  const tenant = await getTenantBySubdomain(subdomain, 'dashboardApi')
  if (!tenant) return null

  const tenantUser = await getTenantUserSession(headers)
  if (!tenantUser || tenantUser.tenantId === null) return null
  if (String(tenantUser.tenantId) !== String(tenant.id)) return null

  return {
    tenant,
    subdomain,
    session: { kind: 'tenant-user', userId: tenantUser.id, email: tenantUser.email, role: tenantUser.role },
  }
}

/**
 * ¿Hay dashboard para esta sesión aunque el Tenant esté inactivo? Lo necesitan
 * las rutas que, ya autorizadas, vuelven a resolver el Tenant con otra
 * proyección (`dashboardQuiz`).
 */
export function seesInactiveTenant(session: DashboardSession): boolean {
  return session.kind === 'internal'
}

/**
 * El Tenant User detrás de la sesión, o `null` si es del equipo interno. Es el
 * "Yo" del filtro por Responsable y a quién se asigna al tomar un Lead: un
 * Internal User nunca es Responsable (solo lo son Tenant Users).
 */
export function tenantUserIdOf(session: DashboardSession): string | number | null {
  return session.kind === 'tenant-user' ? session.userId : null
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
  return session.kind === 'internal' ? internalSessionCan(permission) : roleCan(session.role, permission)
}

/** `canChangeAssignee` para cualquier sesión: quien puede `leads:assign` reparte a cualquiera. */
export function sessionCanChangeAssignee(
  session: DashboardSession,
  current: string | number | null | undefined,
  next: string | number | null | undefined,
): boolean {
  if (session.kind === 'internal') return sessionCan(session, 'leads:assign')
  return canChangeAssignee(session.role, session.userId, current, next)
}

/** Los permisos ya resueltos, para que la UI no pinte botones que la API rechaza. */
export function sessionPermissions(session: DashboardSession): DashboardPermissions {
  return resolvePermissions((permission) => sessionCan(session, permission))
}

/**
 * La autorización completa (tenant + sesión) para las rutas que además del
 * tenant necesitan saber QUIÉN pide y con qué rol.
 */
export async function requireDashboardAuth(req: NextRequest): Promise<DashboardAuth | null> {
  return resolveDashboardAuth(req.headers)
}
