#!/usr/bin/env bash
# DO-06 · Prueba rápida de la API desplegada (smoke test). Uso: smoke.sh https://mi-app
# Reintenta mientras el servicio arranca (App Service y Render tardan en despertar).
set -uo pipefail
URL="${1:?Uso: smoke.sh URL}"
INTENTOS="${2:-30}"

esperar_salud() {
  for i in $(seq 1 "$INTENTOS"); do
    if curl -fsS --max-time 30 "$URL/api/health" 2>/dev/null | grep -q '"ok":true'; then
      echo "OK  /api/health responde ok:true (intento $i)"; return 0
    fi
    echo "..  /api/health todavía no responde (intento $i de $INTENTOS), espero 20 s"; sleep "${ESPERA:-20}"
  done
  echo "::error:: $URL/api/health no respondió ok:true."; return 1
}

revisar() { # revisar RUTA CODIGO_ESPERADO DESCRIPCION
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$URL$1")
  if [ "$codigo" = "$2" ]; then echo "OK  $1 -> $codigo ($3)"; return 0; fi
  echo "::error:: $1 respondió $codigo y se esperaba $2 ($3)"; return 1
}

esperar_salud || exit 1
fallas=0
revisar "/"                 200 "la página principal carga"        || fallas=1
revisar "/privacidad"       200 "la política de privacidad carga"  || fallas=1
revisar "/api/projects"     401 "la API pide sesión"               || fallas=1
# Login con un usuario que no existe: debe contestar 401 (no 500), así se prueba que la API llega a la base de datos
codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 -X POST -H 'Content-Type: application/json' \
         -d '{"username":"ci-smoke-no-existe","password":"x"}' "$URL/api/auth/login")
if [ "$codigo" = "401" ]; then echo "OK  POST /api/auth/login -> 401 (la API y la base de datos responden)"
else echo "::error:: POST /api/auth/login respondió $codigo y se esperaba 401"; fallas=1; fi
[ "$fallas" -eq 0 ] && echo "Smoke test aprobado en $URL"
exit "$fallas"
