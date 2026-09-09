# notoriovs-tenants-cms

Payload CMS 3 + Next.js multi-tenant: cada cliente tiene su subdominio, su
landing, su quiz y su dashboard de leads.

## Arrancar en local

Necesitas Node 20+ y Docker.

```bash
cp .env.example .env      # ajusta PAYLOAD_SECRET (openssl rand -hex 32)
npm install
npm run db:up             # Postgres local para desarrollo y pruebas
npm run db:reset          # crea las dos bases y aplica las migraciones
npm run dev               # http://localhost:3000/admin
```

La primera vez, el admin te pide crear tu usuario. No necesitas credenciales de
nadie: la base de desarrollo es local.

Arranca vacía. Para trabajar con datos de verdad, `npm run copiar-tenant -- <subdominio> --leads 50`
te trae un tenant de producción (solo lectura allá) a tu base local.

## Pruebas

```bash
npm run test:int          # vitest
npm run test:e2e          # playwright (levanta su propio servidor en el 3001)
```

Corren contra `notoriovs_test`, nunca contra tu base de desarrollo ni contra
producción; si el `DATABASE_URL` no es local, se niegan a correr. `npm run
db:reset` las deja en blanco.

## Bases de datos y producción

Tres entornos, tres archivos, y producción solo a propósito:

```bash
npm run prod -- npm run migrate:status
```

Los detalles —qué comando toca qué base, cómo se generan y aplican las
migraciones, por qué el `.env` dejó de ser producción— están en
[docs/runbooks/bases-de-datos.md](docs/runbooks/bases-de-datos.md).

## Decisiones

Las de arquitectura viven en [docs/adr/](docs/adr/). Empieza por
[0006 — las migraciones son la fuente de verdad del esquema](docs/adr/0006-migraciones-como-fuente-de-verdad-del-esquema.md)
si vas a tocar la base.
