import crypto from 'node:crypto'
import { getPayload } from 'payload'
import config from '@payload-config'
import { normalizeTenantUserRole, type TenantUserRole } from '@/access/tenantUserPermissions'
import { TENANT_USERS_SLUG, type TenantUserLogin } from '@/utils/tenantUserAuth'
import { tenantSetPasswordUrl } from '@/utils/tenantUrl'
import { invitationEmail, passwordResetEmail, sendTenantEmail } from '@/email/tenantEmails'

// Cómo entra alguien al Dashboard de Cliente sin que Notoriovs intervenga:
// recuperando su contraseña, o aceptando la invitación de un `owner` de su
// Tenant (issue 10).
//
// Los dos flujos terminan en la MISMA pantalla y usan el MISMO mecanismo: el
// `resetPasswordToken` de la colección de auth de Payload. Se eligió sobre un
// token propio porque ya trae lo que hace falta y que es fácil escribir mal:
// el token vence (`resetPasswordExpiration`) y se consume al usarse — Payload
// deja la expiración en "ahora" al resetear, así que el segundo intento con
// el mismo enlace no encuentra usuario.
//
// La regla que atraviesa todo el archivo: el Tenant SIEMPRE sale del host de
// la petición, nunca del token ni del cuerpo. Un token legítimo de otro
// cliente no abre este dashboard.

/** Lo que dura un enlace de recuperación. Corto: quien lo pidió está frente a su correo. */
export const RESET_TOKEN_TTL_MS = 2 * 60 * 60 * 1000

/**
 * Lo que dura una invitación. Larga a propósito: se le manda a alguien que no
 * estaba esperando el correo y que quizá lo abra el lunes.
 */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Mínimo de una contraseña nueva. */
export const MIN_PASSWORD_LENGTH = 8

type TenantIdentity = {
  id: string | number
  subdomain: string
  companyName: string
}

/** `tenant` viene de la base como id plano, o poblado según por dónde se leyó. */
function toId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

function sameId(a: unknown, b: unknown): boolean {
  const left = toId(a)
  const right = toId(b)
  return left !== null && right !== null && String(left) === String(right)
}

/**
 * Pide recuperar la contraseña de `email` dentro de `tenant`.
 *
 * No devuelve nada y nunca falla hacia afuera: quien llama responde lo mismo
 * exista o no la cuenta. Un endpoint que contestara distinto sería una lista
 * de qué correos tienen acceso al dashboard de este cliente, consultable por
 * cualquiera.
 *
 * El email es único a nivel global en la colección, así que se busca acotado
 * al Tenant del host: la cuenta de otro cliente con ese mismo correo no
 * recibe nada.
 */
export async function requestPasswordReset(tenant: TenantIdentity, email: string): Promise<void> {
  const payload = await getPayload({ config })
  const normalized = email.trim().toLowerCase()
  if (!normalized) return

  const { docs } = await payload.find({
    collection: TENANT_USERS_SLUG,
    where: { and: [{ email: { equals: normalized } }, { tenant: { equals: tenant.id } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (docs.length === 0) return

  try {
    // `disableEmail: true` porque el correo lo mandamos nosotros: el que
    // manda Payload apunta a la pantalla de reset del panel de admin, que es
    // justo donde esta población no puede entrar, y sale con el remitente
    // genérico en vez del nombre del Tenant.
    const token = await payload.forgotPassword({
      collection: TENANT_USERS_SLUG,
      data: { email: normalized },
      disableEmail: true,
      expiration: RESET_TOKEN_TTL_MS,
    })

    if (!token) return

    await sendTenantEmail(payload, {
      companyName: tenant.companyName,
      to: normalized,
      email: passwordResetEmail(
        tenant.companyName,
        tenantSetPasswordUrl(tenant.subdomain, token),
        RESET_TOKEN_TTL_MS / (60 * 60 * 1000),
      ),
    })
  } catch (err) {
    // Tampoco aquí cambia la respuesta: se registra y ya.
    payload.logger.error(`Falló la recuperación de contraseña de ${normalized}: ${err}`)
  }
}

export type ResetOutcome =
  | { ok: true; login: TenantUserLogin }
  | { ok: false; reason: 'invalid-token' | 'weak-password' }

/**
 * Consume un token —de recuperación o de invitación, son el mismo— y deja al
 * usuario con contraseña nueva y sesión abierta.
 *
 * Antes de tocar nada se comprueba a quién pertenece el token y que ese
 * usuario sea de ESTE Tenant. Sin esa comprobación, una invitación emitida
 * por el cliente A podría canjearse abriendo el enlace en el subdominio del
 * cliente B: el reset funcionaría, y el usuario quedaría con sesión en un
 * host que no le toca. El resultado es el mismo `invalid-token` que un
 * enlace vencido: no hay nada que aprender de la diferencia.
 */
export async function resetPasswordWithToken(
  tenant: Pick<TenantIdentity, 'id'>,
  token: string,
  password: string,
): Promise<ResetOutcome> {
  if (!token) return { ok: false, reason: 'invalid-token' }
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: 'weak-password' }

  const payload = await getPayload({ config })

  // `db.findOne` y no `payload.find`: `resetPasswordToken` es un campo oculto
  // de la colección de auth y esta consulta no es de nadie: no hay usuario
  // autenticado todavía.
  const owner = await payload.db.findOne({
    collection: TENANT_USERS_SLUG,
    where: { resetPasswordToken: { equals: token } },
  })

  const ownerTenant = (owner as { tenant?: unknown } | null)?.tenant
  if (!owner || !sameId(ownerTenant, tenant.id)) return { ok: false, reason: 'invalid-token' }

  try {
    const { user, token: sessionToken } = await payload.resetPassword({
      collection: TENANT_USERS_SLUG,
      data: { token, password },
      overrideAccess: true,
    })

    if (!sessionToken || !user) return { ok: false, reason: 'invalid-token' }

    // Segunda comprobación del Tenant, ya sobre el documento que salió del
    // reset. Es barata y cierra el hueco entre las dos consultas.
    const resetUser = user as { id: string | number; email?: unknown; tenant?: unknown; role?: unknown }
    if (!sameId(resetUser.tenant, tenant.id)) return { ok: false, reason: 'invalid-token' }

    return {
      ok: true,
      login: {
        token: sessionToken,
        session: {
          id: resetUser.id,
          email: String(resetUser.email ?? ''),
          tenantId: toId(resetUser.tenant),
          role: normalizeTenantUserRole(resetUser.role),
        },
      },
    }
  } catch {
    // Payload tira 403 cuando el token no existe o ya venció. Es el caso
    // esperado de un enlace reusado, no un error del servidor.
    return { ok: false, reason: 'invalid-token' }
  }
}

export type InviteOutcome =
  | { ok: true; user: { id: string | number; email: string; role: TenantUserRole } }
  | { ok: false; reason: 'already-exists' | 'failed' }

/**
 * Da de alta a un compañero en `tenant` y le manda el enlace para definir su
 * contraseña.
 *
 * El usuario se crea con una contraseña aleatoria que nadie conoce ni ve: es
 * el token del correo, y solo él, lo que le abre la cuenta. Quien puede
 * llamar esto es un `owner` de este Tenant — lo verifica la ruta con el
 * permiso `users:manage` — y el Tenant que recibe al invitado es el del host,
 * no uno que venga en el cuerpo de la petición.
 */
export async function inviteTenantUser(
  tenant: TenantIdentity,
  email: string,
  role: TenantUserRole,
): Promise<InviteOutcome> {
  const payload = await getPayload({ config })
  const normalized = email.trim().toLowerCase()

  // El email es único a nivel global en la colección (índice de Payload), así
  // que se comprueba sin acotar al Tenant: si ya existe en otro cliente, el
  // alta iba a fallar en la base de todas formas. Lo que la respuesta NO dice
  // es en qué Tenant existe.
  const { totalDocs } = await payload.count({
    collection: TENANT_USERS_SLUG,
    where: { email: { equals: normalized } },
    overrideAccess: true,
  })

  if (totalDocs > 0) return { ok: false, reason: 'already-exists' }

  try {
    const created = await payload.create({
      collection: TENANT_USERS_SLUG,
      data: {
        email: normalized,
        // Nunca se comunica ni se guarda en claro: la cuenta solo se abre
        // canjeando el token del correo.
        password: crypto.randomBytes(32).toString('hex'),
        role,
        // El campo es una relación a `tenants`; el id ya viene resuelto del
        // host y Payload lo acepta como valor plano.
        tenant: tenant.id as number,
      },
      overrideAccess: true,
    })

    const token = await payload.forgotPassword({
      collection: TENANT_USERS_SLUG,
      data: { email: normalized },
      disableEmail: true,
      expiration: INVITATION_TTL_MS,
    })

    if (token) {
      await sendTenantEmail(payload, {
        companyName: tenant.companyName,
        to: normalized,
        email: invitationEmail(
          tenant.companyName,
          tenantSetPasswordUrl(tenant.subdomain, token),
          INVITATION_TTL_MS / (24 * 60 * 60 * 1000),
        ),
      })
    }

    return {
      ok: true,
      user: { id: created.id, email: normalized, role: normalizeTenantUserRole(created.role) },
    }
  } catch (err) {
    payload.logger.error(`No se pudo invitar a ${normalized} al tenant ${tenant.id}: ${err}`)
    return { ok: false, reason: 'failed' }
  }
}

export type TenantTeamMember = {
  id: string | number
  email: string
  role: TenantUserRole
  createdAt?: string
}

/**
 * El equipo de un Tenant, para que un `owner` vea a quién invitó antes de
 * volver a invitarlo. Solo email y rol: de esta colección no sale nada más.
 */
export async function listTenantUsers(tenantId: string | number): Promise<TenantTeamMember[]> {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: TENANT_USERS_SLUG,
    where: { tenant: { equals: tenantId } },
    limit: 100,
    depth: 0,
    sort: 'email',
    overrideAccess: true,
  })

  return docs.map((doc) => ({
    id: doc.id,
    email: String(doc.email ?? ''),
    role: normalizeTenantUserRole(doc.role),
    createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : undefined,
  }))
}
