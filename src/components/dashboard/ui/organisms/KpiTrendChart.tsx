import SectionHeading from '@/components/dashboard/ui/atoms/SectionHeading'
import type { TrendPoint } from '@/components/dashboard/KpiReport'

type KpiTrendChartProps = {
  trend: TrendPoint[]
}

export default function KpiTrendChart({ trend }: KpiTrendChartProps) {
  const maxTrend = Math.max(1, ...trend.map((t) => t.count))

  return (
    <div className="bg-neutral-900 p-4 flex-1 min-w-[160px]">
      <p className="-ft-2 tracking-wide text-neutral-400">Leads por semana</p>
      <div className="bg-neutral-900 p-4">
        {trend.length === 0 ? (
          <p className="text-sm text-neutral-400">Todavía no hay leads suficientes para una tendencia.</p>
        ) : (
          <div className="flex items-end gap-3 h-32">
            {trend.map((point) => (
              <div key={point.week} className="flex flex-col gap-1 flex-1">
                <div
                  className="w-full bg-brand-5 rounded-t"
                  style={{ height: `${(point.count / maxTrend) * 100}%`, minHeight: 4 }}
                />
                <span className="-ft-4 text-left text-neutral-400"
                  dangerouslySetInnerHTML={{
                    __html: new Date(point.week)
                      .toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
                      .toString().split('-')
                      .join('<br/>')
                  }}
                />
                {/*<span className="text-[11px] text-neutral-600 font-medium">{point.count}</span>*/}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
