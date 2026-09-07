/**
 * Dónde vive físicamente el media de los Tenants.
 *
 * El origen de Vercel Blob es público y con CDN al frente, así que las `url`
 * de media apuntan directo ahí: ninguna imagen de una landing o de un quiz se
 * sirve desde la app. El plugin de storage deriva ese origen por su cuenta;
 * este módulo lo replica para el único consumidor que no puede preguntárselo,
 * `next.config.ts`, que debe autorizar el host en `images.remotePatterns`
 * para que el optimizador de Next acepte esas URLs remotas.
 *
 * Solo lee de `process.env` y no importa nada, porque `next.config.ts` se
 * evalúa antes de que exista cualquier alias de módulo.
 */

/** Subconjunto de `process.env` del que depende el origen del blob. */
export type BlobEnv = {
  /** Override del origen. Lo usa el emulador local de Vercel Blob. */
  STORAGE_VERCEL_BLOB_BASE_URL?: string
  /** `vercel_blob_rw_<storeId>_<random>`. Única fuente del id del store. */
  BLOB_READ_WRITE_TOKEN?: string
  // Abierto para poder recibir `process.env` tal cual.
  [key: string]: string | undefined
}

/** Lo que `images.remotePatterns` necesita saber de un origen. */
export type BlobRemotePattern = {
  protocol: 'http' | 'https'
  hostname: string
}

const TOKEN_PATTERN = /^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i

/**
 * `public` es el `access` con el que `payload.config.ts` monta el plugin (su
 * valor por defecto, que no cambiamos). Si algún día se monta como privado,
 * este host cambia con él.
 */
const hostnameForStore = (storeId: string) => `${storeId}.public.blob.vercel-storage.com`

/**
 * Origen público del store, o `null` si el entorno no lo define.
 *
 * Deriva el store igual que `@payloadcms/storage-vercel-blob`: sale del token,
 * y de ningún otro lado. Sin token el plugin se apaga por completo y ninguna
 * media llega a tener una `url` de blob, así que ahí no hay nada que
 * autorizar.
 */
function getBlobBaseUrl(env: BlobEnv): string | null {
  if (env.STORAGE_VERCEL_BLOB_BASE_URL) return env.STORAGE_VERCEL_BLOB_BASE_URL

  const storeId = env.BLOB_READ_WRITE_TOKEN?.match(TOKEN_PATTERN)?.[1]

  if (!storeId) return null

  return `https://${hostnameForStore(storeId.toLowerCase())}`
}

/**
 * Los orígenes de media que el optimizador de imágenes de Next debe aceptar:
 * exactamente uno, o ninguno si no hay blob configurado. Se devuelve como
 * lista para que `images.remotePatterns` la use tal cual — una lista vacía no
 * autoriza ningún host remoto, que es lo correcto cuando no hay blob.
 */
export function getBlobRemotePatterns(env: BlobEnv): BlobRemotePattern[] {
  const baseUrl = getBlobBaseUrl(env)

  if (!baseUrl) return []

  const { protocol, hostname } = new URL(baseUrl)

  return [{ protocol: protocol === 'http:' ? 'http' : 'https', hostname }]
}
