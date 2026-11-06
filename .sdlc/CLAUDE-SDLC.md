# SDLC plugin context (plugin-owned)

Updated 2026-11-06 after run `20261105-105249-feature-new-pages`. Run history: [ledger.md](ledger.md) (machine mirror: `ledger.json`).

## Project fingerprint

- **Repo:** Excalidraw monorepo (yarn@1.22.22 workspaces: `excalidraw-app`, `packages/*`, `examples/*`). Stack: node-typescript, React, Vite, vitest 3.0.6, TypeScript 5.9.3. No pre-authored stack adapter; the adaptive profile is at `baseline/stack-profile.md`.
- **Baseline:** `baseline/current.json` (plugin 0.10.1, built 2026-11-05T05:26:05Z, at HEAD `14bb42ede`).
- **Checkout:** a git worktree of `/Users/macbook/Documents/GitHub/Google-Projects/excalidraw`, with a stash shared across worktrees. Never use a bare `git stash`.
- **Default policy:** `argon4-agsdk-only` (in `project.json`).
- **Test command:** `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`. Regenerate snapshots with `yarn test:update`.
- **HEAD baseline:** 149 test files and 2632 tests. After the last run: 152 files and 2646 tests passing, uncommitted.
- **`.sdlc/` ignore:** `.sdlc/` is ignored only through the shared `.git/info/exclude`, not `.gitignore`. A fresh clone won't ignore it.
- **Off-limits by default:** `.env*`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.sdlc/**`, generated wasm subsets, `packages/excalidraw/types/**`, and build output. Only the `en.json` locale may be edited; Crowdin manages the others.

## Last run

`20261105-105249-feature-new-pages` (feature-new, accepted 2026-11-06). It added multi-page drawings:
- an element `pageId`, plus `AppState.pages` and `activePageId`
- the `PageBar` tab bar, opt-in through `UIOptions.canvasActions.pages`
- per-page viewport and undo
- page-aware restore, export, search, collab and Firebase storage

44 files, uncommitted. See `runs/20261105-105249-feature-new-pages/SUMMARY.md`.

Known gaps:
- In a mixed-build collab room, an old-build save drops the page list.
- No test covers frozen elements passed to `updateScene`.
- Render and SVG-export assertions are checked on the scene list and image size.
