// La URL pública del sitio de un Tenant, armada desde la configuración del
// servidor y NUNCA desde la cabecera `Host` de la petición.
//
// Esa distinción es el punto del archivo. Los enlaces de recuperación de
// contraseña y de invitación llevan un token de un solo uso: si la URL se
// construyera con el host que manda el cliente, bastaría con pedir la
// recuperación de la cuenta de alguien más con un `Host:` apuntando a un
// servidor propio para que el token llegara al atacante (host header
// injection). Aquí el dominio sale de `ROOT_DOMAIN` y el subdominio del
// documento del Tenant.

const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'notoriovs.com'

/**
 * En local el dominio raíz es `localhost` y el puerto no vive en
 * `ROOT_DOMAIN` (el middleware lo ignora al resolver el subdominio), así que
 * se toma del que sirve Next. También es lo que decide http vs https.
 */
function isLocalRootDomain(rootDomain: string): boolean {
  const host = rootDomain.split(':')[0]
  return host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1'
}

/** `https://acme.notoriovs.com/dashboard` — o su equivalente local. */
export function tenantSiteUrl(subdomain: string, path = '/'): string {
  const local = isLocalRootDomain(ROOT_DOMAIN)
  const scheme = local ? 'http' : 'https'
  const port = local && !ROOT_DOMAIN.includes(':') ? `:${process.env.PORT || 3000}` : ''
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${scheme}://${subdomain.toLowerCase()}.${ROOT_DOMAIN}${port}${normalizedPath}`
}

/**
 * La pantalla donde se define una contraseña con un token: sirve tanto para
 * recuperar la propia como para aceptar una invitación. Es una sola pantalla
 * a propósito — los dos flujos terminan en lo mismo, "elige tu contraseña",
 * y duplicarla solo daría dos formas de equivocarse.
 */
export function tenantSetPasswordUrl(subdomain: string, token: string): string {
  return tenantSiteUrl(subdomain, `/dashboard/nueva-contrasena?token=${encodeURIComponent(token)}`)
}
