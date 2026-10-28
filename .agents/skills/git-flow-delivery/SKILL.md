---
name: git-flow-delivery
description: Procedimiento estandar de entrega de cambios, ramas Git, pruebas en QA, integracion en dev y creacion de Pull Requests.
---

# Procedimiento Estandar de Ramas y Entregas Git

Este skill documenta y estandariza el flujo de trabajo de Git requerido para cualquier cambio, nueva funcionalidad o correccion en el repositorio.

## 1. Definicion y Jerarquia de Ramas

- **`feature/<nombre-descriptivo>`**:
  - Rama de trabajo exclusiva para implementar una tarea, subtarea o correccion.
  - Se crea siempre a partir del estado mas reciente de la rama base (`git checkout -b feature/...`).
- **`dev`**:
  - Rama de desarrollo e integracion de cambios nuevos.
- **`QA`**:
  - Rama destinada a pruebas de calidad, validacion funcional y pruebas de integracion (E2E / tests).
- **`main`**:
  - Rama principal de produccion estable.

## 2. Flujo de Trabajo Obligatorio

Cada vez que se complete una tarea o conjunto de modificaciones, se debe seguir esta secuencia estricta:

### Paso 1: Crear la rama de funcionalidad
```bash
git checkout -b feature/<nombre-de-la-tarea>
```

### Paso 2: Stage y Commit con Conventional Commits
- Agregar unicamente los archivos modificados relevantes:
```bash
git add <archivos>
git commit -m "<tipo>(<alcance>): <descripcion concisa sin emojis>"
```
- Tipos comunes: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- Regla: No usar emojis en los mensajes de commit.

### Paso 3: Publicar rama y crear Pull Request
```bash
git push -u origin feature/<nombre-de-la-tarea>
```
- La terminal genera el enlace directo de GitHub para abrir el Pull Request.
- **Crear Pull Request a `main` y ramas correspondientes**:
  - URL directa para abrir PR hacia `main`:
    `https://github.com/CloudyCldy/-/compare/main...feature/<nombre-de-la-tarea>?expand=1`
  - URL directa para abrir PR hacia `dev`:
    `https://github.com/CloudyCldy/-/compare/dev...feature/<nombre-de-la-tarea>?expand=1`
  - El agente siempre debe entregar al usuario los enlaces directos de Pull Request listos para su aprobacion.

### Paso 4: Integrar en rama `dev` (Cambios nuevos)
```bash
git checkout dev
git pull origin dev
git merge --no-ff feature/<nombre-de-la-tarea> -m "Merge branch 'feature/<nombre-de-la-tarea>' into dev"
git push origin dev
```

### Paso 5: Integrar en rama `QA` (Pruebas)
- Ejecutar pruebas automáticas antes de la integracion en QA:
```bash
node --test
git checkout QA
git pull origin QA
git merge --no-ff feature/<nombre-de-la-tarea> -m "Merge branch 'feature/<nombre-de-la-tarea>' into QA"
git push origin QA
```

### Paso 6: Integrar en `main` (Produccion via Pull Request / Merge verificado)
- Todo cambio destinado a `main` debe tener su Pull Request registrado en GitHub.
- Tras la validación de pruebas y apertura de PR:
```bash
git checkout main
git pull origin main
git merge --no-ff feature/<nombre-de-la-tarea> -m "Merge branch 'feature/<nombre-de-la-tarea>' into main"
git push origin main
```

## 3. Politica Obligatoria de Pull Requests
1. **Ningun cambio directo a `main`**: Todos los cambios deben originarse en ramas `feature/*`.
2. **Generacion de PR para cada cambio a `main`**: Al finalizar la tarea, siempre se proporciona el enlace directo para el Pull Request hacia `main`.
3. **Trazabilidad en dev y QA**: Los cambios probados se sincronizan en `dev` y `QA`, manteniendo el historial con commits limpios y sin emojis.
