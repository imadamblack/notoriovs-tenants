import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTenantBySubdomain } from '@/utils/getTenant'

// Endpoint server-to-server para que el workflow de n8n que ya arma los
// KPIs semanales de ads (el mismo que hoy escribe al Google Sheet) empuje
// esas filas aquí también. Protegido con un secreto compartido en vez de
// login: no hay usuario "n8n" en Payload, es una integración máquina-a-
// máquina igual que el resto de webhooks del proyecto.
//
// Definir MARKETING_REPORT_INGEST_KEY en .env antes de usar este endpoint
// en n8n (header `x-ingest-key`). Si la env var no está configurada, el
// endpoint rechaza todo por default-deny.
//
// Acepta las mismas columnas que el Sheet (date_start, date_stop, campaign,
// impressions, reach, frequency, cpm, clicks, ctr, landing_page_views,
// leads, cost_per_lead, spend, ads) tal cual las produce n8n hoy, incluidos
// strings con formato ("$652.05", "0.91%", "SM :: A, SM :: B"): se
// normalizan aquí, así que no hace falta tocar el nodo que arma esos
// valores en el workflow, solo agregar el nodo HTTP Request que llama a
// este endpoint.
type IncomingReport = {
  date_start?: string
  date_stop?: string
  campaign?: string
  impressions?: number | string
  reach?: number | string
  frequency?: number | string
  cpm?: number | string
  clicks?: number | string
  ctr?: number | string
  landing_page_views?: number | string
  leads?: number | string
  cost_per_lead?: number | string
  spend?: number | string
  ads?: string | string[]
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  const cleaned = String(value).replace(/[^0-9.-]/g, '')
  const num = parseFloat(cleaned)
  return Number.isNaN(num) ? undefined : num
}

function toAdsList(value: unknown): string[] | undefined {
  if (!value) return undefined
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean)
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export async function POST(req: NextRequest) {
  const expectedKey = process.env.MARKETING_REPORT_INGEST_KEY
  if (!expectedKey) {
    return NextResponse.json(
      { error: 'MARKETING_REPORT_INGEST_KEY no está configurado en el servidor' },
      { status: 503 },
    )
  }
  if (req.headers.get('x-ingest-key') !== expectedKey) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const subdomain = typeof body?.subdomain === 'string' ? body.subdomain.toLowerCase() : ''
  const reports: IncomingReport[] = Array.isArray(body?.reports)
    ? body.reports
    : body?.date_start
      ? [body as IncomingReport] // permite mandar una sola fila suelta también
      : []

  if (!subdomain) return NextResponse.json({ error: 'Falta subdomain' }, { status: 400 })
  if (!reports.length) return NextResponse.json({ error: 'Falta "reports" (array)' }, { status: 400 })

  const tenant = await getTenantBySubdomain(subdomain)
  if (!tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })

  const payload = await getPayload({ config })
  const results: Array<{ campaign?: string; weekStart?: string; op: 'created' | 'updated' | 'skipped'; error?: string }> = []

  for (const row of reports) {
    if (!row.date_start || !row.date_stop || !row.campaign) {
      results.push({ campaign: row.campaign, op: 'skipped', error: 'Falta date_start/date_stop/campaign' })
      continue
    }

    const data = {
      tenant: Number(tenant.id),
      weekStart: new Date(row.date_start).toISOString(),
      weekEnd: new Date(row.date_stop).toISOString(),
      campaign: row.campaign,
      impressions: toNumber(row.impressions),
      reach: toNumber(row.reach),
      frequency: toNumber(row.frequency),
      cpm: toNumber(row.cpm),
      clicks: toNumber(row.clicks),
      ctr: toNumber(row.ctr),
      landingPageViews: toNumber(row.landing_page_views),
      leads: toNumber(row.leads),
      costPerLead: toNumber(row.cost_per_lead),
      spend: toNumber(row.spend),
      ads: toAdsList(row.ads),
    }

    try {
      // Upsert por (tenant, weekStart, weekEnd, campaign): permite que n8n
      // vuelva a mandar la misma semana (backfill/retry) sin duplicar filas.
      const { docs: existing } = await payload.find({
        collection: 'marketing-reports',
        where: {
          and: [
            { tenant: { equals: tenant.id } },
            { weekStart: { equals: data.weekStart } },
            { weekEnd: { equals: data.weekEnd } },
            { campaign: { equals: data.campaign } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (existing[0]) {
        await payload.update({
          collection: 'marketing-reports',
          id: existing[0].id,
          data,
          overrideAccess: true,
        })
        results.push({ campaign: row.campaign, weekStart: row.date_start, op: 'updated' })
      } else {
        await payload.create({ collection: 'marketing-reports', data, overrideAccess: true })
        results.push({ campaign: row.campaign, weekStart: row.date_start, op: 'created' })
      }
    } catch (err) {
      results.push({ campaign: row.campaign, weekStart: row.date_start, op: 'skipped', error: String(err) })
    }
  }

  return NextResponse.json({ ok: true, results })
}
