#!/usr/bin/env bash
# Corre un comando contra PRODUCCIÓN, a propósito y a la vista.
#
#   npm run prod -- npm run migrate:status
#   npm run prod -- npm run migrate
#
# Lee `.env.prod` (que no carga nada más, ni Next ni el CLI de Payload) y
# exporta esas variables al comando. Como @next/env solo rellena las variables
# que aún no existen en el entorno, lo exportado aquí gana sobre el `.env` de
# desarrollo.
#
# Pide confirmación mostrando a qué host va. Con PROD_YES=1 no pregunta, para
# cuando lo llame un guion.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.prod ]; then
  echo "Falta .env.prod. Ahí van las credenciales de producción; no se commitea." >&2
  exit 1
fi

if [ $# -eq 0 ]; then
  echo "Uso: npm run prod -- <comando>   (por ejemplo: npm run prod -- npm run migrate:status)" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.prod
set +a

host="$(node -e 'process.stdout.write(new URL(process.env.DATABASE_URL).host)')"

echo "─────────────────────────────────────────────"
echo " PRODUCCIÓN: $host"
echo " comando:    $*"
echo "─────────────────────────────────────────────"

if [ "${PROD_YES:-}" != "1" ]; then
  read -r -p "¿Seguro? escribe 'si': " respuesta
  [ "$respuesta" = "si" ] || { echo "Cancelado."; exit 1; }
fi

exec "$@"
