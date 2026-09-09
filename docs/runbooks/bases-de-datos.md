# Qué base toca cada comando

Hay tres bases y ninguna se alcanza por accidente.

| Base | Dónde vive | Quién la usa | Archivo |
| --- | --- | --- | --- |
| Desarrollo | Postgres local (`docker-compose.yml`), base `notoriovs_dev` | `npm run dev`, `npm run migrate` | `.env` |
| Pruebas | el mismo Postgres local, base `notoriovs_test` | `npm test` | `.env.test` (commiteado) |
| Producción | Neon | el despliegue de Vercel, y en local **solo** `npm run prod -- …` | `.env.prod` (nunca se commitea) |

## Levantar tu entorno desde cero

```bash
cp .env.example .env      # ajusta PAYLOAD_SECRET
npm install
npm run db:up             # Postgres local en Docker
npm run db:reset          # crea las dos bases y les aplica las migraciones
npm run dev               # http://localhost:3000/admin, crea ahí tu usuario
```

No hace falta pedirle credenciales a nadie: el Postgres local escucha solo en tu
máquina y sus credenciales están en `docker-compose.yml`.

## Por qué el `.env` ya no es producción

`@next/env` carga, en orden, `.env.development.local`, `.env.local`,
`.env.development` y `.env`, y **gana el primero que define cada variable**;
además, una variable que ya venga exportada en el entorno gana sobre todas
ellas. Eso es lo que hace que `npm run prod` funcione sin tocar código: exporta
lo de `.env.prod` y el CLI de Payload ya no puede leer otra cosa.

`.env.prod` tiene ese nombre justamente porque **no** es uno de los que Next
carga solo. Si se llamara `.env.production`, un `next build` local lo cargaría
sin que nadie lo pidiera.

Los tests son el caso aparte: `vitest.setup.ts` no usa `@next/env` sino
`dotenv`, así que carga `.env.test` de forma explícita (`tests/loadTestEnv.ts`)
y **aborta si el `DATABASE_URL` no es local**. El test que habla con Postgres
crea y borra usuarios: equivocarse de base ahí no es un test rojo, es borrar
cuentas de gente.

## Tocar producción

```bash
npm run prod -- npm run migrate:status
npm run prod -- npm run migrate
```

Pide confirmación mostrando el host al que va. En un guion, `PROD_YES=1` la
salta. Para `psql` contra producción, ver
`docs/runbooks/sellar-baseline-de-migraciones.sql` (necesitas
`PGSSLROOTCERT=system` con Neon).

Lo que nunca se hace: copiar el `DATABASE_URL` de producción al `.env`. Ahí
empezó todo esto — bastó reiniciar el dev server para que Payload empujara
tablas nuevas a la base de los clientes (ADR 0006).

## Traerte un tenant de producción para trabajar

Tu base de desarrollo arranca vacía. Para tener con qué trabajar:

```bash
npm run copiar-tenant -- ntrs            # la ficha del tenant y su landing/quiz
npm run copiar-tenant -- ntrs --leads 50 # además, sus 50 leads más recientes
```

Copia el tenant y todo lo que cuelga de él —bloques de la landing, pasos y
opciones del quiz, etapas del pipeline— más las imágenes de media a las que
apunta. De producción solo lee; el destino es el `DATABASE_URL` de tu `.env`, y
aborta si ese no es local. Si el tenant ya está en tu base, se niega en vez de
duplicarlo.

Dos cosas que conviene saber:

- **Los leads son datos personales de gente real.** Trae una muestra para probar
  el dashboard, no la base entera, y recuerda que quedan en tu máquina.
- **Nunca copies con `select *`.** Producción se construyó con el push del dev
  server y tu base local con las migraciones: tienen las mismas columnas en
  distinto orden. Un `COPY` con `select *` mete la fecha de creación en una
  columna de id. El guion nombra cada columna por eso.

## Media

Sin `BLOB_READ_WRITE_TOKEN`, el plugin de Vercel Blob no se monta y los uploads
se guardan en la carpeta local `media/` (ignorada por git). Por eso el `.env` de
desarrollo no trae token: subir una imagen en local no debe escribir en el
almacenamiento de producción.

## Cuando cambia el esquema

1. `npm run db:reset` para partir de una base limpia.
2. `npm run migrate:create`, y **lee el SQL** antes de commitearlo.
3. `npm run db:reset` otra vez: si la migración se aplica sobre una base vacía,
   sirve.
4. Ya en producción: `npm run prod -- npm run migrate`.

El push automático del dev server sigue vivo en local y puede hacer que tu base
diverja del repo sin avisar; `db:reset` es la forma de comprobar que lo que hay
commiteado se sostiene solo.
