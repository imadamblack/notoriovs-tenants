'use client'

import type { PipelineStage } from '@/components/dashboard/DashboardApp'
import KpiSummarySection from '@/components/dashboard/ui/organisms/KpiSummarySection'
import KpiStageProgressSection from '@/components/dashboard/ui/organisms/KpiStageProgressSection'
import KpiTrendChart from '@/components/dashboard/ui/organisms/KpiTrendChart'
import KpiMarketingSection from '@/components/dashboard/ui/organisms/KpiMarketingSection'

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
  marketingTotals: MarketingTotals
}

type KpiReportProps = {
  data: KpiData | null
  pipeline: PipelineStage[]
}

export default function KpiReport({ data, pipeline }: KpiReportProps) {
  if (!data) return <p className="text-neutral-400 text-sm">Cargando…</p>

  return (
    <div className="flex flex-col gap-8">
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
      <KpiMarketingSection marketing={data.marketing} totals={data.marketingTotals} />
    </div>
  )
}
