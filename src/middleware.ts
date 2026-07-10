import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSubdomainFromHost } from '@/utils/subdomain'

// Configura este valor con el dominio raíz real de producción, ej: "notoriovs.com".
// Puede sobreescribirse con la env var ROOT_DOMAIN sin tocar código.
const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'notoriovs.com'

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || ''
  const pathname = req.nextUrl.pathname

  // Admin y API de Payload siempre pasan directo, sin reescritura por tenant.
  if (pathname.startsWith('/admin') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  const subdomain = getSubdomainFromHost(host, ROOT_DOMAIN)

  // Dominio raíz (sin subdominio) o subdominio reservado: se sirve el sitio
  // default definido en src/app/(frontend)/(site), sin reescritura.
  if (!subdomain) {
    return NextResponse.next()
  }

  const url = req.nextUrl.clone()
  url.pathname = `/tenant-site/${subdomain}${pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|images|fonts).*)'],
}
