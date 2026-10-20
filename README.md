# Haitani

Haitaniは、ITプロジェクトを管理するためのマルチテナントSaaSです。各ユーザーは1つの組織に所属し、バックエンドのクエリはセッションのコンテキストでフィルタリングされます。フロントエンドから任意に組織を切り替えることはできません。

## マルチテナントアーキテクチャ

- `organizations`にはテナント、slug、ステータス、GitHubの基本設定が保存されます。
- `roles`には`admin`、`project_manager`、`member`、`viewer`が含まれます。
- ユーザー、プロジェクト、タスク、ファイル、メッセージ、通話、欠勤、アクティビティ、GitHub設定は`organization_id`に関連付けられます。
- `project_members`が各プロジェクトのメンバーシップを管理します。
- 組織登録では、PostgreSQLのトランザクション内でテナント、初期管理者、GitHub設定を作成します。
- `GET/POST/PUT /api/projects`と`/api/organizations/register`が主なAPIエンドポイントです。

## セットアップと移行

Haitaniは、**Sakura Coffee**を開発するチームを管理するための内部プラットフォームです。Sakura Coffeeは独立したプロジェクトとして存在しており、Haitaniはそのソースコードを含まず、リポジトリも変更しません。GitHub連携は情報の参照と表示のみに使用します。

## 機能

- セッション、`bcrypt`、`admin`/`member`ロールによる認証。
- ダッシュボード、メンバー、タスク、優先度、ステータス、進捗管理。
- PostgreSQLに保存されるドラッグ＆ドロップ対応のカンバンボード。
- PostgreSQLの実際のタスクから生成されるガントチャート。
- 拡張子とMIMEタイプの検証、最大10 MBの制限、内部で一意なファイル名に対応したファイル共有。
- GitHub公式APIによるプライベートリポジトリ、コミット、ブランチ、プルリクエスト、アクティビティの参照。
- HTML5、CSS3、Vanilla JavaScriptで構築されたレスポンシブインターフェース。

## 技術

フロントエンド：HTML5、CSS3、Vanilla JavaScript。バックエンド：Node.js、Express。データベース：PostgreSQL（`pg`）。GitHub：`@octokit/rest`。

## インストール

```bash
npm install
npm run db:init
npm run db:seed
npm start
```

`npm run db:init`は冪等性を持ち、新しいテーブルを作成し、初期組織`haitani`を作成し、既存データを削除せずに関連付けます。`npm run db:seed`は初期テナントのデモデータを維持します。

別の組織を作成するには、`company_name`、`slug`、`email`、`description`、`github_url`、`first_name`、`last_name`、`admin_email`、`password`を含む`POST /api/organizations/register`を送信します。完了後、管理者は認証済みの状態になります。

分離を確認するには、異なるHTTPセッションで2人の管理者としてログインし、それぞれの組織にプロジェクトを作成して、`GET /api/projects`が該当するテナントのプロジェクトだけを返すことを確認します。バックエンドは別組織に属するリソースIDも拒否します。

`http://localhost:3000`を開きます。開発時は`npm run dev`を使用できます。

## 環境変数

`.env.example`を`.env`としてコピーし、`PORT`、`SESSION_SECRET`、`CORS_ORIGIN`、`DATABASE_URL`または`PGHOST`、`PGPORT`、`PGDATABASE`、`PGUSER`、`PGPASSWORD`を設定してください。GitHubのトークンはサーバー側の`github_configurations`にのみ保存され、フロントエンドには返されません。既存のトークンが公開された場合は直ちに無効化してください。

最初にPostgreSQLサーバーと`haitani`データベースを作成し、その後`npm run db:init`と`npm run db:seed`を実行してください。このプロジェクトではSQLiteを使用しません。

## Integración con Sanzu API e Inteligencia Contextual

Haitani incluye integración nativa con el motor de inteligencia de proyectos **Sanzu**, operado de forma centralizada mediante `server/services/sanzuClient.js`.

### Arquitectura de Integración

```mermaid
flowchart LR
    subgraph Haitani ["Haitani (Express + PostgreSQL)"]
        UI[Panel de Usuario / Asistente] --> Backend[Servidor Express]
        Backend --> DB[(PostgreSQL)]
        Backend --> Client[sanzuClient.js]
    end

    subgraph Sanzu ["Sanzu API (Next.js 15 + MongoDB)"]
        API[Route Handlers /api/v1] --> Engine[Motor de Metodologías & Riesgos]
        API --> Dict[Diccionario 15 Categorías]
        API --> AI[AI Provider: Core / Gemini / OpenAI]
        Engine --> SanzuDB[(MongoDB)]
    end

    Client -- "HTTP POST /api/v1/partner/chatbot/message<br/>Header: X-Api-Key" --> API
    Client -- "HTTP GET /api/v1/dictionary" --> API
    API -- "Respuesta estructurada (answer, sources, suggestions)" --> Client
```

### Variables de Entorno de Integración

```env
SANZU_API_URL=https://sanzu.onrender.com   # URL de Sanzu (http://localhost:3000 en desarrollo)
SANZU_API_KEY=sz_live_...                 # Clave de integración partner (X-Api-Key)
SANZU_TIMEOUT_MS=8000                     # Tiempo límite por petición en ms
```

### Capacidades del Cliente Centralizado (`sanzuClient.js`)

1. **Gestión de Sesión y Autenticación:** Transmite de forma segura la API key en el encabezado `X-Api-Key` exclusivamente desde el backend de Haitani (nunca se expone al navegador).
2. **Resiliencia y Reintentos Seguros:** Aplica reintentos limitados con retroceso exponencial (`exponential backoff`) únicamente para errores transitorios de red o códigos 408/429/503.
3. **Cancelación Automática:** Implementa `AbortController` cancelando peticiones que excedan `SANZU_TIMEOUT_MS`.
4. **Protección de Secretos:** Sanitiza automáticamente trazas y mensajes de error impidiendo la filtración de tokens, contraseñas o hashes en logs y respuestas.
5. **Modo Local Offline:** Si Sanzu no está disponible o la API Key no está configurada, Haitani conmuta transparentemente a respuestas deterministas locales calculadas con PostgreSQL.
6. **Diccionario Especializado:** Endpoint `GET /api/assistant/dictionary` para consultar términos, sinónimos y conceptos de 15 categorías clave de ingeniería de software.


## Gestión de Sprints y Metodología Ágil (SB-03, SB-05)

Haitani incluye soporte nativo para ciclos de desarrollo ágil (Sprints):

- **Tareas asociadas a proyectos (SB-03.1):** Las tareas pertenecen estrictamente a un proyecto validado dentro de la organización (`GET /api/projects/:id/tasks`, `POST /api/projects/:id/tasks`).
- **Asignación de tareas a sprints (SB-03.2):** Cada tarea puede ser vinculada a un sprint mediante `tasks.sprint_id` (`PATCH /api/tasks/:id/sprint`). Se valida que el sprint pertenezca al mismo proyecto y organización (respondiendo 400 en caso contrario).
- **Ciclo de vida de Sprints (SB-05.1 & SB-05.2):**
  - Estados soportados: `planificado`, `activo` y `cerrado`.
  - Creación con validación de fechas (`end_date >= start_date`).
  - Solo un sprint activo por proyecto de forma concurrente (responde 409 en caso de conflicto).
  - Al cerrar un sprint (`POST /api/sprints/:id/close`), las tareas incompletas regresan al backlog o pueden transferirse a otro sprint planificado mediante `move_to_sprint_id`.
  - Auditoría de eventos en `activities` (`sprint.created`, `sprint.started`, `sprint.closed`).
- **Tablero y Vista de Sprint (SB-05.3):**
  - Rutas hash `#/<rol>/sprints` y `#/<rol>/sprints/:id`.
  - Visualización del avance (% completado, total, pendientes), tablero kanban por columnas de estado (`pendiente`, `en_proceso`, `en_revision`, `bloqueada`, `completada`), lista de pendientes y backlog de tareas no asignadas con incorporación rápida.

---

## Plantillas de Historias y Sprints (KB-01)

El endpoint `GET /api/templates?type=story|sprint` provee plantillas estandarizadas:

1. **Historias de Usuario (`story`):**
   - Historia de Usuario Estándar (formato Como... Quiero... Para... con criterios Given/When/Then).
   - Reporte de Error (Bug Report estructurado con pasos para reproducir y severidad).
   - Tarea Técnica / Spike (investigación con timebox y entregables).
2. **Planificación de Sprints (`sprint`):**
   - Planificación de Sprint Estándar (objetivo, capacidad y riesgos).
   - Sprint de Estabilización y Calidad (Bugfix / Hardening).

En la interfaz de usuario, los botones "Usar plantilla" y "Usar plantilla de planificación" rellenan automáticamente los campos de descripción y objetivo.

---

## Pruebas Automatizadas (QA-01)

La suite de pruebas utiliza el ejecutor nativo de Node.js (`node --test`) y `supertest` para validar la lógica del backend y el aislamiento multi-tenant.

### Ejecución de pruebas

```bash
npm test
```

### Pruebas E2E con Playwright

Las pruebas de interfaz usan Chromium, Firefox y WebKit. Instala sus navegadores una vez y ejecuta la suite así:

```bash
npx playwright install chromium firefox webkit
npm run test:e2e
```

El servidor E2E usa el Express real y una capa de datos aislada; reemplaza la conexión de base de datos por una dirección local inválida y no ejecuta inicialización ni seed. Las pruebas cubren el acceso, la validación de credenciales, el consentimiento de privacidad, la navegación por teclado y el diseño en escritorio, tablet y móvil. Las capturas, trazas y videos se guardan en `test-results/` cuando corresponda; los reintentos solo se habilitan en CI.

### Configuración de base de datos de pruebas

Para ejecutar las pruebas contra una base de datos PostgreSQL dedicada, define la variable de entorno `TEST_DATABASE_URL`:

```bash
# En Windows PowerShell
$env:TEST_DATABASE_URL="postgres://usuario:password@localhost:5432/haitani_test"
npm test

# En Linux/macOS
TEST_DATABASE_URL="postgres://usuario:password@localhost:5432/haitani_test" npm test
```

Si no se define `TEST_DATABASE_URL`, el runner ejecuta automáticamente la suite en un entorno de pruebas aislado en memoria que valida las 20 aserciones de integración y seguridad:
1. Creación de tareas con validación de pertenencia al proyecto y organización.
2. Validación de fechas de sprints (`fin >= inicio`).
3. Asignación y aislamiento de sprints por proyecto.
4. Restricción de un solo sprint activo por proyecto (409) y prevención de reinicio de sprints cerrados.
5. Cierre de sprint y reubicación de tareas no terminadas.
6. Cálculo de métricas y agrupación de tareas por estado en `GET /api/sprints/:id`.
7. Aislamiento multi-tenant estricto (404 al acceder a recursos de otra organización).
8. Control de acceso por roles (`admin`/`project_manager` vs. `member`/`viewer`).
9. Disponibilidad de plantillas de historias y sprints.

