import { NextRequest, NextResponse } from 'next/server'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { createDashboardToken, DASHBOARD_COOKIE_NAME, DASHBOARD_COOKIE_MAX_AGE } from '@/utils/dashboardAuth'

// Valida la contraseña única del tenant (Tenants.dashboardPassword) y, si
// coincide, deja una cookie httpOnly firmada que da acceso al dashboard de
// leads de ese tenant. No hay usuarios ni roles: es una sola contraseña
// compartida por tenant, a propósito (ver nota en Tenants.ts).
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

  if (!subdomain || !password) {
    return NextResponse.json({ error: 'Falta subdomain o password' }, { status: 400 })
  }

  const tenant = await getTenantBySubdomain(subdomain)
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  if (!tenant.dashboardPassword) {
    return NextResponse.json(
      { error: 'Este tenant no tiene un dashboard configurado. Contacta a Notoriovs.' },
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
