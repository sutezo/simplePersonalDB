---
name: run
description: simplePersonalDB の起動手順。dev/preview サーバーの立ち上げ、ポート、Docker 経由の実行方法。アプリを起動・実行・プレビュー・スクリーンショットしたいときに使う。
---

# アプリの起動

ホストに Node は無い。すべて `./docker.sh` 経由で実行する（直接 `pnpm`/`node` を叩かない）。

## 手順

1. 起動済みか確認する:
   ```sh
   docker ps --format '{{.Names}} {{.Ports}}' | grep -E '42304|42305'
   ```
   すでに動いていればそれを使う（新たに起動しない）。
2. 初回のみ: `./docker.sh build`（イメージ作成 + pnpm install）
3. 起動（どちらもバックグラウンド実行を推奨）:
   - 開発サーバー: `./docker.sh dev` → **http://localhost:42304**（起動 ~1 秒、HMR あり）
   - 本番プレビュー: `./docker.sh preview` → **http://localhost:42305**（ビルド込みで ~15 秒）
4. 起動確認: `curl -s -o /dev/null -w '%{http_code}' http://localhost:42304/` が `200`
5. 停止: `docker stop $(docker ps --filter ancestor=simplepersonaldb-dev -q)`
   （他のコンテナも該当しうるので、ポートで対象を確認してから止める）

## 注意

- ホスト側ポート 4173/5173 は別プロジェクトのコンテナが恒常的に専有している。
  42304/42305 を勝手に変えない（`vite.config.ts` と `docker.sh` の両方に定義がある）
- Service worker / PWA / オフライン動作は本番ビルドでのみ有効 → preview で確認する
- IndexedDB はオリジン単位なので、dev (42304) と preview (42305) のデータは別物
