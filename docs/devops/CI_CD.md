# CI/CD de Haitani (DO-01 y DO-02)

El trabajo se reparte entre tres herramientas:

| Herramienta | Qué hace | Cuándo |
|---|---|---|
| **GitHub Actions** (`.github/workflows/ci-cd.yml`) | Trabajo **Pruebas**: levanta PostgreSQL 16, instala con `npm ci`, crea las tablas con `database/init.js` y corre `npm test`. Si una prueba falla, el check queda en rojo. | En cada push y pull request a `dev`, `QA` o `main`. |
| **Jenkins** (`Jenkinsfile`, DO-06) | QA automático: pasa `dev` a `QA` (pre-producción), corre pruebas con JUnit, cobertura, revisión de llaves y la API levantada, y si todo pasa sube `QA` a `main`. Ver [JENKINS.md](JENKINS.md). | Cada cambio nuevo en `dev`. |
| **Render** (Auto-Deploy) | Descarga `main`, instala, arranca la nueva versión y la publica en https://rwq70fnfjj.onrender.com. | Cada vez que llega un cambio a `main`. |

A `main` solo llega lo que Jenkins aprobó en `QA`. Así a producción solo llega código probado.

Si la construcción falla en Render, Render deja en línea la versión anterior.

## Configuración

1. **Render → servicio de Haitani → Settings → Build & Deploy**
   - **Branch:** `main`.
   - **Auto-Deploy:** `On Commit` (o `After CI Checks Pass`, para que Render espere también el check de GitHub).
2. **GitHub → Settings → Branches → Add branch ruleset** para `main`, `QA` y `dev`
   - Activar **Require status checks to pass** y elegir el check **Pruebas**.
   - Con esto un pull request con pruebas fallidas no se puede fusionar (criterio de DO-01).

## Cómo comprobarlo

1. Abrir un pull request a `dev`: en **Checks** aparece **CI/CD Haitani / Pruebas** y debe quedar en verde.
2. Fusionar `QA` → `main`: en **Actions** corre **Pruebas** y en Render → **Events** aparece un deploy nuevo que termina en **Live**.
3. Abrir `/api/health` en producción: responde `ok: true`.

## Sanzu

El repositorio de Sanzu tiene su propio flujo en `.github/workflows/ci.yml`: instala, genera el cliente de Prisma, revisa los tipos con `npm run typecheck` y corre `npm test` en cada push y pull request. Sanzu todavía no se despliega.
