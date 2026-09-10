import { NextRequest, NextResponse } from 'next/server'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { requestPasswordReset } from '@/utils/tenantUserAccount'

// "Olvidé mi contraseña" del Dashboard de Cliente.
//
// Esta ruta responde SIEMPRE lo mismo: exista la cuenta o no, esté el correo
// registrado en otro cliente o no, falle SendGrid o no. Cualquier diferencia
// —un 404, un mensaje distinto, incluso tardar notoriamente menos— convierte
// este endpoint en un directorio de qué correos tienen acceso al dashboard de
// este cliente, consultable sin credenciales desde internet.
//
// La única distinción que sí se hace es la del subdominio: si no existe el
// tenant no hay a nombre de quién mandar nada, y qué subdominios existen ya
// es público (basta con abrirlos).
//
// El `subdomain` llega en el cuerpo y NO del host, a diferencia del resto de
// /api/tenant-dashboard/*. Es deliberado: aquí todavía no hay credencial que
// diga de qué Tenant es quien llama, y dejarlo así mantiene abierta una entrada
// única de login (una sola pantalla en un host compartido). No lo "arregles"
// sin leer el ADR 0007 — la decisión y su precio están ahí.

/** La misma frase para todos los casos. Ver arriba. */
const SENT = 'Si esa cuenta existe, te mandamos un correo con el enlace para elegir una contraseña nueva.'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const data = (body ?? {}) as Record<string, unknown>
  const subdomain = typeof data.subdomain === 'string' ? data.subdomain.toLowerCase() : ''
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''

  if (!subdomain || !email) {
    return NextResponse.json({ error: 'Falta subdomain o email' }, { status: 400 })
  }

  const tenant = await getTenantBySubdomain(subdomain, 'tenantMail')
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  await requestPasswordReset(
    {
      id: tenant.id,
      subdomain,
      companyName: tenant.generalInfo?.companyName || tenant.name,
    },
    email,
  )

  return NextResponse.json({ ok: true, message: SENT })
}
