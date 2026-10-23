import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSubdomainFromHost, ROOT_DOMAIN } from '@/utils/subdomain'

// Se enumeran las extensiones en vez de aceptar cualquier punto: un slug de
// tenant podría traerlo y no queremos dejar de reescribir su página.
const STATIC_FILE = /\.(?:png|jpe?g|gif|svg|ico|webp|avif|txt|xml|json|webmanifest|css|js|map|woff2?|ttf|otf|mp4|webm)$/i

// --- Qué rutas viven en qué host (issues 28 y 31) --------------------------
//
// Hay dos clases de host: el del panel (dominio raíz, subdominio reservado o
// cualquier host fuera de ROOT_DOMAIN, como el *.vercel.app) y el de un Tenant
// (`{subdomain}.notoriovs.com`). Este bloque es el único lugar que decide qué
// sirve cada uno; la prueba del middleware lo afirma ruta por ruta.
//
// En el host de un Tenant no existen el panel (`/admin`) ni la API de Payload
// (`src/app/(payload)/api/**`: REST de todas las colecciones, GraphQL, login y
// recuperación de contraseña del panel). Responden 404. No sustituye al
// control de acceso de las colecciones: es una capa más, por fuera.
//
// El corte no es "todo /api": ahí también viven las rutas propias del producto
// (`src/app/api/**`), y esas siguen en todos los hosts. Se enumeran por ruta
// exacta y no por prefijo porque comparten prefijo con colecciones de Payload:
// `/api/leads/ingest` es nuestra, `/api/leads` es el REST de la colección.
//
// El traspaso del panel al dashboard de un cliente (issue 31) cruza los dos
// hosts: el ticket se emite en el del panel (`PANEL_ONLY_PRODUCT_ROUTES`, que
// lee la sesión del panel) y se canjea en el del Tenant
// (`/api/tenant-dashboard/internal-session`, bajo el prefijo de abajo).

/** Rutas propias del producto que solo existen en el host del panel. */
const PANEL_ONLY_PRODUCT_ROUTES = new Set(['/api/internal-dashboard/enter'])

/** Rutas propias del producto bajo /api. Sirven en cualquier host. */
const PRODUCT_API_ROUTES = new Set([
  '/api/quiz-submit',
  '/api/fb-event',
  '/api/leads/ingest',
  '/api/leads/bulk-import',
  '/api/marketing-reports/ingest',
  '/api/marketing-reports/ad-accounts',
])

/** Prefijos propios del producto: ninguna colección de Payload se llama así. */
const PRODUCT_API_PREFIXES = [
  '/api/tenant-dashboard/',
  // Los archivos de Media sin blob (desarrollo, carpeta local `media/`) se
  // sirven por aquí, y la landing de un tenant los pide desde su propio host.
  // Con blob la `url` ya apunta al CDN. Media es pública (`read: () => true`).
  '/api/media/file/',
]

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`)
}

/** ¿Esta ruta solo existe en el host del panel? */
function isPanelOnlyPath(pathname: string): boolean {
  if (isUnder(pathname, '/admin')) return true
  if (!isUnder(pathname, '/api')) return false
  if (PANEL_ONLY_PRODUCT_ROUTES.has(pathname)) return true
  if (PRODUCT_API_ROUTES.has(pathname)) return false
  return !PRODUCT_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || ''
  const pathname = req.nextUrl.pathname

  const subdomain = getSubdomainFromHost(host, ROOT_DOMAIN)

  // En el host de un Tenant, el panel y la API de Payload no existen (ver
  // isPanelOnlyPath). En el del panel pasan directo, igual que siempre.
  if (isPanelOnlyPath(pathname)) {
    return subdomain ? new NextResponse(null, { status: 404 }) : NextResponse.next()
  }

  // Las rutas propias del producto pasan directo en cualquier host, sin
  // reescritura por tenant.
  if (isUnder(pathname, '/api')) {
    return NextResponse.next()
  }

  // Archivos estáticos de /public (el icono de home screen de iOS, entre
  // otros). Sin esto, en el host de un tenant la reescritura los manda a
  // /tenant-site/{sub}/archivo.png, que no existe: iOS no encuentra el
  // apple-touch-icon y guarda una captura de la página en su lugar.
  if (STATIC_FILE.test(pathname)) {
    return NextResponse.next()
  }

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
