// Lógica compartida para resolver el subdominio de un host, usada tanto por
// src/middleware.ts (server/edge) como por las rutas del dashboard, para que
// todos los sitios coincidan en qué cuenta como "subdominio de tenant".
const RESERVED_SUBDOMAINS = new Set(['app', 'admin'])

// El dominio raíz real de producción, ej: "notoriovs.com". Puede
// sobreescribirse con la env var ROOT_DOMAIN sin tocar código.
export const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'notoriovs.com'

export function getSubdomainFromHost(host: string, rootDomain: string): string {
  const hostWithoutPort = (host || '').toLowerCase().split(':')[0]

  const isLocalhost = hostWithoutPort.endsWith('.localhost') || hostWithoutPort === 'localhost'

  const subdomain = isLocalhost
    ? hostWithoutPort === 'localhost'
      ? ''
      : hostWithoutPort.replace('.localhost', '')
    : hostWithoutPort.endsWith(`.${rootDomain}`)
      ? hostWithoutPort.replace(`.${rootDomain}`, '')
      : ''

  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) return ''

  return subdomain
}

/**
 * De qué tenant es esta petición, según su propia cabecera `Host`.
 *
 * Es la respuesta a "¿a qué cliente pertenece esto?" en todo lo que corre en
 * el servidor con una petición a la mano (ADR 0002). El navegador no elige el
 * `Host`: lo pone él a partir de la URL que se abrió, así que a diferencia de
 * un `?subdomain=` o un campo del cuerpo, no es un dato que el cliente pueda
 * escribir. Un route handler de Next lo lee de su propia petición, sin que el
 * middleware tenga que reenviárselo.
 *
 * Devuelve '' si el host no es el de ningún tenant (dominio raíz o subdominio
 * reservado); quien llama lo trata como "no hay tenant".
 */
export function getSubdomainFromHeaders(headers: Headers): string {
  return getSubdomainFromHost(headers.get('host') || '', ROOT_DOMAIN)
}
