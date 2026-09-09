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

# `.env.prod` se LEE, no se ejecuta. `source` lo trataba como un guion de
# shell, y ahí una URL de Neon se parte sola: trae
# `?sslmode=verify-full&channel_binding=require`, y ese `&` sin comillas manda
# la asignación a segundo plano —o sea, a otro proceso— así que DATABASE_URL
# llegaba vacía y el comando reventaba con "Invalid URL". Lo mismo habría
# pasado con un `$`, un backtick o un `;` dentro de una contraseña.
#
# Aquí se separa por el primer `=`, se le quitan las comillas opcionales que
# admite dotenv, y nada se evalúa.
while IFS= read -r linea || [ -n "$linea" ]; do
  linea="${linea%$'\r'}"

  case "$linea" in
    '' | '#'*) continue ;;
  esac

  linea="${linea#export }"

  nombre="${linea%%=*}"
  valor="${linea#*=}"

  # Una línea sin `=`, o con un nombre que no es un identificador, se ignora
  # en vez de tumbar el guion entero.
  [ "$nombre" != "$linea" ] || continue
  case "$nombre" in
    [A-Za-z_]*) ;;
    *) continue ;;
  esac

  case "$valor" in
    '"'*'"') valor="${valor#\"}" ; valor="${valor%\"}" ;;
    "'"*"'") valor="${valor#\'}" ; valor="${valor%\'}" ;;
  esac

  export "$nombre=$valor"
done < .env.prod

if [ -z "${DATABASE_URL:-}" ]; then
  echo "El .env.prod no define DATABASE_URL. Sin eso no hay a dónde ir." >&2
  exit 1
fi

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
