import { createHmac, timingSafeEqual } from 'crypto'

// Sesión simple del dashboard de cliente: NO usa el sistema de auth de
// Payload (colección Users, pensada para el equipo interno). Cada tenant
// tiene una única contraseña compartida (Tenants → Dashboard Cliente →
// `dashboardPassword`, capturada a mano igual que el Meta Pixel / CAPI
// Token). Al validarla se firma una cookie httpOnly con HMAC-SHA256 usando
// PAYLOAD_SECRET como llave; no hay usuario, rol ni tabla de sesiones que
// mantener.
//
// El payload de la cookie incluye el `subdomain` y se revalida contra el
// subdomain de la petición en cada request: aunque la cookie sea host-only
// (un tenant nunca ve la cookie de otro, al vivir en subdominios distintos),
// esta doble checada evita fugas si algún día se sirve todo bajo un mismo
// host/dominio de cookies compartido.
const COOKIE_NAME = 'notoriovs_dashboard_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 días

function getSecret(): string {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET no está configurado')
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function createDashboardToken(subdomain: string): string {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000
  const payload = Buffer.from(JSON.stringify({ subdomain, exp })).toString('base64url')
  const signature = sign(payload)
  return `${payload}.${signature}`
}

export function verifyDashboardToken(token: string | undefined | null, subdomain: string): boolean {
  if (!token || !subdomain) return false

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false

  let sigBuffer: Buffer
  let expectedBuffer: Buffer
  try {
    sigBuffer = Buffer.from(signature)
    expectedBuffer = Buffer.from(sign(payload))
  } catch {
    return false
  }
  if (sigBuffer.length !== expectedBuffer.length) return false
  if (!timingSafeEqual(sigBuffer, expectedBuffer)) return false

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      subdomain?: string
      exp?: number
    }
    if (data.subdomain !== subdomain.toLowerCase()) return false
    if (!data.exp || Date.now() > data.exp) return false
    return true
  } catch {
    return false
  }
}

export const DASHBOARD_COOKIE_NAME = COOKIE_NAME
export const DASHBOARD_COOKIE_MAX_AGE = MAX_AGE_SECONDS
