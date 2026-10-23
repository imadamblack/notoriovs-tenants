import { NextRequest, NextResponse } from 'next/server'
import { logoutTenantUser, TENANT_USER_COOKIE_NAME } from '@/utils/tenantUserAuth'
import { endInternalDashboardSession, INTERNAL_SESSION_COOKIE_NAME } from '@/utils/internalDashboardSession'
import { parseCookies } from 'payload'

export async function POST(req: NextRequest) {
  // Sale la sesión que se está viendo, en el mismo orden en que la lee
  // `resolveDashboardAuth`: primero la interna. Si alguien de Notoriovs entró
  // al dashboard en un navegador donde además había un Tenant User, salir le
  // cierra lo suyo y le devuelve el panel; la sesión del cliente queda intacta.
  if (parseCookies(req.headers).get(INTERNAL_SESSION_COOKIE_NAME)) {
    // Además de borrar la cookie, cierra la entrada en `dashboard-visits`: el
    // token deja de valer aunque alguien se lo hubiera copiado.
    const returnUrl = await endInternalDashboardSession(req.headers)

    const res = NextResponse.json({ ok: true, returnUrl })
    res.cookies.set(INTERNAL_SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 })
    return res
  }

  // Además de borrar la cookie, saca el `sid` de este navegador del arreglo
  // `sessions` del Tenant User: el token que ya salió deja de valer aunque
  // alguien se lo hubiera copiado.
  await logoutTenantUser(req.headers)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(TENANT_USER_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return res
}
