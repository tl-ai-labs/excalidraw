# Discovery: EX-FE-04 (Excalidraw monorepo)

Run: `20261104-120000-feature-extend-lasso-wrap-overlap` - mode: first-time - built 2026-11-04T17:30:28Z - plugin 0.10.1

## Git state
- HEAD `cf212b2f` ("feat(editor): eyedropper fixes and improvements (#11859)"), branch `EX-FE-04/opus55-plus-sonnet55`, working tree clean.
- This checkout is a **git worktree** (`.git` is a file). Repo root == cwd, so the write contract lives here.
- Remote: `origin` https://github.com/tl-ai-labs/excalidraw.git
- `.gitignore` does **not** cover `.sdlc/` (it does cover `.claude`). However `.git/info/exclude` (line 7, shared across this clone's worktrees) lists `.sdlc/`, so `git status` and `git add -A` already ignore it here. Verified with `git check-ignore`.

## Topology
Top level: `packages/` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `excalidraw-app/`, `examples/` (with-nextjs, with-script-in-browser), `dev-docs/` (Docusaurus, own yarn.lock), `firebase-project/`, `public/`, `scripts/`, `.github/`, `.husky/`, `.codesandbox/`.
Entry points: `packages/excalidraw/index.tsx` (library), `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`.
1267 tracked files - normal size, no sampling needed.

## Detected stacks
- `package.json` (root): **node-typescript** - React 19, Vite (app), esbuild (packages), Vitest 3 + jsdom + vitest-canvas-mock, TypeScript 5.9 strict, Yarn 1 workspaces.
- `examples/with-nextjs/package.json`: Next.js integration example (not core).
- `dev-docs/package.json`: Docusaurus docs site (not a workspace).

No pre-authored adapter matches (shipped: generic, nest, python), so the Tier 2b stack profile was built: `.sdlc/baseline/stack-profile.md`.

## Test / build commands
- Proposed test command: **`yarn test:app --watch=false`** (source: `package.json#scripts.test` -> `vitest`). Plain `yarn test` starts watch mode.
- Scoped for this run: `yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx packages/excalidraw/tests/selection.test.tsx`
- Typecheck: `yarn test:typecheck` (`tsc`). Lint: `yarn test:code`. Format: `yarn test:other`.
- CLAUDE.md says "always run `yarn test:update`" - that rewrites snapshots, so it should not be the pass/fail gate.
- Tests were **not run** during Tier 1; baseline pass/fail is unknown. Gate 0 must confirm.

## Docs
README.md, CLAUDE.md (monorepo layout, yarn commands, path aliases in `vitest.config.mts`), CONTRIBUTING.md (pointer to docs), dev-docs/ (Docusaurus), `.github/copilot-instructions.md` (coding standards). No ADR directory.

## Detected AI/agent setup
- `.claude/` with `settings.local.json` (gitignored; sets the subagent model env var only)
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- None of: `.mcp.json`, `.cursor/`, `.cursorrules`, Aider config, `.continue/`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env keys (names only)
- `.env.development`: 20 keys, `.env.production`: 15 keys, `.env.test`: `VITE_DEBUG_DOM`. All are `VITE_APP_*`, plus `MODE` and `FAST_REFRESH`. No `.env` / `.env.local` present.
- Referenced in code (`process.env` / `import.meta.env`): 24 names, all build/runtime config; no secrets-looking API keys.

## Monorepo / submodules / LFS
- Yarn workspaces (`excalidraw-app`, `packages/*`, `examples/*`); 10 workspace packages. No package defines its own `test` script, so one root Vitest run covers everything. `@excalidraw/*` imports resolve to `packages/*/src` via aliases in `vitest.config.mts` and tsconfig.
- Submodules: none. LFS: none (`.gitattributes` is only `* text=auto eol=lf`).

## Infra
Dockerfile, docker-compose.yml, vercel.json, 11 GitHub workflows (test.yml, lint.yml, size-limit.yml, test-coverage-pr.yml, ...), Husky + lint-staged pre-commit hooks.

## Regulated-repo signals
None found.

## Coexistence risks
- **`.sdlc/` not gitignored**: Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. Mitigation already in place: `.git/info/exclude` ignores `.sdlc/` in this clone, so the risk applies only to other clones.
- **Copilot instructions present** (`.github/copilot-instructions.md`): untouched. It states performance-first TypeScript guidelines that the generated code should follow.
- **Husky pre-commit hooks**: commits run lint-staged (prettier/eslint) and may reformat staged files.

## Proposed off-limits
`.env`, `.env.*` (`.env.development`, `.env.production`, `.env.test`), `.claude/**`, `.github/copilot-instructions.md`, `node_modules/**`, `dist/**`, `build/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**` (generated d.ts, gitignored), generated files `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `packages/excalidraw/fonts/Xiaolai/index.ts`, `.git/**`, `.sdlc/**`.

## Relevant to this run (lasso selection honours Wrap/Overlap)

### The preference (already exists, rectangle box-select only)
- `packages/excalidraw/types.ts:280` - `export type BoxSelectionMode = "contain" | "overlap";` and `AppState.boxSelectionMode` at `:357`.
- `packages/excalidraw/appState.ts:132` - default `boxSelectionMode: "contain"`; `:203` storage config `{ browser: true, export: false, server: false }`.
- `packages/excalidraw/data/restore.ts:1142-1145` - restored from appState/localAppState.
- `packages/excalidraw/components/main-menu/DefaultItems.tsx:443-472` - `PreferencesBoxSelectionModeItem` radio ("Select on": Wrap = `contain`, Overlap = `overlap`); mounted at `:620`, exported as `Preferences.BoxSelectionMode` at `:638`.
- `packages/excalidraw/locales/en.json:192-194` - labels `boxSelectionMode` / `boxSelectionContain` ("Wrap") / `boxSelectionOverlap` ("Overlap").

### How rectangle box selection uses it (reference behaviour)
- `packages/excalidraw/components/App.tsx:~11305-11312` - `getElementsWithinSelection(..., false, this.state.boxSelectionMode)`.
- `packages/element/src/selection.ts:72-98` - `getElementsWithinSelection` -> `elementsOverlappingBBox({ type: boxSelectionMode, ... })`.
- `packages/element/src/bounds.ts:~1269-1530` - `elementsOverlappingBBox` with `type: "contain" | "overlap"`, including bound-text label and frame special cases.

### Lasso implementation
- `packages/excalidraw/lasso/utils.ts` (143 lines) - `getLassoSelectedElementIds({ lassoPath, elements, elementsMap, elementsSegments, intersectedElements, enclosedElements, simplifyDistance })`. For each unlocked element whose AABB meets the lasso bounds, it runs `enclosureTest` and, failing that, `intersectionTest`. It returns `[...intersectedElements, ...enclosedElements]`, so **lasso today always behaves like "overlap"**. Under Wrap, only enclosed elements would be selected.
- `packages/excalidraw/lasso/index.ts` (218 lines) - `class LassoTrail extends AnimatedTrail`; `updateSelection` (~`:196`) calls the util and has `this.app.state` in scope, so `boxSelectionMode` can be read there. `selectElementsFromIds` (~`:76-150`) handles groups, frames/children and bound-text containers.
- App wiring: `packages/excalidraw/components/App.tsx:718` (`lassoTrail = new LassoTrail(this)`), plus start/add/end path calls near `:8606`, `:9507`, `:10792-10810`, `:11142-11162`, `:11456`.

### Existing tests
- `packages/excalidraw/tests/lasso.test.tsx` (1804 lines) - renders `<Excalidraw>` with **default appState** and calls `getLassoSelectedElementIds` directly through the `updatePath` helper (`:45-85`). Suites: "Basic lasso selection tests" (`:87`; e.g. "Intersects some, does not enclose/intersect the rest" `:464`, "Intersects some and encloses some" `:652`, "Single linear element" `:874`) and "Special cases" (`:920`; frames, groups).
- `packages/excalidraw/tests/selection.test.tsx` - "lasso reselection" (`:154`, UI-driven via `mouse` + `setActiveTool({ type: "lasso" })`), "box-selection overlap mode" (`:201`, uses `initialData={{ appState: { boxSelectionMode: "overlap" } }}`, which is a template for the new tests).
- `packages/element/tests/bounds.test.ts:~177` - `elementsOverlappingBBox` with `type: "overlap"`.
- `packages/excalidraw/tests/tool.test.tsx:79-100` - lasso as preferred selection tool.

### Design risk to resolve at Gate 0 / in the spec
The default `boxSelectionMode` is `"contain"` (Wrap), but lasso currently selects intersected **and** enclosed elements. If lasso follows the preference as-is, the **default lasso behaviour changes** to enclosed-only, and the existing intersection-based lasso tests (which run with default appState) are expected to fail. The spec has to choose one of three paths: (a) accept the behaviour change and update those tests to set `boxSelectionMode: "overlap"` (or pass the mode to the util), (b) give lasso its own default, or (c) map the modes differently. If the util gains a mode parameter, give it a default that keeps the direct unit-test callers compiling.
