# simplePersonalDB

オフラインで動作する簡易個人データベース PWA。iPhone のホーム画面に追加して使う。
静的サイト + 全処理クライアント内 + 外部通信ゼロ。要件は `docs/REQUIREMENTS.md` を参照。

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

Netlify にもデプロイ可能（`netlify.toml`、`BASE_PATH` 未設定でルート配信）。
