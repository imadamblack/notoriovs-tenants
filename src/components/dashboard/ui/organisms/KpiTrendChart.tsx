import SectionHeading from '@/components/dashboard/ui/atoms/SectionHeading'
import type { TrendPoint } from '@/components/dashboard/KpiReport'

type KpiTrendChartProps = {
  trend: TrendPoint[]
}

export default function KpiTrendChart({ trend }: KpiTrendChartProps) {
  const maxTrend = Math.max(1, ...trend.map((t) => t.count))

  return (
    <section>
      <SectionHeading>Leads por semana</SectionHeading>
      <div className="bg-white rounded-xl border border-neutral-200 p-4">
        {trend.length === 0 ? (
          <p className="text-sm text-neutral-400">Todavía no hay leads suficientes para una tendencia.</p>
        ) : (
          <div className="flex items-end gap-3 h-32">
            {trend.map((point) => (
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
  )
}
