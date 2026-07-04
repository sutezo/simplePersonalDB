# CLAUDE.md

日本語で。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

simplePersonalDB — オフライン動作する汎用個人データベース PWA（iPhone ホーム画面追加用）。
基本方針: **静的サイト + 全処理クライアント内 + 外部通信ゼロ**。要件は `docs/REQUIREMENTS.md` が正。

## コマンド

ホストに Node は無い。**すべて `./docker.sh` 経由で実行する**（直接 `pnpm`/`node` を叩かない）。

```sh
./docker.sh build              # イメージ作成 + pnpm install（初回）
./docker.sh dev                # 開発サーバー → http://localhost:42304
./docker.sh preview            # ビルド + プレビュー → http://localhost:42305
./docker.sh run pnpm test      # ユニットテスト (Vitest)
./docker.sh run pnpm test -- src/lib/db/csv.test.ts   # 単一テストファイル
./docker.sh run pnpm check     # svelte-check（型チェック）
./docker.sh run pnpm build     # 本番ビルド → build/
./docker.sh run pnpm icons     # PWA アイコン再生成
```

このマシンでは他プロジェクトのコンテナがホストの 4173/5173 を恒常的に専有しているため、
dev/preview のポートは 5173/4173 ではなく 42304/42305 に固定している（`vite.config.ts` の
`server.port`/`preview.port` と `docker.sh` のポート公開を両方揃える必要がある）。
`./docker.sh shell` に入って手動で `pnpm dev`/`pnpm preview` を実行する場合も、
`shell` コマンド自体が両ポートを公開済みなのでそのまま `http://localhost:42304` 等で開ける。
Playwright (`pnpm test:e2e`) はコンテナにブラウザ未導入のため、実行には `playwright install --with-deps` が必要。

## アーキテクチャ

SvelteKit 2 + Svelte 5 (runes) の純 SPA。`+layout.ts` で `ssr=false`、`adapter-static` の
`fallback: index.html` で全ルートをクライアント処理。

データフロー: UI → `src/lib/db/database.ts`（idb / IndexedDB、唯一の永続層）→ 画面へ再ロード。
検索・タグ絞り込み・並べ替えは `src/lib/db/filter.ts` の純粋関数でメモリ内処理。

SQL 機能（`/sql`）: 実行のたびに IndexedDB の全レコードを sql.js（SQLite wasm）のインメモリ DB
（テーブル名 `entries`、tags はスペース結合の TEXT）へ流し込み、SELECT のみ実行して破棄する。
実行成功したクエリは IndexedDB の `sqlHistory` ストアに履歴保存（同一 SQL は先頭へ移動、
上限 `SQL_HISTORY_LIMIT` 件で古い順に削除）。IndexedDB のスキーマ変更時は `DB_VERSION` を上げ、
`upgrade(db, oldVersion)` に移行処理を追加すること。
wasm は `?url` インポートでバンドルに同梱（外部通信ゼロを維持）。
純粋ロジックは `sqlEngine.ts`（Node でもテスト可能）、ブラウザ専用の wasm ロードは `sqlLoader.ts` に分離。

PWA: `src/service-worker.ts` が全ビルドアセット + `${base}/`（SPA フォールバック）を precache。
オフライン時のナビゲーションはキャッシュ済みフォールバックを返す。起動時に `navigator.storage.persist()` を要求。
アイコンは `scripts/generate-icons.mjs`（依存なしの PNG エンコーダ、DB シリンダーの絵）で生成。

UI 構成: `+page.svelte` が一覧 + 詳細の 2 ペイン（モバイルは切替式）を統括。
`EntryForm` は props の初期値のみ取り込み、親が `{#key selectedId}` で再マウントする設計
（`svelte-ignore state_referenced_locally` はそのための意図的な指定）。
一覧は自前の `VirtualList.svelte`（固定行高の仮想スクロール）。

## デプロイ（GitHub Pages）

`main` への push で `.github/workflows/deploy.yml` が自動デプロイ →
**https://sutezo.github.io/simplePersonalDB/**（Pages ソースは「GitHub Actions」設定済み）。

- サブパス配信のため CI では `BASE_PATH=/simplePersonalDB` でビルドする
  （`svelte.config.js` の `paths.base`。ローカル/Netlify は未設定でルート配信）
- **内部リンクには必ず `$app/paths` の `base` を付けること**（`+layout.svelte` 参照）。
  manifest 内のパスは相対で書く
- GitHub Pages にはリライトが無いため、CI で `index.html` を `404.html` にコピーして
  SPA フォールバックにしている（`/sql` 直アクセスは HTTP 404 ステータスだが表示は正常）
- Netlify にも配信可能（`netlify.toml` のリダイレクトでフォールバック）

## 設計上の制約

- 外部通信ゼロ: CDN・外部フォント・API を追加しない。依存はすべてバンドルに同梱する
- SQL は SELECT のみ許可（`validateSelectOnly` で検証）。書き込み系を通さないこと
- `createdAt` / `updatedAt` は読取専用。更新は `updateEntry()` 経由でのみ `updatedAt` を更新
- エクスポートは Blob ダウンロード / Web Share API（iOS は File System Access API 非対応）
