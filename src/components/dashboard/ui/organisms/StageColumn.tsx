'use client'

import type { UIEvent, DragEvent } from 'react'
import type { Lead } from '@/components/dashboard/DashboardApp'
import LeadCard from '@/components/dashboard/ui/organisms/LeadCard'
import Badge from '@/components/dashboard/ui/atoms/Badge'
import EmptyState from '@/components/dashboard/ui/atoms/EmptyState'
import type { TenantMember } from '@/utils/tenantMembers'
import { assigneeLabelOf } from '@/components/dashboard/leadAssignee'

type StageColumnProps = {
  label: string
  count: number
  leads: Lead[]
  loading: boolean
  loadingMore: boolean
  error: boolean
  isDragOver: boolean
  pendingLeadId: string | null
  stuckAfterDays?: number | null
  /** Las personas del Tenant, para las iniciales del Responsable en cada tarjeta. */
  members: TenantMember[]
  scrollRef: (el: HTMLDivElement | null) => void
  onScroll: (e: UIEvent<HTMLDivElement>) => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent<HTMLDivElement>) => void
  onRetry: () => void
  onCardClick: (lead: Lead) => void
  onCardDragStart: (lead: Lead) => void
  onCardDragEnd: () => void
}

export default function StageColumn({
  label,
  count,
  leads,
  loading,
  loadingMore,
  error,
  isDragOver,
  pendingLeadId,
  stuckAfterDays,
  members,
  scrollRef,
  onScroll,
  onDragOver,
  onDragLeave,
  onDrop,
  onRetry,
  onCardClick,
  onCardDragStart,
  onCardDragEnd,
}: StageColumnProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex-shrink-0 w-full md:w-[280px] md:rounded-xl border flex flex-col h-full min-h-0 snap-center ${
        isDragOver ? 'border-brand-3 bg-brand-3/5' : 'border-neutral-800 bg-neutral-900'
      }`}
    >
      <div className="px-4 py-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <span className="font-semibold text-neutral-100 -ft-2 truncate">{label}</span>
        <Badge label={String(count)} tone="neutral" className="shrink-0 ml-2" />
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="p-2 flex flex-col gap-2 overflow-y-auto flex-1 min-h-0">
        {loading && leads.length === 0 && <EmptyState variant="loading" />}
        {error && <EmptyState variant="error" onRetry={onRetry} />}
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            pending={pendingLeadId === String(lead.id)}
            stuckAfterDays={stuckAfterDays}
            assigneeLabel={assigneeLabelOf(lead, members)}
            onClick={() => onCardClick(lead)}
            onDragStart={() => onCardDragStart(lead)}
            onDragEnd={onCardDragEnd}
          />
        ))}
        {!loading && !error && leads.length === 0 && <EmptyState variant="empty" />}
        {loadingMore && <EmptyState variant="loading-more" />}
      </div>
    </div>
  )
}
