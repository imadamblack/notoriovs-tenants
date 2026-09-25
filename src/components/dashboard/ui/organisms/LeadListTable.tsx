import type { Lead, PipelineStage } from '@/components/dashboard/DashboardApp'
import DataTable, { type DataTableColumn } from '@/components/dashboard/ui/molecules/DataTable'
import Badge from '@/components/dashboard/ui/atoms/Badge'
import { leadBadge, formatLeadDate } from '@/components/dashboard/leadPresentation'

type LeadListTableProps = {
  leads: Lead[]
  pipeline: PipelineStage[]
  stuckAfterDays?: number | null
  onRowClick: (lead: Lead) => void
  loading: boolean
  loadingMore: boolean
  /** Ids (en texto) de las filas marcadas para editar en bulto. */
  selectedIds: ReadonlySet<string>
  onToggleLead: (lead: Lead) => void
  /** Marca o desmarca todas las filas cargadas. */
  onToggleAll: () => void
}

// El tamaño de la casilla lo pone el reset del dashboard (_reset.scss).
const CHECKBOX_CLASS = 'cursor-pointer align-middle'

export default function LeadListTable({
  leads,
  pipeline,
  stuckAfterDays,
  onRowClick,
  loading,
  loadingMore,
  selectedIds,
  onToggleLead,
  onToggleAll,
}: LeadListTableProps) {
  const stageLabel = (id: string) => pipeline.find((s) => s.id === id)?.label || id || 'Sin etapa'

  const allSelected = leads.length > 0 && leads.every((lead) => selectedIds.has(String(lead.id)))
  const someSelected = !allSelected && leads.some((lead) => selectedIds.has(String(lead.id)))

  const columns: DataTableColumn<Lead>[] = [
    {
      key: 'select',
      // "Todas" son las filas CARGADAS, no todos los leads del filtro: lo que
      // se ve es lo que se edita.
      header: (
        <input
          type="checkbox"
          aria-label="Seleccionar todos los leads cargados"
          className={CHECKBOX_CLASS}
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected
          }}
          onChange={onToggleAll}
          disabled={!leads.length}
        />
      ),
      // La fila entera abre el lead; la casilla no.
      render: (lead) => (
        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
          <input
            type="checkbox"
            aria-label={`Seleccionar ${lead.name || 'lead sin nombre'}`}
            className={CHECKBOX_CLASS}
            checked={selectedIds.has(String(lead.id))}
            onChange={() => onToggleLead(lead)}
          />
        </span>
      ),
    },
    { key: 'name', header: 'Nombre', render: (lead) => lead.name || 'Sin nombre' },
    { key: 'contact', header: 'Contacto', render: (lead) => lead.whatsapp || lead.phone || lead.email || '—' },
    { key: 'stage', header: 'Etapa', render: (lead) => stageLabel(lead.stage) },
    {
      key: 'status',
      header: 'Estado',
      // Mismo badge que ya usa la tarjeta del Kanban (leadBadge): para un
      // lead abierto muestra los días sin actividad (con el mismo tono de
      // "Estancado" si aplica), no solo un texto plano "Abierto".
      render: (lead) => {
        const badge = leadBadge(lead, stuckAfterDays)
        return badge ? <Badge label={badge.label} tone={badge.tone} /> : <span className="text-[10px] text-neutral-500">—</span>
      },
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
        stickyHeader
      />
      {loadingMore && <p className="-ft-4 text-neutral-600 text-center py-3">Cargando más…</p>}
    </>
  )
}
