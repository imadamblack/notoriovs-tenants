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
  /** `vercel_blob_rw_<storeId>_<random>`. El plugin deriva el store de aquí. */
  BLOB_READ_WRITE_TOKEN?: string
  /** El id del store, cuando se configuró por separado. */
  BLOB_STORE_ID?: string
  // Abierto para poder recibir `process.env` tal cual.
  [key: string]: string | undefined
}

/** Lo que `images.remotePatterns` necesita saber de un origen. */
export type BlobRemotePattern = {
  protocol: 'http' | 'https'
  hostname: string
}

const TOKEN_PATTERN = /^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i

const hostnameForStore = (storeId: string) => `${storeId}.public.blob.vercel-storage.com`

/**
 * Origen público del store, o `null` si el entorno no permite saber cuál es
 * (por ejemplo, un build de preview sin credenciales de blob).
 */
function getBlobBaseUrl(env: BlobEnv): string | null {
  if (env.STORAGE_VERCEL_BLOB_BASE_URL) return env.STORAGE_VERCEL_BLOB_BASE_URL

  // Mismo orden de derivación que `@payloadcms/storage-vercel-blob`: el store
  // vive dentro del token, y `BLOB_STORE_ID` es el respaldo explícito.
  const storeId = env.BLOB_READ_WRITE_TOKEN?.match(TOKEN_PATTERN)?.[1] || env.BLOB_STORE_ID

  if (!storeId) return null

  return `https://${hostnameForStore(storeId.toLowerCase())}`
}

/**
 * El origen de media que el optimizador de imágenes de Next debe aceptar.
 *
 * Cuando no se puede derivar el store cae a un comodín sobre el dominio de
 * Vercel Blob: es preferible a romper un build sin credenciales, y el
 * optimizador sigue acotado a ese dominio.
 */
export function getBlobRemotePattern(env: BlobEnv): BlobRemotePattern {
  const baseUrl = getBlobBaseUrl(env)

  if (!baseUrl) return { protocol: 'https', hostname: hostnameForStore('*') }

  const { protocol, hostname } = new URL(baseUrl)

  return { protocol: protocol === 'http:' ? 'http' : 'https', hostname }
}
