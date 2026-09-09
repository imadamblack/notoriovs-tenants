import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

/**
 * Estas funciones hacen `payload.delete` sobre `users`. Si alguna vez se
 * ejecutan contra una base que no es la de pruebas, borran cuentas de verdad;
 * por eso comprueban el destino antes de tocar nada, además de la barrera que
 * ya pone `loadTestEnv()`.
 */
function assertBaseDePruebas(): void {
  const url = process.env.DATABASE_URL

  if (!url) throw new Error('No hay DATABASE_URL: ¿se cargó .env.test?')

  const { hostname } = new URL(url)
  const esLocal = ['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(hostname)

  if (!esLocal && process.env.ALLOW_REMOTE_TEST_DB !== '1') {
    throw new Error(`seedTestUser() se niega a borrar usuarios en "${hostname}": no es local.`)
  }
}

export const testUser = {
  email: 'dev@payloadcms.com',
  password: 'test',
}

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(): Promise<void> {
  assertBaseDePruebas()
  const payload = await getPayload({ config })

  // Delete existing test user if any
  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })

  // Create fresh test user
  await payload.create({
    collection: 'users',
    data: testUser,
  })
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(): Promise<void> {
  assertBaseDePruebas()
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })
}
