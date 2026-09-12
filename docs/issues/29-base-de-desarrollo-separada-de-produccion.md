# 29: Desarrollo y pruebas dejan de escribir en la base de producción

**What to build:** El `DATABASE_URL` del `.env` es la base de **producción**, y
es la que usan `npm run dev`, `npm run test:int` y `npm run test:e2e`. O sea que
trabajar en local escribe en la base de los clientes. Hay que separarlas: una
base para desarrollo, otra para pruebas, y producción alcanzable solo a
propósito.

No es hipotético. El 2026-09-08, mientras se preparaba el sellado de migraciones
(ADR 0006), bastó **reiniciar el dev server** para que las tablas de
`tenant_users` aparecieran solas en producción: `@payloadcms/db-postgres` empuja
el esquema en modo desarrollo, sin preguntar. El esquema que quedó era correcto
por suerte, no por diseño.

Y hay un caso peor, que no depende del esquema sino de los datos: los tests e2e
llaman a `seedTestUser()`, que hace `payload.delete` sobre `users` y luego crea
`dev@payloadcms.com`. Hoy eso corre contra producción. `test.env` existe con una
URL de Neon distinta —alguien ya tuvo esta intención— pero **nada lo lee**:
`vitest.setup.ts` y `playwright.config.ts` cargan `dotenv/config`, que resuelve
al `.env`.

**Blocked by:** None (can start immediately)

**Status:** hecho (commit f984fd6) — falta correr los e2e en verde: la máquina no tenía el Chromium de Playwright (`npx playwright install chromium`), y falta decidir qué tenants de prueba se copian a la base de dev.

- [x] `npm run dev` no puede tocar la base de producción, ni su esquema ni sus datos
- [x] `npm run test:int` y `npm run test:e2e` corren contra una base de pruebas, no contra producción ni contra la de desarrollo
- [x] Correr los tests deja la base de pruebas como estaba, y no depende de datos que alguien haya creado a mano
- [x] Apuntar a producción es un acto deliberado y visible, no el valor por omisión de un archivo
- [x] Un `.env.example` commiteado dice qué variables hacen falta y cuál es cuál
- [x] Quien clone el repo puede levantar su base de desarrollo sin pedirle credenciales a nadie
- [x] `test.env` queda conectado o eliminado, pero no huérfano

## Notas

- **Cómo separar sin inventar plomería:** el CLI de Payload y Next resuelven el
  entorno con `@next/env`, que carga en orden `.env.development.local`,
  `.env.local`, `.env.development`, `.env` y **gana el primero que define cada
  variable**. Un `.env.local` (ya ignorado por git) con el `DATABASE_URL` de
  desarrollo basta para que el `.env` deje de mandar, sin tocar código.
  Cuidado: `vitest.setup.ts` y `playwright.config.ts` usan `dotenv/config`, que
  **no** sigue ese orden — ahí hay que ser explícito.
- **Los branches de Neon son la herramienta natural**: una copia del esquema (y
  opcionalmente de los datos) por rama, gratis de crear y de tirar. Una para
  desarrollo y otra para pruebas.
- **La base de pruebas debe poder recrearse sola.** Hoy `api.int.spec.ts`
  consulta `users` y pasa porque en producción hay usuarios. Contra una base
  limpia eso no se sostiene: hace falta sembrar lo mínimo, o que el test no
  dependa de datos preexistentes.
- **Payload empuja esquema solo fuera de producción.** Con las bases separadas
  eso deja de ser un peligro y vuelve a ser lo que debe: comodidad local. Ver
  ADR 0006.
- **El mismo agujero existe con el almacenamiento de archivos.** El
  `BLOB_READ_WRITE_TOKEN` del `.env` apunta al blob real, así que subir una
  imagen en local escribe en el almacenamiento de producción. No es parte del
  criterio de este issue, pero es exactamente el mismo error y conviene
  resolverlo de una vez si el costo es parecido.
- **Riesgo al migrar:** si alguien tiene datos de trabajo en la base de
  producción que usaba como si fuera de desarrollo, hay que decidir qué se
  copia a la nueva base de desarrollo y qué se deja. Preguntar antes de
  clonar nada.
