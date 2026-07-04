# CLAUDE.md

日本語で。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

**Pre-implementation.** No application code exists yet — only `docs/REQUIREMENTS.md`, which is the source of truth for all design decisions. Read it before implementing anything. Update this CLAUDE.md once the project is scaffolded (build/test commands, actual structure).

## What This Project Is

simplePersonalDB — a generic personal database implemented as an offline-capable PWA, added to the iPhone home screen. Core principle: **static site + all processing client-side + zero external communication**. No backend, no store app.

## Planned Tech Stack (from docs/REQUIREMENTS.md)

- **Framework**: SvelteKit 2 + Svelte 5 (runes), TypeScript strict, pure SPA (`ssr=false`, `adapter-static`)
- **PWA**: SvelteKit standard service worker (`$service-worker`) — precache all assets, fully offline
- **Storage**: IndexedDB via `idb`, with `navigator.storage.persist()`
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest + Playwright
- **Package manager**: pnpm
- **Deploy**: GitHub → Netlify auto-deploy (fallback: `index.html`)

## Development Environment

macOS + Docker. Node is NOT installed on the host — all commands run through `./docker.sh` (`build` / `shell` / `rebuild` / `clean`; script not yet created). `node_modules` lives in a Docker volume; source is bind-mounted. Do not run `pnpm`/`node` directly on the host.

## Key Design Constraints (iOS PWA)

- Export/backup is via Blob download / Web Share API (File System Access API is unsupported on iOS); import is `<input type="file">` — per current requirements, import is out of scope
- Data survival relies on `navigator.storage.persist()` plus prompting the user to back up
- Data is stored in plaintext in IndexedDB

## Data Model & Features (summary)

A single record type: tags (space-free words, multiple, ~10 categories), item name, value type (text or date), value (~20 chars), memo (multi-line ~100 chars), created/updated timestamps (read-only). Features: list/detail two-pane UI, tag filtering (multi-select), cross-field keyword + date-range search, sort by last-updated, virtual scrolling for large lists, CSV export, and a SELECT-only SQL execution view (with column selection and GROUP BY). No aggregation dashboards. Tag input should suggest existing tags to avoid near-duplicate proliferation.
