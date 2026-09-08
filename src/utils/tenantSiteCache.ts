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
 * Invalida TODAS las páginas públicas de un tenant de un solo golpe.
 *
 * El tipo `'layout'` invalida el segmento y todo lo que cuelga de él, así que
 * cubre landing, survey, thankyou, not-elegible y privacy-notice sin tener
 * que enumerarlas — una lista que se desincronizaría en cuanto alguien
 * agregue una página nueva.
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
      revalidatePath(tenantSitePath(subdomain), 'layout')
    }
  } catch (err) {
    payload.logger.warn(
      `No se pudo invalidar la caché del sitio de ${targets.join(', ')}: ${err}. ` +
        `Las páginas se refrescarán solas en ${TENANT_SITE_REVALIDATE_SECONDS}s.`,
    )
  }
}
