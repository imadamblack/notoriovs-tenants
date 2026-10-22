import { NextRequest, NextResponse } from 'next/server'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { getSubdomainFromHeaders, NO_TENANT_HOST } from '@/utils/subdomain'
import { requestPasswordReset } from '@/utils/tenantUserAccount'

// "Olvidé mi contraseña" del Dashboard de Cliente.
//
// Esta ruta responde SIEMPRE lo mismo: exista la cuenta o no, esté el correo
// registrado en otro cliente o no, falle SendGrid o no. Cualquier diferencia
// —un 404, un mensaje distinto, incluso tardar notoriamente menos— convierte
// este endpoint en un directorio de qué correos tienen acceso al dashboard de
// este cliente, consultable sin credenciales desde internet.
//
// La única distinción que sí se hace es la del host: si no es de ningún
// tenant no hay a nombre de quién mandar nada, y qué subdominios existen ya
// es público (basta con abrirlos).
//
// El Tenant sale del `Host`, como en todo /api/tenant-dashboard/* (ADR 0002).
// Un `subdomain` en el cuerpo se ignora. Las tres rutas sin credencial (login,
// forgot-password, reset-password) fueron la excepción hasta el issue 34; el
// porqué de cerrarla está en las actualizaciones del ADR 0007.
//
// El enlace del correo se arma con este mismo subdominio, así que llega al
// host desde el que se pidió.

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
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''

  if (!email) {
    return NextResponse.json({ error: 'Falta email' }, { status: 400 })
  }

  const subdomain = getSubdomainFromHeaders(req.headers)
  if (!subdomain) {
    return NextResponse.json({ error: NO_TENANT_HOST }, { status: 400 })
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
