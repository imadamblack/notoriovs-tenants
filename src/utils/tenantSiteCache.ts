import type { Payload } from 'payload'

/**
 * Caché de las páginas públicas de un tenant.
 *
 * Las páginas de /tenant-site/[subdomain] (landing, quiz, gracias, no
 * elegible, aviso de privacidad) se prerrenderizan y se sirven desde el CDN:
 * un clic de anuncio ya no dispara una consulta a Postgres. La contraparte es
 * que el HTML se queda congelado hasta que alguien lo invalida, y eso es lo
 * que hace `revalidateTenantSite` desde los hooks del Tenant.
 */

/**
 * Red de seguridad, no el mecanismo principal: lo normal es que la caché se
 * invalide al guardar el Tenant. Este TTL solo acota cuánto puede durar
 * contenido rancio si esa invalidación falla (n8n caído, deploy a media
 * escritura, un cambio hecho fuera del admin).
 */
export const TENANT_SITE_REVALIDATE_SECONDS = 3600

/**
 * Prefijo interno bajo el que viven las páginas de un tenant. En el host real
 * del tenant el visitante nunca lo ve (`src/middleware.ts` reescribe
 * `acme.notoriovs.com/survey` → `/tenant-site/acme/survey`), pero es la ruta
 * con la que Next indexa la caché, así que es la que hay que invalidar.
 */
export function tenantSitePath(subdomain: string): string {
  return `/tenant-site/${subdomain.toLowerCase()}`
}

/**
 * Sufijos de las páginas públicas de un tenant, relativos a `tenantSitePath`.
 * `''` es la landing.
 *
 * Enumerarlas es feo pero es la única forma que **funciona**: hay que
 * invalidar la ruta concreta de cada página. Medido contra un build de
 * producción, con la caché caliente:
 *
 *   revalidatePath('/tenant-site/x/thankyou')           → MISS  ✅
 *   revalidatePath('/tenant-site/x', 'layout')          → HIT   ❌
 *   revalidatePath('/tenant-site/x/thankyou', 'page')   → HIT   ❌
 *   revalidatePath('/tenant-site/[subdomain]', 'layout')→ HIT   ❌
 *
 * Ninguna de las que fallan lanza error: `revalidatePath` acepta la llamada
 * y no invalida nada. Este comentario existe para que nadie "simplifique"
 * esta lista de vuelta a una sola llamada con `'layout'`, que es lo que
 * parece correcto leyendo la documentación y no lo es.
 *
 * `tenantSiteCache.int.spec.ts` verifica que esta lista siga cubriendo todas
 * las páginas que existen en el disco.
 */
export const TENANT_SITE_PAGES = ['', '/survey', '/thankyou', '/not-elegible', '/privacy-notice'] as const

/**
 * Invalida las páginas públicas de un tenant.
 *
 * `next/cache` se importa dinámicamente porque este módulo lo termina
 * arrastrando `payload.config.ts`, que también se carga fuera de Next
 * (`payload migrate`, `payload generate:types`). Un import estático haría
 * fallar esos comandos por una dependencia que ahí no aplica.
 *
 * Fire-and-forget, como el resto de efectos externos del repo: si la
 * invalidación falla, el tenant se guardó igual y sus páginas se refrescan
 * solas al vencer `TENANT_SITE_REVALIDATE_SECONDS`.
 */
export async function revalidateTenantSite(
  subdomains: Array<string | null | undefined>,
  payload: Payload,
): Promise<void> {
  const targets = [...new Set(subdomains.filter((s): s is string => Boolean(s?.trim())))]
  if (!targets.length) return

  try {
    const { revalidatePath } = await import('next/cache')
    for (const subdomain of targets) {
      const base = tenantSitePath(subdomain)
      for (const page of TENANT_SITE_PAGES) {
        revalidatePath(`${base}${page}`)
      }
    }
  } catch (err) {
    payload.logger.warn(
      `No se pudo invalidar la caché del sitio de ${targets.join(', ')}: ${err}. ` +
        `Las páginas se refrescarán solas en ${TENANT_SITE_REVALIDATE_SECONDS}s.`,
    )
  }
}
