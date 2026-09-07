import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

import { getBlobRemotePattern } from './src/utils/blobStorage'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  serverExternalPackages: ['@payloadcms/db-postgres'],
  images: {
    // El media de los Tenants se sirve directo desde el blob público, no desde
    // la app, así que el optimizador de Next tiene que aceptarlo como origen
    // remoto. `localPatterns` ya no incluye `/api/media/file/**` porque esa
    // ruta dejó de servir imágenes.
    remotePatterns: [getBlobRemotePattern(process.env)],
    localPatterns: [
      {
        pathname: '/images/**',
      },
      {
        pathname: '/*',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
  allowedDevOrigins: ['192.168.100.72', '192.168.100.80'],
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
