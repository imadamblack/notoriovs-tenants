import type { Payload } from 'payload'

/**
 * Una persona del Tenant tal como la ve el Dashboard de Cliente: lo justo para
 * nombrarla en el filtro por Responsable, en la tarjeta del Kanban y en el
 * CSV. Nada más del Tenant User cruza al navegador — ni su rol, ni su sesión,
 * ni los campos de auth.
 */
export type TenantMember = {
  id: number | string
  /** El nombre si lo tiene; si no, su email. Ver `memberLabel`. */
  label: string
}

/** Cómo se nombra a una persona del Tenant: su nombre, o su email si no tiene. */
export function memberLabel(member: { name?: string | null; email?: string | null }): string {
  return member.name?.trim() || member.email || 'Sin nombre'
}

/**
 * Las personas del Tenant a las que se les puede asignar un Lead (issue 38):
 * todos sus Tenant Users, sea cual sea su rol. Scopeado a mano por `tenantId`,
 * que siempre sale del host (`requireDashboardAuth`), nunca del navegador.
 */
export async function listTenantMembers(payload: Payload, tenantId: string | number): Promise<TenantMember[]> {
  const { docs } = await payload.find({
    collection: 'tenant-users',
    where: { tenant: { equals: tenantId } },
    select: { name: true, email: true },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

  return docs
    .map((doc) => ({ id: doc.id, label: memberLabel(doc) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

/** `true` si `id` es una de las personas de `members` (o sea, de este Tenant). */
export function isTenantMember(members: TenantMember[], id: string | number): boolean {
  return members.some((member) => String(member.id) === String(id))
}
