import SectionHeading from '@/components/dashboard/ui/atoms/SectionHeading'
import StatTile from '@/components/dashboard/ui/molecules/StatTile'
import DataTable, { type DataTableColumn } from '@/components/dashboard/ui/molecules/DataTable'
import type { MarketingRow, MarketingTotals } from '@/components/dashboard/KpiReport'

type KpiMarketingSectionProps = {
  marketing: MarketingRow[]
  totals: MarketingTotals
}

const currency = (n?: number) =>
  typeof n === 'number' ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }) : '—'

const columns: DataTableColumn<MarketingRow>[] = [
  {
    key: 'week',
    header: 'Semana',
    render: (row) =>
      row.weekStart ? new Date(row.weekStart).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—',
  },
  { key: 'campaign', header: 'Campaña', render: (row) => row.campaign },
  { key: 'leads', header: 'Leads', align: 'right', render: (row) => row.leads ?? '—' },
  { key: 'cpl', header: 'CPL', align: 'right', render: (row) => currency(row.costPerLead) },
  { key: 'spend', header: 'Gasto', align: 'right', render: (row) => currency(row.spend) },
  { key: 'ctr', header: 'CTR', align: 'right', render: (row) => (typeof row.ctr === 'number' ? `${row.ctr}%` : '—') },
]

export default function KpiMarketingSection({ marketing, totals }: KpiMarketingSectionProps) {
  return (
    <section>
      <SectionHeading>Marketing (semanal)</SectionHeading>
      {marketing.length === 0 ? (
        <p className="text-sm text-neutral-400 bg-white rounded-xl border border-neutral-200 p-4">
          Aún no hay reportes de marketing capturados para este tenant.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-3">
            <StatTile label="Gasto total" value={currency(totals.spend)} />
            <StatTile label="Leads (ads)" value={String(totals.leads)} />
            <StatTile label="Costo por lead prom." value={currency(totals.avgCostPerLead)} />
            <StatTile label="Impresiones" value={totals.impressions.toLocaleString('es-MX')} />
          </div>
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-x-auto px-3">
            <DataTable columns={columns} rows={marketing} rowKey={(row) => row.id} />
          </div>
        </>
      )}
    </section>
  )
}
