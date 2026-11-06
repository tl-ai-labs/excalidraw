# Discovery — 20261106-120000-feature-extend-lasso-wrap-overlap

Mode: first-time. Built 2026-11-06T09:04:19Z. Plugin mmo 0.10.1. Intent: feature-extend.

## Git state
- HEAD `cf212b2f3354c09bd6f960b53a9cfb0a3ecbfa58` on `EX-FE-04/argon4-plus-sonnet55`, working tree clean.
- Remote `origin` -> https://github.com/tl-ai-labs/excalidraw.git
- This is a **git worktree** (`.git` is a file pointing at `/Users/apple/Documents/GitHub/excalidraw/.git/worktrees/EX-FE-041`). Toplevel == cwd. Stash stack is shared with other worktrees.
- 1267 tracked files (no sampling needed).
- `.gitignore` does **not** cover `.sdlc/` (`gitignore_covers_sdlc: false`), but `.sdlc/` is ignored locally via `/Users/apple/Documents/GitHub/excalidraw/.git/info/exclude` line 7, so `git add -A` will not stage run artifacts in this clone.

## Topology
Yarn-workspaces monorepo: `excalidraw-app/`, `packages/{common,element,excalidraw,fractional-indexing,laser-pointer,math,utils}`, `examples/{with-nextjs,with-script-in-browser}`, plus `dev-docs/`, `public/`, `scripts/`, `firebase-project/`.
Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `packages/excalidraw/index.tsx`, `packages/*/src/index.ts`.

## Detected stacks
- `package.json` (root): node-typescript; React 19, Vite 5, Vitest 3, TypeScript 5.9, Yarn 1.22 workspaces.
- `packages/excalidraw/package.json`: React component library.
- `excalidraw-app/package.json`: React + Vite app (socket.io-client).
- `examples/with-nextjs/package.json`: Next.js example.
No pre-authored adapter matches (shipped: generic, nest, python) -> **Tier 2b adaptive stack profile is triggered** but not built here; `.sdlc/baseline/stack-profile.md` does not exist yet.

## Test command
- Proposed: `yarn test` (source `package.json#scripts.test` -> `yarn test:app` -> `vitest`; `yarn.lock` present). Note it runs in watch mode unless `--watch=false`.
- Recommended non-watch form: `yarn test:app --watch=false`.
- Targeted for this job: `yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx packages/excalidraw/tests/selection.test.tsx packages/element/tests/bounds.test.ts`
- CLAUDE.md asks for `yarn test:update` before committing and `yarn test:typecheck` (tsc) for types.
- No per-package `scripts.test`; one root `vitest.config.mts` with path aliases into `packages/*/src`.
Gate 0 must confirm.

## Docs present
README.md, CLAUDE.md, CONTRIBUTING.md, dev-docs/README.md, .github/copilot-instructions.md. No ADR dirs.

## Detected AI/agent setup
- `.claude/` with `.claude/settings.local.json` (gitignored)
- `CLAUDE.md`
- `.github/copilot-instructions.md`
None of: `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `CLAUDE.local.md`, `AGENTS.md`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env keys (names only)
Files: `.env.development` (20 keys), `.env.production` (15 keys), `.env.test` (1 key) — all tracked, all `VITE_APP_*`/`MODE`/`FAST_REFRESH`/`VITE_DEBUG_DOM`. Code references `import.meta.env.*`/`process.env.*` names listed in baseline.json. Irrelevant to this job.

## Monorepo / submodules / LFS / infra
- Monorepo: yarn-workspaces (10 packages).
- Submodules: none. LFS: none (`.gitattributes` is `* text=auto eol=lf`).
- Infra: Dockerfile, docker-compose.yml, `.github/workflows/` (test.yml, lint.yml, test-coverage-pr.yml, size-limit.yml, ...), vercel.json, firebase-project/.
- Husky + lint-staged pre-commit hooks.

## Regulated-repo signals
None.

## Coexistence risks
- Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run.
- `.github/copilot-instructions.md` and `.claude/` are present; the plugin leaves them untouched.
- Husky/lint-staged runs on commit; a commit by the pipeline will trigger prettier/eslint hooks.
- Git worktree: stash stack shared with sibling worktrees; avoid bare `git stash`.

## Proposed off-limits
`.env`, `.env.*`, `.claude/**`, `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/**`, `**/node_modules/**`, `**/dist/**`, `**/build/**`, `.next/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, generated wasm wrappers `packages/excalidraw/subset/{harfbuzz/harfbuzz-wasm.ts,woff2/woff2-wasm.ts}`, `.git/**`, `.sdlc/**`.

## Job-relevant code map (lasso honouring Wrap/Overlap)

### Preference (box selection mode)
- Type: `packages/excalidraw/types.ts:280` `export type BoxSelectionMode = "contain" | "overlap";`; AppState field at `:357` (`boxSelectionMode`, default "contain").
- Default: `packages/excalidraw/appState.ts:132` (`"contain"`); storage config `:203` (browser-persisted, not exported).
- Restore: `packages/excalidraw/data/restore.ts:1142-1146`.
- UI: `packages/excalidraw/components/main-menu/DefaultItems.tsx:443-473` (`PreferencesBoxSelectionModeItem`, labels "Select on" / "Wrap" / "Overlap" in `packages/excalidraw/locales/en.json:192-194`), wired at `:620`, `:638`.

### Box selection consumer
- `packages/excalidraw/components/App.tsx:11305-11313` calls `getElementsWithinSelection(..., false, this.state.boxSelectionMode)`.
- `packages/element/src/selection.ts:70-99` `getElementsWithinSelection` -> `elementsOverlappingBBox({ type: boxSelectionMode })`.
- `packages/element/src/bounds.ts:~1278-1550` `elementsOverlappingBBox`: step 1 wrap (`boundsContainBounds`) always selects; steps 2-3 only for `"overlap"` (label AABB + outline intersection); group post-processing `:1525-1548` (overlap = expand to whole group; contain = drop partially-contained groups).

### Lasso
- `packages/excalidraw/lasso/utils.ts:22-90` `getLassoSelectedElementIds` — no mode parameter. Selects an element if `enclosureTest` (`:92-108`, true if ANY segment point of the element lies inside the lasso polygon) or `intersectionTest` (`:110-143`, lasso edges hit the element outline or its bound text). So today's lasso is effectively **overlap** semantics.
- `packages/excalidraw/lasso/index.ts` `LassoTrail`: `updateSelection` (`:172-209`) calls `getLassoSelectedElementIds` at `:197-205` (has `this.app.state` available — natural place to pass `boxSelectionMode`); `selectElementsFromIds` (`:90-162`) handles bound text -> container, frame children removal, `selectGroupsForSelectedElements` (expands any group member to the whole group).
- App wiring: `App.tsx:422` import, `:718` instance, start paths `:8606-8611`, `:9507`, `:11142`, add points `:11162-11166`, end `:4374`, `:10810`, `:11160`, `:11456`.

### Existing tests
- `packages/excalidraw/tests/lasso.test.tsx` (1804 lines): helper `updatePath` (`:45-85`) calls `getLassoSelectedElementIds` directly with no mode; suites "Basic lasso selection tests" (`:87`, incl. "Intersects some..." `:464`, "Intersects some and encloses some" `:652`) and "Special cases" (`:920`, frames `:921`, groups `:1196`).
- `packages/excalidraw/tests/selection.test.tsx`: "box-selection" `:62` (contain default), "lasso reselection" `:154`, "box-selection overlap mode" `:201` (sets mode via `initialData={{ appState: { boxSelectionMode: "overlap" } }}` at `:253`), "inner box-selection" `:789`. Snapshot `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap`.
- `packages/element/tests/bounds.test.ts:166-200` `elementsOverlappingBBox()` overlap vs contain.

### Design risks for this job
- Default `boxSelectionMode` is `"contain"`, but lasso currently behaves as overlap. Making lasso honour the preference with the existing default changes default lasso behaviour and will break existing expectations in `lasso.test.tsx` (intersect-only cases, partial group selection at `:1196`) unless the tests pin `"overlap"` or the helper passes a mode. Gate 0 / architect must decide.
- "Contain" for lasso needs a full-enclosure test (all segment points inside the polygon, plus bound text / arrow labels) instead of the current any-point test; group handling must match box mode (contain = all members enclosed; `selectGroupsForSelectedElements` in `LassoTrail.selectElementsFromIds` currently expands partial groups).
- `getLassoSelectedElementIds` caches `enclosedElements`/`intersectedElements` sets across moves; with contain semantics an element must be able to leave the selection as the path grows (sets are cleared each call at `:49-50`, so OK).
- Frame clipping, locked elements and bound-text exclusion differ between the two paths (box uses `shouldIgnoreElementFromSelection` = locked || bound-to-container; lasso filters only locked and maps bound text to container later).
