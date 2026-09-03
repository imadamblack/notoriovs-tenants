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

export function idleTone(days: number): BadgeTone {
  if (days < 1) return 'neutral'
  if (days < 15) return 'urgent-1'
  if (days < 45) return 'urgent-2'
  return 'urgent-3'
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
): { label: string; tone: BadgeTone } | null {
  if (lead.status === 'open') {
    const days = daysIdle(lead)
    if (days === null) return null
    return { label: idleLabel(days), tone: idleTone(days) }
  }
  return { label: statusLabel(lead.status), tone: statusTone(lead.status) }
}
