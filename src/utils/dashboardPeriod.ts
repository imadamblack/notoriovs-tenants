// Periodo del dashboard ("Hoy / 7 días / 30 días / 3 meses / Máximo").
//
// Vive aparte de leadDashboardFilters.ts porque lo importan las dos
// orillas: el servidor (rutas de leads, counts y kpis) y el cliente (el
// selector del toolbar y la etiqueta de rango de la sección de Marketing).
// leadDashboardFilters.ts arrastra tipos y helpers atados a Payload, así
// que dejarlo ahí obligaría al bundle del navegador a importar de más.
//
// Todas las ventanas son rodantes desde "ahora" (24h/7d/30d/90d), no días
// de calendario: el tenant no tiene zona horaria guardada en ningún lado,
// así que "Hoy" como "desde medianoche" no se puede calcular de forma
// confiable. `all` ("Máximo") no filtra nada.

export type SinceKey = 'today' | '7d' | '30d' | '3m' | 'all'

export const SINCE_DAYS: Record<string, number> = { today: 1, '7d': 7, '30d': 30, '3m': 90 }

export const SINCE_LABELS: Record<SinceKey, string> = {
  today: 'Hoy',
  '7d': '7 días',
  '30d': '30 días',
  '3m': '3 meses',
  all: 'Máximo',
}

export const DEFAULT_SINCE_KEY: SinceKey = 'all'

const DAY_MS = 86400000
const WEEK_MS = 7 * DAY_MS

// Cuántas semanas se pintan en la tendencia cuando el periodo es "Máximo"
// (no hay un inicio de rango del cual partir) y cuántas barras como mucho
// para cualquier otro periodo. 14 cubre "3 meses" completo sin recortar.
const TREND_WEEKS_WHEN_ALL = 8
const MAX_TREND_BUCKETS = 14

export function normalizeSinceKey(raw: string | null | undefined): SinceKey {
  if (raw && (raw in SINCE_LABELS)) return raw as SinceKey
  return DEFAULT_SINCE_KEY
}

export function sinceCutoffISO(sinceKey: string | undefined, now: number = Date.now()): string | undefined {
  if (!sinceKey || !SINCE_DAYS[sinceKey]) return undefined
  return new Date(now - SINCE_DAYS[sinceKey] * DAY_MS).toISOString()
}

// Lunes 00:00 UTC de la semana a la que pertenece `date`. Es el mismo
// criterio (semana lunes-domingo) con el que llegan los Marketing Reports
// desde n8n, para que la tendencia de leads y la tabla de ads hablen de
// las mismas semanas.
export function weekStartUTC(date: Date): Date {
  const day = date.getUTCDay() || 7 // domingo -> 7
  const monday = new Date(date)
  monday.setUTCDate(date.getUTCDate() - day + 1)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

export type WeekBucket = { week: string; startISO: string; endISO: string }

// Divide [start, end] en semanas lunes-domingo. La primera y la última se
// recortan al rango pedido (no al lunes/domingo), para que la suma de las
// barras sea exactamente el total del periodo y no un número mayor que el
// KPI de "Leads totales" que está arriba en la misma pantalla.
export function buildWeekBuckets(startMs: number, endMs: number, maxBuckets = MAX_TREND_BUCKETS): WeekBucket[] {
  if (!(endMs > startMs)) return []

  const weekStarts: number[] = []
  for (let cursor = weekStartUTC(new Date(startMs)).getTime(); cursor < endMs; cursor += WEEK_MS) {
    weekStarts.push(cursor)
  }

  return weekStarts.slice(-maxBuckets).map((weekStart) => ({
    week: new Date(weekStart).toISOString().slice(0, 10),
    startISO: new Date(Math.max(weekStart, startMs)).toISOString(),
    endISO: new Date(Math.min(weekStart + WEEK_MS, endMs)).toISOString(),
  }))
}

// Inicio de la tendencia para un periodo dado. Con "Máximo" no hay corte,
// así que se muestran las últimas TREND_WEEKS_WHEN_ALL semanas.
export function trendStartMs(sinceKey: SinceKey, now: number = Date.now()): number {
  const days = SINCE_DAYS[sinceKey]
  if (days) return now - days * DAY_MS
  return weekStartUTC(new Date(now)).getTime() - (TREND_WEEKS_WHEN_ALL - 1) * WEEK_MS
}

// Ventana de SEMANAS COMPLETAS contenida en el periodo, para los KPIs de
// marketing. Un Marketing Report es semanal y viene tal cual de la
// plataforma de anuncios: si se recortara a la mitad para que cuadre con
// "30 días", el gasto y el CPL que muestra el dashboard no coincidirían
// con lo que el cliente ve en Meta. Por eso aquí el periodo se redondea
// hacia adentro: empieza en el primer lunes DENTRO del rango y termina en
// el último domingo ya cerrado.
export function fullWeekWindow(sinceKey: SinceKey, now: number = Date.now()): { startISO?: string; endISO: string } {
  // Fin: el domingo 23:59:59.999 de la última semana ya terminada, o sea
  // el lunes de la semana en curso menos un milisegundo.
  const endISO = new Date(weekStartUTC(new Date(now)).getTime() - 1).toISOString()

  const days = SINCE_DAYS[sinceKey]
  if (!days) return { endISO }

  const cutoff = now - days * DAY_MS
  const cutoffWeekStart = weekStartUTC(new Date(cutoff)).getTime()
  // Si el corte cae a mitad de semana, esa semana queda fuera: el primer
  // lunes dentro del rango es el de la semana siguiente.
  const startMs = cutoffWeekStart === cutoff ? cutoffWeekStart : cutoffWeekStart + WEEK_MS
  return { startISO: new Date(startMs).toISOString(), endISO }
}
