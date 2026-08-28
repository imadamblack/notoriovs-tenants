import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTenantBySubdomain } from '@/utils/getTenant'

// Cada submit del quiz hace dos cosas en paralelo (dual-write):
//   1. Reenvía la respuesta cruda al webhook de n8n del tenant, igual que
//      siempre (no se toca esa integración: sigue alimentando lo que sea
//      que n8n haga con ella hoy).
//   2. Guarda un doc en la colección `leads` (Payload/Postgres) para que el
//      dashboard de cliente (Kanban + KPIs) tenga de dónde leer.
// Si (2) falla no se cae el submit: el lead igual llegó a n8n. Si (1) falla
// tampoco se cae: el lead ya quedó guardado en Payload.
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

  const tenant = await getTenantBySubdomain(subdomain)

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  // La primera etapa del pipeline configurado en Tenants → Dashboard
  // Cliente → Pipeline. Si el tenant no configuró ninguna (pipeline vacío),
  // cae a 'nuevo' como key genérico.
  const firstStage = tenant.leadPipeline?.[0]?.key || 'nuevo'

  let leadId: string | number | undefined

  try {
    const payload = await getPayload({ config })
    const lead = await payload.create({
      collection: 'leads',
      data: {
        tenant: Number(tenant.id),
        name: typeof answers?.nombre === 'string' ? answers.nombre : undefined,
        phone: typeof answers?.telefono === 'string' ? answers.telefono : undefined,
        whatsapp: typeof answers?.whatsapp === 'string' ? answers.whatsapp : undefined,
        email: typeof answers?.email === 'string' ? answers.email : undefined,
        status: firstStage,
        source: 'quiz',
        answers: answers ?? null,
        utm: utm ?? null,
      },
    })
    leadId = lead.id
  } catch (err) {
    console.error(`No se pudo guardar el lead en Payload para tenant ${tenant.name}`, err)
  }

  if (!tenant.quizWebhook) {
    console.warn(`Tenant ${tenant.name} no tiene "quizWebhook" configurado`)
    return NextResponse.json({ ok: true, id: leadId })
  }

  try {
    await fetch(tenant.quizWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant: tenant.name,
        subdomain,
        answers,
        leadId,
        submittedAt: new Date().toISOString(),
      }),
    })
  } catch (err) {
    console.error(`quizWebhook falló para tenant ${tenant.name}`, err)
  }

  return NextResponse.json({ ok: true, id: leadId })
}
