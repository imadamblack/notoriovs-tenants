-- Sella el esquema actual como punto de partida de las migraciones.
--
-- Contexto: la base de producción se construyó con el push automático de
-- `next dev`, no con migraciones, así que su bitácora (`payload_migrations`)
-- está vacía aunque las tablas ya existan. Correr `payload migrate` tal cual
-- intentaría crear tablas que ya están y fallaría en seco.
--
-- Esto NO toca ni una tabla de datos. Lo único que hace es escribir un renglón
-- en la bitácora diciendo "la migración 20260902_010237 ya está reflejada en
-- este esquema", para que `payload migrate` la salte y corra solo las
-- posteriores.
--
-- Es idempotente y transaccional: si alguna condición no se cumple, aborta sin
-- dejar nada a medias. Correrlo dos veces no hace daño.
--
-- Uso (desde la raíz del repo). El `DATABASE_URL` de producción vive en
-- `.env.prod` —que no carga nada de forma automática, a propósito— y NO está
-- exportada en el shell, así que hay que leerla del archivo; con
-- `psql "$DATABASE_URL"` a secas te conectas al Postgres LOCAL de desarrollo,
-- que no es lo que quieres sellar:
--
--   PGSSLROOTCERT=system \
--   psql "$(grep -m1 '^DATABASE_URL=' .env.prod | cut -d= -f2-)" \
--     -v ON_ERROR_STOP=1 -f docs/runbooks/sellar-baseline-de-migraciones.sql
--
-- `PGSSLROOTCERT=system` no es opcional: la URL de Neon trae
-- `sslmode=verify-full` y psql, sin eso, busca la raíz de confianza en
-- ~/.postgresql/root.crt —que no existe— y ni siquiera intenta conectarse.
-- Con `system` usa las raíces del sistema operativo, sin bajarle un ápice a la
-- verificación del certificado. (Payload no sufre esto porque el driver de
-- Node trae su propio almacén de certificados; por eso `npm run migrate`
-- conecta sin ayuda y psql no.)
--
-- Después, y solo después (`npm run prod` es lo que apunta el CLI de Payload a
-- producción; sin él, `npm run migrate` corre contra tu base local):
--
--   npm run prod -- npm run migrate
--
-- Ojo con el CLI de Payload: la PRIMERA llamada después de un rato sin usar la
-- base suele volver sin imprimir nada. Neon suspende las bases ociosas y ese
-- primer comando se va mientras la base despierta. Vuelve a correrlo y sale.
--
-- Por eso, para saber qué pasó de verdad, no te fíes de la salida del CLI:
-- pregúntale a la bitácora, que es la fuente:
--
--   PGSSLROOTCERT=system \
--   psql "$(grep -m1 '^DATABASE_URL=' .env.prod | cut -d= -f2-)" \
--     -c "select name, batch, created_at from payload_migrations order by name;"

BEGIN;

DO $$
DECLARE
  baseline         CONSTANT text := '20260902_010237';
  tenant_users_mig CONSTANT text := '20260908_233634_tenant_users';
  filas int;
BEGIN
  -- 1. ¿Es la base que creemos? Si no aparecen las tablas del esquema base,
  --    esto no es producción y no hay nada que sellar.
  IF to_regclass('public.tenants') IS NULL OR to_regclass('public.leads') IS NULL THEN
    RAISE EXCEPTION 'Esta base no tiene el esquema base (faltan "tenants" o "leads"). Si es una base nueva y vacía, NO la selles: corre "npm run migrate" y listo.';
  END IF;

  IF to_regclass('public.payload_migrations') IS NULL THEN
    RAISE EXCEPTION 'No existe "payload_migrations". Base inesperada: revisa a qué DATABASE_URL estás apuntando antes de seguir.';
  END IF;

  -- 2. La marca del push de dev (name = 'dev', batch = -1) es ESPERADA aquí:
  --    es justo la huella de haber armado el esquema con `next dev`. La
  --    escribe pushDevSchema y solo sirve para dos cosas: que el push sepa si
  --    ya la puso, y que `payload migrate` abra un diálogo advirtiendo pérdida
  --    de datos. Se retira más abajo — dejarla haría que cada migración futura
  --    pidiera confirmación interactiva, que es justo lo que rompe un
  --    despliegue automático.
  --
  --    Cualquier OTRO renglón sí es señal de que aquí ya se corrieron
  --    migraciones de verdad, y entonces no hay nada que sellar.
  SELECT count(*) INTO filas
  FROM payload_migrations
  WHERE name NOT IN (baseline, tenant_users_mig) AND NOT (batch = -1 AND name = 'dev');
  IF filas > 0 THEN
    RAISE EXCEPTION 'La bitácora tiene % renglón(es) que no son ni el baseline ni la marca del push de dev. Esta base ya se gobierna por migraciones; revisa a mano antes de seguir.', filas;
  END IF;

  -- Fuera la marca del push: a partir de aquí la bitácora dice la verdad por
  -- sí sola. Si algún día se vuelve a correr `next dev` contra esta base, el
  -- push la escribe de nuevo sin problema.
  DELETE FROM payload_migrations WHERE batch = -1 AND name = 'dev';
  GET DIAGNOSTICS filas = ROW_COUNT;
  IF filas > 0 THEN
    RAISE NOTICE 'Retirada la marca del push de dev (% renglón).', filas;
  END IF;

  -- Sellado. `batch = 1` a propósito, nunca -1: el siguiente `payload migrate`
  -- lee el batch más alto y le suma uno.
  INSERT INTO payload_migrations (name, batch, created_at, updated_at)
  SELECT baseline, 1, now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM payload_migrations WHERE name = baseline);

  RAISE NOTICE 'Sellada como aplicada: %', baseline;

  -- El push de dev puede haberse adelantado a migraciones posteriores: basta
  -- con arrancar `next dev` contra esta base después de agregar una colección
  -- para que las tablas aparezcan sin que ninguna migración las haya creado.
  -- Cuando eso pasó, esa migración también hay que sellarla: correrla
  -- intentaría crear tablas que ya están.
  --
  -- El detector es la tabla que la migración crea. NO basta con esto para
  -- afirmar que el esquema es correcto: antes de sellar hay que comparar el
  -- esquema de esta base contra el que producen las migraciones desde cero
  -- (ver la nota de arriba). El guion sella lo que encuentra; comprobar que lo
  -- que encontró está bien es trabajo de esa comparación.
  IF to_regclass('public.tenant_users') IS NOT NULL THEN
    INSERT INTO payload_migrations (name, batch, created_at, updated_at)
    SELECT tenant_users_mig, 2, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM payload_migrations WHERE name = tenant_users_mig);

    RAISE NOTICE 'La tabla "tenant_users" ya existe (la creó el push), así que también se sella: %', tenant_users_mig;
    RAISE NOTICE 'No queda nada pendiente: NO hace falta correr `npm run migrate`.';
  ELSE
    RAISE NOTICE 'Falta crear las tablas de Tenant Users. Ahora corre: npm run migrate';
  END IF;
END $$;

COMMIT;

-- Cómo debe quedar la bitácora: un solo renglón, batch 1.
SELECT name, batch, created_at FROM payload_migrations ORDER BY name;
