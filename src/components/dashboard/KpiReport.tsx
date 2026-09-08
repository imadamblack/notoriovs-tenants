'use client'

import type { PipelineStage } from '@/components/dashboard/DashboardApp'
import EmptyState from '@/components/dashboard/ui/atoms/EmptyState'
import PeriodFilter from '@/components/dashboard/ui/molecules/PeriodFilter'
import KpiSummarySection from '@/components/dashboard/ui/organisms/KpiSummarySection'
import KpiStageProgressSection from '@/components/dashboard/ui/organisms/KpiStageProgressSection'
import KpiTrendChart from '@/components/dashboard/ui/organisms/KpiTrendChart'
import KpiMarketingSection from '@/components/dashboard/ui/organisms/KpiMarketingSection'
import { SINCE_LABELS, type SinceKey } from '@/utils/dashboardPeriod'

export type StageKpi = { id: string; label: string; count: number; pct: number }
export type TrendPoint = { week: string; count: number }
export type MarketingRow = {
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
export type MarketingTotals = { spend: number; leads: number; impressions: number; clicks: number; avgCostPerLead: number }
// Rango REAL de semanas completas que cubren los reportes mostrados (lo
// calcula la ruta de KPIs, no la vista). Es `null` cuando no hay ninguno.
export type MarketingRange = { start: string; end: string } | null

type KpiData = {
  total: number
  byStage: StageKpi[]
  otherCount: number
  won: number
  lost: number
  disqualified: number
  conversionRate: number
  lossRate: number
  disqualifiedRate: number
  trend: TrendPoint[]
  marketing: MarketingRow[]
  marketingRange: MarketingRange
  marketingTotals: MarketingTotals
}

type KpiReportProps = {
  data: KpiData | null
  pipeline: PipelineStage[]
  refreshing: boolean
  sinceKey: SinceKey
  onSinceChange: (next: SinceKey) => void
}

export default function KpiReport({ data, pipeline, refreshing, sinceKey, onSinceChange }: KpiReportProps) {
  // La cabecera (con el selector de periodo) se pinta siempre, también
  // mientras carga y con cero leads: si se desmontara, el control
  // desaparecería justo en el momento de usarlo y no habría forma de salir
  // de un rango vacío sin volver a la pestaña de Leads.
  const header = (
    <header className="flex items-center justify-between gap-4">
      <div>
        <h1 className="ft-2 font-semibold text-neutral-100">Reporte</h1>
        <p className="-ft-3 text-neutral-400">
          Periodo: {SINCE_LABELS[sinceKey]}
          {refreshing && data && <span className="ml-2 text-neutral-600">actualizando…</span>}
        </p>
      </div>
      <PeriodFilter id="kpi-since-select" value={sinceKey} onChange={onSinceChange} />
    </header>
  )

  const periodLabel = sinceKey === 'all' ? null : SINCE_LABELS[sinceKey]

  const body = () => {
    // Solo la PRIMERA carga muestra un placeholder: a partir de ahí el
    // reporte se queda montado y las secciones reciben los valores nuevos
    // en su sitio, sin repintar la pantalla (ver `refreshing` en
    // DashboardApp).
    if (!data) return <EmptyState variant="loading" />

    if (data.total === 0) {
      return (
        <>
          <EmptyState
            variant="empty"
            message={
              sinceKey === 'all'
                ? 'Todavía no hay leads capturados para este tenant.'
                : `Sin leads en el periodo seleccionado (${SINCE_LABELS[sinceKey]}). Prueba con un rango más amplio.`
            }
          />
          {/* Marketing sí se muestra con cero leads: son semanas completas
              de ads, que existen aunque ninguna haya traído un lead. */}
          <KpiMarketingSection
            marketing={data.marketing}
            totals={data.marketingTotals}
            range={data.marketingRange}
            periodLabel={periodLabel}
          />
        </>
      )
    }

    return (
      <>
        <KpiSummarySection
          total={data.total}
          conversionRate={data.conversionRate}
          won={data.won}
          lossRate={data.lossRate}
          lost={data.lost}
          disqualifiedRate={data.disqualifiedRate}
          disqualified={data.disqualified}
        />
        <KpiStageProgressSection byStage={data.byStage} hasPipeline={pipeline.length > 0} otherCount={data.otherCount} />
        <KpiTrendChart trend={data.trend} />
        <KpiMarketingSection
          marketing={data.marketing}
          totals={data.marketingTotals}
          range={data.marketingRange}
          periodLabel={periodLabel}
        />
      </>
    )
  }

  return (
    <div className="container flex flex-col gap-8 p-6" aria-busy={refreshing}>
      {header}
      {body()}
    </div>
  )
}
