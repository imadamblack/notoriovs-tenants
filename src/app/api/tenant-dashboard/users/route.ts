import { NextRequest, NextResponse } from 'next/server'
import { TENANT_USER_ROLE_OPTIONS, type TenantUserRole } from '@/access/tenantUserPermissions'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { requireDashboardAuth, sessionCan } from '@/utils/requireDashboardAuth'
import { inviteTenantUser, listTenantUsers } from '@/utils/tenantUserAccount'

// El equipo de un Tenant, administrado desde su propio dashboard: un `owner`
// invita a un compañero sin que Notoriovs intervenga (issue 10).
//
// Dos puertas, en este orden y las dos en el servidor:
//   1. `requireDashboardAuth` — quien pide tiene sesión válida EN ESTE tenant
//      (el tenant sale del host, nunca del cuerpo de la petición).
//   2. `users:manage` — y además su rol lo autoriza. Un `member` tiene sesión
//      buena y aquí no pasa.
// Que la interfaz esconda el botón no cuenta como puerta.

const VALID_ROLES = new Set(TENANT_USER_ROLE_OPTIONS.map((option) => option.value))

function isValidRole(value: unknown): value is TenantUserRole {
  return typeof value === 'string' && VALID_ROLES.has(value as TenantUserRole)
}

export async function GET(req: NextRequest) {
  const subdomain = req.nextUrl.searchParams.get('subdomain')
  const auth = await requireDashboardAuth(req, subdomain)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!sessionCan(auth.session, 'users:manage')) {
    return NextResponse.json({ error: 'Tu rol no administra usuarios' }, { status: 403 })
  }

  return NextResponse.json({ users: await listTenantUsers(auth.tenant.id) })
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const data = (body ?? {}) as Record<string, unknown>
  const subdomain = typeof data.subdomain === 'string' ? data.subdomain.toLowerCase() : ''

  const auth = await requireDashboardAuth(req, subdomain)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!sessionCan(auth.session, 'users:manage')) {
    return NextResponse.json({ error: 'Tu rol no administra usuarios' }, { status: 403 })
  }

  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Escribe un correo válido' }, { status: 400 })
  }

  // Un rol que no existe no se degrada en silencio a `member`: quien invita
  // tiene que saber con qué permisos entra la persona que invitó.
  const role = data.role
  if (!isValidRole(role)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
  }

  // El nombre de la empresa, para el remitente y el cuerpo del correo. La
  // proyección de la autorización no lo trae (solo necesita el pipeline).
  const tenant = await getTenantBySubdomain(subdomain, 'tenantMail')
  if (!tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })

  const outcome = await inviteTenantUser(
    { id: auth.tenant.id, subdomain, companyName: tenant.generalInfo?.companyName || tenant.name },
    email,
    role,
  )

  if (!outcome.ok) {
    return outcome.reason === 'already-exists'
      ? NextResponse.json({ error: 'Ese correo ya tiene una cuenta en la plataforma' }, { status: 409 })
      : NextResponse.json({ error: 'No se pudo mandar la invitación' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, user: outcome.user })
}
