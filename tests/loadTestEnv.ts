import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Hosts que aceptamos como base de pruebas. Es el único criterio automático que
 * distingue "una base que puedo borrar" de "la base de alguien más".
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'])

/**
 * Deja `process.env` apuntando a la base de PRUEBAS, y aborta si no lo logra.
 *
 * Existe porque `vitest.setup.ts` y `playwright.config.ts` usaban
 * `dotenv/config`, que resuelve al `.env` — o sea que los tests corrían contra
 * la base de desarrollo, y antes contra la de producción. `seedTestUser()` hace
 * `payload.delete` sobre `users`: equivocarse de base aquí no es un test rojo,
 * es borrar cuentas de gente.
 *
 * Carga con `override: true` a propósito: lo que diga `.env.test` gana sobre
 * cualquier cosa que quedara exportada en la shell.
 */
export function loadTestEnv(): { databaseUrl: string } {
  const { error } = dotenv.config({
    path: path.join(repoRoot, '.env.test'),
    override: true,
    quiet: true,
  })

  if (error) {
    throw new Error(`No se pudo leer .env.test (${error.message}). Está commiteado: revisa el repo.`)
  }

  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('.env.test no define DATABASE_URL.')
  }

  const { hostname } = new URL(databaseUrl)

  if (!LOCAL_HOSTS.has(hostname) && process.env.ALLOW_REMOTE_TEST_DB !== '1') {
    throw new Error(
      `Los tests apuntan a "${hostname}", que no es una base local. Los tests borran y crean ` +
        `registros, así que se niegan a correr contra una base remota. Levanta la base local ` +
        `con "npm run db:up" y deja el DATABASE_URL de .env.test, o exporta ALLOW_REMOTE_TEST_DB=1 ` +
        `si de verdad quieres correrlos ahí.`,
    )
  }

  return { databaseUrl }
}
