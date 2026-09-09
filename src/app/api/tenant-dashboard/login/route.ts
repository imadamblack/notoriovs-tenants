import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { createDashboardToken, DASHBOARD_COOKIE_NAME, DASHBOARD_COOKIE_MAX_AGE } from '@/utils/dashboardAuth'
import { loginTenantUser, tenantUserCookieMaxAge, TENANT_USER_COOKIE_NAME } from '@/utils/tenantUserAuth'

// Dos puertas al mismo dashboard mientras dura la migración de autenticación:
//
//  1. Tenant User: email + contraseña propios contra la colección
//     `tenant-users`. Es la definitiva.
//  2. Contraseña compartida del tenant (Tenants → Dashboard Cliente →
//     `dashboardPassword`): la de siempre, sin usuario ni email.
//
// Cuál se intenta lo decide si vino un email, no un modo que mande el cliente.
// Las dos dejan una cookie httpOnly host-only en el subdominio del tenant, así
// que la sesión de un cliente nunca viaja al host de otro.

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

  if (!subdomain || !password) {
    return NextResponse.json({ error: 'Falta subdomain o password' }, { status: 400 })
  }

  return email
    ? await loginAsTenantUser(subdomain, email, password)
    : await loginWithSharedPassword(subdomain, password)
}

async function loginAsTenantUser(subdomain: string, email: string, password: string) {
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

async function loginWithSharedPassword(subdomain: string, password: string) {
  const tenant = await getTenantBySubdomain(subdomain, 'dashboardLogin')
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  if (!tenant.dashboardPassword) {
    return NextResponse.json(
      { error: 'Este tenant ya no usa contraseña compartida. Entra con tu email y contraseña.' },
      { status: 403 },
    )
  }

  if (password !== tenant.dashboardPassword) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  const token = createDashboardToken(subdomain)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(DASHBOARD_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DASHBOARD_COOKIE_MAX_AGE,
  })
  return res
}
