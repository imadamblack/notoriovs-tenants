import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { requireDashboardTenant } from '@/utils/requireDashboardAuth'
import { buildWeekBuckets, normalizeSinceKey, sinceCutoffISO, trendStartMs } from '@/utils/dashboardPeriod'

// KPIs del dashboard de cliente.
//
// Todo se resuelve con `payload.count()` (COUNT(*) con los índices
// `tenant+stage` / `tenant+status` de Leads.ts) en vez de traer los Leads
// del tenant a memoria y contarlos en JS. Antes esta ruta pedía
// `limit: 5000`: con un tenant grande eso era traer megabytes por cada
// visita a la pestaña de KPIs, y encima truncaba en silencio pasados los
// 5000. Son ~20 COUNTs (uno por etapa, uno por status, uno por semana de
// la tendencia), todos baratos y acotados.
//
// Los Marketing Reports SÍ se traen completos (no hay COUNT que sirva:
// hace falta sumar spend/leads/impressions/clicks). Desde el issue #19 un
// Marketing Report es un día, así que la ventana de marketing es la MISMA
// que la del resto del dashboard (antes eran "semanas completas" propias,
// porque el reporte era semanal — ya no aplica). `limit` de 5000 es
// generoso a propósito: pocos tenants, pocas campañas, y aun con años de
// historia diaria no se acerca a ese tope.
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

  // Mismo `sinceCutoff` que los Leads: la sección de Marketing ya no tiene
  // una ventana propia (ver comentario de arriba).
  const marketingWhere: Where[] = [{ tenant: { equals: tenant.id } }]
  if (sinceCutoff) marketingWhere.push({ date: { greater_than_equal: sinceCutoff } })

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
        sort: '-date',
        limit: 5000,
        depth: 0,
        overrideAccess: true,
      }),
    ])

  const pct = (part: number) => (total ? Math.round((part / total) * 1000) / 10 : 0)

  // Progreso por etapa: agrupa por `stage` (la columna del Kanban), no por
  // `status`. Las dos cosas son independientes desde que se separaron: un
  // lead puede estar "Ganado" (status) sentado en cualquier etapa.
  //
  // Y es un EMBUDO, no un corte por columna: cada etapa cuenta los leads que
  // llegaron AL MENOS hasta ahí, no los que están sentados en ella hoy. Un
  // lead en "Paid" ya pasó por "Opt In", así que suma en las dos. Leído como
  // corte, el dashboard decía que solo 2 de 59 habían hecho opt-in, cuando
  // los 59 lo hicieron y 2 además ya pagaron.
  //
  // Se calcula como suma de sufijos sobre `pipeline`, que ya viene en orden
  // de embudo: es el mismo orden en el que se pintan las columnas del Kanban.
  const reachedStage: number[] = []
  let carried = 0
  for (let i = stageCounts.length - 1; i >= 0; i--) {
    carried += stageCounts[i]
    reachedStage[i] = carried
  }

  // El porcentaje sigue siendo sobre `total` (todos los leads del periodo), no
  // sobre la primera etapa: así la primera barra llega a 100% solo cuando
  // TODOS los leads están en el pipeline actual, y el hueco que queda es
  // exactamente el `otherCount` que la vista explica abajo.
  const byStage = pipeline.map((stage, i) => ({
    id: stage.id,
    label: stage.label,
    count: reachedStage[i],
    pct: pct(reachedStage[i]),
    // Conversión contra la etapa ANTERIOR ("de los que llegaron a Survey,
    // cuántos agendaron"), que es la que dice DÓNDE se cae el embudo: el
    // porcentaje sobre el total no distingue entre una etapa que pierde mucha
    // gente y una que simplemente hereda pocos leads de arriba.
    //
    // `null` en la primera etapa (no hay anterior) y también cuando la
    // anterior venía en cero: ahí no hay conversión que medir, y un "0%"
    // se leería como una fuga que no existe.
    stepPct:
      i === 0 || !reachedStage[i - 1]
        ? null
        : Math.round((reachedStage[i] / reachedStage[i - 1]) * 1000) / 10,
  }))

  const trend = buckets.map((bucket, i) => ({ week: bucket.week, count: trendCounts[i] }))

  // `reports` son días crudos: (tenant, campaign, date). La tabla que ve
  // el cliente es por CAMPAÑA dentro de la ventana, no por día — con la
  // ventana pedida (7 días, 30, "Máximo") una tabla de un renglón por día
  // sería enorme y no es lo que el dueño del negocio quiere comparar.
  //
  // `ctr` y `costPerLead` se calculan aquí, por campaña, dividiendo los
  // ACUMULADOS de la ventana (issue #19: no se promedian días sueltos).
  type CampaignAgg = {
    campaign: string
    spend: number
    leads: number
    impressions: number
    clicks: number
  }
  const byCampaign = new Map<string, CampaignAgg>()
  for (const r of reports) {
    const campaign = r.campaign || 'Sin campaña'
    const agg = byCampaign.get(campaign) ?? { campaign, spend: 0, leads: 0, impressions: 0, clicks: 0 }
    agg.spend += r.spend || 0
    agg.leads += r.leads || 0
    agg.impressions += r.impressions || 0
    agg.clicks += r.clicks || 0
    byCampaign.set(campaign, agg)
  }

  const marketing = Array.from(byCampaign.values())
    .map((agg) => ({
      campaign: agg.campaign,
      spend: agg.spend,
      leads: agg.leads,
      impressions: agg.impressions,
      clicks: agg.clicks,
      ctr: agg.impressions ? Math.round((agg.clicks / agg.impressions) * 1000) / 10 : null,
      costPerLead: agg.leads ? Math.round((agg.spend / agg.leads) * 100) / 100 : null,
    }))
    .sort((a, b) => b.spend - a.spend)

  const marketingTotals = reports.reduce(
    (acc, r) => {
      acc.spend += r.spend || 0
      acc.leads += r.leads || 0
      acc.impressions += r.impressions || 0
      acc.clicks += r.clicks || 0
      return acc
    },
    { spend: 0, leads: 0, impressions: 0, clicks: 0 },
  )

  // El rango que se etiqueta en la vista es el REAL de los días que
  // entraron, no el teórico de la ventana: si el tenant lleva dos semanas
  // sin ads, decir "últimos 30 días" mentiría sobre lo que suman los
  // números de abajo.
  const dates = reports.map((r) => String(r.date)).filter(Boolean).sort()
  const marketingRange = dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null

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
