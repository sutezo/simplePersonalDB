# simplePersonalDB

[![Deploy](https://img.shields.io/github/actions/workflow/status/sutezo/simplePersonalDB/deploy.yml?branch=main&label=deploy&logo=github)](https://github.com/sutezo/simplePersonalDB/actions/workflows/deploy.yml)
[![Site](https://img.shields.io/website?url=https%3A%2F%2Fsutezo.github.io%2FsimplePersonalDB%2F&label=site)](https://sutezo.github.io/simplePersonalDB/)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![PWA](https://img.shields.io/badge/PWA-offline-5A0FC8?logo=pwa&logoColor=white)](https://sutezo.github.io/simplePersonalDB/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

オフラインで動作する簡易個人データベース PWA。Android/iPhone のホーム画面に追加して使う。
静的サイト + 全処理クライアント内。既定では外部通信なしで動作し、Google Drive 同期ボタンを押した時だけ Google API に通信する。
要件は `docs/REQUIREMENTS.md` を参照。

公開 URL: **https://sutezo.github.io/simplePersonalDB/**

## 機能

- 項目・値・タグ・メモの登録 / 編集 / 削除（IndexedDB に保存、完全ローカル）
- 一覧 + 詳細の 2 ペイン（モバイルは 2 画面切替）、仮想スクロール
- キーワード（項目・値・メモ横断）・タグ複数・更新日範囲での絞り込み、最終更新順ソート
- タグはスペース区切り入力 + 既存タグからワンタップ追加（重複乱発防止、必須・1項目1〜5個・1タグ7文字以内）
- データ型「年月日」選択時は今日の日付を自動入力
- カレンダービュー: 日時型エントリを値の日付に配置した月表示（タグ絞り込み対応、表示専用）
- CSV エクスポート（iOS 共有シート / Blob ダウンロード、BOM 付き UTF-8）と
  CSV インポート（復元、同一 ID は上書き）
- Google Drive 手動同期（Google Drive API の `appDataFolder` にアプリ専用 JSON スナップショットを保存）
- バックアップ督促バナー（最終バックアップから 7 日経過 + 変更ありで表示、3 日スヌーズ可）
- SQL 実行画面: SELECT のみ実行可（sql.js / SQLite wasm）、カラム選択 + GROUP BY の
  クエリビルダー、実行履歴（クリックで再読込、最大 50 件）
- PWA: 全アセット precache による完全オフライン動作、`navigator.storage.persist()` 要求

## 技術スタック

SvelteKit 2 + Svelte 5 (runes) / TypeScript strict / adapter-static (SPA) /
IndexedDB (`idb`) / sql.js (SELECT実行) / Tailwind CSS 4 / Vitest + Playwright / pnpm

## 開発環境

ホストに Node は不要。すべて Docker 経由で操作する。

```sh
./docker.sh build      # イメージ作成 + pnpm install（初回に実行）
./docker.sh dev        # 開発サーバー起動 → http://localhost:42304
./docker.sh preview    # ビルドしてプレビュー → http://localhost:42305
./docker.sh shell      # コンテナ内シェル
./docker.sh rebuild    # イメージをキャッシュなしで再構築 + 再インストール
./docker.sh clean      # イメージと node_modules / pnpm store ボリュームを削除
./docker.sh run <cmd>  # 任意コマンド実行（例: ./docker.sh run pnpm test）
```

`node_modules` は Docker volume に置かれ、ソースはバインドマウントされる。

## Google Drive 同期

同期を使う場合は Google Cloud Console で Drive API を有効化し、ウェブアプリ用 OAuth クライアント ID を作成する。
承認済み JavaScript 生成元にローカル開発用の `http://localhost:42304` と、公開 URL の生成元を登録する。

```sh
cp .env.example .env
# .env の VITE_GOOGLE_CLIENT_ID に OAuth クライアント ID を設定
```

同期は画面の「Google Drive同期」ボタンを押した時だけ実行する。保存先はユーザーから見えない Drive の `appDataFolder` で、要求スコープは `https://www.googleapis.com/auth/drive.appdata`。


**OAuth クライアントIDの作り方**

1. Google Cloud Console を開く
   https://console.cloud.google.com/

2. プロジェクトを作成、または既存プロジェクトを選択

3. Drive API を有効化
   「API とサービス」→「ライブラリ」→ `Google Drive API` →「有効にする」

4. OAuth 同意画面を設定
   「Google Auth platform」または「OAuth 同意画面」へ移動
   - アプリ名: `simplePersonalDB` など
   - ユーザーサポートメール: 自分の Google アカウント
   - 対象: 個人利用なら `外部`
   - テストユーザー: 自分の Google アカウントを追加

5. クライアントIDを作成
   「Google Auth platform」→「クライアント」→「クライアントを作成」

6. アプリケーションの種類を選ぶ
   `ウェブ アプリケーション`

7. 承認済み JavaScript 生成元を追加
   ローカル用:

   ```txt
   http://localhost:42304
   ```

   GitHub Pages で使うなら:

   ```txt
   https://sutezo.github.io
   ```

   `https://sutezo.github.io/simplePersonalDB/` ではなく、origin なので `/simplePersonalDB` は付けません。

8. 作成後に表示される `クライアント ID` をコピー
   形はだいたいこうです。

   ```txt
   xxxxx.apps.googleusercontent.com
   ```

8-1. Drive API が有効か
  - Google Cloud Console → 対象プロジェクト → 「API とサービス」→「有効な API とサービス」
  - Google Drive API が有効になっている必要があります。

8-2. OAuth 同意画面にスコープを追加しているか
  - Google Cloud Console → Google Auth platform → Data Access / スコープ

### 追加するスコープ:

  `https://www.googleapis.com/auth/drive.appdata`

-  このアプリはこのスコープだけ使います。Google 公式でも drive.appdata は「アプリ自身の設定データを Drive 内で管理する」スコープとして定義されています。

  `https://developers.google.com/workspace/drive/api/guides/api-specific-auth`

8-3. 公開ステータスが Testing なら、自分をテストユーザーに追加
  - Google Auth platform → Audience / Test users

  - 自分の Google アカウントを追加してください。
  - これを忘れると access_denied / 403 になりがちです。




9. このリポジトリの `.env` に設定

   ```sh
   cp .env.example .env
   ```

   `.env`:

   ```sh
   VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
   ```

10. dev server を再起動

   ```sh
   ./docker.sh dev
   ```

公式ドキュメント上も、Web アプリでは `Web application` を選び、`Authorized JavaScript origins` に `http://localhost:<port>` を追加する必要があります。
参照: https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid


## よく使うコマンド

```sh
./docker.sh run pnpm test       # ユニットテスト (Vitest)
./docker.sh run pnpm check      # 型チェック (svelte-check)
./docker.sh run pnpm build      # 本番ビルド (build/ に出力)
./docker.sh run pnpm test:e2e   # E2E (要: playwright install --with-deps)
./docker.sh run pnpm icons      # PWAアイコン再生成 (static/icons)
```

## デプロイ

GitHub Pages へ自動デプロイ（`.github/workflows/deploy.yml`）。
`main` への push で GitHub Actions がビルドし、`https://sutezo.github.io/simplePersonalDB/` に公開される。

- サブパス配信のため `BASE_PATH=/simplePersonalDB` を付けてビルドする（`svelte.config.js` の `paths.base`）
- GitHub Pages にはリライト機能がないため、SPA フォールバックとして `index.html` を `404.html` にコピーする
- 初回のみ、リポジトリの Settings → Pages → Source を「GitHub Actions」にすること
- Google Drive 同期を本番でも使う場合は、リポジトリの Settings → Secrets and variables → Actions → Variables に
  `VITE_GOOGLE_CLIENT_ID` を追加すること
- Google Cloud Console の OAuth クライアントには、承認済み JavaScript 生成元として `https://sutezo.github.io` を追加すること

Netlify にもデプロイ可能（`netlify.toml`、`BASE_PATH` 未設定でルート配信）。


## ライセンス

MIT License
