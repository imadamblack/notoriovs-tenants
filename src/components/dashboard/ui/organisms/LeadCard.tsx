import type { Lead } from '@/components/dashboard/DashboardApp'
import { formatPhone } from '@/utils/formatters'
import Badge from '@/components/dashboard/ui/atoms/Badge'
import Avatar from '@/components/dashboard/ui/atoms/Avatar'
import { daysIdle, idleLabel, idleTone, statusLabel, statusTone, formatLeadDate } from '@/components/dashboard/leadPresentation'

function cardTone(lead: Lead, days: number | null) {
  if (lead.status === 'won') {
    return 'bg-gradient-to-br from-emerald-900/70 via-emerald-950/60 to-neutral-900 border-emerald-700/40'
  }
  if (lead.status === 'lost') {
    return 'bg-neutral-900/80 border-red-900/30'
  }
  if (lead.status === 'disqualified') {
    return 'bg-neutral-900/50 border-neutral-800 opacity-60'
  }
  if (days === null || days < 7) return 'bg-neutral-800 border-neutral-800'
  if (days < 15) return 'bg-gradient-to-br from-yellow-900/40 via-yellow-950/30 to-neutral-900 border-red-900/30'
  if (days < 45) return 'bg-gradient-to-br from-red-950/80 via-red-950/40 to-neutral-900 border-red-900/40'
  return 'bg-gradient-to-br from-red-950 via-[#3a0a0a] to-black border-red-800/50'
}

type LeadCardProps = {
  lead: Lead
  pending?: boolean
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
}

export default function LeadCard({ lead, pending, onClick, onDragStart, onDragEnd }: LeadCardProps) {
  const days = daysIdle(lead)
  const badge = lead.status !== 'open' ? { label: statusLabel(lead.status), tone: statusTone(lead.status) } : null
  const badgeIdle = lead.status === 'open' && days !== null ? { label: idleLabel(days), tone: idleTone(days) } : null
  const date = formatLeadDate(lead.createdAt)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`rounded-lg border p-3 cursor-pointer transition-shadow hover:shadow-lg hover:shadow-black/30 ${cardTone(lead, days)} ${pending ? 'opacity-40 pointer-events-none' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium -ft-1 text-neutral-100 truncate">{lead.name || `Lead ${lead.id}`}</p>
        {badge && <Badge label={badge.label} tone={badge.tone} className="shrink-0" />}
      </div>
      <p className="-ft-2 text-neutral-400 truncate mt-0.5">
        {formatPhone(lead.whatsapp || lead.phone || lead.email || '—')}
      </p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <Avatar name={lead.name} />
          {date && <span className="text-[10px] text-neutral-500">{date}</span>}
        </div>
        {badgeIdle && <Badge label={badgeIdle.label} tone={badgeIdle.tone} />}
      </div>
    </div>
  )
}
