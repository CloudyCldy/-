# Jenkins · QA automático y pre-producción (DO-06)

## Cómo queda el flujo

```
feat/HB-xx ──PR──> dev ──(Jenkins)──> QA / pre-producción ──(Jenkins)──> main ──(Render)──> producción
              │                              │
        GitHub Actions          pruebas + JUnit + cobertura
        (pruebas del PR)        código hardcodeado y llaves (gitleaks)
                                API levantada sin errores
```

| Quién | Qué hace | Cuándo |
|---|---|---|
| Desarrollador | Hace su rama `feat/HB-xx` y abre un pull request a `dev`. | Cuando termina su historia. |
| GitHub Actions | Corre las pruebas del pull request. | En cada push y pull request. |
| Jenkins | Pasa `dev` a **QA** (pre-producción), analiza QA completo y, si todo pasa, sube QA a **main** él solo. | Cada vez que llega un cambio nuevo a `dev` (revisa cada 5 minutos). También se puede forzar con *Construir con parámetros → PROMOVER_AHORA*. |
| Render | Publica `main` en producción (Auto-Deploy). | Cuando Jenkins actualiza `main`. |

Nadie hace a mano los pull requests de `dev` a `QA` ni de `QA` a `main`: eso lo hace Jenkins.

**Si algo falla**, Jenkins se detiene y `main` no cambia:
- En el commit de GitHub aparece un tache rojo **Jenkins / pre-producción** con la etapa que falló.
- En Jenkins, **Test Result** dice qué prueba falló (archivo, nombre y error) o en qué archivo y línea hay una llave; si falló la API, el log muestra las últimas líneas del servidor.
- El desarrollador corrige en una rama nueva, la une a `dev` y Jenkins vuelve a hacer todo el camino solo.

**La rama QA es la pre-producción:** es la única que puede llegar a `main`, y nadie la toca a mano.

**Ventana de despliegue (opcional):** si el equipo prefiere publicar a una hora fija, se quitan las `//` de la línea `cron(...)` en el `Jenkinsfile`.

## Qué revisa Jenkins en pre-producción

| Etapa | Herramienta | Detiene el pipeline si… |
|---|---|---|
| Pruebas | `node --test` con reporte **JUnit** | falla una prueba. |
| Cobertura | c8 con reporte **Cobertura** | la cobertura de líneas baja de 55 %. |
| Código hardcodeado | gitleaks (`.gitleaks.toml`) | hay un token, llave o contraseña escrita en el código. |
| Archivos privados | `ci/scripts/secretos.sh` | se subió un `.env`, `terraform.tfvars`, `.tfstate`, `.pem` o un respaldo. |
| API sin errores | `ci/scripts/api_local.sh` | la API, levantada con una base nueva, no responde: `/api/health`, la página, la privacidad, rutas que piden sesión y el login contra la base. |
| Producción | `ci/scripts/smoke.sh` | después del despliegue en Render, `/api/health` no responde `ok:true`. |

## Variables y llaves separadas

| Ambiente | Base de datos | Llaves y variables |
|---|---|---|
| Pre-producción (Jenkins) | PostgreSQL de pruebas en un contenedor; una base nueva en cada ejecución que se borra al terminar. | Credenciales de Jenkins y variables temporales; no usa ninguna llave de producción. |
| Producción (Render) | PostgreSQL de Render. | Variables del panel de Render. |

## Instalación en una laptop (Docker Desktop)

Ocupa unos 6 GB de disco y 4 GB de RAM. Jenkins trabaja mientras la laptop está prendida y con internet. Usa el puerto **8090**.

1. **Token de GitHub** (lo crea alguien con permiso de escritura en el repositorio):
   GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)** → Generate new token.
   Permiso **repo**, expiración de 30 días. Cópialo; no se comparte por chat.
2. Abre Docker Desktop y espera a que diga *Engine running*.
3. En PowerShell, dentro de la carpeta del repositorio:
   ```powershell
   cd ci\jenkins
   powershell -ExecutionPolicy Bypass -File .\levantar-local.ps1
   ```
   Pide tu usuario de GitHub y el token (solo la primera vez), los guarda en `ci\jenkins\secrets` (no se sube a Git) y levanta Jenkins.
4. Abre **http://localhost:8090** y entra con `admin` y la contraseña que muestra el script.
5. Abre el trabajo **Haitani · pre-producción** y da **Construir ahora** una vez: así se registra la revisión de `dev` cada 5 minutos. Esa primera ejecución solo analiza; desde ahí, cada cambio nuevo en `dev` hace todo el camino solo.

Apagar: `docker compose stop` · Prender otra vez: `docker compose start` · Borrar todo: `docker compose down -v`.
