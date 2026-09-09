import { NextRequest, NextResponse } from 'next/server'
import { logoutTenantUser, TENANT_USER_COOKIE_NAME } from '@/utils/tenantUserAuth'

export async function POST(req: NextRequest) {
  // Además de borrar la cookie, saca el `sid` de este navegador del arreglo
  // `sessions` del Tenant User: el token que ya salió deja de valer aunque
  // alguien se lo hubiera copiado.
  await logoutTenantUser(req.headers)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(TENANT_USER_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return res
}
