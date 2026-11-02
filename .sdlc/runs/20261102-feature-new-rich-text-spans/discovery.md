# Discovery: 20261102-feature-new-rich-text-spans

Mode: first-time. Intent: feature-new. Built 2026-11-02T08:28:49Z at `14bb42ed` on `EX-NF-11/opus55-plus-sonnet55` (clean worktree, 1 of 6 on this repo). Remote: `tl-ai-labs/excalidraw`. No sampling was needed (1,327 tracked files).

Seed: let users colour or highlight part of a text element, with the styling saved, collaborated, rendered on canvas and kept in SVG export.

## Detected stacks

| Manifest | Stack | Frameworks |
| --- | --- | --- |
| `package.json` | node-typescript | React, Vite, Vitest, Yarn workspaces |
| `excalidraw-app/package.json` | node-typescript | React, Vite, Firebase, socket.io-client, Jotai |
| `packages/excalidraw/package.json` | node-typescript | React, esbuild, Radix UI, Jotai, roughjs |
| `examples/with-nextjs/package.json` | node-typescript | Next.js |
| `dev-docs/package.json` | node-javascript | Docusaurus (outside the workspaces, own lockfile) |

No pre-authored adapter matches, so Tier 2b ran. The profile is at `.sdlc/baseline/stack-profile.md`.

## Topology

Yarn workspaces monorepo: `excalidraw-app`, `packages/*`, `examples/*`. Packages: `common`, `element`, `excalidraw`, `fractional-indexing`, `laser-pointer`, `math`, `utils`. Also `dev-docs/`, `firebase-project/`, `public/`, `scripts/`.

Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `packages/excalidraw/index.tsx`, `packages/element/src/index.ts`.

## Test command

Proposed: `yarn test:app --watch=false`, from `package.json#scripts.test:app`. Gate 0 confirms.

- The detection rule gives `yarn test`, which is bare `vitest` and watches on a TTY. `scripts.test:all` uses the `--watch=false` form, so that is proposed instead.
- `yarn test:update` (CLAUDE.md, pre-commit step) rewrites snapshots. Do not use it as the verification command, because it would absorb regressions.
- One root Vitest config. Per-package runs use a path: `yarn test:app --watch=false packages/element`.
- Companion checks: `yarn test:typecheck`, `yarn test:code`, `yarn test:other`.

## Known baseline

From `/Users/apple/Documents/GitHub/ex-cells/EX-NF-11-baseline-check.log`, written before this run. The worktree reflog holds only `14bb42ed`, so it applies to this HEAD. Not re-run here.

- `tsc`: pass. ESLint: pass.
- Vitest: 149 of 149 files, 2,632 tests passed, 47 skipped, 1 todo. No pre-existing failures.
- `yarn test:other` (Prettier) is not in the log, so its state is unknown.
- Local Node is 24.22.1; CI uses 20.x.

## Docs

`README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` (link only), `dev-docs/README.md`, `dev-docs/docs/**`, `packages/excalidraw/CHANGELOG.md`. No ADR directories.

## Detected AI/agent setup

- `.claude/`, `.claude/settings.local.json` (gitignored, not read)
- `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`

Not found: `CLAUDE.local.md`, `.mcp.json`, Cursor, Aider, Continue, Roo, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env keys (names only)

`.env.development`, `.env.production` and `.env.test` are tracked in git. Key names are in `baseline.json`. There is no `.env` or `.env.local`.

## Repo-state risks

- **LFS:** none. `.gitattributes` holds only `* text=auto eol=lf`.
- **Submodules:** none.
- **Encrypted secrets:** none found by name or marker (git-crypt, sops, PGP, Vault). This was a pattern scan, not a secret audit.
- **Aggressive `.gitignore`:** unanchored `build`, `dist`, `html`, `logs`, `firebase`, `coverage` and `meta*.json` ignore any new path with those names at any depth. Avoid them for new files. No tracked file is currently ignored.
- **Pre-commit:** `.husky/pre-commit` has `lint-staged` commented out, so nothing enforces formatting locally.
- **Build output:** no `dist/` or `build/` on disk. Tests resolve packages from source through aliases in `vitest.config.mts`.
- **Locales:** `crowdin.yml` manages all locales from `en.json`. New strings go in `packages/excalidraw/locales/en.json` only.
- **Snapshots:** 23 `.snap` files, 3 of which contain `originalText`. A field set on every text element would churn them.
- **Regulated signals:** none.

## Coexistence risks

- **`.sdlc/` ignore state:** your `.gitignore` doesn't cover `.sdlc/`, but `.git/info/exclude` does, so `git add -A` will not stage run artifacts on this machine. No `.gitignore` edit is needed for this run. The exclude file is local and is not shared with other clones.
- **Project instructions:** `CLAUDE.md`, `AGENTS.md` and `.github/copilot-instructions.md` stay untouched, and generated code must follow them.

## Proposed off-limits

`.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/rules/**`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `.sdlc/**`, `.git/**`.

This is the group-derived list merged with `off_limits_default` from `.sdlc/project.json`. `AGENTS.md` and the two WASM files were added on judgment. Translated locale files are not listed because the list has no exclusion syntax for `en.json`; keep them out of the file scope at Gate 0.

## Seed surfaces

- **Text element type:** `packages/element/src/types.ts`
- **Creation and mutation:** `packages/element/src/newElement.ts`, `packages/element/src/mutateElement.ts`, `packages/element/src/transform.ts`, `packages/element/src/duplicate.ts`
- **Layout:** `packages/element/src/textElement.ts`, `packages/element/src/textMeasurements.ts`, `packages/element/src/textWrapping.ts`
- **Canvas rendering:** `packages/element/src/renderElement.ts`, `packages/excalidraw/renderer/staticScene.ts`
- **SVG export:** `packages/excalidraw/renderer/staticSvgScene.ts`, `packages/excalidraw/scene/export.ts`
- **WYSIWYG editor:** `packages/excalidraw/wysiwyg/textWysiwyg.tsx`, `packages/excalidraw/components/App.text.ts`, `packages/excalidraw/css/styles.scss`
- **Restore and migration:** `packages/excalidraw/data/restore.ts`, `packages/common/src/constants.ts`
- **Collab reconciliation:** `packages/excalidraw/data/reconcile.ts`, `excalidraw-app/collab/Collab.tsx`, `excalidraw-app/collab/Portal.tsx`, `excalidraw-app/data/firebase.ts`, `packages/element/src/delta.ts`
- **Other code that rewrites text or copies style:** `packages/element/src/listMarker.ts`, `packages/element/src/stickyNote.ts`, `packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/actions/actionStyles.ts`, `packages/excalidraw/actions/actionBoundText.tsx`, `packages/excalidraw/actions/actionTextAutoResize.ts`, `packages/excalidraw/components/App.clipboard.ts`, `packages/excalidraw/components/App.duplicate.ts`, `packages/excalidraw/components/ConvertElementTypePopup.tsx`
- **Docs listing element fields:** `dev-docs/docs/codebase/json-schema.mdx`, `dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx`, `dev-docs/docs/@excalidraw/excalidraw/api/utils/restore.mdx`, `packages/excalidraw/CHANGELOG.md`
- **Tests:** listed under `seed_surfaces.tests` in `baseline.json`.
