# Discovery — 20261106-101158-feature-extend-arrowhead-size

Mode: first-time (full Tier 1 scan) plus Tier 2b stack profile. Built 2026-11-06. Plugin 0.10.1.

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-FE-09/opus55-plus-flash38-v2`, working tree clean.
- Remote `origin` = https://github.com/tl-ai-labs/excalidraw.git
- This is a **git worktree** (gitdir `/Users/macbook/Documents/GitHub/excalidraw/.git/worktrees/EX-FE-09`). The toplevel matches cwd.
- 1327 tracked files (not a very large repo, so no sampling needed).
- `.gitignore` does not list `.sdlc/`, but the shared `.git/info/exclude` has `.sdlc/`, so run artifacts are already ignored.

## Topology
Top level: `packages/` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `excalidraw-app/`, `examples/` (with-nextjs, with-script-in-browser), `dev-docs/`, `firebase-project/`, `public/`, `scripts/`, `.github/`, `.husky/`, `.claude/`, `.codesandbox/`.
Entry points: `excalidraw-app/index.tsx`, `packages/excalidraw/index.tsx`, `packages/element/src/index.ts`.

## Detected stacks
- `package.json` → node-typescript: React 19 types, Vite 5, Vitest 3, TypeScript 5.9 (strict), yarn 1 workspaces, jotai, roughjs, radix-ui.
- `examples/with-nextjs/package.json` → Next.js example (not relevant to this intent).
- No pre-authored adapter matches React/TS. Tier 2b ran: see `.sdlc/baseline/stack-profile.md`.

## Test command
- Proposed: `yarn test:app --watch=false` (`scripts.test` = `yarn test:app` = `vitest`; without `--watch=false` vitest stays in watch mode).
- CLAUDE.md asks for `yarn test:update` before committing (vitest with `--update`) and `yarn test:typecheck` (`tsc`).
- Targeted: `yarn vitest run packages/element/tests/bounds.test.ts` and similar.
- **Gate 0 must confirm.** The pre-check status recorded the test probe as skipped.

## Docs
README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md (link only), dev-docs/README.md, per-package READMEs, dev-docs/docs/codebase/json-schema.mdx. No ADR directory.

## Detected AI/agent setup
- `.claude/settings.local.json` (sets only `env.CLAUDE_CODE_SUBAGENT_MODEL`). `.claude` is gitignored.
- `CLAUDE.md` describes the monorepo layout and commands.
- `AGENTS.md` has two rules: use `app.ownerDocument`/`app.ownerWindow` rather than globals for new DOM APIs, and prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<>&`.
- `.github/copilot-instructions.md` has coding standards: be terse, use TS, prefer immutable/readonly, use `?.`/`??`, prefer performance.
- None found: `.mcp.json`, `.cursor*`, `.aider*`, `.continue/`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env keys (names only)
- `.env.development`: 20 keys (VITE_APP_* plus MODE, FAST_REFRESH)
- `.env.production`: 15 keys
- `.env.test`: VITE_DEBUG_DOM
- All are committed, non-secret Vite build config. None is relevant to this intent.

## Monorepo / submodules / LFS
- Yarn workspaces: `excalidraw-app`, `packages/*`, `examples/*`. The packages have no test script of their own. A single root `vitest.config.mts` aliases `@excalidraw/*` to the `src/` folders.
- No submodules (`.gitmodules` absent). No LFS (`.gitattributes` only sets `* text=auto eol=lf`).
- Infra: Dockerfile, docker-compose.yml, vercel.json, firebase-project/, 11 GitHub workflows (test.yml, lint.yml, size-limit.yml, etc.).
- Husky pre-commit is a no-op (lint-staged is commented out).

## Regulated-repo signals
None (no SECURITY/PRIVACY/COMPLIANCE docs, no CODEOWNERS).

## Coexistence risks
- `.claude/settings.local.json` and the CLAUDE.md, AGENTS.md and copilot-instructions files stay untouched. Their rules should be carried into the change spec's conventions.
- `.sdlc/` is not in `.gitignore`, but the shared `.git/info/exclude` already ignores it, so `git add -A` is safe. There is no need to put `.gitignore` in the allowlist.
- No Cursor, Aider or MCP configs and no repo-local routing policy.

## Proposed off-limits
`.env`, `.env.*`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `**/node_modules/**`, `**/dist/**`, `**/build/**`, `.next/**`, `packages/excalidraw/types/**` (generated, gitignored), `dev-dist/**`, `coverage/**`, `.sdlc/**`, `.git/**`.

## Intent code map — arrowhead size (feature-extend)
Line numbers are at HEAD 14bb42ed.

**Size and geometry (packages/element/src/bounds.ts)**
- 716-717: `CARDINALITY_MARKER_SIZE = 20`, `CROWFOOT_ARROWHEAD_SIZE = 15`
- 727-745: `getArrowheadSize(arrowhead)` gives the base pixel size per type (arrow 25, diamond 12, crowfoot 15, cardinality bar 20, default 15). It takes the type only, with no element or scale input.
- 747-751, 754-776: `getArrowheadAngle(arrowhead, size = getArrowheadSize(...))`. `arrow` heads widen from 20° to 30° as `size` shrinks toward `ARROW_ARROWHEAD_WIDEST_SIZE` (10). Its `fullSize` depends on base size, so a scale factor must be threaded in here too.
- 861-903: `getCardinalityMarkerScale` calls `getArrowheadSize` for bar, crowfoot and circle.
- 911-990: `getArrowheadSizeBeyondLastSegment` (growth on a short last segment; `legibleSize = getArrowheadSize/2` at 969)
- 992-1110+: `getArrowheadPoints(element, shape, position, arrowhead, offsetMultiplier)`. The main size is computed at 1058 (`const size = getArrowheadSize(arrowhead)`) and clamped against the segment length at 1076-1087. This is the main hook: it already receives `element`.

**Other getArrowheadSize consumers (need the scaled size too, or a decision not to scale)**
- packages/element/src/elbowArrow.ts:1493, 1498: elbow-route leg reserves room for the arrowheads. Lines 1297-1311 and 1358-1377 use a fixed `BASE_BINDING_GAP * 6` padding when an arrowhead exists.
- packages/element/src/transform.ts:662: label margin in skeleton transform.

**Shape generation (canvas and SVG share it)**
- packages/element/src/shape.ts:401-640: `getArrowheadShapes` calls `getArrowheadPoints` for every type.
- shape.ts:998-1030: arrow branch of `generateElementShape` (`startArrowhead`/`endArrowhead`).
- packages/element/src/renderElement.ts:106-118: `getCanvasPadding` uses a fixed 40px for arrows with arrowheads. Large heads could clip there, so it may need to scale. Note the existing typo `endArrowhead || endArrowhead`.
- SVG export: packages/excalidraw/renderer/staticSvgScene.ts:476 (`ShapeCache.generateElementShape` for linear elements). There is no separate arrowhead SVG code path, so the size flows through shape.ts. packages/excalidraw/scene/export.ts:575-596 covers background and outline-arrowhead fill.
- ShapeCache (shape.ts:98) is keyed on element version, and `newElementWith` bumps the version, so cache invalidation is automatic.

**Types**
- packages/element/src/types.ts:350-367: `ArrowheadLegacy`, `Arrowhead`, `AnyArrowhead`
- types.ts:369-377: `ExcalidrawLinearElement` (`startArrowhead`, `endArrowhead`). Arrowheads live on the linear base and are shared with `line`.
- types.ts:391-395: `ExcalidrawArrowElement` (`elbowed`)
- types.ts:397+: `ExcalidrawElbowArrowElement` (uses `Merge<>`)
- packages/element/src/arrowheads.ts:3-34: `normalizeArrowhead`, `getArrowheadForPicker`

**Element creation defaults**
- packages/element/src/newElement.ts:623-648: `newLinearElement` (arrowheads null)
- newElement.ts:650-692: `newArrowElement` (opts `startArrowhead?`/`endArrowhead?`, used for elbow and non-elbow)
- packages/excalidraw/components/App.tsx:8621-8660: the arrow tool creates arrows from `currentItemStartArrowhead`/`currentItemEndArrowhead`
- Other creation sites that copy current-item arrowheads: App.drawshape.ts:200-201; ConvertElementTypePopup.tsx:900-915; element/src/convertToShape.ts:651-652; element/src/transform.ts:741 (skeleton default); element/src/elbowArrow.ts:320, 1023
- packages/excalidraw/actions/actionStyles.ts:181-195: copy/paste styles copies arrowheads (a new size prop should be copied here)
- packages/excalidraw/actions/actionFlip.ts:129-130: swaps start and end arrowheads (a per-end size should swap too)

**Restore / migration**
- packages/excalidraw/data/restore.ts:450-540: `restoreElementWithProperties` (typed `Required<...>`, so a new required element field must be supplied for every linear-element case)
- restore.ts:626-668: `line`/legacy `draw` case (normalizes arrowheads at 630-631)
- restore.ts:669-720+: `arrow` case (630/671-675 normalize; end defaults to "arrow" when undefined)
- restore.ts:274-290, 615: analog for restoring a nested per-element option with validation (`restoreFreedrawStrokeOptions`)
- restore.ts:1268+: `restoreAppState` (new `currentItem*` keys get defaults from `getDefaultAppState`)

**Properties panel**
- packages/excalidraw/actions/actionProperties.tsx:1960-2056: `actionChangeArrowhead` (perform, then `changeProperty`, `newElementWith`, elbow re-route, `currentItem*Arrowhead` update; PanelComponent with two `IconPicker`s at 2015-2051)
- actionProperties.tsx:2058-2075: `actionChangeArrowProperties` (compact-mode container rendering `changeArrowhead` and `changeArrowType`)
- actionProperties.tsx:716-772: `actionChangeStrokeWidth`, the closest analog for a small/medium/large `RadioSelection` with `testId`s and `getFormValue`
- actionProperties.tsx:828-905: `actionChangeFreedrawMode` (analog for a type-specific per-element prop)
- packages/excalidraw/actions/types.ts:65-80: `ActionName` union (add the new action name)
- packages/excalidraw/actions/index.ts:1-24: re-exports from actionProperties
- packages/excalidraw/components/Actions.tsx:168, 189 (desktop panel: `predicates.arrowheads && renderAction("changeArrowhead")`), 285, 395 (compact popover)
- packages/excalidraw/components/shapeActionPredicates.ts:148: `arrowheads: forToolOrSelection(canHaveArrowheads)`

**AppState**
- packages/excalidraw/appState.ts:39, 46: defaults `currentItemEndArrowhead: "arrow"`, `currentItemStartArrowhead: null`
- appState.ts:175, 196: storage config `{ browser: true, export: false, server: false }`. A new key must be added here because the config object is typed exhaustively over AppState keys.
- packages/excalidraw/types.ts:464-465: `AppState.currentItemStartArrowhead`/`currentItemEndArrowhead`

**Locales (packages/excalidraw/locales/en.json)**
- 38 `strokeWidth`, 52-70 `arrowheads` and `arrowhead_*`, 77 `fontSize`, 83-86 `small`/`medium`/`large`/`veryLarge` (reusable for size options), 91-96 thin/bold/extraBold. There are 59 locale files, but only en.json needs editing (Crowdin handles the rest).

**Constants analog**
- packages/common/src/constants.ts:477-512: `STROKE_WIDTH_KEYS`, `STROKE_WIDTH`, `getStrokeWidthByKey` (a pattern for size keys mapped to values)

**Existing tests and snapshots**
- packages/element/tests/bounds.test.ts:226-360+: `getArrowheadPoints()` geometry tests (uses `getArrowheadSize`)
- packages/element/tests/shape.test.ts:14-35: arrowhead shape fill tests
- packages/excalidraw/actions/actionProperties.test.tsx:98-237: properties-panel tests (stroke width pattern at 138-212)
- packages/excalidraw/tests/data/restore.test.ts:563-580, 737-756: arrowhead restore tests
- packages/excalidraw/tests/scene/export.test.ts:424-480: outline-arrowhead SVG and canvas export
- packages/excalidraw/actions/actionFlip.test.tsx (37 arrowhead refs), element/tests/elbowArrow.test.tsx, element/src/__tests__/transform.test.ts, tests/lasso.test.tsx
- Snapshots that will churn if a new element field or appState key is added: tests/__snapshots__/history.test.tsx.snap (64 `currentItemEndArrowhead`), regressionTests.test.tsx.snap (52), contextmenu.test.tsx.snap (17), tests/packages/__snapshots__/utils.test.ts.snap, packages/utils/tests/__snapshots__/utils.test.ts.snap, element/src/__tests__/__snapshots__/transform.test.ts.snap, tests/data/__snapshots__/restore.test.ts.snap, selection/multiPointCreate/dragCreate/move snaps. Expect `yarn test:update` to rewrite these. The allowlist must include `**/__snapshots__/*.snap`.
- Test helper: packages/excalidraw/tests/helpers/api.ts:232-236, 416-421. `API.createElement` explicitly sets the arrow's arrowheads, so a new prop needs pass-through here.

## Notes
- Scan completed well within the timebox.
