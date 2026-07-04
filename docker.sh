#!/usr/bin/env bash
# Entry point for all development commands. The host does not need Node/pnpm:
# everything runs inside the Docker image built from ./Dockerfile.
set -euo pipefail

IMAGE="simplepersonaldb-dev"
MODULES_VOLUME="simplepersonaldb_node_modules"
STORE_VOLUME="simplepersonaldb_pnpm_store"

# Run a command inside the dev container.
# Sources are bind-mounted; node_modules and the pnpm store live in volumes.
# Extra docker flags (e.g. port mappings) can be passed via DOCKER_FLAGS.
run() {
  # ${arr[@]+...} keeps `set -u` happy on bash 3.2 when the array is empty.
  local tty_flags=()
  if [ -t 0 ] && [ -t 1 ]; then
    tty_flags=(-it)
  fi
  docker run --rm ${tty_flags[@]+"${tty_flags[@]}"} \
    -v "$PWD":/app \
    -v "$MODULES_VOLUME":/app/node_modules \
    -v "$STORE_VOLUME":/root/.local/share/pnpm/store \
    ${DOCKER_FLAGS:-} \
    "$IMAGE" "$@"
}

usage() {
  cat <<'EOF'
Usage: ./docker.sh <command> [args...]

Commands:
  build            Build the dev image and install dependencies (pnpm install)
  rebuild          Rebuild the image without cache and reinstall dependencies
  shell            Open an interactive shell inside the container
  clean            Remove the image and the node_modules / pnpm store volumes
  dev              Start the Vite dev server (http://localhost:42304)
  preview          Build the app and serve it (http://localhost:42305)
  run <cmd...>     Run an arbitrary command inside the container
                   e.g. ./docker.sh run pnpm test
EOF
}

cmd="${1:-}"
case "$cmd" in
  build)
    docker build -t "$IMAGE" .
    run pnpm install
    ;;
  rebuild)
    docker build --no-cache -t "$IMAGE" .
    run pnpm install --force
    ;;
  shell)
    DOCKER_FLAGS="-p 42304:42304 -p 42305:4173" run bash
    ;;
  clean)
    docker rmi -f "$IMAGE" 2>/dev/null || true
    docker volume rm -f "$MODULES_VOLUME" "$STORE_VOLUME" 2>/dev/null || true
    echo "Removed image and volumes."
    ;;
  dev)
    DOCKER_FLAGS="-p 42304:42304" run pnpm dev
    ;;
  preview)
    # Host 4173 is commonly taken by other projects' containers on this
    # machine, so the internal Vite preview port (4173) is published on 42305.
    DOCKER_FLAGS="-p 42305:4173" run bash -lc "pnpm build && pnpm preview"
    ;;
  run)
    shift
    [ $# -gt 0 ] || { usage; exit 1; }
    run "$@"
    ;;
  *)
    usage
    exit 1
    ;;
esac
