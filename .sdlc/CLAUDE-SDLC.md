# SDLC context for this project

Written by the mmo brownfield pipeline. Run history: [ledger.md](ledger.md) (machine mirror: `ledger.json`).

## Project fingerprint

- **Repo:** the Excalidraw monorepo, using Yarn 1 workspaces and node-typescript. It contains:
  - `packages/excalidraw`, the React editor library
  - `excalidraw-app`, a React 19 + Vite app
  - `packages/element`, `packages/common`, `packages/math` and `packages/utils`
- **Baseline:** `.sdlc/baseline/current.json` at `14bb42ede`. The stack profile is in `.sdlc/baseline/stack-profile.md`.
- **Test commands:** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false`. Snapshots change only through `yarn test:update`.
- **Default policy:** `opus55-plus-flash38-agsdk`.
- **Always off-limits:**
  - AI configs: `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
  - non-English locale files, which Crowdin manages
  - `yarn.lock` and every `package.json`
  - `.github/workflows/**` and `firebase-project/**`
- **Last run:** `20261109-163637-feature-new-pages` (feature-new, Pages). It was accepted on 2026-11-10 and left uncommitted.

## Notes for the next run

- Pages model:
  - Each element has an optional `pageId`. Elements without one belong to the home page.
  - App state holds `pages`, `activePageId` and `pageViewports`.
  - `Scene` getters return the active page's elements, except the `*IncludingDeleted` and `*AllPages` getters, which return every page's.
- Editor tests that drive shortcuts must render `<Excalidraw handleKeyboardGlobally />`. Without it, key events on `document` never reach the editor.
