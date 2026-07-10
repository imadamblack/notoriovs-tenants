import { NextRequest, NextResponse } from 'next/server'
import { getTenantBySubdomain } from '@/utils/getTenant'

// Las respuestas del quiz nunca se guardan en Payload (no hay colección
// `Leads`): este endpoint solo consulta el tenant para saber a qué
// webhook(s) reenviar, y responde al frontend. Ver "5. Webhooks" en la
// arquitectura descrita en CLAUDE.md / el prompt original.
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { subdomain, answers, contact } = body || {}

  if (!subdomain) {
    return NextResponse.json({ error: 'Falta subdomain' }, { status: 400 })
  }

  const tenant = await getTenantBySubdomain(subdomain)

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  if (!tenant.quizWebhook) {
    console.warn(`Tenant ${tenant.name} no tiene "quizWebhook" configurado`)
    return NextResponse.json({ ok: true })
  }

  try {
    await fetch(tenant.quizWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant: tenant.name,
        subdomain,
        contact,
        answers,
        submittedAt: new Date().toISOString(),
      }),
    })
  } catch (err) {
    console.error(`quizWebhook falló para tenant ${tenant.name}`, err)
  }

  return NextResponse.json({ ok: true })
}
