import { postgresAdapter } from '@payloadcms/db-postgres'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { TenantUsers } from './collections/TenantUsers'
import { Media } from './collections/Media'
import { Tenants } from './collections/Tenants'
import { Leads } from './collections/Leads'
import { LeadExports } from './collections/LeadExports'
import { MarketingReports } from './collections/MarketingReports'
// `Config` se importa como tipo desde el archivo generado (payload-types.ts)
// para darle tipado fuerte al plugin (multiTenantPlugin<Config>(...)); no
// crea un ciclo real porque solo se usa a nivel de tipos, nunca en runtime.
import type { Config } from './payload-types'
import { isSuperadminUser, superadminFieldAccess } from './access/internalRoles'
import { sendgridAdapter } from './email/sendgrid'

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
  collections: [Users, TenantUsers, Media, Tenants, Leads, LeadExports, MarketingReports],
  // Correo transaccional (recuperación de contraseña e invitaciones). Sin
  // `SENDGRID_API_KEY` esto queda en `undefined` y Payload usa su adaptador de
  // consola, que imprime el correo en la terminal en vez de mandarlo: es lo
  // que se quiere en desarrollo —el enlace se copia del log— y evita que una
  // máquina local mande correo real a la gente de un cliente.
  email: process.env.SENDGRID_API_KEY ? sendgridAdapter(process.env.SENDGRID_API_KEY) : undefined,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // El push automático del modo desarrollo es comodidad local y nada más
    // (ADR 0006). En pruebas se apaga: ahí el esquema lo ponen las migraciones
    // (`npm run db:reset`), y además el servidor de e2e y el proceso de tests
    // levantan cada uno su Payload contra la misma base — dos empujones
    // simultáneos se bloquean entre sí y el login se queda colgado.
    push: process.env.PAYLOAD_SCHEMA_PUSH !== 'false',
  }),
  sharp,
  plugins: [
    // `disablePayloadAccessControl: true` hace que la `url` de cada media
    // apunte al blob público en vez de a `/api/media/file/...`. Sin esto,
    // cada imagen de una landing o de un quiz obliga a la app a descargarla
    // del blob y reenviarla en cada visita: una invocación serverless por
    // imagen y por visitante, que es justo el costo que pesa en tráfico
    // pagado móvil. El media de este proyecto es público de todas formas
    // (`Media.access.read` es `() => true`), así que no se pierde ningún
    // control de acceso al saltarse esa capa.
    //
    // El plugin se monta solo si hay token. Sin él, Payload guarda los uploads
    // en la carpeta local `media/`: así, subir una imagen en desarrollo deja de
    // escribir en el blob de producción — el mismo agujero que tenía la base de
    // datos, y se cierra igual, no configurando lo de producción en local.
    ...(process.env.BLOB_READ_WRITE_TOKEN
      ? [
          vercelBlobStorage({
            collections: {
              media: {
                disablePayloadAccessControl: true,
              },
            },
            addRandomSuffix: true,
            token: process.env.BLOB_READ_WRITE_TOKEN,
          }),
        ]
      : []),
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
    // Quién ve todos los clientes y quién solo los suyos (issue 09). Hasta
    // aquí esto era `() => true`: todo Internal User tenía acceso irrestricto
    // a los 50+ tenants. Ahora un superadmin sigue viéndolo todo y un account
    // manager queda acotado a los Tenants de su campo `tenants` (el que agrega
    // este mismo plugin).
    //
    // El plugin es quien aplica el recorte, y lo hace en el único lugar que
    // sirve: le agrega en AND un `tenant in [asignados]` a TODAS las reglas de
    // acceso de las colecciones enlistadas arriba, más un `id in [asignados]`
    // a la colección `tenants` y a los usuarios internos. No es un filtro de
    // la vista de lista: vale igual para la API REST.
    //
    // Escribir `tenants` y `role` en el propio usuario está cerrado a
    // superadmin a nivel de campo (ver `superadminFieldAccess`). Sin eso, un
    // account manager podía editar su propio documento —Payload siempre lo
    // permite— y asignarse los clientes que quisiera.
    //
    // El control de acceso que ya tenía cada colección (`Boolean(req.user)`
    // en Leads/MarketingReports) NO se reemplaza: el plugin lo combina con
    // la restricción de tenant en un AND, nunca lo debilita.
    multiTenantPlugin<Config>({
      collections: {
        leads: {},
        'lead-exports': {},
        'marketing-reports': {},
      },
      userHasAccessToAllTenants: (user) => isSuperadminUser(user),
      tenantsArrayField: {
        includeDefaultField: true,
        arrayFieldAccess: {
          create: superadminFieldAccess,
          update: superadminFieldAccess,
        },
        tenantFieldAccess: {
          create: superadminFieldAccess,
          update: superadminFieldAccess,
        },
      },
    }),
  ],
})
