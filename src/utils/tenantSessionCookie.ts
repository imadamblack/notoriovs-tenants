import type { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { tenantUserCookieMaxAge, TENANT_USER_COOKIE_NAME } from '@/utils/tenantUserAuth'

/**
 * Deja abierta la sesión de Tenant User en este navegador. Un solo lugar
 * porque hay dos formas de abrirla —iniciar sesión y canjear un enlace de
 * recuperación o invitación— y las dos tienen que poner exactamente la misma
 * cookie: httpOnly (el JavaScript de la página no la lee), host-only (no
 * viaja al subdominio de otro cliente) y con la vida que declara la propia
 * colección.
 */
export async function setTenantSessionCookie(res: NextResponse, token: string): Promise<void> {
  const payload = await getPayload({ config })

  res.cookies.set(TENANT_USER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: tenantUserCookieMaxAge(payload),
  })
}
