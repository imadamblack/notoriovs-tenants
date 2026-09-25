import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireDashboardAuth, sessionCan, type DashboardSession } from '@/utils/requireDashboardAuth'
import type { Where } from 'payload'
import {
  buildBulkLeadsWhere,
  MAX_BULK_LEADS,
  readAssigneeValue,
  readBulkLeadIds,
} from '@/utils/leadDashboardFilters'
import { resolveStageAndStatus } from '@/utils/leadStageStatus'
import { isTenantMember, listTenantMembers } from '@/utils/tenantMembers'

// Edición en bulto desde la Lista del dashboard: mover varios leads a una
// etapa, marcarles un estado o darles un Responsable de una vez.
//
// Vive aquí y no en el panel de Payload a propósito. En el panel, "Select all"
// armaba su `where` sin el tenant elegido y editó los leads de todos los
// clientes; aquí el tenant no es una opción de la pantalla sino el del host,
// y va dentro del `where` (`buildBulkLeadsWhere`) pase lo que pase con los ids.
//
// Solo `stage`, `status` y `assignee`. Contacto, notas y respuestas son de un
// lead a la vez, y borrar en bulto no existe: borrar es irreversible.
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
  const hasStageOrStatus = 'stage' in data || 'status' in data
  const hasAssignee = 'assignee' in (body || {})
  if (!hasStageOrStatus && !hasAssignee) {
    return NextResponse.json({ error: 'Falta la etapa, el estado o el responsable' }, { status: 400 })
  }

  const resolved = resolveStageAndStatus(auth.tenant, data)
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 })

  const payload = await getPayload({ config })

  // El Responsable se valida entero antes de tocar nada, para que un
  // Responsable inválido no deje aplicada a medias la etapa.
  let assigneeWhere: Where | null = null
  let assignee: number | null = null
  if (hasAssignee) {
    const next = readAssigneeValue(body.assignee)
    if (next === undefined) return NextResponse.json({ error: 'Responsable inválido' }, { status: 400 })
    if (next !== null && !isTenantMember(await listTenantMembers(payload, auth.tenant.id), next)) {
      return NextResponse.json({ error: 'Esa persona no es de este equipo' }, { status: 400 })
    }
    const scope = assigneeScope(auth.session, next)
    if (!scope) {
      return NextResponse.json(
        { error: 'Tu rol solo permite tomar leads sin asignar o soltar los tuyos' },
        { status: 403 },
      )
    }
    assignee = next
    assigneeWhere = { and: [buildBulkLeadsWhere(auth.tenant.id, ids), scope] }
  }

  const updated = new Map<string, unknown>()
  let failed = 0

  if (hasStageOrStatus) {
    const result = await payload.update({
      collection: 'leads',
      where: buildBulkLeadsWhere(auth.tenant.id, ids),
      data: resolved.data as { stage?: string; status?: 'open' | 'won' | 'lost' | 'disqualified' },
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of result.docs) updated.set(String(doc.id), doc)
    failed += result.errors.length
  }

  // Los leads que el rol no puede tocar (un `member` tomando uno que ya es de
  // alguien) no fallan: no entran al `where`, igual que un id de otro tenant.
  // Se cuentan aparte para que la interfaz diga cuántos se quedaron como
  // estaban y por qué.
  let skipped = 0
  if (assigneeWhere) {
    const result = await payload.update({
      collection: 'leads',
      where: assigneeWhere,
      data: { assignee },
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of result.docs) updated.set(String(doc.id), doc)
    failed += result.errors.length
    skipped = Math.max(0, ids.length - result.docs.length - result.errors.length)
  }

  return NextResponse.json({ leads: [...updated.values()], failed, skipped })
}

/**
 * El `where` extra que acota una asignación en bulto a los leads que esta
 * sesión puede reasignar, o `null` si no puede hacer ese cambio con ninguno.
 *
 * Es `canChangeAssignee` escrito como consulta: un `owner` reparte cualquier
 * lead; un `member` solo toma los que no tienen Responsable o suelta los
 * suyos. Hacerlo en el `where` y no lead por lead es lo que evita tener que
 * leer 500 leads antes de escribirlos.
 */
function assigneeScope(session: DashboardSession, next: number | null): Where | null {
  if (sessionCan(session, 'leads:assign')) return { id: { exists: true } }
  if (next !== null && String(next) === String(session.userId)) return { assignee: { exists: false } }
  if (next === null) return { assignee: { equals: Number(session.userId) } }
  return null
}
