#!/usr/bin/env bash
# DO-06 · Pruebas con reporte JUnit y cobertura (formato Cobertura) para Jenkins.
# Crea una base de datos nueva solo para esta ejecución y la borra al terminar.
# Variables: CI_DB_HOST, CI_DB_PASSWORD, BUILD_NUMBER (las pone Jenkins), COBERTURA_MINIMA (opcional, % de líneas).
set -euo pipefail

DB_HOST="${CI_DB_HOST:-postgres}"
DB_NAME="haitani_ci_${BUILD_NUMBER:-local}"
MINIMA="${COBERTURA_MINIMA:-55}"
export PGPASSWORD="${CI_DB_PASSWORD:?Falta CI_DB_PASSWORD}"
export DATABASE_URL="postgresql://postgres:${CI_DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"
export SESSION_SECRET="ci-${BUILD_NUMBER:-local}-${RANDOM}"
export PGSSLMODE=disable

borrar_base() { psql -h "$DB_HOST" -U postgres -q -c "DROP DATABASE IF EXISTS \"${DB_NAME}\"" >/dev/null 2>&1 || true; }
trap borrar_base EXIT

rm -rf reports/coverage reports/junit.xml && mkdir -p reports/coverage
borrar_base
psql -h "$DB_HOST" -U postgres -q -c "CREATE DATABASE \"${DB_NAME}\""
node database/init.js

echo "== Pruebas (node --test) con JUnit y cobertura =="
set +e
npx --yes c8@10 \
  --reporter=cobertura --reporter=text-summary --report-dir=reports/coverage \
  --exclude='test/**' --exclude='node_modules/**' --exclude='ci/**' \
  node --test --test-concurrency=1 \
    --test-reporter=spec --test-reporter-destination=stdout \
    --test-reporter=junit --test-reporter-destination=reports/junit.xml \
    test/*.test.js
resultado=$?
set -e

if [ "$resultado" -ne 0 ]; then
  echo "::error:: Fallaron pruebas. Revisa 'Test Result' en Jenkins: ahí sale el archivo, la prueba y el error."
  exit "$resultado"
fi

node ci/scripts/cobertura_unica.js reports/coverage/cobertura-coverage.xml

# Quality gate de cobertura: si baja del mínimo, el pipeline se detiene.
lineas=$(grep -o 'line-rate="[0-9.]*"' reports/coverage/cobertura-coverage.xml | head -1 | grep -o '[0-9.]*')
porcentaje=$(awk -v r="$lineas" 'BEGIN { printf "%.1f", r * 100 }')
echo "Cobertura de líneas: ${porcentaje}% (mínimo ${MINIMA}%)"
if awk -v p="$porcentaje" -v m="$MINIMA" 'BEGIN { exit !(p < m) }'; then
  echo "::error:: La cobertura (${porcentaje}%) está por debajo del mínimo (${MINIMA}%)."
  exit 1
fi
