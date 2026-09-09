// Corre las migraciones pendientes IMPRIMIENDO lo que pase.
//
//   npm run migrate:debug              # contra tu base de desarrollo
//   npm run prod -- npm run migrate:debug   # contra producción
//
// Hace exactamente el mismo trabajo que `npm run migrate`, pero sin el CLI de
// Payload en medio. Ese CLI, en los comandos de migración, se traga los errores
// de arranque y sale con código 0: si le falta una variable de entorno o no
// puede conectarse, no imprime absolutamente nada. O sea que "falló" y "todavía
// no termina" se ven idénticos —una línea en blanco— y no hay forma de
// distinguirlos mirando la pantalla.
//
// Aquí, si algo truena, se ve el error completo y el proceso sale con código 1.
import payload from 'payload'
import config from '../src/payload.config.js'

// Le dice a Payload que esto es una migración y no el arranque de la app, para
// que no intente empujar el esquema ni levantar trabajos programados.
process.env.PAYLOAD_MIGRATING = 'true'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('Falta DATABASE_URL. Con `npm run prod -- ...` la pone scripts/prod.sh.')
  process.exit(1)
}

const { host, pathname } = new URL(connectionString)
console.log(`→ Base: ${host}${pathname}`)

try {
  await payload.init({ config, disableOnInit: true })
  await payload.db.migrate()
  console.log('✓ Listo: no queda ninguna migración pendiente.')
} catch (err) {
  console.error('✗ La migración falló. Nada quedó a medias: cada una corre dentro de su transacción.')
  console.error(err)
  process.exit(1)
}

process.exit(0)
