# Discovery — 20261104-211345-feature-extend-arrowhead-size

Mode: first-time (full Tier 1 scan). Built 2026-11-04T15:45:18Z. Plugin mmo 0.10.1.
Intent hint: feature-extend — "Let users choose the size of an arrow's heads through a new per-element property and a properties-panel control."

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-FE-09/opus55-plus-sonnet55` (main branch: `master`)
- Working tree: clean (`dirty: false`)
- Remote: `origin` -> https://github.com/tl-ai-labs/excalidraw.git
- This checkout is a **git worktree** (gitdir `/Users/apple/Documents/GitHub/excalidraw/.git/worktrees/EX-FE-09`). Git toplevel == cwd, so the write contract applies here.
- 1,327 tracked files (normal-size repo; no sampling needed).
- `gitignore_covers_sdlc: false` — `.gitignore` has no `.sdlc` line, **but** `.sdlc/` is ignored through the parent repo's `.git/info/exclude` (line 7), so `git add -A` will not pick it up in this worktree or any sibling worktree of the same repo.

## Directory topology
Top level: `.claude/`, `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/`, `examples/`, `excalidraw-app/`, `firebase-project/`, `packages/`, `public/`, `scripts/`.
`packages/`: `common`, `element`, `excalidraw`, `fractional-indexing`, `laser-pointer`, `math`, `utils`.
Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `packages/excalidraw/index.tsx`, `packages/{element,common,math,utils}/src/index.ts`.

## Detected stacks
- Root `package.json` (`excalidraw-monorepo`, yarn@1.22.22): TypeScript 5.9, React 19, Vite 5, Vitest 3, ESLint, Prettier.
- `packages/excalidraw` — React library (jotai, roughjs, perfect-freehand, radix-ui); built with esbuild.
- `excalidraw-app` — Vite + React app (firebase, sentry, socket.io).
- `examples/with-nextjs` — Next.js example; `dev-docs/` — Docusaurus site (own yarn.lock, outside workspaces).
- No pre-authored adapter matches (shipped: generic, nest, python). **Tier 2b adaptive stack profile is triggered** (React/TypeScript) but was not run in this Tier 1 pass; no `.sdlc/baseline/stack-profile.md` exists yet.

## Monorepo
Yarn workspaces: `excalidraw-app`, `packages/*`, `examples/*`. Internal packages resolve through path aliases in root `vitest.config.mts` / `tsconfig.json`. One root vitest config runs every package's tests. Run a single file with `yarn test:app --watch=false <path>`.

## Test / build commands
- **Proposed: `yarn test:update`** (`vitest --update --watch=false`). CLAUDE.md says to run it before committing.
- Also: `yarn test:typecheck` (`tsc`), which CLAUDE.md lists for type safety.
- Other options: `yarn test:app --watch=false` (no snapshot rewrite), `yarn test:code` (eslint, max-warnings 0), `yarn test:all`.
- Caution: plain `yarn test` starts vitest in **watch mode**. `test:update` rewrites snapshots without asking, so unintended snapshot diffs get through. Suggest running `yarn test:app --watch=false` first, then `test:update` after reviewing the snapshot changes. Gate 0 must confirm this.

## Docs
`README.md`, `CLAUDE.md`, `AGENTS.md` (use `app.ownerDocument`/`ownerWindow`; prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types`), `CONTRIBUTING.md` (links to docs site), `dev-docs/` (Docusaurus). No ADR directories.

## Detected AI/agent setup
- `CLAUDE.md` (project instructions)
- `AGENTS.md`
- `.claude/` with `settings.local.json` (`.claude` is gitignored)
- `.github/copilot-instructions.md` (coding standards: prefer immutable data, optional chaining, performance over allocation)
- Not found: `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `CLAUDE.local.md`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env files (key names only)
- `.env.development`: 20 keys (VITE_APP_* backend/library/WS/firebase/plus URLs, flags, MODE, FAST_REFRESH)
- `.env.production`: 15 keys (subset of the above)
- `.env.test`: VITE_DEBUG_DOM
- Code references: `process.env.*` mainly in CI/scripts (GITHUB_*, OSS_STATS_*, PR_TITLE, RUNNER_NAME, IS_PREACT, VITE_DEBUG_DOM). `import.meta.env.*` uses the VITE_APP_* keys. None of them matter for this intent.

## Repo-state risks
- Submodules: none (no `.gitmodules`).
- Git LFS: none (`.gitattributes` is only `* text=auto eol=lf`).
- Dirty tree: no, the tree is clean.
- Worktree: the git stash stack is shared with the main checkout and sibling worktrees. Rollback anchors should use commits or refs, not bare `git stash`.
- Husky: `.husky/pre-commit` exists but its `yarn lint-staged` line is commented out, so it does nothing.
- Infra: Dockerfile, docker-compose.yml, 12 GitHub workflows (including test.yml, lint.yml, size-limit.yml, test-coverage-pr.yml), vercel.json, firebase-project/.

## Regulated-repo signals
None found.

## Coexistence risks
- You have CLAUDE.md, AGENTS.md and `.github/copilot-instructions.md`. The plugin will never modify them. Their conventions (Merge<> over Omit&, ownerDocument usage, immutable/perf-first TS) should flow into the change spec.
- `.claude/settings.local.json` is present. It stays untouched.
- Your `.gitignore` doesn't cover `.sdlc/`. In this checkout the parent repo's `.git/info/exclude` already ignores `.sdlc/`, so it is not visible to `git add -A` here. That protection is local and does not travel with clones. Gate 0 may offer to add `.gitignore` to this run's allowlist so the plugin can add the entry as part of the run. This is optional here, since the files are already excluded.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `node_modules/**`, `dist/**`, `build/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**` (generated, gitignored), `.git/**`, `.sdlc/**`.

## Relevant code for this intent

### Element types
- `packages/element/src/types.ts` — `Arrowhead` / `CardinalityArrowhead` / `ArrowheadLegacy` unions (~l.342-367). `ExcalidrawLinearElement` holds `startArrowhead` / `endArrowhead: Arrowhead | null` (~l.369-377). `ExcalidrawArrowElement` (`elbowed`) and `ExcalidrawElbowArrowElement` (uses `Merge<>`). A new per-element property (e.g. `arrowheadSize`, or separate start/end sizes) belongs here.

### Arrowhead geometry and rendering
- `packages/element/src/bounds.ts`
  - size constants `CARDINALITY_MARKER_SIZE = 20`, `CROWFOOT_ARROWHEAD_SIZE = 15`, `CARDINALITY_*_OFFSET/SCALE` (~l.716-724)
  - `getArrowheadSize(arrowhead)` (l.727): per-type base px (arrow 25, diamond 12, cardinality 15/20, default 15)
  - `getArrowheadAngle(arrowhead, size)` (l.754) with `ARROW_ARROWHEAD_ANGLE / WIDEST_ANGLE / WIDEST_SIZE` (l.747-751)
  - cardinality helpers and `getArrowheadSizeBeyondLastSegment` (~l.851-990)
  - `getArrowheadPoints(element, shape, position, arrowhead)` (l.992): reads size at ~l.1058, then scales it down by segment length
- `packages/element/src/shape.ts` — `getArrowheadShapes` (l.401) calls `getArrowheadPoints` for every arrowhead kind. Shape generation for linear elements is at ~l.999-1020.
- `packages/element/src/arrowheads.ts` — `normalizeArrowhead`, `getArrowheadForPicker` (legacy name mapping).
- `packages/element/src/renderElement.ts` — `getCanvasPadding` (l.105-119) uses a fixed 40px for arrows with heads. **Existing bug:** it checks `element.endArrowhead || element.endArrowhead`, so `startArrowhead` is never consulted. Larger heads will need padding that scales with the arrowhead size.
- `packages/element/src/elbowArrow.ts` — routing reserves room using `getArrowheadSize(arrow.startArrowhead/endArrowhead)` (~l.1493-1498).
- `packages/element/src/transform.ts` — skeleton label margin uses `getArrowheadSize` (~l.657-672). It sets the default `endArrowhead: "arrow"` (~l.741).
- `packages/element/src/binding.ts` (~l.2178): start/end has-arrowhead checks.

### Properties panel
- `packages/excalidraw/actions/actionProperties.tsx` — `actionChangeArrowhead` (l.1960-2056): `IconPicker` for start/end, `changeProperty`, sets `currentItemStart/EndArrowhead`. `actionChangeArrowProperties` (l.2058) and `actionChangeArrowType` (l.2077) sit next to it. Templates for a size control: `actionChangeStrokeWidth` (l.716, ButtonIconSelect), `actionChangeFontSize` (l.1007, S/M/L/XL), `actionChangeOpacity` (l.964, Range).
- `packages/excalidraw/actions/types.ts` (l.74) — the `ActionName` union. A new action name must be added here.
- `packages/excalidraw/components/Actions.tsx` (l.189) — `{predicates.arrowheads && renderAction("changeArrowhead")}`. This is where the new control is rendered.
- `packages/excalidraw/actions/actionStyles.ts` (l.190-191) — copy/paste styles copies start/endArrowhead. The new property should be copied there too.
- `packages/excalidraw/components/icons.tsx` — icons for the picker.
- `packages/excalidraw/locales/en.json` (l.52-61) — `labels.arrowheads` and the `arrowhead_*` strings. New labels go here (en.json only; Crowdin handles the other locales).

### Creation, restore and app-state defaults
- `packages/element/src/newElement.ts` — `newLinearElement` (l.623, `startArrowhead: null, endArrowhead: null`) and `newArrowElement` (l.652, opts.startArrowhead/endArrowhead/elbowed).
- `packages/excalidraw/data/restore.ts` — linear and arrow restore at ~l.630-720 (`normalizeArrowhead`). The template for validating a new enum-like property is `restoreStrokeVariability` + `ALLOWED_STROKE_VARIABILITIES` (~l.252-265).
- `packages/excalidraw/appState.ts` — `currentItemStartArrowhead` / `currentItemEndArrowhead` defaults (l.39, 46) and storage config (l.175, 196). A `currentItem<ArrowheadSize>` entry needs both.
- `packages/excalidraw/types.ts` (l.464-465) — the `AppState` fields.
- Creation call sites that pass appState arrowheads: `packages/excalidraw/components/App.tsx` (~l.8626-8629), `App.drawshape.ts` (~l.200), `packages/element/src/flowchart.ts` (l.376), `packages/element/src/convertToShape.ts` (l.651), `packages/excalidraw/components/ConvertElementTypePopup.tsx` (~l.900-915).
- Element skeleton API: `packages/element/src/transform.ts` (`ExcalidrawElementSkeleton`), also used by `App.clipboard.ts`.
- **Closest prior pattern:** `strokeVariability` (commit cd514d72, freedraw per-element property). It touched types.ts, restore.ts, appState.ts, types.ts (AppState), actionProperties.tsx, App.tsx, icons.tsx, restore.test.ts and freedrawMode.test.tsx.

### Tests and snapshots likely to change
- Unit tests: `packages/element/tests/bounds.test.ts`, `packages/element/tests/shape.test.ts`, `packages/element/tests/newElement.test.ts`, `packages/element/src/__tests__/transform.test.ts` (uses `getArrowheadSize("arrow")`), `packages/excalidraw/tests/data/restore.test.ts`, `packages/excalidraw/actions/actionFlip.test.tsx`, `packages/element/tests/elbowArrow.test.tsx`, `packages/element/tests/linearElementEditor.test.tsx`, `packages/excalidraw/tests/lasso.test.tsx`. Test helper: `packages/excalidraw/tests/helpers/api.ts`.
- Snapshots that embed arrow element props (count of `Arrowhead` mentions): `packages/excalidraw/tests/__snapshots__/history.test.tsx.snap` (182), `regressionTests.test.tsx.snap` (122), `packages/element/src/__tests__/__snapshots__/transform.test.ts.snap` (30), `packages/excalidraw/tests/data/__snapshots__/restore.test.ts.snap` (8), `selection.test.tsx.snap`, `multiPointCreate.test.tsx.snap`, `dragCreate.test.tsx.snap` (4 each), `move.test.tsx.snap` (2). Adding a field to every linear/arrow element (and to appState) will rewrite these. The appState snapshots in history/regression will change too if a `currentItem*` field is added.

## Notes
- The scan finished well within the timebox. No sampling was needed.
- Tier 2b (stack profile) is recommended for React/TS before the architect writes the change spec.
