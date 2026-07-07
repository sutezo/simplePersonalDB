---
name: architecture
description: simplePersonalDB のコードマップ。データフロー、各モジュールの責務、純粋ロジックとUIの分離、ルート構成。「どのファイルを触ればよいか」を特定したいとき、コードベースを把握したいときに使う。
---

# コードマップ

SvelteKit 2 + Svelte 5 (runes) の純 SPA。`+layout.ts` で `ssr=false`、`adapter-static`
の `fallback: index.html` で全ルートをクライアント処理する。要件は `docs/REQUIREMENTS.md` が正。

## データフロー

```
UI (routes / components)
  → src/lib/db/database.ts  … IndexedDB (idb)。唯一の永続層。CRUD はここだけ
  → 画面へ再ロード（各ページの reload() が listEntries() を呼び直す）

検索・絞り込み・並べ替え・カレンダー・SQL は「メモリ内の純粋関数」で処理する。
永続層から取得した Entry[] を関数に通すだけで、DB を直接叩かない。
```

## 純粋ロジック ↔ UI の対応表

CLAUDE.md の方針に従い、**Node でテスト可能な純粋ロジック**と**ブラウザ専用の UI/副作用**を
分離している。ロジックには必ず `*.test.ts` が隣接する（コロケーション）。

| 関心事 | 純粋ロジック（Node可・テスト有） | UI / 副作用 |
|---|---|---|
| 永続化 | — | `db/database.ts`（IndexedDB、CRUD の唯一の窓口） |
| 型 | `types.ts`（`Entry` / `EntryInput` / `ValueType` / `SqlHistoryEntry`） | — |
| 検索・絞り込み | `db/filter.ts`（`filterEntries` / `sortByUpdatedAt` / `collectTags` / `parseTags`） | `components/TagFilter.svelte`, `routes/+page.svelte` |
| CSV 入出力 | `db/csv.ts`（`entriesToCsv` / `parseCsv`(RFC4180) / `csvToEntries`） | `routes/+page.svelte`（Blob DL / Web Share） |
| バックアップ督促 | `db/backup.ts`（`needsBackupReminder` / `snoozeUntil`） | `routes/+page.svelte` のバナー |
| カレンダー | `db/calendar.ts`（`filterDateEntries` / `buildMonthGrid` / `CalendarCell`） | `components/CalendarView.svelte`, `routes/calendar/+page.svelte` |
| SQL | `db/sqlEngine.ts`（`validateSelectOnly` / `buildDatabase` / `executeSelect` / `buildSelectSql`） | `db/sqlLoader.ts`（wasm ロード）, `routes/sql/+page.svelte` |
| Google Drive 同期 | `db/googleDriveSync.ts`（`mergeSnapshots` は純粋、GIS/API 部分は副作用） | `routes/+page.svelte` の同期ボタン |

**新しい関心事を足すときもこの型に従う**: まず `db/*.ts` に純粋関数 + `*.test.ts`、
次に `components/*.svelte` や `routes/*` の UI から呼ぶ。→ 手順は `/add-feature`。

## ルート構成（`src/routes/`）

- `+layout.ts` … `export const ssr = false`（SPA 化の要）
- `+layout.svelte` … アプリシェル。ヘッダーのナビ `links` 配列。**内部リンクは `base` プレフィックス必須**（GitHub Pages サブパス対応）
- `+page.svelte` … 一覧 + 詳細の 2 ペイン（モバイルは切替）。CRUD・検索・CSV・同期・督促の統括
- `calendar/+page.svelte` … 日時型エントリのみの月表示（表示専用・タグ絞り込みのみ）
- `sql/+page.svelte` … SELECT 実行 + クエリビルダー + 履歴

## コンポーネント（`src/lib/components/`）

- `EntryForm.svelte` … 登録/編集フォーム。props の初期値のみ取り込み、親が `{#key selectedId}` で再マウントする設計
- `TagFilter.svelte` … タグの複数選択（AND 絞り込み）。一覧とカレンダーで共用
- `VirtualList.svelte` … 固定行高の自前仮想スクロール（一覧の大量データ用）
- `CalendarView.svelte` … 月グリッド描画（表示専用）

## PWA / インフラ

- `service-worker.ts` … 全ビルドアセット + `${base}/`（SPA フォールバック）を precache。オフライン時はキャッシュ済みフォールバックを返す
- `scripts/generate-icons.mjs` … 依存なしの PNG エンコーダでアイコン生成（`pnpm icons`）
- デプロイは `main` push で `.github/workflows/deploy.yml` → GitHub Pages。詳細は README とルート `CLAUDE.md`

## 迷ったら

- **起動・プレビュー** → `/run`
- **変更の検証（テスト/型/ビルド/実機）** → `/verify`
- **機能を足す手順** → `/add-feature`
- **Entry スキーマ / IndexedDB ストアの変更** → `/data-model`
