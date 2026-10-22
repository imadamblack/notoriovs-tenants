import { NextRequest, NextResponse } from 'next/server'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { getSubdomainFromHeaders, NO_TENANT_HOST } from '@/utils/subdomain'
import { loginTenantUser } from '@/utils/tenantUserAuth'
import { setTenantSessionCookie } from '@/utils/tenantSessionCookie'

// Una sola puerta al dashboard: email + contraseña propios contra la colección
// `tenant-users`. La contraseña compartida por Tenant vivió aquí en paralelo
// mientras duró la migración y ya no existe.
//
// La cookie es httpOnly y host-only en el subdominio del tenant, así que la
// sesión de un cliente nunca viaja al host de otro.
//
// El Tenant sale del `Host`, como en todo /api/tenant-dashboard/* (ADR 0002).
// Un `subdomain` en el cuerpo se ignora. Las tres rutas sin credencial (login,
// forgot-password, reset-password) fueron la excepción hasta el issue 34; el
// porqué de cerrarla está en las actualizaciones del ADR 0007.
//
// Un host que no es de ningún Tenant (el del panel, el dominio raíz) se rechaza
// antes de mirar credenciales: ahí una sesión no tendría dashboard que abrir, y
// antes quedaba la cookie puesta con una pantalla que no explicaba nada.

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

  const password = typeof body?.password === 'string' ? body.password : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Falta email o password' }, { status: 400 })
  }

  const subdomain = getSubdomainFromHeaders(req.headers)
  if (!subdomain) {
    return NextResponse.json({ error: NO_TENANT_HOST }, { status: 400 })
  }

  // El tenant sale del host, nunca del usuario: quien se autentica bien pero
  // pertenece a otro cliente recibe exactamente la misma respuesta que quien
  // erró la contraseña, para no delatar en qué subdominio existe una cuenta.
  //
  // `dashboardIdentity` no resuelve un tenant inactivo: con la suscripción
  // caída no se abre sesión, aunque su landing y su quiz sigan corriendo.
  const tenant = await getTenantBySubdomain(subdomain, 'dashboardIdentity')
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  const login = await loginTenantUser(email, password)
  if (!login || login.session.tenantId === null || String(login.session.tenantId) !== String(tenant.id)) {
    return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  await setTenantSessionCookie(res, login.token)
  return res
}
