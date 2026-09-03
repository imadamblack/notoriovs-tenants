import type { Lead, PipelineStage } from '@/components/dashboard/DashboardApp'
import DataTable, { type DataTableColumn } from '@/components/dashboard/ui/molecules/DataTable'
import Badge from '@/components/dashboard/ui/atoms/Badge'
import { statusLabel, statusTone, formatLeadDate } from '@/components/dashboard/leadPresentation'

type LeadListTableProps = {
  leads: Lead[]
  pipeline: PipelineStage[]
  onRowClick: (lead: Lead) => void
  loading: boolean
  loadingMore: boolean
}

export default function LeadListTable({ leads, pipeline, onRowClick, loading, loadingMore }: LeadListTableProps) {
  const stageLabel = (id: string) => pipeline.find((s) => s.id === id)?.label || id || 'Sin etapa'

  const columns: DataTableColumn<Lead>[] = [
    { key: 'name', header: 'Nombre', render: (lead) => lead.name || 'Sin nombre' },
    { key: 'contact', header: 'Contacto', render: (lead) => lead.whatsapp || lead.phone || lead.email || '—' },
    { key: 'stage', header: 'Etapa', render: (lead) => stageLabel(lead.stage) },
    {
      key: 'status',
      header: 'Status',
      render: (lead) =>
        lead.status !== 'open' ? (
          <Badge label={statusLabel(lead.status)} tone={statusTone(lead.status)} />
        ) : (
          <span className="text-[10px] text-neutral-500">Abierto</span>
        ),
    },
    { key: 'createdAt', header: 'Creado', render: (lead) => formatLeadDate(lead.createdAt) || '—' },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={leads}
        rowKey={(lead) => lead.id}
        onRowClick={onRowClick}
        emptyMessage={loading ? 'Cargando…' : 'Sin leads'}
      />
      {loadingMore && <p className="-ft-4 text-neutral-600 text-center py-3">Cargando más…</p>}
    </>
  )
}
