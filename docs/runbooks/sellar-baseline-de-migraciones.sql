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
-- Uso (desde la raíz del repo). `DATABASE_URL` vive en .env y NO está exportada
-- en el shell, así que hay que leerla del archivo; con `psql "$DATABASE_URL"` a
-- secas te intenta conectar a un Postgres local y falla:
--
--   PGSSLROOTCERT=system \
--   psql "$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2-)" \
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
-- Después, y solo después:
--
--   npm run migrate
--
-- Ojo con el CLI de Payload: la PRIMERA llamada después de un rato sin usar la
-- base suele volver sin imprimir nada. Neon suspende las bases ociosas y ese
-- primer comando se va mientras la base despierta. Vuelve a correrlo y sale.
--
-- Por eso, para saber qué pasó de verdad, no te fíes de la salida del CLI:
-- pregúntale a la bitácora, que es la fuente:
--
--   PGSSLROOTCERT=system \
--   psql "$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2-)" \
--     -c "select name, batch, created_at from payload_migrations order by name;"

BEGIN;

DO $$
DECLARE
  baseline CONSTANT text := '20260902_010237';
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

  -- 2. Una bitácora con renglones significa que aquí ya se corrieron
  --    migraciones: sellar encima taparía historia real.
  SELECT count(*) INTO filas FROM payload_migrations WHERE name <> baseline;
  IF filas > 0 THEN
    RAISE EXCEPTION 'La bitácora ya tiene % migración(es) registrada(s) además del baseline. Esta base ya se gobierna por migraciones; no hay nada que sellar.', filas;
  END IF;

  -- 3. `batch = -1` es la marca que deja el push de dev. Si está, `payload
  --    migrate` abre un diálogo interactivo advirtiendo pérdida de datos.
  IF EXISTS (SELECT 1 FROM payload_migrations WHERE batch = -1) THEN
    RAISE EXCEPTION 'La bitácora trae la marca del push de dev (batch = -1). Párate aquí y revisa a mano antes de sellar.';
  END IF;

  -- 4. Si "tenant_users" ya existe, el push adelantó la migración siguiente y
  --    sellar solo el baseline dejaría la bitácora mintiendo.
  IF to_regclass('public.tenant_users') IS NOT NULL THEN
    RAISE EXCEPTION 'La tabla "tenant_users" ya existe: el push ya adelantó la migración 20260908. Este guion no cubre ese caso.';
  END IF;

  -- Sellado. `batch = 1` a propósito, nunca -1: el siguiente `payload migrate`
  -- lee el batch más alto y le suma uno.
  INSERT INTO payload_migrations (name, batch, created_at, updated_at)
  SELECT baseline, 1, now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM payload_migrations WHERE name = baseline);

  RAISE NOTICE 'Baseline sellado: % queda marcada como aplicada. Ahora corre: npm run migrate', baseline;
END $$;

COMMIT;

-- Cómo debe quedar la bitácora: un solo renglón, batch 1.
SELECT name, batch, created_at FROM payload_migrations ORDER BY name;
