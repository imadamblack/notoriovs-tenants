import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { requireDashboardTenant } from '@/utils/requireDashboardAuth'

// Todas las rutas bajo /api/tenant-dashboard/* usan la Local API de Payload
// con `overrideAccess: true` (Leads.access exige `req.user`, que aquí nunca
// existe: no hay usuario de Payload, solo la cookie de sesión del tenant).
// El scoping por tenant se hace a mano en cada query/mutación, nunca
// confiando en nada que venga del cliente sin re-validar contra la sesión.

const SORT_MAP: Record<string, string> = {
  created_desc: '-createdAt',
  created_asc: 'createdAt',
  name_asc: 'name',
}

const ALLOWED_STATUSES_FILTER = new Set(['open', 'won', 'lost', 'disqualified'])

// Campos donde busca el cuadro de "Buscar leads" del dashboard (Kanban y
// Lista). `contains` en Postgres se traduce a ILIKE '%valor%' (case
// insensitive), ver @payloadcms/drizzle/dist/queries/sanitizeQueryValue.js.
const SEARCH_FIELDS = ['name', 'phone', 'whatsapp', 'email'] as const

function clampLimit(raw: string | null): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return 50
  return Math.min(Math.floor(parsed), 100)
}

function clampPage(raw: string | null): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.floor(parsed)
}

// GET soporta paginación y filtros reales (antes traía hasta 1000 leads del
// tenant en una sola llamada, sin paginar; con tenants de miles de leads eso
// truncaba en silencio todo lo que no cupiera en esos 1000). El Kanban pide
// esto una vez por columna (`stage`), la Lista lo pide sin `stage` con su
// propia página.
//
// `stage=__other__` es un valor sintético (no existe en la DB): representa
// leads cuya `stage` no coincide con ninguna etapa del pipeline actual del
// tenant (etapas borradas/renombradas a mano, datos importados con una
// etapa que ya no existe, etc.). El front lo usa para la columna "Otro".
export async function GET(req: NextRequest) {
  const subdomain = req.nextUrl.searchParams.get('subdomain')
  const tenant = await requireDashboardTenant(req, subdomain)
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const params = req.nextUrl.searchParams
  const stage = params.get('stage')?.trim() || undefined
  const status = params.get('status')?.trim() || undefined
  const search = params.get('search')?.trim() || undefined
  const sort = SORT_MAP[params.get('sort') || 'created_desc'] || SORT_MAP.created_desc
  const page = clampPage(params.get('page'))
  const limit = clampLimit(params.get('limit'))

  const and: Where[] = [{ tenant: { equals: tenant.id } }]

  if (stage) {
    if (stage === '__other__') {
      const pipelineIds = (tenant.leadPipeline || []).map((s) => s.id)
      // Si el tenant no tiene pipeline configurado, "otro" es simplemente
      // "todos los leads": no hay ninguna etapa contra la cual comparar.
      if (pipelineIds.length) and.push({ stage: { not_in: pipelineIds } })
    } else {
      and.push({ stage: { equals: stage } })
    }
  }

  if (status && ALLOWED_STATUSES_FILTER.has(status)) {
    and.push({ status: { equals: status } })
  }

  if (search) {
    and.push({
      or: SEARCH_FIELDS.map((field) => ({ [field]: { contains: search } })),
    })
  }

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'leads',
    where: { and },
    sort,
    page,
    limit,
    depth: 0,
    overrideAccess: true,
  })

  return NextResponse.json({
    leads: result.docs,
    pipeline: tenant.leadPipeline || [],
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    page: result.page,
    hasNextPage: result.hasNextPage,
    hasPrevPage: result.hasPrevPage,
  })
}

export async function PATCH(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { subdomain, id } = body || {}
  const tenant = await requireDashboardTenant(req, subdomain)
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const payload = await getPayload({ config })

  // Confirma que el lead pertenece a este tenant antes de tocarlo. Sin este
  // check, cualquier sesión válida de un tenant podría editar leads de otro
  // con solo adivinar/enumerar ids.
  const existing = await payload.findByID({
    collection: 'leads',
    id,
    depth: 0,
    overrideAccess: true,
  })
  const existingTenantId =
    typeof existing?.tenant === 'object' ? (existing.tenant as { id?: unknown })?.id : existing?.tenant
  if (!existing || String(existingTenantId) !== String(tenant.id)) {
    return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  }

  // Solo estos campos son editables desde el dashboard de cliente. Nunca se
  // permite tocar `answers`, `utm`, `tenant` o `source` desde aquí.
  const allowedFields = ['stage', 'status', 'notes', 'name', 'phone', 'whatsapp', 'email'] as const
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  for (const field of allowedFields) {
    if (field in body) data[field] = body[field]
  }

  if ('stage' in data) {
    const matchedStage = tenant.leadPipeline?.find((stage) => stage.id === data.stage)
    if (tenant.leadPipeline?.length && !matchedStage) {
      return NextResponse.json({ error: 'Etapa inválida para este tenant' }, { status: 400 })
    }

    // Auto-sincroniza `status` con la etapa a la que se movió el lead
    // (esto es lo que hace que arrastrar una tarjeta a la columna "Ganado"
    // en el Kanban marque el lead como ganado), salvo que este mismo
    // request ya traiga un `status` explícito: eso pasa cuando se guarda
    // desde el panel de detalle, donde el usuario ve y controla los dos
    // campos ("Etapa" y "Resultado") a la vez y no queremos pisar lo que
    // eligió a propósito.
    if (!('status' in data)) {
      data.status = matchedStage?.isWon ? 'won' : matchedStage?.isLost ? 'lost' : 'open'
    }
  }

  const ALLOWED_STATUSES = new Set(['open', 'won', 'lost', 'disqualified'])
  if ('status' in data && !ALLOWED_STATUSES.has(data.status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  const updated = await payload.update({
    collection: 'leads',
    id,
    data,
    depth: 0,
    overrideAccess: true,
  })

  return NextResponse.json({ lead: updated })
}
