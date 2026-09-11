# Haitani

Haitani es un SaaS multi-tenant para administrar proyectos de TI. Cada usuario pertenece a una organización y las consultas del backend se filtran por el contexto de la sesión; el frontend no puede cambiar arbitrariamente de organización.

## Arquitectura multi-tenant

- `organizations` contiene el tenant, su slug, estado y configuración general de GitHub.
- `roles` incluye `admin`, `project_manager`, `member` y `viewer`.
- Usuarios, proyectos, tareas, archivos, mensajes, llamadas, ausencias, actividades y configuración de GitHub se relacionan con `organization_id`.
- `project_members` controla la pertenencia a cada proyecto.
- El registro de organización crea el tenant, el administrador inicial y su configuración GitHub en una transacción PostgreSQL.
- `GET/POST/PUT /api/projects` y `/api/organizations/register` son los endpoints principales añadidos.

## Puesta en marcha y migración

Haitaniは、**Sakura Coffee**を開発するチームを管理するための内部プラットフォームです。Sakura Coffeeは本プロジェクトとは別に既に存在しており、Haitaniはそのソースコードを含んでおらず、リポジトリを変更することもありません。GitHubとの連携は、参照および閲覧のみを目的としています。

## 機能

- セッション認証、`bcrypt`、および`admin`/`member`ロールによる認証。
- ダッシュボード、メンバー、タスク、優先度、ステータス、進捗状況。
- PostgreSQLに永続化されるドラッグ＆ドロップ対応のカンバン。
- PostgreSQLの実際のタスクから生成されるガントチャート。
- ファイル拡張子、MIMEタイプの検証、最大10 MBのサイズ制限、内部一意のファイル名を備えたファイル共有機能。
- GitHubの公式APIを介した、プライベートリポジトリ、コミット、ブランチ、プルリクエスト、アクティビティの照会。
- HTML5、CSS3、Vanilla JavaScriptによるレスポンシブなインターフェース。

## 技術

フロントエンド：HTML5、CSS3、Vanilla JavaScript。バックエンド：Node.js、Express。データベース：PostgreSQL（`pg`）。GitHub：`@octokit/rest`。

## インストール

```bash
npm install
npm run db:init
npm run db:seed
npm start
```

`npm run db:init` es idempotente: crea las tablas nuevas, crea la organización inicial `haitani` y asocia los datos existentes sin borrarlos. `npm run db:seed` conserva los datos de demostración del tenant inicial.

Para crear otra organización se envía un `POST /api/organizations/register` con `company_name`, `slug`, `email`, `description`, `github_url`, `first_name`, `last_name`, `admin_email` y `password`. El administrador queda autenticado al terminar.

Para comprobar el aislamiento, inicia sesión con dos administradores en sesiones HTTP distintas, crea un proyecto en cada organización y verifica que `GET /api/projects` sólo devuelve el proyecto del tenant correspondiente. El backend también rechaza IDs de recursos pertenecientes a otra organización.

`http://localhost:3000` を開きます。開発時は `npm run dev` を使用してください。

## 環境変数

`.env.example` を `.env` としてコピーし、`PORT`、`SESSION_SECRET`、`CORS_ORIGIN`、`DATABASE_URL` または `PGHOST`、`PGPORT`、`PGDATABASE`、`PGUSER`、`PGPASSWORD` を定義してください。GitHubのトークンはサーバー側の `github_configurations` にのみ保存され、フロントエンドには返されません。既存のトークンが公開された場合は直ちに失効させてください。

PostgreSQLサーバーとデータベース `haitani` を作成してから `npm run db:init` と `npm run db:seed` を実行してください。SQLiteは使用しません。

## Asistente Sanzu

El panel de administrador incluye el asistente en `Asistente IA`. El servidor consulta por defecto `https://sanzu.onrender.com` mediante `/api/chat` y nunca envía el token al navegador. Para configurar otra ruta o autenticación, añade al `.env`:

```env
SANZU_API_URL=https://sanzu.onrender.com
SANZU_CHAT_PATH=/api/chat
SANZU_API_TOKEN=tu_token
# Si Haruchiyo usa un UUID de proyecto propio, configúralo aquí.
SANZU_PROJECT_ID=tu_project_id
```

Si Sanzu no está disponible, el asistente conserva un modo local con respuestas sobre tareas vencidas y progreso del proyecto.

Sakura Coffeのリポジトリ

