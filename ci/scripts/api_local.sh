#!/usr/bin/env bash
# DO-06 · "API sin errores": levanta Haitani dentro de Jenkins con una base de datos nueva
# y le hace el smoke test (salud, páginas, API que pide sesión y login contra la base).
set -euo pipefail
DB_HOST="${CI_DB_HOST:-postgres}"
DB_NAME="haitani_api_${BUILD_NUMBER:-local}"
PUERTO="${API_PUERTO:-3999}"
export PGPASSWORD="${CI_DB_PASSWORD:?Falta CI_DB_PASSWORD}"
export DATABASE_URL="postgresql://postgres:${CI_DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"
export SESSION_SECRET="api-${BUILD_NUMBER:-local}-${RANDOM}"
export PGSSLMODE=disable
export PORT="$PUERTO"

terminar() {
  [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null || true
  psql -h "$DB_HOST" -U postgres -q -c "DROP DATABASE IF EXISTS \"${DB_NAME}\"" >/dev/null 2>&1 || true
}
trap terminar EXIT

mkdir -p reports
psql -h "$DB_HOST" -U postgres -q -c "DROP DATABASE IF EXISTS \"${DB_NAME}\""
psql -h "$DB_HOST" -U postgres -q -c "CREATE DATABASE \"${DB_NAME}\""
node database/init.js

echo "== Arrancando la API en el puerto ${PUERTO} =="
node app.js > reports/api.log 2>&1 &
PID=$!

if ! bash ci/scripts/smoke.sh "http://localhost:${PUERTO}" 10; then
  echo "::error:: La API no pasó el smoke test. Últimas líneas del servidor:"
  tail -40 reports/api.log
  exit 1
fi
if ! kill -0 "$PID" 2>/dev/null; then
  echo "::error:: El servidor se cayó durante la prueba."; tail -40 reports/api.log; exit 1
fi
