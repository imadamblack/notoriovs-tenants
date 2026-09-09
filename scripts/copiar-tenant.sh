#!/usr/bin/env bash
# Copia UN tenant de producción a tu base local de desarrollo.
#
#   npm run copiar-tenant -- ntrs
#   npm run copiar-tenant -- ntrs --leads 50
#
# Copia la ficha del tenant y todo lo que cuelga de ella —bloques de la landing,
# pasos y opciones del quiz, etapas del pipeline— más las imágenes de media a
# las que apunta. Los leads NO viajan salvo que los pidas con `--leads N`, que
# trae los N más recientes.
#
# De producción solo lee (`SELECT`); nunca le escribe. El destino es siempre el
# `DATABASE_URL` de tu `.env`, y aborta si ese no es local.
#
# Ojo con lo que te llevas: los leads son datos personales de gente real. Trae
# una muestra para tener con qué trabajar, no la base entera.
set -euo pipefail

cd "$(dirname "$0")/.."

SUB="${1:-}"
LEADS=0

if [ -z "$SUB" ] || [ "$SUB" = "--help" ]; then
  echo "Uso: npm run copiar-tenant -- <subdominio> [--leads N]" >&2
  exit 1
fi
shift

while [ $# -gt 0 ]; do
  case "$1" in
    --leads) LEADS="${2:?--leads necesita un número}"; shift 2 ;;
    *) echo "Opción desconocida: $1" >&2; exit 1 ;;
  esac
done

[ -f .env.prod ] || { echo "Falta .env.prod, que es de donde sale el DATABASE_URL de producción." >&2; exit 1; }

PROD_URL="$(grep -m1 '^DATABASE_URL=' .env.prod | cut -d= -f2-)"
# El destino sale del `.env`, salvo que exportes otro DATABASE_URL —igual que
# manda @next/env: lo que ya está en el entorno gana sobre el archivo.
DEV_URL="${DATABASE_URL:-$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2-)}"

# La misma barrera que tienen los tests: nada de escribirle a una base remota.
node -e '
  const { hostname } = new URL(process.argv[1])
  const local = ["localhost", "127.0.0.1", "::1", "[::1]", "postgres"].includes(hostname)
  if (!local) {
    console.error(`El destino "${hostname}" no es una base local. Este guion escribe: no va a hacerlo contra una base remota.`)
    process.exit(1)
  }
' "$DEV_URL"

# `PGSSLROOTCERT=system` no es opcional con Neon: ver
# docs/runbooks/sellar-baseline-de-migraciones.sql.
prod() { PGSSLROOTCERT=system psql "$PROD_URL" -v ON_ERROR_STOP=1 "$@"; }
dev()  { psql "$DEV_URL" -v ON_ERROR_STOP=1 "$@"; }

if [ "$(dev -Atc "select count(*) from tenants where subdomain = '$SUB'")" != "0" ]; then
  echo "El tenant '$SUB' ya existe en tu base local. Bórralo antes de volver a copiarlo," >&2
  echo "o corre 'npm run db:reset' si quieres empezar de cero." >&2
  exit 1
fi

TEN="(select id from tenants where subdomain = '$SUB')"

# Orden de inserción: primero lo que otros referencian. El filtro de cada tabla
# es lo que la ata a este tenant y a ningún otro.
IMAGENES_DEL_TENANT="select general_info_logo_id from tenants where subdomain='$SUB'
  union select landing_hero_image_id from tenants where subdomain='$SUB'
  union select quiz_intro_image_id from tenants where subdomain='$SUB'
  union select i.image_id from tenants_blocks_projects_items i
    join tenants_blocks_projects p on p.id = i._parent_id where p._parent_id in $TEN"

PLAN=(
  "payload_folders|id in (select folder_id from media where folder_id is not null and id in ($IMAGENES_DEL_TENANT))"
  "media|id in ($IMAGENES_DEL_TENANT)"
  "tenants|subdomain = '$SUB'"
  "tenants_lead_pipeline|_parent_id in $TEN"
  "tenants_quiz_steps|_parent_id in $TEN"
  "tenants_quiz_steps_options|_parent_id in (select id from tenants_quiz_steps where _parent_id in $TEN)"
  "tenants_blocks_rich_text|_parent_id in $TEN"
  "tenants_blocks_cta_final|_parent_id in $TEN"
  "tenants_blocks_criteria|_parent_id in $TEN"
  "tenants_blocks_criteria_items|_parent_id in (select id from tenants_blocks_criteria where _parent_id in $TEN)"
  "tenants_blocks_faq|_parent_id in $TEN"
  "tenants_blocks_faq_items|_parent_id in (select id from tenants_blocks_faq where _parent_id in $TEN)"
  "tenants_blocks_projects|_parent_id in $TEN"
  "tenants_blocks_projects_items|_parent_id in (select id from tenants_blocks_projects where _parent_id in $TEN)"
  "tenants_blocks_stats|_parent_id in $TEN"
  "tenants_blocks_stats_items|_parent_id in (select id from tenants_blocks_stats where _parent_id in $TEN)"
  "tenants_blocks_testimonials|_parent_id in $TEN"
  "tenants_blocks_testimonials_items|_parent_id in (select id from tenants_blocks_testimonials where _parent_id in $TEN)"
)

if [ "$LEADS" -gt 0 ]; then
  PLAN+=("leads|tenant_id in $TEN order by created_at desc limit $LEADS")
fi

# Cada columna se nombra por su nombre, nunca `select *`: producción se
# construyó con el push del dev server y la base local con las migraciones, así
# que tienen las mismas columnas en DISTINTO ORDEN. Un `select *` mete la fecha
# de creación en una columna de id y el COPY revienta —o peor, no revienta.
columnas() {
  dev -Atc "select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
            from information_schema.columns
            where table_schema = 'public' and table_name = '$1';"
}

CSVS="$(mktemp -d)"
trap 'rm -rf "$CSVS"' EXIT

echo "→ Leyendo producción (solo SELECT)"
for entrada in "${PLAN[@]}"; do
  tabla="${entrada%%|*}"; filtro="${entrada#*|}"
  cols="$(columnas "$tabla")"
  prod -q -c "\copy (select $cols from $tabla where $filtro) to '$CSVS/$tabla.csv' csv"
  filas="$(wc -l < "$CSVS/$tabla.csv" | tr -d ' ')"
  [ "$filas" = "0" ] || echo "   $tabla: $filas"
done

echo "→ Escribiendo en tu base local"
for entrada in "${PLAN[@]}"; do
  tabla="${entrada%%|*}"
  [ -s "$CSVS/$tabla.csv" ] || continue
  dev -q -c "\copy $tabla ($(columnas "$tabla")) from '$CSVS/$tabla.csv' csv"
done

# Los ids vienen tal cual de producción, así que las secuencias tienen que
# quedar por encima del máximo copiado; si no, el siguiente insert choca.
echo "→ Ajustando las secuencias de id"
dev -Atc "
  select 'select setval(pg_get_serial_sequence('''||c.relname||''', ''id''),
          greatest(coalesce((select max(id) from '||c.relname||'), 1), 1));'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (c.relname like 'tenants%' or c.relname in ('media', 'payload_folders', 'leads'))
    and pg_get_serial_sequence(c.relname, 'id') is not null;" | dev -q -f - > /dev/null

echo
dev -Atc "select 'Copiado: '||name||' ('||subdomain||'), '
  ||(select count(*) from tenants_quiz_steps where _parent_id = t.id)||' pasos de quiz, '
  ||(select count(*) from tenants_lead_pipeline where _parent_id = t.id)||' etapas, '
  ||(select count(*) from leads where tenant_id = t.id)||' leads'
  from tenants t where subdomain = '$SUB';"
