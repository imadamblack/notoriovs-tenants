// Lógica compartida para resolver el subdominio de un host, usada tanto por
// src/middleware.ts (server/edge) como por src/services/fbEvents.ts
// (browser, vía window.location.hostname) para que ambos sitios coincidan
// en qué cuenta como "subdominio de tenant".
const RESERVED_SUBDOMAINS = new Set(['app', 'admin'])

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
