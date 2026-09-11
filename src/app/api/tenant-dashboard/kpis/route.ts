import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { requireDashboardTenant } from '@/utils/requireDashboardAuth'
import {
  buildWeekBuckets,
  fullWeekWindow,
  normalizeSinceKey,
  sinceCutoffISO,
  trendStartMs,
} from '@/utils/dashboardPeriod'

// KPIs del dashboard de cliente.
//
// Dos decisiones que sorprenden si se leen sin contexto:
//
// 1. Todo se resuelve con `payload.count()` (COUNT(*) con los índices
//    `tenant+stage` / `tenant+status` de Leads.ts) en vez de traer los
//    Leads del tenant a memoria y contarlos en JS. Antes esta ruta pedía
//    `limit: 5000`: con un tenant grande eso era traer megabytes por cada
//    visita a la pestaña de KPIs, y encima truncaba en silencio pasados
//    los 5000. Son ~20 COUNTs (uno por etapa, uno por status, uno por
//    semana de la tendencia), todos baratos y acotados.
//
// 2. Los KPIs de Leads respetan el periodo elegido tal cual, pero los de
//    marketing usan SEMANAS COMPLETAS (ver `fullWeekWindow`) y devuelven
//    su propio rango en `marketingRange` para que la vista lo etiquete.
//    Un Marketing Report es semanal y viene tal cual de la plataforma de
//    anuncios; partirlo a la mitad para que cuadre con "30 días" daría un
//    gasto y un CPL que no coinciden con lo que el cliente ve en Meta.
export async function GET(req: NextRequest) {
  const tenant = await requireDashboardTenant(req)
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sinceKey = normalizeSinceKey(req.nextUrl.searchParams.get('since'))
  const now = Date.now()
  const payload = await getPayload({ config })

  const base: Where[] = [{ tenant: { equals: tenant.id } }]
  const sinceCutoff = sinceCutoffISO(sinceKey, now)
  if (sinceCutoff) base.push({ createdAt: { greater_than_equal: sinceCutoff } })

  const countLeads = async (extra: Where[] = []) => {
    const { totalDocs } = await payload.count({
      collection: 'leads',
      where: { and: [...base, ...extra] },
      overrideAccess: true,
    })
    return totalDocs
  }

  const pipeline = tenant.leadPipeline || []
  const pipelineIds = pipeline.map((s) => s.id)

  // La tendencia arranca en el inicio del periodo (o en las últimas 8
  // semanas con "Máximo"); cada barra es un COUNT acotado a su semana.
  const buckets = buildWeekBuckets(trendStartMs(sinceKey, now), now)

  const marketingWindow = fullWeekWindow(sinceKey, now)
  const marketingWhere: Where[] = [
    { tenant: { equals: tenant.id } },
    { weekEnd: { less_than_equal: marketingWindow.endISO } },
  ]
  if (marketingWindow.startISO) {
    marketingWhere.push({ weekStart: { greater_than_equal: marketingWindow.startISO } })
  }

  const [total, stageCounts, otherCount, won, lost, disqualified, trendCounts, { docs: reports }] =
    await Promise.all([
      countLeads(),
      Promise.all(pipeline.map((stage) => countLeads([{ stage: { equals: stage.id } }]))),
      pipelineIds.length ? countLeads([{ stage: { not_in: pipelineIds } }]) : Promise.resolve(0),
      countLeads([{ status: { equals: 'won' } }]),
      countLeads([{ status: { equals: 'lost' } }]),
      countLeads([{ status: { equals: 'disqualified' } }]),
      Promise.all(
        buckets.map((bucket) =>
          countLeads([
            { createdAt: { greater_than_equal: bucket.startISO } },
            { createdAt: { less_than: bucket.endISO } },
          ]),
        ),
      ),
      payload.find({
        collection: 'marketing-reports',
        where: { and: marketingWhere },
        sort: '-weekStart',
        limit: 26, // ~6 meses
        depth: 0,
        overrideAccess: true,
      }),
    ])

  const pct = (part: number) => (total ? Math.round((part / total) * 1000) / 10 : 0)

  // Progreso por etapa: agrupa por `stage` (la columna del Kanban), no por
  // `status`. Las dos cosas son independientes desde que se separaron: un
  // lead puede estar "Ganado" (status) sentado en cualquier etapa.
  const byStage = pipeline.map((stage, i) => ({
    id: stage.id,
    label: stage.label,
    count: stageCounts[i],
    pct: pct(stageCounts[i]),
  }))

  const trend = buckets.map((bucket, i) => ({ week: bucket.week, count: trendCounts[i] }))

  const marketing = reports
    .map((r) => ({
      id: r.id,
      campaign: r.campaign,
      weekStart: r.weekStart,
      weekEnd: r.weekEnd,
      impressions: r.impressions,
      reach: r.reach,
      frequency: r.frequency,
      cpm: r.cpm,
      clicks: r.clicks,
      ctr: r.ctr,
      landingPageViews: r.landingPageViews,
      leads: r.leads,
      costPerLead: r.costPerLead,
      spend: r.spend,
      ads: r.ads,
    }))
    .sort((a, b) => String(b.weekStart).localeCompare(String(a.weekStart)))

  const marketingTotals = marketing.reduce(
    (acc, r) => {
      acc.spend += r.spend || 0
      acc.leads += r.leads || 0
      acc.impressions += r.impressions || 0
      acc.clicks += r.clicks || 0
      return acc
    },
    { spend: 0, leads: 0, impressions: 0, clicks: 0 },
  )

  // El rango que se etiqueta en la vista es el REAL de los reportes que
  // entraron, no el teórico de la ventana: si el tenant lleva dos semanas
  // sin ads, decir "últimas 4 semanas" mentiría sobre lo que suman los
  // números de abajo.
  const weekStarts = marketing.map((r) => String(r.weekStart)).filter(Boolean)
  const weekEnds = marketing.map((r) => String(r.weekEnd)).filter(Boolean)
  const marketingRange = marketing.length
    ? { start: weekStarts.sort()[0], end: weekEnds.sort()[weekEnds.length - 1] }
    : null

  return NextResponse.json({
    since: sinceKey,
    rangeStart: sinceCutoff ?? null,
    total,
    byStage,
    otherCount,
    won,
    lost,
    disqualified,
    conversionRate: pct(won),
    lossRate: pct(lost),
    disqualifiedRate: pct(disqualified),
    trend,
    marketing,
    marketingRange,
    marketingTotals: {
      ...marketingTotals,
      avgCostPerLead: marketingTotals.leads
        ? Math.round((marketingTotals.spend / marketingTotals.leads) * 100) / 100
        : 0,
    },
  })
}
