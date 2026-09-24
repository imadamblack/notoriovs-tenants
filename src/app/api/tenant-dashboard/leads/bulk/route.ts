import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireDashboardAuth, sessionCan } from '@/utils/requireDashboardAuth'
import { buildBulkLeadsWhere, MAX_BULK_LEADS, readBulkLeadIds } from '@/utils/leadDashboardFilters'
import { resolveStageAndStatus } from '@/utils/leadStageStatus'

// Edición en bulto desde la Lista del dashboard: mover varios leads a una
// etapa o marcarles un resultado de una vez.
//
// Vive aquí y no en el panel de Payload a propósito. En el panel, "Select all"
// armaba su `where` sin el tenant elegido y editó los leads de todos los
// clientes; aquí el tenant no es una opción de la pantalla sino el del host,
// y va dentro del `where` (`buildBulkLeadsWhere`) pase lo que pase con los ids.
//
// Solo `stage` y `status`. Contacto, notas y respuestas son de un lead a la
// vez, y borrar en bulto no existe: borrar es irreversible.
export async function PATCH(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const auth = await requireDashboardAuth(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!sessionCan(auth.session, 'leads:update')) {
    return NextResponse.json({ error: 'Tu rol no permite editar leads' }, { status: 403 })
  }

  const ids = readBulkLeadIds(body?.ids)
  if (!ids) {
    return NextResponse.json(
      { error: `Manda entre 1 y ${MAX_BULK_LEADS} leads` },
      { status: 400 },
    )
  }

  const data: { stage?: unknown; status?: unknown } = {}
  if ('stage' in (body || {})) data.stage = body.stage
  if ('status' in (body || {})) data.status = body.status
  if (!('stage' in data) && !('status' in data)) {
    return NextResponse.json({ error: 'Falta la etapa o el resultado' }, { status: 400 })
  }

  const resolved = resolveStageAndStatus(auth.tenant, data)
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 })

  const payload = await getPayload({ config })
  const result = await payload.update({
    collection: 'leads',
    where: buildBulkLeadsWhere(auth.tenant.id, ids),
    data: resolved.data as { stage?: string; status?: 'open' | 'won' | 'lost' | 'disqualified' },
    depth: 0,
    overrideAccess: true,
  })

  return NextResponse.json({ leads: result.docs, failed: result.errors.length })
}
