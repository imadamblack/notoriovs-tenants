import { NextRequest, NextResponse } from 'next/server'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { getSubdomainFromHeaders } from '@/utils/subdomain'
import { tenantSiteUrl } from '@/utils/tenantUrl'
import {
  INTERNAL_SESSION_COOKIE_NAME,
  INTERNAL_SESSION_TTL_SECONDS,
  redeemDashboardTicket,
} from '@/utils/internalDashboardSession'

// Segundo salto del traspaso del panel al Dashboard de un cliente (issue 31):
// canjea el ticket por la cookie de sesión interna de ESTE host y manda al
// dashboard.
//
// El Tenant sale del `Host` (ADR 0007), como en todo /api/tenant-dashboard/*.
// Un ticket emitido para el cliente A presentado en el host del B no coincide
// y se acabó: no hay mensaje distinto para eso.

function failed() {
  return new NextResponse(
    'Este enlace ya se usó o venció. Vuelve a entrar desde el panel de Notoriovs.',
    { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } },
  )
}

export async function GET(req: NextRequest) {
  const subdomain = getSubdomainFromHeaders(req.headers)
  if (!subdomain) return failed()

  // Activo o no: al equipo no se le cierra el dashboard de un cliente caído.
  const tenant = await getTenantBySubdomain(subdomain, 'dashboardApi', { includeInactive: true })
  if (!tenant) return failed()

  const session = await redeemDashboardTicket(req.nextUrl.searchParams.get('ticket') ?? '', tenant.id)
  if (!session) return failed()

  // A la URL limpia: el ticket no se queda en el historial ni en el `Referer`.
  // Se arma desde el subdominio y no desde `req.nextUrl`, que en desarrollo
  // trae el host del servidor (localhost) y no el del Tenant.
  const res = NextResponse.redirect(tenantSiteUrl(subdomain, '/dashboard'), 303)
  // Mismas propiedades que la cookie de un Tenant User (ver
  // tenantSessionCookie.ts), con nombre propio: host-only, así que no viaja al
  // subdominio de otro cliente.
  res.cookies.set(INTERNAL_SESSION_COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: INTERNAL_SESSION_TTL_SECONDS,
  })
  return res
}
