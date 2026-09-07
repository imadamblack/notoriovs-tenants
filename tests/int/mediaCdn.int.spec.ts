// @vitest-environment node
import { describe, it, expect } from 'vitest'

import config from '@/payload.config'
import { getBlobRemotePattern } from '@/utils/blobStorage'

describe('getBlobRemotePattern', () => {
  it('deriva el host del store a partir del token de lectura/escritura', () => {
    expect(getBlobRemotePattern({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_ABC123_xyz789' })).toEqual({
      protocol: 'https',
      hostname: 'abc123.public.blob.vercel-storage.com',
    })
  })

  it('cae a BLOB_STORE_ID cuando el token no está disponible', () => {
    expect(getBlobRemotePattern({ BLOB_STORE_ID: 'Store42' })).toEqual({
      protocol: 'https',
      hostname: 'store42.public.blob.vercel-storage.com',
    })
  })

  it('respeta el override del emulador, protocolo incluido', () => {
    expect(
      getBlobRemotePattern({
        STORAGE_VERCEL_BLOB_BASE_URL: 'http://localhost:9966',
        BLOB_STORE_ID: 'store42',
      }),
    ).toEqual({ protocol: 'http', hostname: 'localhost' })
  })

  it('cae a un comodín acotado al dominio de Vercel Blob si no se conoce el store', () => {
    expect(getBlobRemotePattern({})).toEqual({
      protocol: 'https',
      hostname: '*.public.blob.vercel-storage.com',
    })
  })
})

describe('colección media', () => {
  it('no registra ningún handler que sirva archivos desde la app', async () => {
    const resolved = await config
    const media = resolved.collections.find((collection) => collection.slug === 'media')

    expect(media?.upload).toBeDefined()
    expect(media?.upload?.handlers ?? []).toHaveLength(0)
  })
})
