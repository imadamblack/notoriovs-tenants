// @vitest-environment node
import { describe, it, expect } from 'vitest'

import config from '@/payload.config'
import { getBlobRemotePatterns } from '@/utils/blobStorage'

describe('getBlobRemotePatterns', () => {
  it('deriva el host del store a partir del token, igual que el plugin', () => {
    expect(getBlobRemotePatterns({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_ABC123_xyz789' })).toEqual([
      { protocol: 'https', hostname: 'abc123.public.blob.vercel-storage.com' },
    ])
  })

  it('respeta el override del emulador, protocolo incluido', () => {
    expect(
      getBlobRemotePatterns({
        STORAGE_VERCEL_BLOB_BASE_URL: 'http://localhost:9966',
        BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_abc123_xyz789',
      }),
    ).toEqual([{ protocol: 'http', hostname: 'localhost' }])
  })

  it('no autoriza ningún host cuando no hay blob configurado', () => {
    // Sin token el plugin de storage se apaga y ninguna media tiene `url` de
    // blob, así que no hay nada que autorizar.
    expect(getBlobRemotePatterns({})).toEqual([])
  })

  it('no autoriza ningún host si el token está mal formado', () => {
    expect(getBlobRemotePatterns({ BLOB_READ_WRITE_TOKEN: 'no-es-un-token' })).toEqual([])
  })
})

describe('colección media', () => {
  it('no registra ningún handler que sirva archivos desde la app', async () => {
    // El plugin de cloud storage inyecta su `staticHandler` en `upload.handlers`
    // salvo que se le pase `disablePayloadAccessControl`. Que la lista quede
    // vacía es lo que garantiza que `/api/media/file/...` ya no sirve imágenes.
    const resolved = await config
    const media = resolved.collections.find((collection) => collection.slug === 'media')

    expect(media?.upload).toBeDefined()
    expect(media?.upload?.handlers ?? []).toHaveLength(0)
  })
})
