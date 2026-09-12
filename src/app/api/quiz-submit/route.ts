import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { emitTenantEventById, leadEventData } from '@/events/tenantEvents'

// Cada submit del quiz hace dos cosas:
//   1. Guarda un doc en la colección `leads` (Payload/Postgres) para que el
//      dashboard de cliente (Kanban + KPIs) tenga de dónde leer. El aviso al
//      cliente (`lead.created`) no sale de aquí: lo emite el hook de la
//      colección, que cubre las cuatro puertas por las que entra un Lead.
//   2. Emite `quiz.completed` al tubo del tenant, con las respuestas crudas.
// Si (1) falla no se cae el submit y el evento del quiz sale igual — que es
// justamente por lo que sigue habiendo dos eventos y no uno. Si (2) falla
// tampoco se cae: el lead ya quedó guardado.
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { subdomain, answers, utm } = body || {}

  if (!subdomain) {
    return NextResponse.json({ error: 'Falta subdomain' }, { status: 400 })
  }

  const tenant = await getTenantBySubdomain(subdomain, 'quizSubmit')

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  // El id (autogenerado por Payload) de la primera etapa del pipeline
  // configurado en Tenants → Dashboard Cliente → Pipeline. Si el tenant no
  // configuró ninguna (pipeline vacío), cae a 'nuevo' como sentinel: no
  // coincide con ningún id real, así que esos leads simplemente aparecen en
  // la columna "Otro" del dashboard hasta que se les configure un pipeline.
  const firstStage = tenant.leadPipeline?.[0]?.id || 'nuevo'

  // Quién contestó, sacado de las respuestas. Se calcula una sola vez porque lo
  // usan dos cosas: el Lead que se guarda y el evento que sale si ese guardado
  // falla. Que el fallo es justo cuando más falta hace el contacto —no hay Lead
  // en el Kanban, alguien tiene que atenderlo a mano— es la razón de que no se
  // quede adentro del `create`.
  const contacto = {
    name: typeof answers?.nombre === 'string' ? answers.nombre : undefined,
    phone: typeof answers?.telefono === 'string' ? answers.telefono : undefined,
    whatsapp: typeof answers?.whatsapp === 'string' ? answers.whatsapp : undefined,
    email: typeof answers?.email === 'string' ? answers.email : undefined,
  }

  // El Lead guardado, si se pudo guardar. Es lo que viaja en `quiz.completed`.
  let lead: Awaited<ReturnType<typeof payload.create>> | undefined
  const payload = await getPayload({ config })

  try {
    lead = await payload.create({
      collection: 'leads',
      data: {
        tenant: Number(tenant.id),
        ...contacto,
        stage: firstStage,
        status: 'open',
        source: 'quiz',
        answers: answers ?? null,
        utm: utm ?? null,
      },
    })
  } catch (err) {
    console.error(`No se pudo guardar el lead en Payload para tenant ${tenant.name}`, err)
  }

  await emitTenantEventById({
    event: 'quiz.completed',
    tenantId: tenant.id,
    // El MISMO cuerpo que `lead.created`. Si el guardado de arriba falló, el
    // evento sale igual —el cliente no pierde las respuestas por un error
    // nuestro—: misma forma, el contacto sacado de las respuestas, y en nulo
    // solo lo que de verdad no existe sin un Lead guardado (`id`, `stage`,
    // `status`, `createdAt`).
    data: leadEventData(lead ?? { ...contacto, source: 'quiz', answers, utm }),
    payload,
  })

  return NextResponse.json({ ok: true, id: lead?.id })
}
