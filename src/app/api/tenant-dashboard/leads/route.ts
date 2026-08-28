import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireDashboardTenant } from '@/utils/requireDashboardAuth'

// Todas las rutas bajo /api/tenant-dashboard/* usan la Local API de Payload
// con `overrideAccess: true` (Leads.access exige `req.user`, que aquí nunca
// existe: no hay usuario de Payload, solo la cookie de sesión del tenant).
// El scoping por tenant se hace a mano en cada query/mutación, nunca
// confiando en nada que venga del cliente sin re-validar contra la sesión.

export async function GET(req: NextRequest) {
  const subdomain = req.nextUrl.searchParams.get('subdomain')
  const tenant = await requireDashboardTenant(req, subdomain)
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'leads',
    where: { tenant: { equals: tenant.id } },
    sort: '-createdAt',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })

  return NextResponse.json({ leads: docs, pipeline: tenant.leadPipeline || [] })
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
  const allowedFields = ['status', 'notes', 'name', 'phone', 'whatsapp', 'email'] as const
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  for (const field of allowedFields) {
    if (field in body) data[field] = body[field]
  }

  if (
    'status' in data &&
    tenant.leadPipeline?.length &&
    !tenant.leadPipeline.some((stage) => stage.key === data.status)
  ) {
    return NextResponse.json({ error: 'Etapa inválida para este tenant' }, { status: 400 })
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
