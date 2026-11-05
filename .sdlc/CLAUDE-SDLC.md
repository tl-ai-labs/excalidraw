# SDLC project state

The mmo plugin keeps this file. Run history is in the [ledger](ledger.md) ([ledger.json](ledger.json)).

## Project fingerprint

- **Repo:** Excalidraw monorepo, a worktree of `/Users/macbook/Documents/GitHub/Google-Projects/excalidraw`.
  - Remotes: `origin` is tl-ai-labs/excalidraw; `upstream` is excalidraw/excalidraw.
- **Baseline:** `baseline/current.json`, built 2026-11-05 at HEAD `14bb42ede`, 1327 tracked files.
  - Stack profile: `baseline/stack-profile.md`.
- **Stack:**
  - TypeScript 5.9 strict, ESM only, Yarn 1 workspaces.
  - React 19 + Jotai; packages build with esbuild, the app with Vite 5; tests on Vitest 3 + jsdom.
  - Packages: `common`, `element`, `math`, `utils`, `excalidraw`, plus the app `excalidraw-app`.
- **Test command:** `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`.
  - Plain `yarn test` runs in watch mode.
- **Default policy:** `argon4-agsdk-only` (see `project.json`).

## Known quirks for runs

- `yarn prettier` ignores the paths it is given. It always scans `**/*.{css,scss,json,md,html,yml}`, `.sdlc/` included, so it fails as a per-file check.
  - To check specific files, use `node_modules/.bin/prettier --list-different <files>` instead.
- Edits to `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx` (117 kB) only apply when anchored on a unique passage, for example the file's last three lines.
- `isTextElement`-only fields must be carried in `packages/excalidraw/data/restore.ts`, or file load and collaboration drop them.

## Last run

- `20261105-105313-feature-new-text-range-styles` (feature-new): **accepted** on 2026-11-05.
  - 26 files changed, left uncommitted on `EX-NF-11/argon4-agsdk-only`.
  - Records: `runs/20261105-105313-feature-new-text-range-styles/`.
