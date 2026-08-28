'use client'

import type { PipelineStage } from '@/components/dashboard/DashboardApp'

type StageKpi = { key: string; label: string; count: number; pct: number }
type TrendPoint = { week: string; count: number }
type MarketingRow = {
  id: string | number
  campaign?: string
  weekStart?: string
  weekEnd?: string
  impressions?: number
  clicks?: number
  ctr?: number
  leads?: number
  costPerLead?: number
  spend?: number
}

type KpiData = {
  total: number
  byStage: StageKpi[]
  otherCount: number
  won: number
  lost: number
  conversionRate: number
  lossRate: number
  trend: TrendPoint[]
  marketing: MarketingRow[]
  marketingTotals: { spend: number; leads: number; impressions: number; clicks: number; avgCostPerLead: number }
}

type KpiReportProps = {
  data: KpiData | null
  pipeline: PipelineStage[]
}

const currency = (n?: number) =>
  typeof n === 'number' ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }) : '—'

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 flex-1 min-w-[160px]">
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="ft-3 font-bold text-brand-1 mt-1">{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function KpiReport({ data, pipeline }: KpiReportProps) {
  if (!data) return <p className="text-neutral-400 text-sm">Cargando…</p>

  const maxTrend = Math.max(1, ...data.trend.map((t) => t.count))

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-semibold text-brand-1 mb-3">Resumen del pipeline</h2>
        <div className="flex flex-wrap gap-3">
          <Tile label="Leads totales" value={String(data.total)} />
          <Tile
            label="Tasa de conversión"
            value={`${data.conversionRate}%`}
            sub={`${data.won} lead(s) en etapa "ganado"`}
          />
          <Tile label="Tasa de pérdida" value={`${data.lossRate}%`} sub={`${data.lost} lead(s) perdidos`} />
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-brand-1 mb-3">Progreso por etapa</h2>
        <div className="bg-white rounded-xl border border-neutral-200 p-4 flex flex-col gap-3">
          {data.byStage.map((stage) => (
            <div key={stage.key} className="flex items-center gap-3">
              <span className="w-32 text-sm text-neutral-600 truncate">{stage.label}</span>
              <div className="flex-1 h-3 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-3" style={{ width: `${stage.pct}%` }} />
              </div>
              <span className="w-16 text-right text-sm text-neutral-500">
                {stage.count} ({stage.pct}%)
              </span>
            </div>
          ))}
          {!pipeline.length && <p className="text-sm text-neutral-400">Sin pipeline configurado.</p>}
          {data.otherCount > 0 && (
            <p className="text-xs text-neutral-400">
              {data.otherCount} lead(s) con una etapa que ya no existe en el pipeline actual.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-brand-1 mb-3">Leads por semana</h2>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          {data.trend.length === 0 ? (
            <p className="text-sm text-neutral-400">Todavía no hay leads suficientes para una tendencia.</p>
          ) : (
            <div className="flex items-end gap-3 h-32">
              {data.trend.map((point) => (
                <div key={point.week} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className="w-full bg-brand-5 rounded-t"
                    style={{ height: `${(point.count / maxTrend) * 100}%`, minHeight: 4 }}
                  />
                  <span className="text-[10px] text-neutral-400">
                    {new Date(point.week).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="text-[11px] text-neutral-600 font-medium">{point.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-brand-1 mb-3">Marketing (semanal)</h2>
        {data.marketing.length === 0 ? (
          <p className="text-sm text-neutral-400 bg-white rounded-xl border border-neutral-200 p-4">
            Aún no hay reportes de marketing capturados para este tenant.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 mb-3">
              <Tile label="Gasto total" value={currency(data.marketingTotals.spend)} />
              <Tile label="Leads (ads)" value={String(data.marketingTotals.leads)} />
              <Tile label="Costo por lead prom." value={currency(data.marketingTotals.avgCostPerLead)} />
              <Tile label="Impresiones" value={data.marketingTotals.impressions.toLocaleString('es-MX')} />
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-400 border-b border-neutral-100">
                    <th className="p-3 font-medium">Semana</th>
                    <th className="p-3 font-medium">Campaña</th>
                    <th className="p-3 font-medium text-right">Leads</th>
                    <th className="p-3 font-medium text-right">CPL</th>
                    <th className="p-3 font-medium text-right">Gasto</th>
                    <th className="p-3 font-medium text-right">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.marketing.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-50 last:border-0">
                      <td className="p-3 text-neutral-600 whitespace-nowrap">
                        {row.weekStart ? new Date(row.weekStart).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—'}
                      </td>
                      <td className="p-3 text-neutral-800">{row.campaign}</td>
                      <td className="p-3 text-right">{row.leads ?? '—'}</td>
                      <td className="p-3 text-right">{currency(row.costPerLead)}</td>
                      <td className="p-3 text-right">{currency(row.spend)}</td>
                      <td className="p-3 text-right">{typeof row.ctr === 'number' ? `${row.ctr}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
