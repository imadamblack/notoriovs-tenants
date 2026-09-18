import SectionHeading from '@/components/dashboard/ui/atoms/SectionHeading'
import StatTile from '@/components/dashboard/ui/molecules/StatTile'
import DataTable, { type DataTableColumn } from '@/components/dashboard/ui/molecules/DataTable'
import type { MarketingRange, MarketingRow, MarketingTotals } from '@/components/dashboard/KpiReport'

type KpiMarketingSectionProps = {
  marketing: MarketingRow[]
  totals: MarketingTotals
  range: MarketingRange
  // Etiqueta del periodo elegido arriba, o `null` con "Máximo". Solo se
  // usa para explicar por qué la sección salió vacía.
  periodLabel: string | null
}

const currency = (n?: number) =>
  typeof n === 'number' ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }) : '—'

const columns: DataTableColumn<MarketingRow>[] = [
  { key: 'campaign', header: 'Campaña', render: (row) => row.campaign },
  { key: 'leads', header: 'Leads', align: 'right', render: (row) => row.leads ?? '—' },
  { key: 'cpl', header: 'CPL', align: 'right', render: (row) => currency(row.costPerLead ?? undefined) },
  { key: 'spend', header: 'Gasto', align: 'right', render: (row) => currency(row.spend) },
  {
    key: 'ctr',
    header: 'CTR',
    align: 'right',
    render: (row) => (typeof row.ctr === 'number' ? `${row.ctr}%` : '—'),
  },
]

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: 'UTC' })

export default function KpiMarketingSection({ marketing, totals, range, periodLabel }: KpiMarketingSectionProps) {
  return (
    <section className="flex-col">
      <SectionHeading>Marketing</SectionHeading>
      {/* Desde el issue #19 un Marketing Report es un día, así que esta
          sección usa la MISMA ventana que el resto del dashboard (antes
          era "semanas completas" propias, porque el reporte era semanal).
          El rango sigue escrito a la vista porque es el REAL de los días
          que trajo n8n, no el teórico del periodo: si el tenant lleva
          semanas sin ads, el rango lo dice en vez de mentir con "30 días". */}
      <p className="-ft-3 text-neutral-400 -mt-2 mb-3">
        {range
          ? `Del ${shortDate(range.start)} al ${shortDate(range.end)}`
          : periodLabel
            ? `Sin datos de ads en "${periodLabel}"`
            : 'Aún sin datos de ads'}
      </p>
      {/* Los totales se pintan siempre, en cero si no hubo ads en el rango:
          mismo criterio que en el resto del reporte. Lo que desaparece
          cuando no hay reportes es la tabla, que sin filas no tiene nada
          que enseñar; el aviso ocupa su lugar y explica el porqué. */}
      <div className="flex flex-wrap gap-3 mb-3">
        <StatTile label="Gasto total" value={currency(totals.spend)} emphasis="primary" />
        <StatTile label="Leads (ads)" value={String(totals.leads)} />
        <StatTile label="Costo por lead prom." value={currency(totals.avgCostPerLead)} />
        {/* Dato de apoyo: explica el alcance, pero no es un número que el
            cliente compare contra el gasto o el CPL. */}
        <StatTile label="Impresiones" value={totals.impressions.toLocaleString('es-MX')} emphasis="support" />
      </div>
      {marketing.length === 0 ? (
        <p className="-ft-3 text-neutral-400 bg-neutral-900 rounded-xl border border-neutral-800 p-4">
          {periodLabel
            ? `No hay ads registrados dentro de "${periodLabel}".`
            : 'Aún no hay reportes de marketing capturados para este tenant.'}
        </p>
      ) : (
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-x-auto px-3">
          <DataTable columns={columns} rows={marketing} rowKey={(row) => row.campaign} />
        </div>
      )}
    </section>
  )
}
