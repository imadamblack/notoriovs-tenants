import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTenantBySubdomain } from '@/utils/getTenant'

// Endpoint server-to-server para que el n8n de Notoriovs meta Leads que no
// pasaron por el quiz: el formulario nativo de Meta Ads, un mensaje de
// WhatsApp, una lista que nos pasó el cliente. Mismo molde que
// /api/marketing-reports/ingest — secreto compartido en un header,
// `subdomain` en el body, default-deny si la env var no está puesta.
//
// Definir LEADS_INGEST_KEY en .env antes de usarlo desde n8n (header
// `x-ingest-key`). Es una llave distinta de la del ingest de reportes a
// propósito: rotar una no debe apagar la otra.
//
// POR QUÉ EL `subdomain` VIAJA EN EL BODY. El ADR 0002 pide que el Tenant
// salga del host y no de lo que diga el cliente. Aquí no aplica: la llave es
// una sola y de plataforma —ya autoriza a todos los Tenants por definición—,
// así que el `subdomain` es ruteo, no autorización. La fuga que el ADR evita
// es credencial-del-Tenant-A + Tenant-B-en-el-body, y eso no puede pasar
// mientras no existan credenciales por Tenant. Este endpoint tampoco es una
// segunda forma de autenticarse contra el dashboard: vive aparte, con su
// propia llave, y solo escribe.
type IncomingLead = {
  name?: string
  phone?: string
  whatsapp?: string
  email?: string
  source?: string
  externalId?: string | number
  notes?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  utm?: any
}

// Los tres canales que puede declarar n8n. `quiz` y `manual` quedan fuera a
// propósito: son los dos caminos que NO pasan por aquí, y dejar que este
// endpoint los escriba borraría justamente la distinción que el `source`
// existe para sostener.
const INGEST_SOURCES = ['meta', 'whatsapp', 'import'] as const
type IngestSource = (typeof INGEST_SOURCES)[number]

function toText(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

type RowResult = {
  externalId?: string
  op: 'created' | 'updated' | 'skipped'
  id?: string | number
  error?: string
}

export async function POST(req: NextRequest) {
  const expectedKey = process.env.LEADS_INGEST_KEY
  if (!expectedKey) {
    return NextResponse.json(
      { error: 'LEADS_INGEST_KEY no está configurado en el servidor' },
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
  const leads: IncomingLead[] = Array.isArray(body?.leads)
    ? body.leads
    : body?.name || body?.phone || body?.whatsapp || body?.email
      ? [body as IncomingLead] // permite mandar un solo lead suelto también
      : []

  if (!subdomain) return NextResponse.json({ error: 'Falta subdomain' }, { status: 400 })
  if (!leads.length) return NextResponse.json({ error: 'Falta "leads" (array)' }, { status: 400 })

  const tenant = await getTenantBySubdomain(subdomain, 'leadIngest')
  if (!tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })

  // Misma regla que /api/quiz-submit: el lead nace en la primera etapa del
  // pipeline del tenant, y si no hay pipeline configurado cae al sentinel
  // 'nuevo', que no coincide con ningún id real y deja al lead en la columna
  // "Otro" del dashboard hasta que se configure uno.
  const firstStage = tenant.leadPipeline?.[0]?.id || 'nuevo'

  const payload = await getPayload({ config })
  const results: RowResult[] = []

  for (const row of leads) {
    const name = toText(row?.name)
    const phone = toText(row?.phone)
    const whatsapp = toText(row?.whatsapp)
    const email = toText(row?.email)
    const externalId = toText(row?.externalId)

    if (!name && !phone && !whatsapp && !email) {
      results.push({ externalId, op: 'skipped', error: 'El lead no trae nombre ni forma de contacto' })
      continue
    }

    const declaredSource = toText(row?.source)
    if (declaredSource && !INGEST_SOURCES.includes(declaredSource as IngestSource)) {
      results.push({
        externalId,
        op: 'skipped',
        error: `"source" inválido: usa ${INGEST_SOURCES.join(', ')}`,
      })
      continue
    }

    const data = {
      tenant: Number(tenant.id),
      name,
      phone,
      whatsapp,
      email,
      source: (declaredSource as IngestSource) ?? 'import',
      externalId,
      notes: toText(row?.notes),
      utm: row?.utm ?? null,
    }

    try {
      // Idempotencia por (tenant, externalId): si n8n manda el id que el
      // lead tiene en su sistema de origen, reintentar el mismo envío
      // actualiza el lead en vez de crear otro. Sin `externalId` no hay con
      // qué reconocerlo, así que se crea siempre — es decisión tomada:
      // preferimos aceptar el lead a rechazarlo por falta de id.
      const existing = externalId
        ? (
            await payload.find({
              collection: 'leads',
              where: {
                and: [{ tenant: { equals: tenant.id } }, { externalId: { equals: externalId } }],
              },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
          ).docs[0]
        : undefined

      if (existing) {
        // Al actualizar NO se toca `stage` ni `status`: si alguien del
        // cliente ya movió el lead en el Kanban, un reintento de n8n no
        // puede devolverlo a la primera etapa.
        const updated = await payload.update({
          collection: 'leads',
          id: existing.id,
          data,
          overrideAccess: true,
        })
        results.push({ externalId, op: 'updated', id: updated.id })
      } else {
        const created = await payload.create({
          collection: 'leads',
          data: { ...data, stage: firstStage, status: 'open' },
          overrideAccess: true,
        })
        results.push({ externalId, op: 'created', id: created.id })
      }
    } catch (err) {
      results.push({ externalId, op: 'skipped', error: String(err) })
    }
  }

  return NextResponse.json({ ok: true, results })
}
