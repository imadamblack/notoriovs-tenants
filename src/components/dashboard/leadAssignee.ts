import type { Lead } from '@/components/dashboard/DashboardApp'
import type { TenantMember } from '@/utils/tenantMembers'

// Cómo se pinta el Responsable de un Lead (issue 38) en el Dashboard. El Lead
// trae solo el id (las rutas leen con `depth: 0`); el nombre sale de la lista
// de personas del Tenant que la página ya le pasó al Dashboard.

export function assigneeIdOf(lead: Pick<Lead, 'assignee'>): string | null {
  const value = lead.assignee
  if (value === null || value === undefined) return null
  return String(typeof value === 'object' ? value.id : value)
}

/**
 * El nombre del Responsable, o `null` si no tiene. Un id que ya no está en la
 * lista (alguien que se dio de alta después de abrir el Dashboard) se muestra
 * como "Otra persona" en vez de desaparecer: el Lead sí tiene Responsable.
 */
export function assigneeLabelOf(lead: Pick<Lead, 'assignee'>, members: TenantMember[]): string | null {
  const id = assigneeIdOf(lead)
  if (id === null) return null
  return members.find((member) => String(member.id) === id)?.label ?? 'Otra persona'
}
