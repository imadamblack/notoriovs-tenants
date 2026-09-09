import { NextRequest, NextResponse } from 'next/server'
import { DASHBOARD_COOKIE_NAME } from '@/utils/dashboardAuth'
import { logoutTenantUser, TENANT_USER_COOKIE_NAME } from '@/utils/tenantUserAuth'

// Cierra las dos puertas de una sola vez, sin preguntar por cuál entró: no
// cuesta nada borrar una cookie que no estaba, y así un navegador que arrastre
// las dos (por ejemplo el de alguien que probó las dos formas durante la
// migración) queda realmente fuera.
export async function POST(req: NextRequest) {
  // Además de borrar la cookie, saca el `sid` de este navegador del arreglo
  // `sessions` del Tenant User: el token que ya salió deja de valer aunque
  // alguien se lo hubiera copiado.
  await logoutTenantUser(req.headers)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(DASHBOARD_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  res.cookies.set(TENANT_USER_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return res
}
