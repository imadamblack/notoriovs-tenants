// Corre las migraciones pendientes IMPRIMIENDO lo que pase.
//
//   npm run migrate:debug              # contra tu base de desarrollo
//   npm run prod -- npm run migrate:debug   # contra producción
//
// **Contra producción, ésta es la ÚNICA forma de migrar que funciona**, no una
// alternativa verbosa. Hace el mismo trabajo que `npm run migrate` pero sin el
// CLI de Payload en medio, y ese CLI, en los comandos de migración, se traga los
// errores de arranque y sale con código 0: si le falta una variable de entorno o
// no puede conectarse, no imprime absolutamente nada. O sea que "falló" y
// "todavía no termina" se ven idénticos —una línea en blanco— y no hay forma de
// distinguirlos mirando la pantalla.
//
// Contra producción eso ya no es un riesgo teórico: pasó dos veces, con la
// migración de roles (issue 09) y con la que borró los webhooks viejos
// (2026-09-12). Las dos veces `npm run prod -- npm run migrate` volvió al prompt
// en silencio sin haber aplicado nada, y las dos veces entraron con este guion.
// `migrate:status` tampoco imprime ahí, así que no sirve para confirmar: lo que
// confirma es el `✓` de aquí, o `CHECK_MIGRATIONS=1 npm run prod -- npm run
// migrate:check`. Por qué el CLI falla ahí y no en otra shell, sigue sin saberse.
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
