# DO-06 · Levanta Jenkins de Haitani en esta computadora con Docker Desktop.
# Uso (PowerShell, dentro de ci\jenkins):   powershell -ExecutionPolicy Bypass -File .\levantar-local.ps1
# Pide los datos una sola vez, los guarda en .\secrets (no se sube a Git) y levanta Jenkins en http://localhost:8090
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Escribir([string]$ruta, [string]$valor) {
  # Sin salto de línea al final y sin BOM, para que Jenkins lea el valor exacto
  [System.IO.File]::WriteAllText((Join-Path $PSScriptRoot $ruta), $valor)
}
function Aleatoria([int]$largo = 20) {
  $c = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'.ToCharArray()
  -join (1..$largo | ForEach-Object { $c | Get-Random })
}
function Secreto([string]$texto) {
  $s = Read-Host -AsSecureString $texto
  [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
}

docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host 'Abre Docker Desktop y espera a que diga "Engine running"; luego vuelve a correr este script.' -ForegroundColor Red; exit 1 }

New-Item -ItemType Directory -Force -Path secrets | Out-Null

if (-not (Test-Path secrets\github_token)) {
  Write-Host "`n== Datos que necesita Jenkins (solo se piden la primera vez) ==" -ForegroundColor Cyan
  $ghUser  = Read-Host 'Usuario de GitHub'
  $ghToken = Secreto 'Token de GitHub (classic, permiso repo)'

  Escribir 'secrets\github_user' $ghUser
  Escribir 'secrets\github_token' $ghToken
  Escribir 'secrets\jenkins_admin_password' (Aleatoria)
  Escribir 'secrets\ci_db_password' (Aleatoria 24)
  Escribir '.env' "JENKINS_PORT=8090`nJENKINS_PUBLIC_URL=http://localhost:8090/`n"
}

Write-Host "`n== Construyendo y levantando Jenkins (la primera vez tarda de 5 a 10 minutos) ==" -ForegroundColor Cyan
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Write-Host 'docker compose falló; manda una captura de este error.' -ForegroundColor Red; exit 1 }

Write-Host "`nListo. Abre http://localhost:8090 (tarda 1 o 2 minutos en arrancar)." -ForegroundColor Green
Write-Host ("Usuario admin      contraseña: " + (Get-Content secrets\jenkins_admin_password -Raw))
Write-Host "Para apagarlo:   docker compose stop      Para prenderlo otra vez:   docker compose start"
