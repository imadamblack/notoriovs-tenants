import type { Payload } from 'payload'
import { DEFAULT_FROM_ADDRESS } from '@/email/sendgrid'

// Los correos que un Tenant le manda a su gente. Todos salen del dominio de
// Notoriovs (un solo remitente verificado en SendGrid, ver issue 00) y llevan
// el nombre del cliente como nombre visible: quien recibe lee "Acme", no
// "Notoriovs", aunque el buzón sea nuestro.
//
// Que sea SIEMPRE nuestro dominio no es una simplificación: verificar el
// dominio de cada cliente en SendGrid significaría pedirle a cada uno que
// toque su DNS, y un correo firmado con un dominio ajeno sin esa
// verificación cae directo en spam.

/**
 * Un nombre de remitente no puede traer comillas ni saltos de línea: la
 * cabecera `From` se arma concatenando, y un salto de línea ahí es una
 * cabecera nueva que el atacante escribe (header injection). El nombre del
 * Tenant lo captura el equipo interno, no un desconocido, pero esto no
 * depende de eso.
 */
function sanitizeFromName(name: string): string {
  return name.replace(/[\r\n"<>]/g, ' ').trim() || 'Notoriovs'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** `"Acme" <no-reply@notoriovs.com>`: dominio nuestro, nombre del cliente. */
export function tenantFromLine(companyName: string): string {
  return `"${sanitizeFromName(companyName)}" <${DEFAULT_FROM_ADDRESS}>`
}

type TenantEmail = {
  subject: string
  text: string
  html: string
}

/**
 * Plantilla única: un párrafo, un botón y la URL en texto. El correo lo abre
 * gente en su teléfono y el 90% de los clientes recorta el HTML elaborado,
 * así que el texto plano tiene que bastarse solo.
 */
function actionEmail({
  companyName,
  intro,
  actionLabel,
  url,
  footer,
}: {
  companyName: string
  intro: string
  actionLabel: string
  url: string
  footer: string
}): { text: string; html: string } {
  const text = `${intro}\n\n${url}\n\n${footer}\n\n${companyName} · CRM de Notoriovs`

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#171717;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
      <tr><td>
        <p style="margin:0 0 16px;font-size:18px;font-weight:600;">${escapeHtml(companyName)}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
        <p style="margin:0 0 24px;">
          <a href="${escapeHtml(url)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-size:15px;">${escapeHtml(actionLabel)}</a>
        </p>
        <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#525252;word-break:break-all;">
          Si el botón no funciona, copia esta dirección en tu navegador:<br />${escapeHtml(url)}
        </p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#525252;">${escapeHtml(footer)}</p>
      </td></tr>
    </table>
  </body>
</html>`

  return { text, html }
}

export function passwordResetEmail(companyName: string, url: string, hours: number): TenantEmail {
  return {
    subject: `Recupera tu contraseña de ${companyName}`,
    ...actionEmail({
      companyName,
      intro: `Pediste recuperar la contraseña de tu cuenta en el CRM de ${companyName}. Elige una nueva desde aquí.`,
      actionLabel: 'Elegir nueva contraseña',
      url,
      footer: `El enlace vence en ${hours} ${hours === 1 ? 'hora' : 'horas'} y solo sirve una vez. Si no lo pediste, ignora este correo: tu contraseña sigue igual.`,
    }),
  }
}

export function invitationEmail(companyName: string, url: string, days: number): TenantEmail {
  return {
    subject: `Te invitaron al CRM de ${companyName}`,
    ...actionEmail({
      companyName,
      intro: `Te dieron acceso al CRM de ${companyName}, donde viven los prospectos y los números de sus campañas. Define tu contraseña para entrar.`,
      actionLabel: 'Definir mi contraseña',
      url,
      footer: `La invitación vence en ${days} días. Si vence, pídele a quien te invitó que te mande otra.`,
    }),
  }
}

/**
 * Manda un correo a nombre de un Tenant. Devuelve si salió: quien llama
 * decide qué hacer con eso, y en los flujos de este issue la respuesta al
 * usuario NO cambia — un fallo de SendGrid no puede convertirse en una
 * respuesta distinta que delate qué cuentas existen.
 */
export async function sendTenantEmail(
  payload: Payload,
  { companyName, to, email }: { companyName: string; to: string; email: TenantEmail },
): Promise<boolean> {
  try {
    await payload.sendEmail({
      from: tenantFromLine(companyName),
      to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    })
    return true
  } catch (err) {
    payload.logger.error(`No se pudo enviar "${email.subject}" a ${to}: ${err}`)
    return false
  }
}
