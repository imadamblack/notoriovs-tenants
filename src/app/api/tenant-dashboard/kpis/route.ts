import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireDashboardTenant } from '@/utils/requireDashboardAuth'

type LeadRow = { stage?: string | null; status?: string | null; createdAt?: string }

// Agrupa leads por semana (lunes-domingo) para la gráfica de tendencia.
// Simple a propósito: sin librerías de fechas, solo Date nativo.
function weekKey(dateStr: string | undefined): string {
  const d = dateStr ? new Date(dateStr) : new Date()
  const day = d.getUTCDay() || 7 // domingo -> 7
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - day + 1)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const subdomain = req.nextUrl.searchParams.get('subdomain')
  const tenant = await requireDashboardTenant(req, subdomain)
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const payload = await getPayload({ config })

  const [{ docs: leads }, { docs: reports }] = await Promise.all([
    payload.find({
      collection: 'leads',
      where: { tenant: { equals: tenant.id } },
      limit: 5000,
      depth: 0,
      select: { stage: true, status: true, createdAt: true },
      overrideAccess: true,
    }),
    payload.find({
      collection: 'marketing-reports',
      where: { tenant: { equals: tenant.id } },
      sort: '-weekStart',
      limit: 26, // ~6 meses
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const pipeline = tenant.leadPipeline || []
  const total = leads.length

  // Progreso por etapa: agrupa por `stage` (la columna del Kanban), no por
  // `status`. Las dos cosas son independientes desde que se separaron: un
  // lead puede estar "Ganado" (status) sentado en cualquier etapa.
  const byStage = pipeline.map((stage) => {
    const count = (leads as LeadRow[]).filter((l) => l.stage === stage.id).length
    return {
      id: stage.id,
      label: stage.label,
      count,
      pct: total ? Math.round((count / total) * 1000) / 10 : 0,
    }
  })

  const knownIds = new Set(pipeline.map((s) => s.id))
  const otherCount = (leads as LeadRow[]).filter((l) => !l.stage || !knownIds.has(l.stage)).length

  // Conversión: ahora se lee directo del `status` fijo (open/won/lost/
  // disqualified) en vez de inferirse de las etiquetas del pipeline, así
  // que no depende de cómo cada tenant nombró sus etapas.
  const won = (leads as LeadRow[]).filter((l) => l.status === 'won').length
  const lost = (leads as LeadRow[]).filter((l) => l.status === 'lost').length
  const disqualified = (leads as LeadRow[]).filter((l) => l.status === 'disqualified').length

  const weekBuckets = new Map<string, number>()
  for (const lead of leads as LeadRow[]) {
    const key = weekKey(lead.createdAt)
    weekBuckets.set(key, (weekBuckets.get(key) || 0) + 1)
  }
  const trend = Array.from(weekBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, count]) => ({ week, count }))

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

  return NextResponse.json({
    total,
    byStage,
    otherCount,
    won,
    lost,
    disqualified,
    conversionRate: total ? Math.round((won / total) * 1000) / 10 : 0,
    lossRate: total ? Math.round((lost / total) * 1000) / 10 : 0,
    disqualifiedRate: total ? Math.round((disqualified / total) * 1000) / 10 : 0,
    trend,
    marketing,
    marketingTotals: {
      ...marketingTotals,
      avgCostPerLead: marketingTotals.leads ? Math.round((marketingTotals.spend / marketingTotals.leads) * 100) / 100 : 0,
    },
  })
}
