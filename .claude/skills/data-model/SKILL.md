---
name: data-model
description: simplePersonalDB のデータモデル変更手順。Entry スキーマへの項目追加や IndexedDB ストア変更、DB_VERSION 引き上げと upgrade 移行、CSV/filter/form/test への波及。永続データの構造を変えるときに使う。
---

# データモデル / スキーマ変更

最も事故りやすい領域。IndexedDB は永続層なので、**旧バージョンの DB が残る実機**でも
壊れないことが最重要。実装の型どおりの流れは `/add-feature`、検証は `/verify`。

## IndexedDB の構造（`src/lib/db/database.ts`）

- `DB_NAME = 'simple-personal-db'`、`DB_VERSION` は執筆時 3（**現在値は `database.ts` が正**）
- ストア:
  - `entries`（keyPath `id`）… インデックス `by-updatedAt` / `by-tags`(multiEntry)
  - `sqlHistory`（keyPath `id`）… インデックス `by-executedAt`
  - `meta`（keyPath `key`）… key-value。`MetaKey` 型で列挙（`lastBackupAt` 等）
- CRUD はすべてこのファイルの関数経由（`listEntries` / `createEntry` / `updateEntry` /
  `importEntries` / `replaceEntries` / `deleteEntry` / `getMeta` / `setMeta` …）。

## ストア/インデックスを変えるとき（DB_VERSION の引き上げ）

1. `DB_VERSION` を +1 する。
2. `upgrade(db, oldVersion)` に**追記だけ**する（既存の `if (oldVersion < n)` ブロックは消さない）。
   新バージョン番号の `if (oldVersion < 新number) { ... }` を末尾に足す。
   ```ts
   if (oldVersion < 4) {
     // create/alter stores or backfill here
   }
   ```
3. 既存レコードに新項目のデフォルトを入れる必要があれば、この移行内で backfill する。
4. **旧 DB からのアップグレード確認**: 旧バージョンのデータが入ったブラウザで開き、
   `upgrade` が通って既存データが壊れないことを実機で確かめる（`/verify` の注意点）。

## Entry に項目を足すとき（波及チェックリスト）

型は 1 箇所だが、周辺の純粋ロジックへ確実に波及させる。`/architecture` の対応表も参照。

1. **`src/lib/types.ts`**: `Entry` に項目追加（TSDoc も）。ユーザー編集可能なら `EntryInput`
   （`Pick<Entry, ...>`）にも含める。
2. **既存データの後方互換**: 既存 Entry には新項目が無い。読み出し時に既定値を与えるか、
   上記の `upgrade` で backfill する（`undefined` 前提のコードを書かない）。
3. **CSV（`src/lib/db/csv.ts`）**: `CSV_COLUMNS` に列を追加し、`entriesToCsv` / `csvToEntries`
   の両方を更新（往復で失われないこと）。`csv.test.ts` にラウンドトリップのケースを追加。
4. **検索（`src/lib/db/filter.ts`）**: キーワード横断や絞り込み対象にするなら `filterEntries`
   を更新し、`filter.test.ts` を追加。
5. **フォーム（`src/lib/components/EntryForm.svelte`）**: 入力 UI とバリデーションを追加。
6. **表示（`routes/+page.svelte` の一覧・詳細、必要なら `CalendarView` など）**。
7. **同期（`src/lib/db/googleDriveSync.ts`）**: スナップショット JSON に新項目が乗ることを確認
   （`mergeSnapshots` は id ごとに `updatedAt` の新しい方を採用）。
8. **ドキュメント**: `docs/REQUIREMENTS.md` の項目テーブルと `README.md` を更新。

## 原則

- `createdAt` / `updatedAt` は読取専用。書き換えは `updateEntry()`（`updatedAt` を打刻）経由のみ。
- 日付は文字列（`yyyy-mm-dd` / ISO 8601）で扱い、`Date` へ早期変換しない（タイムゾーンずれ回避）。
- 破壊的変更（項目リネーム・削除）は移行で吸収し、既存ユーザーのデータを失わせない。
- 変更後は必ず `/verify`（`pnpm test` / `pnpm check` / `pnpm build` + 旧 DB アップグレード確認）。
