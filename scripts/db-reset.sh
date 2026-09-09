#!/usr/bin/env bash
# Reconstruye las bases LOCALES de desarrollo y pruebas desde cero, aplicando
# las migraciones commiteadas. Nunca toca producción: solo habla con el Postgres
# que escuche en localhost:5432, sea el de docker-compose.yml o uno instalado en
# la máquina (Homebrew, Postgres.app). A la app le da igual: lo único que cambia
# es quién sirve ese puerto.
#
#   npm run db:reset
#
# Aplicar las migraciones sobre una base limpia es además la única forma de
# comprobar que hacen lo que dicen (ver ADR 0006).
set -euo pipefail

cd "$(dirname "$0")/.."

DEV_DB=notoriovs_dev
TEST_DB=notoriovs_test
PG_USER=notoriovs
PG_PASSWORD=notoriovs

# Cómo hablarle al servidor como administrador. Con Docker, entrando al
# contenedor; sin Docker, con el psql de la máquina y tu usuario de sistema,
# que en una instalación de Homebrew es superusuario.
if docker compose ps --status running postgres >/dev/null 2>&1 &&
  [ -n "$(docker compose ps -q postgres 2>/dev/null)" ]; then
  psql_admin() { docker compose exec -T postgres psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 "$@"; }
  echo "→ Usando el Postgres de docker-compose"
else
  command -v psql >/dev/null || {
    echo "No hay ni Docker ni psql. Levanta la base con 'npm run db:up' (Docker) o instala Postgres." >&2
    exit 1
  }
  psql_admin() { psql -h localhost -p 5432 -d postgres -v ON_ERROR_STOP=1 "$@"; }
  echo "→ Usando el Postgres de la máquina en localhost:5432"
fi

psql_admin -c 'select 1' >/dev/null 2>&1 || {
  echo "No hay un Postgres respondiendo en localhost:5432. Arráncalo ('npm run db:up' si usas Docker)." >&2
  exit 1
}

# El rol que usan las URLs de .env y .env.test. Con Docker ya viene creado.
psql_admin -c "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$PG_USER') THEN
    CREATE ROLE $PG_USER LOGIN PASSWORD '$PG_PASSWORD' CREATEDB;
  END IF;
END \$\$;" >/dev/null

for db in "$DEV_DB" "$TEST_DB"; do
  echo "→ Recreando $db"
  psql_admin -c "DROP DATABASE IF EXISTS $db WITH (FORCE);" >/dev/null
  psql_admin -c "CREATE DATABASE $db OWNER $PG_USER;" >/dev/null
done

for db in "$DEV_DB" "$TEST_DB"; do
  echo "→ Aplicando migraciones en $db"
  DATABASE_URL="postgres://$PG_USER:$PG_PASSWORD@localhost:5432/$db" npm run migrate
done

echo
echo "Listo. 'npm run dev' y crea tu usuario admin en http://localhost:3000/admin"
