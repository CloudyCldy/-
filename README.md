# Haitani

Haitaniは、**Sakura Coffee**を開発するチームを管理するための内部プラットフォームです。Sakura Coffeeは本プロジェクトとは別に既に存在しており、Haitaniはそのソースコードを含んでおらず、リポジトリを変更することもありません。GitHubとの連携は、参照および閲覧のみを目的としています。

## 機能

- セッション認証、`bcrypt`、および`admin`/`member`ロールによる認証。
- ダッシュボード、メンバー、タスク、優先度、ステータス、進捗状況。
- SQLiteに永続化されるドラッグ＆ドロップ対応のカンバン。
- SQLiteの実際のタスクから生成されるガントチャート。
- ファイル拡張子、MIMEタイプの検証、最大10 MBのサイズ制限、内部一意のファイル名を備えたファイル共有機能。
- GitHubの公式APIを介した、プライベートリポジトリ、コミット、ブランチ、プルリクエスト、アクティビティの照会。
- HTML5、CSS3、Vanilla JavaScriptによるレスポンシブなインターフェース。

## 技術

フロントエンド：HTML5、CSS3、Vanilla JavaScript。バックエンド：Node.js、Express。データベース：`better-sqlite3`を使用したSQLite。GitHub：`@octokit/rest`。

## インストール

```bash
npm install
npm run db:init
npm run db:seed
npm start
```

`http://localhost:3000` を開きます。開発時は `npm run dev` を使用してください。

## 環境変数

`.env.example` を `.env` としてコピーし、`PORT`、`SESSION_SECRET`、`GITHUB_REPOSITORY_URL`、`GITHUB_OWNER`、`GITHUB_REPOSITORY`、`GITHUB_TOKEN` を定義してください。トークンは SQLite に保存されることも、フロントエンドに送信されることもありません。Haitaniからも設定可能です。この設定はプロセスのメモリ内にのみ存在し、プロセスを再起動すると失われます。

Sakura Coffeのリポジトリ

DeepL.com（無料版）で翻訳しました。