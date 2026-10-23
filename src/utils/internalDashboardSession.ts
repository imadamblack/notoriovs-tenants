import { createHash, randomBytes } from 'node:crypto'
import { getPayload, parseCookies } from 'payload'
import config from '@payload-config'
import { canInternalUserEnterTenant } from '@/access/internalRoles'
import { relationId, ticketOpensTenant } from '@/utils/dashboardTicket'

// Sesión del equipo de Notoriovs dentro del Dashboard de un cliente (issue 31).
//
// El panel y el dashboard viven en hosts distintos y sus cookies son
// host-only, así que la sesión del panel no llega al subdominio del cliente
// (y desde el issue 28 la API de Payload ni siquiera se sirve ahí). La sesión
// viaja por un traspaso explícito:
//
//   1. En el host del panel, `issueDashboardTicket` emite un ticket de un solo
//      uso y un minuto de vida, acotado a un Internal User y a un Tenant.
//   2. El navegador aterriza con él en el host del Tenant, y
//      `redeemDashboardTicket` lo canjea por la cookie de sesión de ese host.
//   3. En cada petición, `getInternalDashboardSession` lee esa sesión, y
//      `resolveDashboardAuth` la vuelve a autorizar contra el Tenant del host y
//      contra el Internal User vivo.
//
// Ticket, sesión y bitácora son el mismo documento de `dashboard-visits`.
//
// La cookie tiene nombre propio, distinto del de un Tenant User: si se
// llamaran igual, entrar a dar soporte le pisaría la sesión a quien tenga el
// dashboard del cliente abierto en esa misma máquina. Las dos conviven y el
// orden en que se leen lo declara `resolveDashboardAuth`.

export const INTERNAL_SESSION_COOKIE_NAME = 'notoriovs-internal-token'

const VISITS_SLUG = 'dashboard-visits'

/** El ticket solo tiene que sobrevivir una redirección. */
const TICKET_TTL_MS = 60 * 1000

/** Una jornada de soporte. Salir la cierra antes. */
export const INTERNAL_SESSION_TTL_SECONDS = 8 * 60 * 60

function newToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Lo que se guarda en la base: el hash, nunca el token. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Un Internal User tal como lo necesita `canInternalUserEnterTenant`. */
export type InternalUserSnapshot = {
  id: string | number
  email: string
  collection: 'users'
  role?: unknown
  tenants?: unknown
}

export type InternalDashboardSession = {
  visitId: string | number
  /** A qué Tenant se emitió el ticket. Quien manda es el host: ver `resolveDashboardAuth`. */
  tenantId: string | number | null
  /** El Internal User leído ahora, no al emitir el ticket. */
  user: InternalUserSnapshot | null
}

async function loadInternalUser(id: unknown): Promise<InternalUserSnapshot | null> {
  const userId = relationId(id)
  if (userId === null) return null

  const payload = await getPayload({ config })
  try {
    const user = await payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
    return { id: user.id, email: user.email, collection: 'users', role: user.role, tenants: user.tenants }
  } catch {
    // Borrado: no hay a quién dejar entrar.
    return null
  }
}

/**
 * Emite el ticket de traspaso, en el host del panel. `null` si este Internal
 * User no puede entrar a ese Tenant: un account manager con un cliente que no
 * tiene asignado no consigue ticket.
 *
 * `returnUrl` es a dónde vuelve "Salir".
 */
export async function issueDashboardTicket(
  user: InternalUserSnapshot,
  tenantId: string | number,
  returnUrl: string,
): Promise<string | null> {
  if (!canInternalUserEnterTenant(user, tenantId)) return null

  const ticket = newToken()
  const payload = await getPayload({ config })

  await payload.create({
    collection: VISITS_SLUG,
    data: {
      tenant: Number(tenantId),
      user: Number(user.id),
      userEmail: user.email,
      ticketHash: hashToken(ticket),
      ticketExpiresAt: new Date(Date.now() + TICKET_TTL_MS).toISOString(),
      returnUrl,
    },
    depth: 0,
    overrideAccess: true,
  })

  return ticket
}

/**
 * Canjea un ticket por el token de sesión del host del Tenant, o `null` si no
 * sirve: de otro Tenant, ya usado, vencido, o el Internal User ya no puede
 * entrar ahí (lo degradaron en el minuto que tardó la redirección).
 */
export async function redeemDashboardTicket(ticket: string, tenantId: string | number): Promise<string | null> {
  if (!ticket) return null

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: VISITS_SLUG,
    where: { ticketHash: { equals: hashToken(ticket) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const visit = docs[0]
  if (!visit || !ticketOpensTenant(visit, tenantId)) return null

  const user = await loadInternalUser(visit.user)
  if (!canInternalUserEnterTenant(user, tenantId)) return null

  const session = newToken()
  // El `enteredAt: exists false` en el `where` es lo que hace al ticket de un
  // solo uso aunque dos pestañas lo canjeen a la vez: la segunda ya no
  // encuentra un documento que actualizar.
  const { docs: updated } = await payload.update({
    collection: VISITS_SLUG,
    where: { and: [{ id: { equals: visit.id } }, { enteredAt: { exists: false } }] },
    data: {
      enteredAt: new Date().toISOString(),
      sessionHash: hashToken(session),
      sessionExpiresAt: new Date(Date.now() + INTERNAL_SESSION_TTL_SECONDS * 1000).toISOString(),
    },
    depth: 0,
    overrideAccess: true,
  })

  return updated.length === 1 ? session : null
}

/** La sesión vigente (abierta, no vencida, no cerrada) que nombra la cookie, si hay. */
async function findOpenVisit(headers: Headers) {
  const token = parseCookies(headers).get(INTERNAL_SESSION_COOKIE_NAME)
  if (!token) return null

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: VISITS_SLUG,
    where: {
      and: [
        { sessionHash: { equals: hashToken(token) } },
        { endedAt: { exists: false } },
        { sessionExpiresAt: { greater_than: new Date().toISOString() } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return docs[0] ?? null
}

/**
 * Resuelve la sesión interna que traiga la petición, o `null`. Solo dice qué
 * hay; decidir si abre ESTE dashboard es de `resolveDashboardAuth`.
 */
export async function getInternalDashboardSession(headers: Headers): Promise<InternalDashboardSession | null> {
  const visit = await findOpenVisit(headers)
  if (!visit) return null

  return {
    visitId: visit.id,
    tenantId: relationId(visit.tenant),
    user: await loadInternalUser(visit.user),
  }
}

/**
 * Cierra la sesión interna del lado del servidor y devuelve a dónde volver
 * (la ficha del Tenant en el panel). Borrar la cookie es de la ruta.
 */
export async function endInternalDashboardSession(headers: Headers): Promise<string | null> {
  const visit = await findOpenVisit(headers)
  if (!visit) return null

  const payload = await getPayload({ config })
  await payload.update({
    collection: VISITS_SLUG,
    id: visit.id,
    data: { endedAt: new Date().toISOString() },
    depth: 0,
    overrideAccess: true,
  })

  return visit.returnUrl
}
