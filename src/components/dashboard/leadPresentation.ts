import type { Lead } from '@/components/dashboard/DashboardApp'
import type { BadgeTone } from '@/components/dashboard/ui/atoms/Badge'

const STATUS_LABELS: Record<Lead['status'], string> = {
  open: 'Abierto',
  won: 'Ganado',
  lost: 'Perdido',
  disqualified: 'Descalificado',
}

const STATUS_TONES: Record<Lead['status'], BadgeTone> = {
  open: 'neutral',
  won: 'success',
  lost: 'danger',
  disqualified: 'neutral',
}

export function statusLabel(status: Lead['status']): string {
  return STATUS_LABELS[status]
}

export function statusTone(status: Lead['status']): BadgeTone {
  return STATUS_TONES[status]
}

// Días sin movimiento: única señal de urgencia disponible con los datos
// reales del lead (no hay campo de "última actividad"), contra `updatedAt`
// (o `createdAt` si nunca se ha tocado).
export function daysIdle(lead: Pick<Lead, 'updatedAt' | 'createdAt'>): number | null {
  const raw = lead.updatedAt || lead.createdAt
  if (!raw) return null
  const ms = Date.now() - new Date(raw).getTime()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.floor(ms / 86400000))
}

// Default cuando el tenant no tiene configurado `leadStuckAfterDays` (ver
// Tenants.ts → Dashboard Cliente). Mantenerlo en sync con el `defaultValue`
// de ese campo.
export const DEFAULT_LEAD_STUCK_AFTER_DAYS = 21

export type IdleThresholds = { warning: number; urgent: number; critical: number }

// Los 3 cortes de "días sin actividad" que colorean la tarjeta/badge de un
// lead abierto. Solo el primero (`warning`) es configurable por tenant: es
// el mismo número que separa "abierto normal" de "Estancado" en el filtro
// de status del Kanban/Lista (ver isStuck más abajo y el filtro de status en
// KanbanBoard.tsx). Los otros dos se derivan como 2x/4x ese número en vez de
// tener sus propios campos, así el degradado de urgencia queda siempre
// ordenado sin importar qué tan alto o bajo configure cada tenant el
// primero.
export function idleThresholds(stuckAfterDays?: number | null): IdleThresholds {
  const warning = stuckAfterDays && stuckAfterDays > 0 ? stuckAfterDays : DEFAULT_LEAD_STUCK_AFTER_DAYS
  return { warning, urgent: warning * 2, critical: warning * 4 }
}

export function idleTone(days: number, thresholds: IdleThresholds = idleThresholds()): BadgeTone {
  if (days < thresholds.warning) return 'neutral'
  if (days < thresholds.urgent) return 'urgent-1'
  if (days < thresholds.critical) return 'urgent-2'
  return 'urgent-3'
}

// "Estancado": lead abierto que lleva sin actividad al menos
// `leadStuckAfterDays` (el corte `warning` de arriba). Es lo mismo que
// filtra `status=stuck` en /api/tenant-dashboard/leads (ver ese archivo
// para la versión que corre en el servidor contra `updatedAt`).
export function isStuck(lead: Pick<Lead, 'status' | 'updatedAt' | 'createdAt'>, stuckAfterDays?: number | null): boolean {
  if (lead.status !== 'open') return false
  const days = daysIdle(lead)
  return days !== null && days >= idleThresholds(stuckAfterDays).warning
}

export function idleLabel(days: number): string {
  return days < 1 ? '<1d' : `${days}d`
}

export function formatLeadDate(raw?: string): string | null {
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Un único badge por lead: el de urgencia (si sigue abierto) o el de
// status (ganado/perdido/descalificado). Mismo criterio que ya usaban por
// separado KanbanBoard y LeadDetailPanel.
export function leadBadge(
  lead: Pick<Lead, 'status' | 'updatedAt' | 'createdAt'>,
  stuckAfterDays?: number | null,
): { label: string; tone: BadgeTone } | null {
  if (lead.status === 'open') {
    const days = daysIdle(lead)
    if (days === null) return null
    return { label: idleLabel(days), tone: idleTone(days, idleThresholds(stuckAfterDays)) }
  }
  return { label: statusLabel(lead.status), tone: statusTone(lead.status) }
}
