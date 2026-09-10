import { NextRequest, NextResponse } from 'next/server'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { loginTenantUser } from '@/utils/tenantUserAuth'
import { setTenantSessionCookie } from '@/utils/tenantSessionCookie'

// Una sola puerta al dashboard: email + contraseña propios contra la colección
// `tenant-users`. La contraseña compartida por Tenant vivió aquí en paralelo
// mientras duró la migración y ya no existe.
//
// La cookie es httpOnly y host-only en el subdominio del tenant, así que la
// sesión de un cliente nunca viaja al host de otro.
//
// El `subdomain` llega en el cuerpo y NO del host, a diferencia del resto de
// /api/tenant-dashboard/*. Es deliberado: aquí todavía no hay credencial que
// diga de qué Tenant es quien llama, y dejarlo así mantiene abierta una entrada
// única de login (una sola pantalla en un host compartido). No lo "arregles"
// sin leer el ADR 0007 — la decisión y su precio están ahí.

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

  const res = NextResponse.json({ ok: true })
  await setTenantSessionCookie(res, login.token)
  return res
}
