import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface LoginOptions {
  page: Page
  user: {
    email: string
    password: string
  }
}

/**
 * Logs the user into the admin panel via the login page.
 *
 * Las rutas son relativas al `baseURL` de playwright.config.ts, que apunta al
 * servidor levantado contra la base de pruebas.
 */
export async function login({ page, user }: LoginOptions): Promise<void> {
  await page.goto('/admin/login')

  await page.fill('#field-email', user.email)
  await page.fill('#field-password', user.password)
  await page.click('button[type="submit"]')

  await page.waitForURL('**/admin')

  // Prueba de que hay sesión, y no de que el CSS ya cargó: el enlace de salir
  // es texto. Lo que había aquí era un icono absolutamente posicionado, que
  // mide 0x0 —o sea "invisible" para Playwright— hasta que el dev server
  // termina de compilar la hoja de estilos del admin.
  await expect(page.locator('a[href="/admin/logout"]')).toBeVisible()
}
