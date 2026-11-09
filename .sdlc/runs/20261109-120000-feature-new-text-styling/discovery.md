# Discovery — 20261109-120000-feature-new-text-styling

Mode: first-time (full Tier 1 scan) · Plugin 0.10.1 · Intent hint: feature-new — colour/highlight part of a text element (saved, collaborated, rendered on canvas, kept in SVG export).

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-NF-11/opus55-plus-flash38-agsdk` (a git worktree; `.git` is a file).
- Working tree: clean.
- Remote: `origin` -> https://github.com/tl-ai-labs/excalidraw.git
- `.gitignore` exists but does **not** cover `.sdlc/` (`gitignore_covers_sdlc: false`). However `.sdlc/` **is** excluded through `/Users/sriram/excalidraw-agy/.git/info/exclude` (line 7, shared common git dir), so `git status` shows it as ignored. That exclusion is local only and not committed.

## Directory topology
Top level: `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/` (Docusaurus docs site), `examples/` (with-nextjs, with-script-in-browser), `excalidraw-app/` (excalidraw.com app: collab/, components/, data/, share/, tests/), `firebase-project/`, `packages/` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `public/`, `scripts/`.
Entry points: `packages/excalidraw/index.tsx` (library), `excalidraw-app/index.tsx` / `excalidraw-app/App.tsx` (app).
1327 tracked files — a normal-size repo, no sampling needed.

## Detected stacks
- `package.json` (root, `excalidraw-monorepo`, yarn@1.22.22 workspaces) -> **node-typescript**: React 19, Vite (app), esbuild (packages), vitest 3 + jsdom + vitest-canvas-mock, TypeScript 5.9 strict, roughjs for hand-drawn shapes.
- `examples/with-nextjs/package.json` -> Next.js example only (not a primary target).
- No pre-authored adapter matches (React/TS) -> Tier 2b stack profile written to `.sdlc/baseline/stack-profile.md`.

## Test / build commands
- Proposed: **`yarn test:app --watch=false`** (source: `package.json#scripts.test` = `yarn test:app` = `vitest`; plain `yarn test` starts watch mode, so pass `--watch=false` / use `vitest run` in automation).
- Targeted: `yarn vitest run <path>`. Type check: `yarn test:typecheck` (tsc). Lint: `yarn test:code`. Snapshots: `yarn test:update` (CLAUDE.md asks for this before committing).
- No per-package test scripts; one root `vitest.config.mts` with `@excalidraw/*` path aliases.
- Quick health check (run during discovery): restore, reconcile, textElement, textWysiwyg, export (3 suites) — 7 files, 304 passed, 1 skipped, about 10 s total. Full suite not run.

## Docs
- `README.md`, `CLAUDE.md` (monorepo layout, `yarn test:update`, `yarn test:typecheck`, `yarn fix`), `AGENTS.md` (use `app.ownerDocument` / `app.ownerWindow` rather than DOM globals; prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types`), `CONTRIBUTING.md` (link to the docs), `dev-docs/docs/` (docs site), `packages/excalidraw/CHANGELOG.md` (has an "Unreleased" section; new features go at the top under the right section, with a PR link).
- No ADR directory.

## Detected AI/agent setup
- `CLAUDE.md` (project instructions) and `AGENTS.md` (agent guidelines) at repo root.
- No `.claude/` dir in this worktree (`.claude` is in `.gitignore`), no `.mcp.json`, `.cursor/`, `.cursorrules`, Aider, Continue, Roo, Copilot instructions, `routing-policy.yaml`, or `gemini*.{yaml,json}`.

## Env files (key names only)
- `.env.development` (20 keys), `.env.production` (15 keys), `.env.test` (`VITE_DEBUG_DOM`). All are committed Vite build config (`VITE_APP_*`), not secrets. Code reads `import.meta.env.*` / `process.env.*` (for example `VITE_APP_WS_SERVER_URL`, `VITE_APP_FIREBASE_CONFIG`). None matter for this intent.

## Monorepo / submodules / LFS / infra
- Monorepo: yarn workspaces (`excalidraw-app`, `packages/*`, `examples/*`). No nx/turbo/lerna/pnpm.
- Submodules: none. Git-LFS: none (`.gitattributes` = `* text=auto eol=lf`).
- Infra: Dockerfile, docker-compose.yml, 12 GitHub workflows (test, lint, size-limit, stats, and others), vercel.json, firebase-project/. Husky + lint-staged pre-commit hooks.

## Regulated-repo signals
None found.

## Intent map — partial text colour / highlight
| Concern | Files |
|---|---|
| Element type | `packages/element/src/types.ts` — `ExcalidrawTextElement` (~L253): `text`, `originalText`, `fontSize`, `fontFamily`, `textAlign`, `verticalAlign`, `containerId`, `autoResize`, `lineHeight`, `labelPosition`, `baseFontSize`; colour is the element-wide `strokeColor` from the base. |
| Creation / layout | `packages/element/src/newElement.ts` (`newTextElement` ~L337), `textElement.ts`, `textMeasurements.ts`, `textWrapping.ts` (wrapping changes `text` compared with `originalText`, so range offsets must account for wrapping), `typeChecks.ts`, `mutateElement.ts` |
| Canvas render | `packages/element/src/renderElement.ts` — text branch ~L660-715 draws each line with a single `context.fillText` in `strokeColor`; results cached per element object in `elementWithCanvasCache` (WeakMap). Also `packages/excalidraw/renderer/staticScene.ts`. |
| SVG export | `packages/excalidraw/renderer/staticSvgScene.ts` — text branch ~L779-845: one `<text>` per line with a single `fill` (would need `<tspan>`s plus highlight `<rect>`s); `packages/excalidraw/scene/export.ts` (`exportScene` -> `renderSceneToSvg`). |
| WYSIWYG editor | `packages/excalidraw/wysiwyg/textWysiwyg.tsx` — a **plain `<textarea>`** (~L533), so it cannot show styled ranges; selection offsets come from `selectionStart/End`. Opened from `packages/excalidraw/components/App.text.ts` (~L281). CSS in `packages/excalidraw/css/styles.scss`. |
| Styling actions / UI | `packages/excalidraw/actions/actionProperties.tsx` (`actionChangeStrokeColor` ~L366, uses `resolveColorTarget` from `actions/colorTargets.ts`; sticky-note label/ink sync), `actions/actionStyles.ts` (copy/paste styles), `actions/register.ts`, `actions/index.ts` |
| Restore / validation | `packages/excalidraw/data/restore.ts` — `case "text"` ~L555 via `restoreElementWithProperties` (new fields need defaulting/sanitising here); `packages/excalidraw/data/json.ts` (`serializeAsJSON`) |
| Collab / versioning | `packages/excalidraw/data/reconcile.ts` (whole-element last-writer-wins on `version`, tie-break on the lower `versionNonce`; no per-property merge); `mutateElement.ts` / `newElementWith` bump `version` + `versionNonce`; `packages/element/src/delta.ts` + `store.ts` (undo/redo deltas; nested arrays compare by reference); `excalidraw-app/collab/Collab.tsx`, `Portal.tsx`, `excalidraw-app/data/index.ts`, `firebase.ts` |
| Tests | `packages/element/tests/` (textElement, textWrapping, newElement, delta), `packages/element/src/__tests__/`, `packages/excalidraw/tests/` (+ `data/restore.test.ts`, `data/reconcile.test.ts`, `scene/export.test.ts`, `export.test.tsx`, `history.test.tsx`, `actionStyles.test.tsx`, `colorTargets.test.ts`, `clipboard.test.tsx`), `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`, `packages/excalidraw/actions/actionProperties.test.tsx`, `packages/utils/tests/export.test.ts`, `excalidraw-app/tests/collab.test.tsx`. Snapshot files (`__snapshots__`) are likely to change when a new text field is added. |

## Coexistence risks
- **`.sdlc/` not gitignored** (lower risk here: `.git/info/exclude` already ignores `.sdlc/` locally, so `git add -A` will not pick it up in this clone; it would on a fresh clone) — "Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run."
- **CLAUDE.md / AGENTS.md present** — project guidance for agents. Untouched by default; its conventions (`yarn test:update`, `Merge<>`, `app.ownerDocument`) should feed the change spec.
- **Husky pre-commit (lint-staged)** — commits run prettier/eslint on staged files and may rewrite formatting.
- **Snapshot-heavy tests** — adding a field to `ExcalidrawTextElement` will probably change many `__snapshots__` files (CLAUDE.md asks for `yarn test:update`). The file-scope allowlist should include the relevant `__snapshots__/*.snap` files, or the run should expect snapshot failures.

## Proposed off-limits
`.env`, `.env.*`, `.claude/**`, `.mcp.json`, `.cursor/**`, `CLAUDE.md`, `AGENTS.md`, `node_modules/**`, `dist/**`, `build/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**` (generated), `.git/**`, `.husky/_/**`, `yarn.lock`.
