import { postgresAdapter } from '@payloadcms/db-postgres'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Tenants } from './collections/Tenants'
import { Leads } from './collections/Leads'
import { MarketingReports } from './collections/MarketingReports'
// `Config` se importa como tipo desde el archivo generado (payload-types.ts)
// para darle tipado fuerte al plugin (multiTenantPlugin<Config>(...)); no
// crea un ciclo real porque solo se usa a nivel de tipos, nunca en runtime.
import type { Config } from './payload-types'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      icons: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          url: '/favicon.svg',
        },
      ],
    },
    components: {
      graphics: {
        Logo: '/components/AdminLogo#AdminLogo',
        Icon: '/components/Favicon#Favicon',
      },
      beforeDashboard: ['/components/TenantsDashboardWidget#TenantsDashboardWidget'],
    },
  },
  collections: [Users, Media, Tenants, Leads, MarketingReports],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [
    vercelBlobStorage({
      collections: {
        media: true,
      },
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
    }),
    // Agrega el selector de tenant en el admin de Payload y filtra
    // automáticamente las listas de `leads` y `marketing-reports` por el
    // tenant seleccionado, en vez de mostrar los de los 50+ tenants
    // mezclados. El campo `tenant` que ya tenían ambas colecciones se quitó
    // de sus `fields`: este plugin lo inyecta él mismo (con el mismo nombre
    // 'tenant' y el mismo `relationTo: 'tenants'` que ya usábamos), así que
    // todo el código que ya lee/escribe `tenant` (quiz-submit, el endpoint
    // de ingesta, las rutas de /api/tenant-dashboard) sigue funcionando sin
    // cambios.
    //
    // `userHasAccessToAllTenants: () => true` porque hoy todo el equipo
    // interno de Notoriovs administra todos los clientes: nadie debe
    // quedar restringido a un subconjunto de tenants. El campo `tenants`
    // que el plugin agrega a Users (para restringir accesos por tenant) no
    // hace falta usarlo mientras esto siga así; si algún día contratan a
    // alguien que solo debe ver ciertos clientes, ahí sí se vuelve útil.
    //
    // El control de acceso que ya tenía cada colección (`Boolean(req.user)`
    // en Leads/MarketingReports) NO se reemplaza: el plugin lo combina con
    // la restricción de tenant en un AND, nunca lo debilita.
    multiTenantPlugin<Config>({
      collections: {
        leads: {},
        'marketing-reports': {},
      },
      userHasAccessToAllTenants: () => true,
    }),
  ],
})
