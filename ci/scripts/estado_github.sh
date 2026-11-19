#!/usr/bin/env bash
# DO-06 · Publica el resultado de Jenkins en el commit de GitHub (palomita o tache con liga al build).
# Uso: estado_github.sh SHA success|failure|pending "descripción"
set -uo pipefail
SHA="$1"; ESTADO="$2"; DESC="$3"
curl -fsS -X POST -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${GITHUB_REPO}/statuses/${SHA}" \
  -d "{\"state\":\"${ESTADO}\",\"context\":\"Jenkins / pre-producción\",\"description\":\"${DESC:0:130}\",\"target_url\":\"${BUILD_URL:-}\"}" \
  -o /dev/null || echo "Aviso: no se pudo publicar el estado en GitHub (no detiene el pipeline)."
