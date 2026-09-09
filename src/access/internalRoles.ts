import type { Access, FieldAccess, Field, Where } from 'payload'

// Roles del equipo de Notoriovs (colección `users`). Son la mitad interna del
// issue 09; la mitad del cliente vive en src/access/tenantUserPermissions.ts.
//
//  - `superadmin`: todos los Tenants. Es el único que da de alta y da de baja
//    clientes, y el único que puede repartir roles y asignaciones.
//  - `account-manager`: solo los Tenants que tiene asignados en su campo
//    `tenants`. Ve, en el panel, esos Tenants y nada más: sus Leads, sus
//    Marketing Reports y sus Usuarios de Cliente.
//
// Antes de esto, `userHasAccessToAllTenants: () => true` le daba a todo
// Internal User acceso irrestricto a los 50+ clientes. Ese era el estado real
// del sistema, no una omisión: mientras el equipo fuera el mismo puñado de
// personas administrando a todos, no había nada que separar.

export type InternalRole = 'superadmin' | 'account-manager'

export const INTERNAL_ROLE_OPTIONS: { label: string; value: InternalRole }[] = [
  { label: 'Superadmin (todos los clientes)', value: 'superadmin' },
  { label: 'Account Manager (solo sus clientes)', value: 'account-manager' },
]

/** La relación llega como id o como documento poblado según el `depth` de la petición. */
function extractId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

type MaybeInternalUser =
  | {
      collection?: string
      role?: unknown
      tenants?: unknown
    }
  | null
  | undefined

/**
 * `true` solo para un superadmin del equipo interno. Un rol ausente o
 * desconocido NO cuenta: si algún día llega un documento sin `role` (una fila
 * vieja, un seed a mano), lo que se pierde es alcance, no aislamiento.
 */
export function isSuperadminUser(user: MaybeInternalUser): boolean {
  return user?.collection === 'users' && user?.role === 'superadmin'
}

/**
 * Ids de los Tenants asignados a un Internal User. El campo `tenants` lo
 * inyecta `multiTenantPlugin` en la colección `users` (ver payload.config.ts):
 * es un array de filas `{ tenant }`.
 */
export function assignedTenantIds(user: MaybeInternalUser): (string | number)[] {
  const rows = Array.isArray(user?.tenants) ? user.tenants : []

  return rows
    .map((row) => extractId((row as { tenant?: unknown })?.tenant))
    .filter((id): id is string | number => id !== null)
}

/** Solo superadmin. Lo que se protege con esto no se le delega a un account manager. */
export const isSuperadmin: Access = ({ req }) => isSuperadminUser(req.user)

/**
 * Versión a nivel de campo. Sin esto, la restricción por roles sería
 * decorativa: Payload deja que cualquier usuario edite su propio documento, así
 * que un account manager podía abrir su perfil, ponerse `superadmin` (o
 * asignarse Tenants) y quedarse con todo. El rol y las asignaciones solo los
 * mueve un superadmin.
 */
export const superadminFieldAccess: FieldAccess = ({ req }) => isSuperadminUser(req.user)

export const internalRoleField: Field = {
  name: 'role',
  type: 'select',
  required: true,
  defaultValue: 'account-manager' satisfies InternalRole,
  options: INTERNAL_ROLE_OPTIONS,
  label: 'Rol',
  index: true,
  access: {
    create: superadminFieldAccess,
    update: superadminFieldAccess,
  },
  admin: {
    description:
      'Un Superadmin ve y administra todos los clientes. Un Account Manager solo ve los clientes que tenga asignados abajo. Solo un Superadmin puede cambiar esto.',
  },
}

/**
 * Acceso interno acotado a los Tenants asignados, para colecciones que el
 * plugin multi-tenant NO toca (hoy: `tenant-users`). Un superadmin pasa
 * derecho; un account manager recibe un filtro por su lista de Tenants, y si
 * no tiene ninguno asignado no ve nada.
 *
 * `fieldName` es el campo que apunta al Tenant en esa colección.
 */
export function internalScopedToAssignedTenants(fieldName = 'tenant'): Access {
  return ({ req }) => {
    if (req.user?.collection !== 'users') return false
    if (isSuperadminUser(req.user)) return true

    const ids = assignedTenantIds(req.user)
    if (!ids.length) return false

    return { [fieldName]: { in: ids } } as Where
  }
}
