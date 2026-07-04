# simplePersonalDB — 簡易個人データベース PWA 要件定義

## 1. 概要

汎用個人データベース
iPhone のホーム画面に追加して使うオフライン動作可能な PWA として実装する。
ストアアプリは費用面で採用しない。

## 2. 基本方針

**「静的サイト + 全処理クライアント内 + 外部通信ゼロ」**
- sqlite3 のような簡易データベース

## 3. アーキテクチャ

```
[iPhone PWA (ホーム画面追加)]
  UI (SvelteKit SPA / ssr=false / adapter-static)
  IndexedDB — データ保存
  バックアップ — 共有シート/Blob ダウンロードで「ファイル」(iCloud Drive) へ
                インポート（復元）は CSV を `<input type="file">` で読み込み
                定期的にバックアップを促すバナーを表示
```

## 4. 技術スタック

| 領域 | 選定 | 理由 |
|---|---|---|
| フレームワーク | SvelteKit 2 + Svelte 5 (runes), TypeScript strict | SSR 不要のため純 SPA |
| ビルド/配信 | `adapter-static` + GitHub Pages（fallback: `index.html` を `404.html` に複製） | バックエンドゼロ |
| PWA | SvelteKit 標準サービスワーカー（`$service-worker`） | 依存追加なしで全アセット precache・完全オフライン |
| ローカル保存 | IndexedDB (`idb`) + `navigator.storage.persist()` | 平文保存 |
| スタイル | Tailwind CSS 4 | 軽量・依存最小 |
| テスト | Vitest + Playwright | |
| CI/CD | GitHub Actions → GitHub Pages 自動デプロイ | |
| ビルド | pnpm | |

## 5. iOS PWA の既知の制約（設計に織り込み済み）

- ホーム画面追加した PWA は Safari の「7 日間未使用でストレージ削除」の対象外。
  ただしストレージ逼迫時の退避リスクは残るため `persist()` + バックアップ督促で対処
- File System Access API 非対応 → エクスポートは Blob ダウンロード / Web Share API、
  インポートは `<input type="file">`

## 6. 開発環境

macOS + Docker。ホストに Node は不要で、すべて `./docker.sh` 経由で操作する
（`build` / `shell` / `rebuild` / `clean`。詳細は README 参照）。
`node_modules` は Docker volume に置き、ソースはバインドマウントする。
pnpmを使用

## 7 機能

- 一覧、詳細の2ペインまたは2画面
- 入力・編集機能
- エクスポート(CSV)・インポート(CSV、IDで上書き)
- バックアップ督促（最終バックアップから7日経過 + 変更ありで表示、スヌーズ可）
- 集計機能なし
- SQL実行・結果表示機能、select のみ。項目は選択できるように
    - group by

|項目|種類|note|
|---|---|-|
|タグ|スペースなし単語文字列|複数指定可能（1項目5個まで）,1タグ7文字以内,カテゴリを表す,〜20種類くらい|
|項目|テキスト||
|データ型|テキスト、年月日|値の型|
|値|テキスト|1行,〜20文字程度|
|メモ|テキスト|複数行100文字程度まで|
|登録日時|日時|読取専用|
|最終更新|日時|読取専用|

### 一覧画面
- 項目リスト
- タグで絞れる.タグは複数選べる
- 検索はキーワード（値、項目、メモ横断的に）、日付範囲
- 最終更新日時で並べ替え
- たくさんある場合、仮想スクロール


### 入力
- タグは1項目に自由にスペース区切りで選べる.似たような文字列で重複・乱発しないよう過去タグからも選べるように
- 項目、値は自由テキスト


