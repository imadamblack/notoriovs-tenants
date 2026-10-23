import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { issueDashboardTicket } from '@/utils/internalDashboardSession'
import { tenantSiteUrl } from '@/utils/tenantUrl'

// Primer salto del traspaso del panel al Dashboard de un cliente (issue 31).
// Vive solo en el host del panel (ver el middleware): ahí está la sesión del
// Internal User, en la cookie `payload-token`.
//
// Lo llama un formulario del panel (`TenantPreviewLinks`), no un fetch: es una
// navegación de primer nivel, así que la cookie del panel viaja (es `lax`) y la
// respuesta puede ser la redirección al host del Tenant. Es POST para que un
// enlace o una imagen en otro sitio no puedan dispararlo.
//
// Responde con una redirección al host del Tenant con el ticket en la URL. El
// ticket vale un minuto y una sola vez; la ruta que lo canjea redirige de
// inmediato a una URL sin él.
function panelOrigin(req: NextRequest): string {
  const host = req.headers.get('host') || req.nextUrl.host
  const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '')
  return `${proto}://${host}`
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user || user.collection !== 'users') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const form = await req.formData().catch(() => null)
  const tenantId = String(form?.get('tenant') ?? '')
  if (!/^\d+$/.test(tenantId)) {
    return NextResponse.json({ error: 'Falta el cliente' }, { status: 400 })
  }

  // El subdominio sale del documento, no de lo que mande el formulario. Se
  // resuelve aunque el Tenant esté inactivo: el equipo entra igual.
  const tenant = await payload
    .findByID({ collection: 'tenants', id: tenantId, depth: 0, select: { subdomain: true }, overrideAccess: true })
    .catch(() => null)
  if (!tenant?.subdomain) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  // "Salir" vuelve a la ficha de este Tenant en el panel desde el que se entró:
  // el host de esta misma petición, que es el del panel (el middleware no
  // sirve esta ruta en otro). Del `Host` y no de `req.nextUrl`, que en
  // desarrollo trae el del servidor. Quien manda este `Host` es el navegador
  // del propio Internal User, así que solo podría desviarse a sí mismo.
  const returnUrl = new URL(`/admin/collections/tenants/${tenantId}`, panelOrigin(req)).toString()

  const ticket = await issueDashboardTicket(
    { id: user.id, email: user.email, collection: 'users', role: user.role, tenants: user.tenants },
    tenantId,
    returnUrl,
  )
  // Mismo 404 que un Tenant inexistente: a un account manager no se le
  // confirma qué clientes hay fuera de los suyos.
  if (!ticket) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  const target = tenantSiteUrl(
    tenant.subdomain,
    `/api/tenant-dashboard/internal-session?ticket=${encodeURIComponent(ticket)}`,
  )
  return NextResponse.redirect(target, 303)
}
