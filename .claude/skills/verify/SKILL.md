---
name: verify
description: simplePersonalDB の変更を検証する手順。ユニットテスト・型チェック・ビルド・ブラウザでの実機確認（一覧 CRUD / カレンダー / SQL / バックアップ）まで。コミット前や動作確認を求められたときに使う。
---

# 変更の検証

すべて `./docker.sh` 経由（ホストに Node は無い）。以下を上から順に実行する。

## 1. 静的検証

```sh
./docker.sh run pnpm test    # ユニットテスト（Vitest、全件成功を維持）
./docker.sh run pnpm check   # svelte-check（0 errors / 0 warnings を維持）
./docker.sh run pnpm build   # 本番ビルド（build/index.html = SPA fallback が出ること）
```

単一テストファイル: `./docker.sh run pnpm test -- src/lib/db/csv.test.ts`

E2E（`pnpm test:e2e`）はコンテナにブラウザ未導入のため、そのままでは失敗する。
実行するなら先に `./docker.sh run pnpm exec playwright install --with-deps` が必要
（通常はユニットテスト + 実機確認で足りる）。

## 2. 実機確認（UI に触れる変更のとき）

`/run` スキルの手順でサーバーを起動し、ブラウザで変更に関係する経路を実際に操作する。
大量データが必要なときは `testdata/sample-entries.csv`（100 件、ID は `sample-###`）を
CSV インポートする（同一 ID は上書きなので再インポートしても増殖しない）:

- **一覧画面** (`/`): 「＋ 新規」→ フォーム入力 → 保存 → 一覧に反映。
  タグチップでの絞り込み、キーワード検索、CSV エクスポート/インポートボタンの表示
- **カレンダー画面** (`/calendar`): 日時型（`valueType === 'date'`）のエントリが値の日付セルに
  表示される。text 型は出ない。タグチップで絞り込める。前月／次月で月移動できる（表示専用）
- **SQL 画面** (`/sql`): 「実行」→ 結果テーブル表示 → 履歴に追加される。
  履歴クリックでエディタに復元される
- **バックアップ督促バナー**: データありで未バックアップ（または 7 日超過 + 変更あり）のとき
  一覧上部にアンバーのバナーが出る
- コンソールエラー確認: アプリ由来のエラーが無いこと
  （`chrome-extension://` 由来のものは無視してよい）

## 注意（ブラウザ自動操作時）

- 削除ボタンと CSV インポートは `window.confirm()` を出す。**モーダルは自動操作を
  ブロックするので踏まない**（ロジックはユニットテストで担保されている）
- 「今すぐバックアップ」「CSVエクスポート」はファイルダウンロードが発生する
- IndexedDB スキーマを変更した場合は、旧バージョンの DB が残るブラウザで
  アップグレードパス（`upgrade(db, oldVersion)`）が通ることも確認する（詳細は `/data-model`）

## 関連スキル

- サーバー起動 → `/run`
- 機能の追加・変更手順 → `/add-feature`
- スキーマ変更の手順 → `/data-model`
