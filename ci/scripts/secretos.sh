#!/usr/bin/env bash
# DO-06 · Revisa que no haya llaves, contraseñas ni archivos de configuración privados en el código.
# Solo revisa los archivos versionados (lo mismo que se va a desplegar).
set -euo pipefail
mkdir -p reports
fallas=0

echo "== Archivos que nunca deben estar en el repositorio =="
prohibidos=$(git ls-files | grep -E '(^|/)\.env$|(^|/)\.env\.[^/]*$|terraform\.tfvars$|\.tfstate|_respaldo_.*\.json$|\.pem$|jenkins_agent_key' | grep -vE '\.example$' || true)
if [ -n "$prohibidos" ]; then
  echo "::error:: Estos archivos no deben subirse al repositorio:"; echo "$prohibidos"
  fallas=1
else
  echo "Sin archivos privados en el repositorio."
fi

echo "== Llaves y contraseñas escritas en el código (gitleaks) =="
tmp=$(mktemp -d)
git archive HEAD | tar -x -C "$tmp"
raiz=$(pwd)
if (cd "$tmp" && gitleaks dir . --config "$raiz/.gitleaks.toml" --no-banner --redact \
     --report-format junit --report-path "$raiz/reports/secretos.xml" --exit-code 1); then
  echo "No se encontraron llaves ni contraseñas en el código."
else
  echo "::error:: gitleaks encontró posibles llaves o contraseñas. En 'Test Result' sale el archivo y la línea."
  echo "         Muévelas a una variable de entorno (variables de Render o credenciales de Jenkins)."
  fallas=1
fi
rm -rf "$tmp"

exit "$fallas"
