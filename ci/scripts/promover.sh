#!/usr/bin/env bash
# DO-06 · Promueve un commit a otra rama: dev -> QA (pre-producción) y QA -> main (producción).
# Uso: promover.sh RAMA_DESTINO SHA [RAMA_ORIGEN]
# Hace un merge sin fast-forward para que en GitHub quede registrado quién y cuándo promovió.
set -euo pipefail
DESTINO="${1:?Falta la rama destino}"
SHA="${2:?Falta el commit}"
ORIGEN="${3:-dev}"
REPO_URL="${REPO_URL_PRUEBA:-https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git}"

git config user.name "Jenkins Haitani"
git config user.email "jenkins@haitani.local"
git fetch -q "$REPO_URL" "+refs/heads/${DESTINO}:refs/remotes/origin/${DESTINO}"

if git merge-base --is-ancestor "$SHA" "origin/${DESTINO}"; then
  echo "La rama ${DESTINO} ya tiene el commit ${SHA:0:7}; no hay nada que promover."
  exit 0
fi

git checkout -q -B "ci-${DESTINO}" "origin/${DESTINO}"
if ! git merge --no-ff --no-edit -m "release(${DESTINO}): promoción automática de ${ORIGEN} ${SHA:0:7} (Jenkins #${BUILD_NUMBER:-0})" "$SHA"; then
  git merge --abort || true
  echo "::error:: Conflicto al unir ${ORIGEN} con ${DESTINO}. Alguien cambió ${DESTINO} a mano; hay que resolverlo con un pull request."
  exit 1
fi
git push -q "$REPO_URL" "HEAD:refs/heads/${DESTINO}"
echo "Promovido ${ORIGEN} ${SHA:0:7} -> ${DESTINO} ($(git rev-parse --short HEAD))"
