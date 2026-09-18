import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTenantBySubdomain } from '@/utils/getTenant'

// Endpoint server-to-server para que el workflow de n8n que arma los KPIs
// diarios de ads (Meta Insights con time_increment=1) empuje esas filas
// aquí. Protegido con un secreto compartido en vez de login: no hay usuario
// "n8n" en Payload, es una integración máquina-a-máquina igual que el
// resto de webhooks del proyecto.
//
// Definir MARKETING_REPORT_INGEST_KEY en .env antes de usar este endpoint
// en n8n (header `x-ingest-key`). Si la env var no está configurada, el
// endpoint rechaza todo por default-deny.
//
// Issue #19: un Marketing Report es UN DÍA de una campaña, no una semana.
// El job de n8n corre diario y manda una ventana móvil de los últimos 7
// días en cada llamada (Meta corrige atribución hacia atrás 2-3 días), y
// cada fila PISA la que ya existía para (tenant, campaign, date) en vez de
// insertar — así reingestar la misma ventana todos los días no duplica ni
// deja huecos.
//
// Acepta las columnas tal cual las produce el nodo de Meta Insights de
// n8n (date_start, campaign, impressions, clicks, landing_page_views,
// leads, spend, ads), incluidos strings con formato ("$652.05",
// "SM :: A, SM :: B"): se normalizan aquí, así que no hace falta tocar el
// nodo que arma esos valores. `date_stop` se acepta pero se ignora fuera
// de validar que, si viene, sea el mismo día que `date_start` (un
// Marketing Report ya no cubre un rango).
//
// `reach`, `frequency`, `cpm`, `ctr` y `cost_per_lead` se aceptan si n8n
// todavía los manda (para no forzar tocar ese nodo el mismo día que este
// endpoint), pero se ignoran: no se guardan (ver MarketingReports.ts).
type IncomingReport = {
  date_start?: string
  date_stop?: string
  campaign?: string
  impressions?: number | string
  clicks?: number | string
  landing_page_views?: number | string
  leads?: number | string
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

// YYYY-MM-DD del día, sin horas: dos fechas del mismo día con horas
// distintas (por zona horaria del emisor) deben resolver a la misma fila.
function toDayKey(value: string): string | undefined {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString().slice(0, 10)
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
      ? [body as IncomingReport] // permite mandar un solo día suelto también
      : []

  if (!subdomain) return NextResponse.json({ error: 'Falta subdomain' }, { status: 400 })
  if (!reports.length) return NextResponse.json({ error: 'Falta "reports" (array)' }, { status: 400 })

  const tenant = await getTenantBySubdomain(subdomain, 'identity')
  if (!tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })

  const payload = await getPayload({ config })
  const results: Array<{ campaign?: string; date?: string; op: 'created' | 'updated' | 'skipped'; error?: string }> = []

  for (const row of reports) {
    if (!row.date_start || !row.campaign) {
      results.push({ campaign: row.campaign, op: 'skipped', error: 'Falta date_start/campaign' })
      continue
    }

    const dayKey = toDayKey(row.date_start)
    if (!dayKey) {
      results.push({ campaign: row.campaign, op: 'skipped', error: 'date_start inválida' })
      continue
    }
    if (row.date_stop && toDayKey(row.date_stop) !== dayKey) {
      results.push({
        campaign: row.campaign,
        date: dayKey,
        op: 'skipped',
        error: 'date_stop no coincide con date_start: un Marketing Report es un día, no un rango',
      })
      continue
    }

    const data = {
      tenant: Number(tenant.id),
      date: new Date(dayKey).toISOString(),
      campaign: row.campaign,
      impressions: toNumber(row.impressions),
      clicks: toNumber(row.clicks),
      landingPageViews: toNumber(row.landing_page_views),
      leads: toNumber(row.leads),
      spend: toNumber(row.spend),
      ads: toAdsList(row.ads),
    }

    try {
      // Upsert por (tenant, campaign, date): permite que n8n reingeste la
      // misma ventana móvil de 7 días todos los días (retry/corrección de
      // atribución de Meta) sin duplicar filas.
      const { docs: existing } = await payload.find({
        collection: 'marketing-reports',
        where: {
          and: [
            { tenant: { equals: tenant.id } },
            { date: { equals: data.date } },
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
        results.push({ campaign: row.campaign, date: dayKey, op: 'updated' })
      } else {
        await payload.create({ collection: 'marketing-reports', data, overrideAccess: true })
        results.push({ campaign: row.campaign, date: dayKey, op: 'created' })
      }
    } catch (err) {
      results.push({ campaign: row.campaign, date: dayKey, op: 'skipped', error: String(err) })
    }
  }

  return NextResponse.json({ ok: true, results })
}
