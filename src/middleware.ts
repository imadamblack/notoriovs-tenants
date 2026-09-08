import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSubdomainFromHost } from '@/utils/subdomain'

// Configura este valor con el dominio raíz real de producción, ej: "notoriovs.com".
// Puede sobreescribirse con la env var ROOT_DOMAIN sin tocar código.
const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'notoriovs.com'

// Se enumeran las extensiones en vez de aceptar cualquier punto: un slug de
// tenant podría traerlo y no queremos dejar de reescribir su página.
const STATIC_FILE = /\.(?:png|jpe?g|gif|svg|ico|webp|avif|txt|xml|json|webmanifest|css|js|map|woff2?|ttf|otf|mp4|webm)$/i

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || ''
  const pathname = req.nextUrl.pathname

  // Admin y API de Payload siempre pasan directo, sin reescritura por tenant.
  if (pathname.startsWith('/admin') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Archivos estáticos de /public (el icono de home screen de iOS, entre
  // otros). Sin esto, en el host de un tenant la reescritura los manda a
  // /tenant-site/{sub}/archivo.png, que no existe: iOS no encuentra el
  // apple-touch-icon y guarda una captura de la página en su lugar.
  if (STATIC_FILE.test(pathname)) {
    return NextResponse.next()
  }

  const subdomain = getSubdomainFromHost(host, ROOT_DOMAIN)

  // Rutas ya resueltas a /tenant-site/{subdomain}/... (ej. el iframe de Live
  // Preview del admin) pasan directo. Sin este guard, si el admin se sirve
  // desde un subdominio no reservado (ver RESERVED_SUBDOMAINS), esta ruta se
  // reescribiría dos veces (/tenant-site/{admin}/tenant-site/{tenant}/...) y
  // el preview daría 404.
  if (pathname.startsWith('/tenant-site')) {
    // ...salvo en el host real del tenant, donde /tenant-site/{sub} es ruta
    // interna y no una URL pública: servirla ahí duplicaría cada página en
    // dos URLs. Se canonicaliza de vuelta a la limpia.
    //
    // Esto es lo que le permite a la landing redirigir al quiz con la ruta
    // interna absoluta (ver el comentario en page.tsx) en vez de leer el
    // `host` con `headers()`, que volvería la página dinámica y tiraría toda
    // la caché.
    const internalPrefix = `/tenant-site/${subdomain}`
    const isOwnInternalPath =
      Boolean(subdomain) &&
      (pathname === internalPrefix || pathname.startsWith(`${internalPrefix}/`))

    if (isOwnInternalPath) {
      const url = req.nextUrl.clone()
      url.pathname = pathname.slice(internalPrefix.length) || '/'
      return NextResponse.redirect(url, 308)
    }

    return NextResponse.next()
  }

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
