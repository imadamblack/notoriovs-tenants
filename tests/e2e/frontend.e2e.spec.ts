import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  // La raíz del sitio no es una página: redirige al admin. Lo que había aquí
  // —el "Welcome to your new project" de la plantilla de Payload— llevaba
  // tiempo sin corresponder con la app, pero nadie lo notaba porque
  // `npm run test:e2e` ni siquiera arrancaba.
  test('la raíz redirige al admin', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/admin(\/|$)/)
  })
})
