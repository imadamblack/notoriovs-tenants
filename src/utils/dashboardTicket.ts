// La regla pura del ticket de traspaso al Dashboard de un cliente (issue 31),
// aparte de internalDashboardSession.ts para poder afirmarla sin cargar la
// config de Payload.

export function relationId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

/** Lo mínimo de un documento de `dashboard-visits` para decidir si un ticket abre. */
export type TicketVisit = {
  tenant?: unknown
  ticketExpiresAt?: string | null
  enteredAt?: string | null
}

/**
 * ¿Este ticket abre el dashboard de este Tenant? Tiene que ser de ese Tenant
 * —uno emitido para el cliente A no sirve en el host del B, sin más
 * explicación—, no haberse usado y no haber vencido.
 */
export function ticketOpensTenant(visit: TicketVisit, tenantId: string | number, now = Date.now()): boolean {
  const ticketTenant = relationId(visit.tenant)
  if (ticketTenant === null || String(ticketTenant) !== String(tenantId)) return false
  if (visit.enteredAt) return false
  if (!visit.ticketExpiresAt || new Date(visit.ticketExpiresAt).getTime() <= now) return false
  return true
}
