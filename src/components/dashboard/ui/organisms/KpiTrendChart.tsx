import SectionHeading from '@/components/dashboard/ui/atoms/SectionHeading'
import type { TrendPoint } from '@/components/dashboard/KpiReport'

type KpiTrendChartProps = {
  trend: TrendPoint[]
}

// `week` es una fecha sin hora ("2025-09-01") y representa un lunes UTC: sin
// forzar UTC al formatear, un navegador en México la corre al domingo previo
// y la etiqueta deja de coincidir con la semana de la tabla de Marketing.
const weekLabel = (week: string) =>
  new Date(week).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: 'UTC' })

// Deja aire arriba de la línea para que la etiqueta del punto más alto quepa
// dentro de la caja en vez de salirse por encima.
const TOP_PADDING = 18

export default function KpiTrendChart({ trend }: KpiTrendChartProps) {
  const maxTrend = Math.max(1, ...trend.map((t) => t.count))

  // Coordenadas en porcentaje: el SVG se estira con `preserveAspectRatio="none"`
  // y la línea conserva su grosor gracias a `vectorEffect`, así que la gráfica
  // es fluida sin tener que medir el contenedor en el cliente.
  const x = (i: number) => (trend.length === 1 ? 50 : (i / (trend.length - 1)) * 100)
  const y = (count: number) => TOP_PADDING + (1 - count / maxTrend) * (100 - TOP_PADDING)
  const line = trend.map((point, i) => `${x(i)},${y(point.count)}`).join(' ')

  // Con muchas semanas las fechas se encimarían, así que se pintan salteadas
  // (el último punto siempre lleva etiqueta: es el dato más reciente).
  const labelStep = trend.length > 8 ? 2 : 1

  return (
    <section className="flex-col">
      <SectionHeading>Leads por semana</SectionHeading>
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
        {trend.length === 0 ? (
          <p className="-ft-1 text-neutral-400">Todavía no hay leads suficientes para una tendencia.</p>
        ) : (
          <div className="px-6">
            <div className="relative h-44 border-b border-neutral-800">
              <svg
                className="absolute inset-0 w-full h-full overflow-visible text-brand-3"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  points={line}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {/* Punto y valor van sueltos (no anidados) para que cada uno se
                  ancle exacto: el punto centrado en su coordenada y el número
                  justo encima, sin que el alto del texto corra la línea. */}
              {trend.map((point, i) => (
                <span
                  key={`dot-${point.week}`}
                  className="absolute w-2 h-2 rounded-full bg-brand-3 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${x(i)}%`, top: `${y(point.count)}%` }}
                />
              ))}
              {trend.map((point, i) => (
                <span
                  key={`value-${point.week}`}
                  className="absolute -ft-4 font-medium text-neutral-300 tabular-nums -translate-x-1/2 -translate-y-full -mt-2"
                  style={{ left: `${x(i)}%`, top: `${y(point.count)}%` }}
                >
                  {point.count}
                </span>
              ))}
            </div>
            <div className="relative h-5 mt-2">
              {trend.map((point, i) =>
                i % labelStep === 0 || i === trend.length - 1 ? (
                  <span
                    key={point.week}
                    className="absolute -translate-x-1/2 -ft-4 text-neutral-400 whitespace-nowrap"
                    style={{ left: `${x(i)}%` }}
                  >
                    {weekLabel(point.week)}
                  </span>
                ) : null,
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
