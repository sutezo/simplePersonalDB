---
name: add-feature
description: simplePersonalDB に機能を追加・変更する型どおりの手順。純粋ロジック先行、Svelte5 runes の当プロジェクト作法、base プレフィックス、外部通信ゼロ、TSDoc 等の規約。画面や機能を実装するときに使う。
---

# 機能の追加・変更手順

コードのどこに何があるかは `/architecture` を先に見る。実装後の検証は `/verify`。
スキーマ（Entry の項目や IndexedDB ストア）を変える場合は `/data-model` を必ず参照。

## 型どおりの流れ

1. **純粋ロジックを先に書く**（`src/lib/db/*.ts`）
   副作用なし・Node で動く関数として実装し、同じ場所に `*.test.ts` を置く（コロケーション）。
   既存関数を再利用する（例: タグ絞り込みは `filter.ts` の `filterEntries` を使い回す）。DRY。
2. **UI から呼ぶ**（`src/lib/components/*.svelte` / `src/routes/*`）
   データ取得は `database.ts` の関数経由のみ。ロジックは 1 の純粋関数へ委譲する。
3. **ドキュメント更新**: 機能なら `README.md`「機能」と `docs/REQUIREMENTS.md`「7 機能」に追記。
   アーキテクチャに影響するならルート `CLAUDE.md` と本 `.claude/skills/` も更新。
4. **検証**: `/verify`（テスト・型・ビルド → UI 変更なら実機確認）。

## Svelte 5 / このプロジェクト固有の作法

- **runes を使う**: `$state` / `$derived` / `$props` / `$bindable`。`export let` や旧ストア構文は使わない。
- **フォームの再マウント設計**: `EntryForm` は props の初期値だけを `$state` に取り込み、
  親が `{#key selectedId}` でフォームごと再マウントして値をリセットする。
  そのため props を直接参照する初期化には `// svelte-ignore state_referenced_locally` を**意図的に**付ける（消さない）。
- **派生値は `$derived`**: 絞り込み結果や候補リストは手続き的に再代入せず `$derived` で宣言的に。
- **内部リンクは必ず `base` を付ける**: `import { base } from '$app/paths'` → `` `${base}/calendar` ``。
  GitHub Pages のサブパス配信で壊れないため。ナビは `+layout.svelte` の `links` 配列に追加する。
  manifest 内のパスは相対で書く。

## コード規約（グローバル CLAUDE.md 準拠）

- SOLID / KISS / YAGNI / DRY。関数型を優先し副作用を最小化。
- 厳密な型付け。`any` 禁止、必要なら `unknown`。
- エラーは握りつぶさず、意味のあるメッセージ付きで処理する。
- **TSDoc 必須**（`.ts` / `.svelte` とも。`@param` / `@returns` など）。
- **全ソースファイル冒頭に、その役割・責務を 2 行程度**で記述（既存ファイル参照。`.svelte` は `<!-- -->`）。
- ソース・サンプルのコメントはすべて英語。コロケーション重視。
- 既存の Tailwind 配色（slate 系）とユーティリティの書き方に合わせる。

## 設計上の制約（破ってはいけない）

- **外部通信ゼロ**: CDN・外部フォント・外部 API を追加しない。依存はすべてバンドルに同梱する
  （唯一の例外はユーザーが押したときだけ動く Google Drive 同期）。
- **SQL は SELECT のみ**: `validateSelectOnly` を通す。書き込み系を通さない。
- `createdAt` / `updatedAt` は読取専用。更新は `updateEntry()` 経由でのみ `updatedAt` を更新する。
- エクスポートは Blob ダウンロード / Web Share API（iOS は File System Access API 非対応）。

## タグの制約（登録フォームで検証済み）

`EntryForm.svelte` の `save()` で検証: **1 つ以上必須**・1 タグ **7 文字以内**（`MAX_TAG_LENGTH`）・
**5 個まで**（`MAX_TAG_COUNT`）。タグは絞り込みの軸なので「タグなし」は許可しない。
制約を変えるときは定数・ヒント文言・`README.md` / `docs/REQUIREMENTS.md` を揃える。

## Git（確認後のみ）

Conventional Commits、本文は英語で要約＋変更点一覧。**確認なしに commit / push しない**。
変更後はコミットメッセージ案を英語で提示し、末尾にセッションのモデルに応じた
`Co-Authored-By` トレーラーを付ける（正確な行はシステムプロンプトの指示が正）。
