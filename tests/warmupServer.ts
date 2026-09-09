import { baseURL } from '../playwright.config'

/**
 * Compila las rutas del admin antes de que empiece el primer test.
 *
 * El servidor de pruebas es un `next dev`: no compila una ruta hasta que
 * alguien la pide, y la primera visita al admin tarda más de un minuto en una
 * máquina normal. Sin este paso, ese tiempo cae dentro del `beforeAll` que
 * hace login y lo tumba por timeout — un fallo que parece de la app y es del
 * compilador. Aquí no estorba: `globalSetup` corre después de levantar el
 * servidor y fuera del reloj de los tests.
 */
export default async function warmupServer(): Promise<void> {
  // `/api/users/me` compila la ruta de la API de Payload, que es a donde va el
  // POST del formulario de login.
  const rutas = ['/admin/login', '/api/users/me', '/']

  for (const ruta of rutas) {
    const respuesta = await fetch(`${baseURL}${ruta}`, {
      signal: AbortSignal.timeout(5 * 60 * 1000),
      redirect: 'follow',
    })

    if (!respuesta.ok) {
      throw new Error(`El servidor de pruebas respondió ${respuesta.status} en ${ruta}`)
    }

    await respuesta.text()
  }
}
