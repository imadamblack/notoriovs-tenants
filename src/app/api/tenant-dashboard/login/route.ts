import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { loginTenantUser, tenantUserCookieMaxAge, TENANT_USER_COOKIE_NAME } from '@/utils/tenantUserAuth'

// Una sola puerta al dashboard: email + contraseña propios contra la colección
// `tenant-users`. La contraseña compartida por Tenant vivió aquí en paralelo
// mientras duró la migración y ya no existe.
//
// La cookie es httpOnly y host-only en el subdominio del tenant, así que la
// sesión de un cliente nunca viaja al host de otro.

/** Mismo mensaje para credenciales malas, usuario inexistente y cuenta bloqueada. */
const BAD_CREDENTIALS = 'Email o contraseña incorrectos'

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const subdomain = typeof body?.subdomain === 'string' ? body.subdomain.toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!subdomain || !email || !password) {
    return NextResponse.json({ error: 'Falta subdomain, email o password' }, { status: 400 })
  }

  // El tenant sale del host, nunca del usuario: quien se autentica bien pero
  // pertenece a otro cliente recibe exactamente la misma respuesta que quien
  // erró la contraseña, para no delatar en qué subdominio existe una cuenta.
  const tenant = await getTenantBySubdomain(subdomain, 'identity')
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  const login = await loginTenantUser(email, password)
  if (!login || login.session.tenantId === null || String(login.session.tenantId) !== String(tenant.id)) {
    return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(TENANT_USER_COOKIE_NAME, login.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: tenantUserCookieMaxAge(payload),
  })
  return res
}
