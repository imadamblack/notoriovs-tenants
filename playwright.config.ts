import { defineConfig, devices } from '@playwright/test'

// Fija la base de PRUEBAS antes de nada. `dotenv/config` (lo que había aquí)
// resuelve al `.env`, así que los tests e2e —que borran y crean usuarios—
// corrían contra la base de desarrollo, y antes contra la de producción.
import { loadTestEnv } from './tests/loadTestEnv'

const { databaseUrl } = loadTestEnv()

// Puerto propio: el servidor de los tests usa la base de pruebas, y no debe
// confundirse con el `npm run dev` que quizá tengas abierto en el 3000.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3001)
export const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    // Nunca reutilizar un servidor ajeno: el que esté corriendo casi seguro
    // apunta a la base de desarrollo, y estos tests borran usuarios.
    reuseExistingServer: false,
    // Estas variables ganan sobre el `.env` que carga Next: @next/env solo
    // rellena las que no vienen ya en el entorno.
    env: {
      DATABASE_URL: databaseUrl,
      PAYLOAD_SECRET: process.env.PAYLOAD_SECRET ?? '',
      PORT: String(PORT),
    },
  },
})
