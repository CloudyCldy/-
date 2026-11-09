# CI/CD de Haitani (DO-01 y DO-02)

El flujo está en `.github/workflows/ci-cd.yml` y corre en GitHub Actions.

## Qué hace

| Cuándo | Trabajo | Qué pasa |
|---|---|---|
| Push o pull request a `dev`, `QA` o `main` | **Pruebas** | Levanta PostgreSQL 16, instala con `npm ci`, crea las tablas con `database/init.js` y corre `npm test`. Si una prueba falla, el trabajo queda en rojo. |
| Push a `main` con las pruebas aprobadas | **Despliegue a Render** | Llama al deploy hook de Render, espera a que el despliegue quede `live` (si están los secretos de la API) y revisa que `/api/health` responda `ok: true`. |

Si el despliegue falla en Render, Render deja en línea la versión anterior y el trabajo de GitHub queda en rojo con el motivo.

## Configuración (una sola vez, la hace quien administra Render y el repositorio)

1. **Render → servicio de Haitani → Settings → Build & Deploy**
   - Copiar el **Deploy Hook** (es una URL secreta, no se comparte por chat).
   - Cambiar **Auto-Deploy** a **Off**, para que solo GitHub Actions despliegue y siempre después de las pruebas.
2. **GitHub → repositorio → Settings → Secrets and variables → Actions → New repository secret**
   - `RENDER_DEPLOY_HOOK_URL`: la URL del deploy hook. **Obligatorio.**
   - `RENDER_API_KEY`: Render → Account Settings → API Keys. Opcional, sirve para esperar a que el despliegue termine.
   - `RENDER_SERVICE_ID`: el id que empieza con `srv-` en la URL del servicio en Render. Opcional, va junto con la API key.
3. **GitHub → Settings → Branches → Add branch ruleset** para `main`, `QA` y `dev`
   - Activar **Require status checks to pass** y elegir el check **Pruebas**.
   - Con esto un pull request con pruebas fallidas no se puede fusionar (criterio de DO-01).

## Cómo comprobarlo

1. Abrir un pull request a `dev`: en la pestaña **Checks** aparece **CI/CD Haitani / Pruebas** y debe quedar en verde.
2. Fusionar `QA` → `main`: en **Actions** corren **Pruebas** y luego **Despliegue a Render**; al final, el log muestra "El servicio responde correctamente."
3. Para probar el criterio de DO-01, una rama con una prueba rota a propósito debe quedar en rojo y el botón de merge bloqueado.

## Sanzu

El repositorio de Sanzu tiene su propio flujo en `.github/workflows/ci.yml`: instala, genera el cliente de Prisma, revisa los tipos con `npm run typecheck` y corre `npm test` en cada push y pull request. Sanzu todavía no se despliega, así que no tiene trabajo de despliegue.