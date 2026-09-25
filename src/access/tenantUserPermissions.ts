import type { Field } from 'payload'

// Roles del lado del cliente (colección `tenant-users`), y qué puede hacer
// cada uno dentro del Dashboard de Cliente de SU tenant.
//
// Un rol aquí nunca cruza la frontera del tenant: quién entra a qué tenant lo
// decide `resolveDashboardAuth` a partir del host, y solo después de eso el rol
// decide qué puede hacer ahí dentro. Un `owner` de otro cliente no es más que
// un desconocido.

export type TenantUserRole = 'owner' | 'member'

export const TENANT_USER_ROLE_OPTIONS: { label: string; value: TenantUserRole }[] = [
  { label: 'Propietario (todo, incluidos usuarios y facturación)', value: 'owner' },
  { label: 'Miembro (leads y KPIs)', value: 'member' },
]

/**
 * Lo que se puede hacer en el dashboard. Es una lista corta a propósito: cada
 * permiso nuevo tiene que corresponder a un botón o a una ruta que exista.
 */
export type DashboardPermission =
  /** Ver los Leads del tenant. */
  | 'leads:read'
  /** Editar un Lead: etapa, resultado (incluido "descalificado"), notas y contacto. */
  | 'leads:update'
  /** Borrar un Lead de la base. Distinto de descalificarlo: esto no se puede deshacer. */
  | 'leads:delete'
  /**
   * Poner o quitar al Responsable de cualquier Lead, a cualquier persona del
   * Tenant. Sin este permiso solo se puede tomar un Lead sin asignar para uno
   * mismo o soltar uno propio (ver `canChangeAssignee`).
   */
  | 'leads:assign'
  /** Ver los KPIs, gasto en anuncios y costo por lead incluidos. */
  | 'kpis:read'
  /** Invitar, cambiar de rol y remover Usuarios de Cliente del propio tenant. */
  | 'users:manage'
  /** Ver y cambiar la suscripción del tenant. */
  | 'billing:manage'

/**
 * La administración de usuarios del propio Tenant está construida y probada
 * (issue 10: el `owner` invita, el invitado define su contraseña y entra a su
 * Tenant), pero apagada a pedido: se entrega después.
 *
 * Es UN interruptor y gobierna las dos caras, que es justo el punto de que
 * viva en el modelo de permisos y no en la interfaz:
 *   - el menú de cuenta no pinta la entrada "Usuarios"
 *     (`permissionsForRole` → `canManageUsers`), y
 *   - las rutas /api/tenant-dashboard/users responden 403
 *     (`sessionCan` → `roleCan`), así que tampoco se alcanza a mano.
 *
 * Para encenderla: `true`. No hay nada más que hacer — ni migración, ni
 * borrar código, ni tocar componentes.
 */
export const TENANT_USER_MANAGEMENT_ENABLED = false

// La diferencia entre los dos roles es corta y deliberada: un `member` trabaja
// los leads a diario —incluido descalificarlos— y ve los números completos del
// gasto en anuncios, porque un dashboard que le esconde el costo por lead a
// quien atiende los leads no sirve de nada. Lo que no hace es lo irreversible
// (borrar) ni lo administrativo (usuarios, facturación).
const PERMISSIONS: Record<TenantUserRole, ReadonlySet<DashboardPermission>> = {
  owner: new Set<DashboardPermission>([
    'leads:read',
    'leads:update',
    'leads:delete',
    'leads:assign',
    'kpis:read',
    ...(TENANT_USER_MANAGEMENT_ENABLED ? (['users:manage'] as const) : []),
    'billing:manage',
  ]),
  member: new Set<DashboardPermission>(['leads:read', 'leads:update', 'kpis:read']),
}

/**
 * Lee el rol de un documento de Tenant User. Cualquier cosa que no sea
 * `owner` —una fila vieja sin rol, un valor que ya no existe— cae en `member`,
 * que es el rol que no borra nada ni toca usuarios.
 */
export function normalizeTenantUserRole(value: unknown): TenantUserRole {
  return value === 'owner' ? 'owner' : 'member'
}

export function roleCan(role: TenantUserRole, permission: DashboardPermission): boolean {
  return PERMISSIONS[role].has(permission)
}

/**
 * Los permisos ya resueltos, para mandárselos al cliente y que la UI no
 * ofrezca botones que la API va a rechazar. Es una conveniencia de pintado: la
 * decisión de verdad la toma el servidor en cada ruta, siempre.
 */
export type DashboardPermissions = {
  canDeleteLeads: boolean
  canManageUsers: boolean
  /** Asignar Leads a cualquiera. Sin él, solo tomar o soltar los propios. */
  canAssignLeads: boolean
}

export function permissionsForRole(role: TenantUserRole): DashboardPermissions {
  return {
    canDeleteLeads: roleCan(role, 'leads:delete'),
    canManageUsers: roleCan(role, 'users:manage'),
    canAssignLeads: roleCan(role, 'leads:assign'),
  }
}

type AssigneeId = string | number | null | undefined

function sameAssignee(a: AssigneeId, b: AssigneeId): boolean {
  if (a === null || a === undefined) return b === null || b === undefined
  return b !== null && b !== undefined && String(a) === String(b)
}

/**
 * ¿Puede esta sesión cambiar el Responsable de un Lead de `current` a `next`?
 *
 * Quien tiene `leads:assign` (un `owner`) reparte a cualquiera. Los demás
 * trabajan sus propios Leads sin pasarle trabajo a nadie ni quitárselo: solo
 * pueden **tomar** uno sin asignar para sí mismos o **soltar** uno que ya es
 * suyo. Un Lead de otra persona no se toca.
 *
 * Dejarlo igual siempre se puede: el formulario del Lead manda todos sus
 * campos al guardar, y un `member` que edita el teléfono de un Lead ajeno no
 * está reasignando nada.
 *
 * Que `next` sea alguien de ESTE Tenant no se decide aquí: eso es aislamiento
 * entre tenants y lo impone la colección (`assertAssigneeInLeadTenant`).
 */
export function canChangeAssignee(
  role: TenantUserRole,
  viewerId: string | number,
  current: AssigneeId,
  next: AssigneeId,
): boolean {
  if (sameAssignee(current, next)) return true
  if (roleCan(role, 'leads:assign')) return true

  const isViewer = (value: AssigneeId) => sameAssignee(value, viewerId)
  const isNobody = (value: AssigneeId) => value === null || value === undefined

  return (isNobody(current) && isViewer(next)) || (isViewer(current) && isNobody(next))
}

export const tenantUserRoleField: Field = {
  name: 'role',
  type: 'select',
  required: true,
  defaultValue: 'member' satisfies TenantUserRole,
  options: TENANT_USER_ROLE_OPTIONS,
  label: 'Rol',
  index: true,
  admin: {
    description:
      'Un Propietario gestiona los usuarios y la facturación de su empresa, puede borrar leads y se los asigna a cualquiera de su equipo. Un Miembro trabaja los leads y ve los KPIs completos, gasto en anuncios incluido; puede tomar para sí un lead sin asignar o soltar los suyos, pero no borra leads, no se los asigna a otros ni administra usuarios.',
  },
}
