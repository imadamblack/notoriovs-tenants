import { NextRequest, NextResponse } from 'next/server'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { MIN_PASSWORD_LENGTH, resetPasswordWithToken } from '@/utils/tenantUserAccount'
import { setTenantSessionCookie } from '@/utils/tenantSessionCookie'

// Canjea el enlace del correo: define la contraseña y abre la sesión. Sirve
// igual para recuperar la propia y para aceptar una invitación — son el mismo
// token.
//
// El tenant sale del subdominio de la petición y el módulo comprueba que el
// dueño del token pertenezca a ÉL antes de tocar nada: un enlace legítimo del
// cliente A abierto en el subdominio del cliente B no canjea, no cambia
// ninguna contraseña y no abre ninguna sesión.

const INVALID_TOKEN =
  'Este enlace ya no sirve: venció o ya se usó. Pide uno nuevo desde "¿Olvidaste tu contraseña?".'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const data = (body ?? {}) as Record<string, unknown>
  const subdomain = typeof data.subdomain === 'string' ? data.subdomain.toLowerCase() : ''
  const token = typeof data.token === 'string' ? data.token.trim() : ''
  const password = typeof data.password === 'string' ? data.password : ''

  if (!subdomain || !token || !password) {
    return NextResponse.json({ error: 'Falta subdomain, token o password' }, { status: 400 })
  }

  const tenant = await getTenantBySubdomain(subdomain, 'identity')
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  const outcome = await resetPasswordWithToken({ id: tenant.id }, token, password)

  if (!outcome.ok) {
    return outcome.reason === 'weak-password'
      ? NextResponse.json(
          { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` },
          { status: 400 },
        )
      : NextResponse.json({ error: INVALID_TOKEN }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })
  await setTenantSessionCookie(res, outcome.login.token)
  return res
}
