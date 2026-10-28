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

### Paso 3: Publicar rama y enlace a Pull Request
```bash
git push -u origin feature/<nombre-de-la-tarea>
```
- La salida de Git proporciona el enlace directo para abrir el Pull Request hacia el repositorio.

### Paso 4: Integrar en rama `dev` (Cambios nuevos)
```bash
git checkout dev
git pull origin dev
git merge --no-ff feature/<nombre-de-la-tarea> -m "Merge branch 'feature/<nombre-de-la-tarea>' into dev"
git push origin dev
```

### Paso 5: Integrar en rama `QA` (Pruebas)
```bash
git checkout QA
git pull origin QA
git merge --no-ff feature/<nombre-de-la-tarea> -m "Merge branch 'feature/<nombre-de-la-tarea>' into QA"
git push origin QA
```

### Paso 6: Integrar en `main` (Produccion)
```bash
git checkout main
git pull origin main
git merge --no-ff feature/<nombre-de-la-tarea> -m "Merge branch 'feature/<nombre-de-la-tarea>' into main"
git push origin main
```

## 3. Verificacion Final
- Ejecutar `git status` para comprobar que el directorio de trabajo este limpio.
- Ejecutar las suites de pruebas pertinentes (`node --test`) antes de fusionar en `QA` y `main`.
