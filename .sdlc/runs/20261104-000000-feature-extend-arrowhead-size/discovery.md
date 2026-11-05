# Discovery — run 20261104-000000-feature-extend-arrowhead-size

Mode: first-time (Tier 1). Plugin mmo 0.9.3. Scan completed well within timebox.

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on `EX-FE-09/opus55-only` (git worktree; common dir `/Users/macbook/Desktop/Work/AI studies TL/excalidraw/.git`)
- Working tree: clean
- Remote: origin -> https://github.com/tl-ai-labs/excalidraw.git
- `gitignore_covers_sdlc: false` — `.gitignore` has no `.sdlc` entry; `.sdlc/` is ignored only via the shared `.git/info/exclude`.

## Topology
Top-level: `.codesandbox`, `.github`, `.husky`, `dev-docs`, `examples`, `excalidraw-app`, `firebase-project`, `packages`, `public`, `scripts`. 1327 tracked files.
- `packages/`: common, element, excalidraw, fractional-indexing, laser-pointer, math, utils
- `excalidraw-app/`: app-language, collab, components, data, share, tests
- Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `packages/excalidraw/index.tsx`

## Detected stacks
- `package.json` — node-typescript, React 19, Vite (app), esbuild (packages), Vitest; Yarn 1.22.22 workspaces
- `examples/with-nextjs/package.json` — Next.js example (example only)
- `dev-docs/package.json` — Docusaurus docs site (not in root workspaces)
- No pre-authored adapter matches (available: generic, nest, python) -> Tier 2b adaptive stack profile is required.

## Test command
- Proposed: `yarn test:app --watch=false` (from `package.json#scripts.test` = `yarn test:app` = `vitest`, watch by default)
- Also relevant: `yarn test:update` (CLAUDE.md: run before committing; updates snapshots), `yarn test:typecheck` (tsc), `yarn test:all`
- Gate 0 must confirm.

## Docs
README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md (points to docs site), `.github/copilot-instructions.md`, `dev-docs/docs/`. No ADR directories.

## Detected AI/agent setup
- `CLAUDE.md` (claude-instructions)
- `AGENTS.md` (agents-instructions: use `app.ownerDocument`/`app.ownerWindow`; prefer `Merge<Base, Overrides>`)
- `.github/copilot-instructions.md` (copilot)
- None of: `.claude/`, `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `routing-policy.yaml`, gemini configs.

## Env keys (names only)
- `.env.development` (20 keys), `.env.production` (15), `.env.test` (1: VITE_DEBUG_DOM). All three are tracked in git. Values not read.
- Code references include VITE_APP_* keys plus CI vars (GITHUB_*, OSS_STATS_*, PR_TITLE, RUNNER_NAME) and PKG_NAME/PKG_VERSION/IS_PREACT.

## Monorepo / submodules / LFS
- Yarn workspaces: `excalidraw-app`, `packages/*`, `examples/*`. No per-package test scripts; root vitest config covers all.
- Submodules: none. LFS: none (`.gitattributes` is only `* text=auto eol=lf`).

## Infra hints
Dockerfile, docker-compose.yml, `.github/workflows/` (12 workflows), vercel.json, firebase-project/, Husky + lint-staged.

## Regulated-repo signals
None detected.

## Coexistence risks
- Copilot instructions at `.github/copilot-instructions.md` — untouched by default.
- Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. (Currently mitigated by the shared `.git/info/exclude` entry, which is local to this machine.)
- Husky pre-commit runs lint-staged on commit.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.claude/**`, `.mcp.json`, `.cursor/**`, `.sdlc/**`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `dev-dist/**`, generated wasm wrappers (`packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`), `yarn.lock`, `.git/**`.

## Scope hints for intent (arrowhead size)
- `packages/element/src/types.ts` — `Arrowhead` type; `startArrowhead`/`endArrowhead` on arrow element base (~L356-376)
- `packages/element/src/newElement.ts` — `newLinearElement`/`newArrowElement` defaults (~L636-685)
- `packages/element/src/bounds.ts` — `getArrowheadSize` (L727), `getArrowheadAngle`, `getArrowheadPoints` (L992): geometry
- `packages/element/src/shape.ts` — `getArrowheadShapes` renders heads via rough.js
- `packages/element/src/renderElement.ts` — canvas render path for arrows
- `packages/element/src/transform.ts` — skeleton transform uses `getArrowheadSize` for margins
- `packages/excalidraw/data/restore.ts` — `normalizeArrowhead` in restoreElement (~L630-707); `restoreAppState` (L1268)
- `packages/excalidraw/actions/actionProperties.tsx` — `actionChangeArrowhead` (L1960), `actionChangeArrowProperties` (L2058)
- `packages/excalidraw/actions/types.ts` — `ActionName` union (L74)
- `packages/excalidraw/components/Actions.tsx` — panel renders `changeArrowhead` (L189), `changeArrowProperties` (L395)
- `packages/excalidraw/types.ts` / `packages/excalidraw/appState.ts` — `currentItem*Arrowhead` app-state + storage config
- `packages/excalidraw/components/App.tsx` (~L8626), `App.drawshape.ts`, `ConvertElementTypePopup.tsx`, `packages/element/src/flowchart.ts`, `convertToShape.ts` — arrow creation from currentItem state
- `packages/excalidraw/actions/actionStyles.ts` — copy/paste styles copies arrowheads
- `packages/excalidraw/locales/en.json` — `labels.arrowheads` and `arrowhead_*` strings (L52-70)
- `packages/excalidraw/tests/helpers/api.ts` — `API.createElement` arrowhead options
- Snapshots listing element/appState props: `packages/excalidraw/tests/__snapshots__/{dragCreate,history,move,multiPointCreate,regressionTests,selection,contextmenu}.test.tsx.snap`, `packages/excalidraw/tests/data/__snapshots__/restore.test.ts.snap`, `packages/element/src/__tests__/__snapshots__/transform.test.ts.snap`, `packages/utils/tests/__snapshots__/utils.test.ts.snap`, `packages/excalidraw/tests/packages/__snapshots__/utils.test.ts.snap`
