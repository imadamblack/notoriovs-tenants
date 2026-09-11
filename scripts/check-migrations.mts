// Guardián del despliegue: NO deja subir código cuyo esquema no esté aplicado.
//
//   npm run migrate:check                       # a mano (ver abajo cuándo corre solo)
//   CHECK_MIGRATIONS=1 npm run migrate:check    # forzarlo contra tu base local
//
// Corre dentro de `npm run build`. Solo LEE: compara las migraciones
// commiteadas (src/migrations/index.ts) contra las que la base dice tener
// aplicadas (tabla `payload_migrations`), y sale con código 1 si falta alguna.
// Nunca aplica nada — aplicar sigue siendo un acto deliberado:
//
//   npm run prod -- npm run migrate
//
// POR QUÉ NO APLICARLAS AQUÍ. Es la pregunta obvia, y la respuesta está en
// ADR 0006 más lo que se aprendió con la migración de exportación a CSV:
//
//   - Un build de Vercel corre en cada push, de cualquier rama. Que uno de
//     preview toque o no la base de los clientes depende de una casilla del
//     panel de Vercel ("All Environments" en DATABASE_URL) que no vive en este
//     repo y que nadie ve en un code review. Mientras el build no escriba, esa
//     casilla no puede hacer daño.
//   - El `down` que genera Payload no siempre corre (el de
//     20260908_233634_tenant_users truena a la mitad: dropea una llave foránea
//     que el CASCADE anterior ya se llevó). Si el build aplicara y luego
//     fallara, el esquema quedaría adelantado sin vuelta atrás real.
//   - Una migración generada puede traer SQL destructivo de arrastre. Leerlo
//     antes de commitear es el paso 2 del runbook, y aplicar en automático
//     borra ese momento.
//   - Dos builds simultáneos serían dos `payload migrate` a la vez sobre la
//     misma base.
//
// Así, lo peor que puede pasar es que un despliegue se caiga diciendo qué
// migración falta. Nunca que la base quede a medias.
// Carga el `.env` para cuando se corre a mano en local. No pisa lo que ya
// venga en el entorno, así que `npm run prod -- ...` (que exporta las
// variables de producción) sigue ganando, y en Vercel —donde no hay archivo—
// no hace nada.
import 'dotenv/config'
import payload from 'payload'
import config from '../src/payload.config.js'
import { migrations } from '../src/migrations/index.js'

// Igual que en migrate-debug.mts: esto no es el arranque de la app, así que
// Payload no debe empujar el esquema ni levantar trabajos programados.
process.env.PAYLOAD_MIGRATING = 'true'

/** La fila que escribe el push del dev server. No es una migración. */
const PUSH_MARKER = 'dev'

// Cuándo corre de verdad. Por omisión, solo en el build de producción de
// Vercel: es el único que puede dejar código adelantado a la base de un
// cliente. Un build local o de preview no tiene por qué fallar porque tu base
// de desarrollo vaya por su cuenta (el push la mueve sin avisar, ver ADR 0006).
const isProductionBuild = process.env.VERCEL_ENV === 'production'
const forced = process.env.CHECK_MIGRATIONS === '1'

if (process.env.SKIP_MIGRATION_CHECK === '1') {
  console.log('· Revisión de migraciones saltada (SKIP_MIGRATION_CHECK=1).')
  process.exit(0)
}

if (!isProductionBuild && !forced) {
  console.log('· Revisión de migraciones: solo corre en el build de producción (CHECK_MIGRATIONS=1 para forzarla).')
  process.exit(0)
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('✗ Falta DATABASE_URL: no hay contra qué comparar las migraciones.')
  process.exit(1)
}

const { host, pathname } = new URL(connectionString)
console.log(`→ Revisando migraciones contra ${host}${pathname}`)

/**
 * Los nombres que la base dice tener aplicados. Una base recién creada todavía
 * no tiene la tabla, y eso no es un error: significa "ninguna aplicada", que es
 * justo lo que hay que reportar.
 */
async function appliedMigrationNames(): Promise<string[]> {
  try {
    const { docs } = await payload.find({
      collection: 'payload-migrations',
      pagination: false,
      overrideAccess: true,
    })
    return docs.map((doc) => doc.name).filter((name): name is string => Boolean(name))
  } catch (err) {
    if (String(err).includes('payload_migrations')) return []
    throw err
  }
}

try {
  await payload.init({ config, disableOnInit: true })

  const applied = new Set(await appliedMigrationNames())
  const pending = migrations.filter((migration) => !applied.has(migration.name))

  // La marca del push en una base gobernada por migraciones es un problema por
  // sí sola: mientras esté, `payload migrate` abre un diálogo interactivo y se
  // queda esperando una respuesta que en un servidor no llega nunca (ADR 0006).
  if (applied.has(PUSH_MARKER)) {
    console.error(
      `✗ Esta base trae la marca del push ("${PUSH_MARKER}"), o sea que su esquema no lo gobiernan\n` +
        '  las migraciones. Con esa fila puesta, `payload migrate` se cuelga sin aplicar nada.\n' +
        '  Ver docs/runbooks/sellar-baseline-de-migraciones.sql.',
    )
    process.exit(1)
  }

  if (pending.length) {
    console.error(
      `✗ Faltan ${pending.length} migración(es) por aplicar en esta base:\n` +
        pending.map((migration) => `    · ${migration.name}`).join('\n') +
        '\n\n  El despliegue se detiene aquí para no subir código adelantado al esquema.\n' +
        '  Aplícalas y vuelve a desplegar:\n\n' +
        '    npm run prod -- npm run migrate\n' +
        '    npm run prod -- npm run migrate:status\n',
    )
    process.exit(1)
  }

  console.log(`✓ Las ${migrations.length} migraciones del repo están aplicadas.`)
} catch (err) {
  // Falla cerrada: si no se pudo comprobar, no se despliega. Un build que se
  // cae es barato; uno que sube código contra un esquema desconocido, no.
  console.error('✗ No se pudo comprobar el estado de las migraciones.')
  console.error(err)
  process.exit(1)
}

process.exit(0)
