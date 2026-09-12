import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireDashboardAuth, requireDashboardTenant, sessionCan } from '@/utils/requireDashboardAuth'
import { buildLeadsWhere, readLeadFilters } from '@/utils/leadDashboardFilters'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { mergeAnswersPatch, quizQuestions, readAnswers } from '@/utils/leadAnswers'

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
// Los filtros (etapa, status, periodo, búsqueda) los arma
// `buildLeadsWhere`, compartido con los conteos del Kanban y con la
// exportación a CSV: ahí vive también qué significa `stage=__other__`.
export async function GET(req: NextRequest) {
  const tenant = await requireDashboardTenant(req)
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const params = req.nextUrl.searchParams
  const sort = SORT_MAP[params.get('sort') || 'created_desc'] || SORT_MAP.created_desc
  const page = clampPage(params.get('page'))
  const limit = clampLimit(params.get('limit'))

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'leads',
    where: buildLeadsWhere(tenant, readLeadFilters(params)),
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

/**
 * Texto ya recortado, o `undefined` si venía vacío. Un campo de contacto en
 * blanco no se guarda como cadena vacía: eso haría que un lead "sin correo"
 * y uno "con el correo borrado" se vieran distintos en la base sin serlo.
 */
function toText(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'string') return undefined
  return value.trim() || undefined
}

// Alta a mano de un Lead desde el propio dashboard: el que llegó por
// teléfono o en persona y nunca pasó por el quiz (issue 13). Queda marcado
// con `source: 'manual'`, que es lo que lo distingue para siempre de los
// del quiz y de los que mete n8n por /api/leads/ingest.
//
// No pide un permiso de rol: capturar un lead es el trabajo diario tanto de
// un `owner` como de un `member`, igual que editarlo con el PATCH de arriba.
// Lo único que se exige es sesión válida en ESTE tenant.
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const tenant = await requireDashboardTenant(req)
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const name = toText(body?.name)
  const phone = toText(body?.phone)
  const whatsapp = toText(body?.whatsapp)
  const email = toText(body?.email)

  // Lo mínimo para que el lead sirva de algo: cómo se llama y por dónde
  // buscarlo. Nada más es obligatorio — quien captura un lead en medio de
  // una llamada no tiene por qué llenar un formulario largo.
  if (!name) {
    return NextResponse.json({ error: 'Escribe el nombre del lead' }, { status: 400 })
  }
  if (!phone && !whatsapp && !email) {
    return NextResponse.json(
      { error: 'Deja al menos un teléfono, un WhatsApp o un correo' },
      { status: 400 },
    )
  }

  // Nace en la primera etapa del pipeline del tenant, igual que los del
  // quiz y los del ingest, salvo que quien lo captura elija otra: un lead
  // que llega por teléfono a veces entra ya avanzado ("me habló para
  // agendar"). Sin pipeline configurado cae al sentinel 'nuevo', que no
  // coincide con ningún id real y lo deja en la columna "Otro".
  const pipeline = tenant.leadPipeline || []
  const requestedStage = toText(body?.stage)
  if (requestedStage && pipeline.length && !pipeline.some((stage) => stage.id === requestedStage)) {
    return NextResponse.json({ error: 'Etapa inválida para este tenant' }, { status: 400 })
  }
  const stage = requestedStage || pipeline[0]?.id || 'nuevo'

  const payload = await getPayload({ config })

  // Duplicado por teléfono: se avisa, NO se bloquea. La segunda llamada
  // llega con `confirmDuplicate` y captura el lead de todos modos — el
  // mismo número puede ser de dos personas (una empresa, una familia), y
  // perder un lead por eso es peor que tener dos.
  //
  // La comparación es exacta contra lo que se escribió, en `phone` y en
  // `whatsapp` (el mismo número suele quedar registrado en cualquiera de
  // los dos). Dos formatos distintos del mismo número no se reconocen: eso
  // pediría guardar una versión normalizada aparte, y este aviso no vale
  // ese campo.
  const numbers = [phone, whatsapp].filter((value): value is string => Boolean(value))
  if (numbers.length && !body?.confirmDuplicate) {
    const found = await payload.find({
      collection: 'leads',
      where: {
        and: [
          { tenant: { equals: tenant.id } },
          { or: [{ phone: { in: numbers } }, { whatsapp: { in: numbers } }] },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const duplicate = found.docs[0]
    if (duplicate) {
      return NextResponse.json(
        { error: 'Ya tienes un lead con ese teléfono', duplicate },
        { status: 409 },
      )
    }
  }

  const created = await payload.create({
    collection: 'leads',
    data: {
      tenant: Number(tenant.id),
      name,
      phone,
      whatsapp,
      email,
      stage,
      status: 'open',
      source: 'manual',
      notes: toText(body?.notes),
    },
    depth: 0,
    overrideAccess: true,
  })

  return NextResponse.json({ lead: created }, { status: 201 })
}

/**
 * El lead de `id`, pero solo si es de este tenant. Sin esta comprobación
 * cualquier sesión válida de un tenant podría tocar leads de otro con solo
 * adivinar o enumerar ids: el id viene del cliente, la pertenencia no.
 */
async function findLeadOfTenant(
  payload: Awaited<ReturnType<typeof getPayload>>,
  id: string | number,
  tenantId: string | number,
) {
  const lead = await payload.findByID({
    collection: 'leads',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })

  const leadTenantId = typeof lead?.tenant === 'object' ? (lead.tenant as { id?: unknown })?.id : lead?.tenant

  return lead && String(leadTenantId) === String(tenantId) ? lead : null
}

export async function PATCH(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { id } = body || {}
  const auth = await requireDashboardAuth(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const tenant = auth.tenant
  const payload = await getPayload({ config })

  const lead = await findLeadOfTenant(payload, id, tenant.id)
  if (!lead) {
    return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  }

  // Solo estos campos son editables desde el dashboard de cliente. Nunca se
  // permite tocar `utm`, `tenant` o `source` desde aquí. `answers` no está en
  // la lista porque no se guarda tal cual llega: pasa por `mergeAnswersPatch`
  // más abajo.
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

  // Las respuestas del quiz son campos del lead como cualquier otro: si el
  // lead se equivocó al contestar, quien lo atiende lo corrige aquí (issue
  // 15). No se guardan en bruto: cada pregunta se valida contra el quiz del
  // tenant —una pregunta de opciones solo admite sus opciones— y se mezcla
  // con lo que el lead ya tenía, para que mandar una respuesta no borre las
  // demás. El quiz se carga solo en este caso: las decenas de PATCH que mueven
  // una tarjeta de columna no tienen por qué pagarlo.
  if ('answers' in (body || {})) {
    const tenantQuiz = await getTenantBySubdomain(auth.subdomain, 'dashboardQuiz')
    const merged = mergeAnswersPatch({
      current: readAnswers(lead.answers),
      patch: body.answers,
      questions: quizQuestions(tenantQuiz?.quizSteps),
    })
    if (!merged.ok) return NextResponse.json({ error: merged.error }, { status: 400 })

    data.answers = merged.answers
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

// Borrar un lead es la única acción del dashboard que no se puede deshacer, y
// por eso es de las dos que distinguen a un `owner` de un `member` (la otra es
// gestionar usuarios, que llega con el issue 10). Un `member` sí puede sacar
// un lead de en medio: lo marca como descalificado con el PATCH de arriba, que
// lo quita de los números de conversión sin perder el registro.
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  const auth = await requireDashboardAuth(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  // 403 y no 404: la sesión es válida y el lead es suyo; lo que falta es el
  // rol. Decirlo tal cual es lo que permite que la interfaz explique por qué
  // no está el botón en vez de fingir que el lead no existe.
  if (!sessionCan(auth.session, 'leads:delete')) {
    return NextResponse.json(
      { error: 'Tu rol no permite borrar leads. Puedes marcarlo como descalificado.' },
      { status: 403 },
    )
  }

  const payload = await getPayload({ config })

  if (!(await findLeadOfTenant(payload, id, auth.tenant.id))) {
    return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  }

  await payload.delete({ collection: 'leads', id, overrideAccess: true })

  return NextResponse.json({ ok: true })
}
