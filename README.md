# Haitani

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

`http://localhost:3000` を開きます。開発時は `npm run dev` を使用してください。

## 環境変数

`.env.example` を `.env` としてコピーし、`PORT`、`SESSION_SECRET`、`DATABASE_URL` または `PGHOST`、`PGPORT`、`PGDATABASE`、`PGUSER`、`PGPASSWORD`、さらにGitHubの変数を定義してください。トークンはPostgreSQLに保存されることも、フロントエンドに送信されることもありません。GitHub設定画面から入力した値はプロセスのメモリ内にのみ存在し、再起動すると失われます。

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

