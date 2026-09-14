import SectionHeading from '@/components/dashboard/ui/atoms/SectionHeading'
import StatTile from '@/components/dashboard/ui/molecules/StatTile'

type KpiSummarySectionProps = {
  total: number
  conversionRate: number
  won: number
  lossRate: number
  lost: number
  disqualifiedRate: number
  disqualified: number
}

export default function KpiSummarySection({
  total,
  conversionRate,
  won,
  lossRate,
  lost,
  disqualifiedRate,
  disqualified,
}: KpiSummarySectionProps) {
  return (
    <section className="flex-col">
      <SectionHeading>Ventas</SectionHeading>
      <div className="flex flex-wrap gap-4">
        {/* El KPI que resume la sección: se lee antes que las tasas, que son
            lecturas sobre ese mismo total. */}
        <StatTile label="Leads totales" value={String(total)} emphasis="primary" />
        <StatTile label="Tasa de conversión" value={`${conversionRate}%`} sub={`${won} lead(s) ganados`} />
        <StatTile label="Tasa de pérdida" value={`${lossRate}%`} sub={`${lost} lead(s) perdidos`} />
        <StatTile
          label="Descalificados"
          value={`${disqualifiedRate}%`}
          sub={`${disqualified} lead(s) descalificados`}
        />
      </div>
    </section>
  )
}
