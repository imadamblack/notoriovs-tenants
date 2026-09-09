import { test, expect, Page } from '@playwright/test'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin Panel', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    // El login arrastra la compilación del dashboard —con sus componentes
    // propios— la primera vez que se pide. Contra un `next dev` en frío eso
    // pasa de los 90s por omisión, y el hook moría antes de que la app
    // respondiera. Las aserciones siguen fallando en 20s: esto solo alarga la
    // espera del compilador, no la de un test roto.
    test.setTimeout(240_000)

    await seedTestUser()

    const context = await browser.newContext()
    page = await context.newPage()

    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('can navigate to dashboard', async () => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin$/)
    // Las colecciones del proyecto listadas en la barra: el dashboard se
    // renderizó con la configuración de Payload, no solo respondió 200.
    await expect(page.getByRole('link', { name: 'Tenants', exact: true })).toBeVisible()
  })

  test('can navigate to list view', async () => {
    await page.goto('/admin/collections/users')
    await expect(page).toHaveURL(/\/admin\/collections\/users$/)
    const listViewArtifact = page.locator('h1', { hasText: 'Users' }).first()
    await expect(listViewArtifact).toBeVisible()
  })

  test('can navigate to edit view', async () => {
    await page.goto('/admin/collections/users/create')
    await expect(page).toHaveURL(/\/admin\/collections\/users\/[a-zA-Z0-9-_]+/)
    const editViewArtifact = page.locator('input[name="email"]')
    await expect(editViewArtifact).toBeVisible()
  })
})
