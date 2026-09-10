import type { EmailAdapter, SendEmailOptions } from 'payload'

// Salida de correo transaccional del sistema: recuperación de contraseña e
// invitaciones a un Tenant (issue 10).
//
// Se habla con la API v3 de SendGrid por `fetch` en vez de montar
// `@payloadcms/email-nodemailer` + SMTP. Dos razones, en orden de peso:
//
// 1. Esto corre en funciones serverless de Vercel. Una petición HTTPS empieza
//    y termina dentro de la invocación; una sesión SMTP mantiene un socket
//    abierto que hay que cerrar a mano y que se muere con la función, con lo
//    que un correo puede quedar a medio entregar sin que nadie se entere.
// 2. Cero dependencias nuevas: el cuerpo que pide SendGrid son treinta líneas
//    de JSON, no una librería.
//
// Sin `SENDGRID_API_KEY` este adaptador no se monta y Payload cae en el suyo,
// que imprime los correos en la consola. Eso es lo que se quiere en
// desarrollo: el enlace de recuperación sale en la terminal y nadie manda
// correo de verdad desde su máquina.

const SENDGRID_ENDPOINT = 'https://api.sendgrid.com/v3/mail/send'

/** Dirección desde la que sale TODO el correo del sistema. Ver `tenantEmails`. */
export const DEFAULT_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'no-reply@notoriovs.com'

/** Nombre visible cuando el correo no es de ningún Tenant en particular. */
export const DEFAULT_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Notoriovs'

type Address = { email: string; name?: string }

/**
 * Parte `"Nombre Visible" <buzon@dominio>` en sus dos mitades. Payload arma
 * el `from` así (una sola cadena) y SendGrid lo quiere separado.
 * Una dirección pelada (`buzon@dominio`) también es válida y se devuelve sin
 * nombre.
 */
export function parseAddress(value: unknown): Address | null {
  if (value && typeof value === 'object' && 'address' in value) {
    const { address, name } = value as { address?: unknown; name?: unknown }
    if (typeof address !== 'string' || !address) return null
    return typeof name === 'string' && name ? { email: address, name } : { email: address }
  }

  if (typeof value !== 'string') return null

  const withName = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (withName) {
    const name = withName[1].trim()
    const email = withName[2].trim()
    return name ? { email, name } : { email }
  }

  const bare = value.trim()
  return bare ? { email: bare } : null
}

function toRecipients(to: SendEmailOptions['to']): Address[] {
  const values = Array.isArray(to) ? to : [to]

  return values.map(parseAddress).filter((address): address is Address => address !== null)
}

/**
 * El cuerpo que espera la API v3 de SendGrid. Separado del envío para poder
 * leerlo de un vistazo (y afirmarlo en un test) sin tocar la red.
 */
export function buildSendGridPayload(message: SendEmailOptions, fallbackFrom: Address) {
  const to = toRecipients(message.to)
  if (to.length === 0) throw new Error('Un correo sin destinatario no se envía.')

  const content: { type: string; value: string }[] = []
  // SendGrid exige el texto plano ANTES del HTML: es el orden de preferencia
  // del cliente de correo, no un detalle de formato.
  if (typeof message.text === 'string' && message.text) {
    content.push({ type: 'text/plain', value: message.text })
  }
  if (typeof message.html === 'string' && message.html) {
    content.push({ type: 'text/html', value: message.html })
  }
  if (content.length === 0) throw new Error('Un correo sin cuerpo no se envía.')

  return {
    personalizations: [{ to }],
    from: parseAddress(message.from) ?? fallbackFrom,
    subject: message.subject ?? '',
    content,
  }
}

export const sendgridAdapter = (apiKey: string): EmailAdapter<Response> =>
  ({ payload }) => {
    const fallbackFrom: Address = { email: DEFAULT_FROM_ADDRESS, name: DEFAULT_FROM_NAME }

    return {
      name: 'sendgrid',
      defaultFromAddress: DEFAULT_FROM_ADDRESS,
      defaultFromName: DEFAULT_FROM_NAME,
      sendEmail: async (message) => {
        const res = await fetch(SENDGRID_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildSendGridPayload(message, fallbackFrom)),
        })

        if (!res.ok) {
          // El cuerpo del error de SendGrid dice cuál es el problema real
          // (remitente sin verificar, llave sin permisos); sin él, en el log
          // solo queda un 403 mudo.
          const detail = await res.text().catch(() => '')
          payload.logger.error(`SendGrid rechazó el correo (${res.status}): ${detail}`)
          throw new Error(`SendGrid respondió ${res.status}`)
        }

        return res
      },
    }
  }
