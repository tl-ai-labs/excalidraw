# Discovery — run 20261102-144102-feature-new-text-range-styles

Mode: first-time (full Tier 1 scan). Built 2026-11-02T09:12:50Z. Plugin mmo 0.9.3.
Upcoming intent: feature-new — partial text styling (per-range colour / highlight) on text elements.

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-NF-11/opus55-only` (main branch: `master`).
- Working tree **clean** (`git_dirty: false`).
- Remote: `origin` → https://github.com/tl-ai-labs/excalidraw.git
- **This checkout is a git worktree.** `.git` is a file pointing at `/Users/macbook/Desktop/Work/AI studies TL/excalidraw/.git/worktrees/EX-NF-11`. The stash stack is shared with other worktrees, so rollback must use WIP commits or tagged stashes, never a bare `git stash`.
- `gitignore_covers_sdlc: false`. `.gitignore` has no `.sdlc` entry, but `.sdlc/` is ignored through the main repo's `.git/info/exclude` (line 7), and `git status --ignored` reports `!! .sdlc/`. In this checkout, `git add -A` will not pick up run artifacts.
- 1327 tracked files. Normal-size repo; no sampling needed.

## Directory topology
Top level: `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/` (Docusaurus docs site), `examples/` (with-nextjs, with-script-in-browser), `excalidraw-app/` (app: collab, components, data, share, tests), `firebase-project/`, `packages/` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `public/`, `scripts/`.
Root files: `package.json`, `tsconfig.json` (strict, path aliases), `vitest.config.mts` (aliases + jsdom + `setupTests.ts`), `yarn.lock`, `Dockerfile`, `docker-compose.yml`, `vercel.json`.

## Detected stacks
- **node-typescript, React 19, Yarn 1 workspaces monorepo** (`package.json`, workspaces `excalidraw-app`, `packages/*`, `examples/*`).
- Library `@excalidraw/excalidraw` (React peer ^17/^18/^19, jotai). It is built with esbuild.
- App `excalidraw-app` (Vite 5, React 19, jotai, firebase, socket.io-client).
- Example `with-nextjs` (Next 14.1). It is integration-only.
- Tests: Vitest 3 + jsdom + vitest-canvas-mock + @testing-library/react. TypeScript 5.9.3 strict.
- **Tier 2b triggered.** No pre-authored adapter covers React/TS (the plugin ships only generic, nest and python). The stack profile is in `.sdlc/baseline/stack-profile.md`.

## Monorepo
Yarn workspaces. All tests run through **one root vitest config**, so packages have no per-package `test` script. To run one area, filter by path: `yarn test:app --watch=false <path>`.
Packages: @excalidraw/common, @excalidraw/element, @excalidraw/excalidraw, @excalidraw/fractional-indexing, @excalidraw/laser-pointer, @excalidraw/math, @excalidraw/utils, excalidraw-app, with-nextjs, with-script-in-browser.

## Test / build commands (proposed — Gate 0 must confirm)
- Proposed: **`yarn test:app --watch=false`** (`package.json#scripts.test` → `yarn test:app` → `vitest`). The non-watch flag is needed for CI-style runs. CI (`.github/workflows/test.yml`) runs `yarn test:app` on Node 20.
- CLAUDE.md asks for `yarn test:update` (runs vitest with `--update`, which rewrites snapshots) before committing, and `yarn test:typecheck` (`tsc`) for types.
- Lint: `yarn test:code` (eslint, max-warnings=0). Format: `yarn test:other` (prettier). Everything: `yarn test:all`.
- Caution: `yarn test:update` silently rewrites `__snapshots__`. For a baseline or verify step, prefer the non-updating run so snapshot diffs show up as failures and get reviewed.
- **Baseline pass status: unknown.** Discovery did not run the suite. HEAD is a merged master commit, so it most likely passes, but this is not verified.
- Husky pre-commit exists, but its `yarn lint-staged` line is commented out, so it does nothing.

## Docs
- `README.md`: product README (excalidraw.com, docs links).
- `CLAUDE.md`: monorepo layout, `yarn test:typecheck` / `yarn test:update` / `yarn fix`, path aliases in `vitest.config.mts`.
- `AGENTS.md`: use `app.ownerDocument` / `app.ownerWindow` instead of DOM globals, and use `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` instead of `Omit & ...`.
- `CONTRIBUTING.md`: points to docs.excalidraw.com.
- `.github/copilot-instructions.md`: coding standards (TS guidelines, terse style).
- `dev-docs/`: Docusaurus docs site. No ADR directory.

## Detected AI/agent setup
- `CLAUDE.md` (claude-instructions)
- `AGENTS.md` (agents-instructions)
- `.github/copilot-instructions.md` (copilot)
- Not present: `.claude/` (it is gitignored and absent), `CLAUDE.local.md`, `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env files
- Present and **committed to git**: `.env.development`, `.env.production`, `.env.test`. `.env*.local` files are gitignored, and none exist.
- `env_keys_by_file`: **not collected.** The permission classifier denied reading the env files, even for key names only. Gate 0 / credential discovery should ask the user if it needs the names.
- Env names referenced in code (via `import.meta.env.*` / `process.env.*`) include `VITE_APP_WS_SERVER_URL`, `VITE_APP_FIREBASE_CONFIG`, `VITE_APP_BACKEND_V2_GET_URL`/`_POST_URL`, `VITE_APP_LIBRARY_URL`, `VITE_APP_AI_BACKEND`, `VITE_APP_DISABLE_SENTRY`, `VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX` and others; the full list is in baseline.json. None of them matter for this feature.

## Submodules / LFS
- Submodules: none (no `.gitmodules`).
- LFS: none (`.gitattributes` only has `* text=auto eol=lf`).

## Infra hints
Dockerfile, docker-compose.yml, vercel.json, and .github/workflows (test, lint, size-limit, stats, test-coverage-pr, docker build and publish, autorelease, sentry). No terraform, GitLab CI, CircleCI or Jenkins.

## Regulated-repo signals
None found (no SECURITY/PRIVACY/COMPLIANCE/HIPAA/SOC2/PCI/GDPR docs, no compliance dirs, no CODEOWNERS).

## Feature hotspots — partial text styling (all confirmed to exist)
| Concern | Path | Notes |
|---|---|---|
| Text element type | `packages/element/src/types.ts` | `ExcalidrawTextElement` at L253: `text`, `originalText`, `fontSize`, `fontFamily`, `lineHeight` (branded), `autoResize`, `containerId`, `baseFontSize`, `labelPosition`. The element-wide colour is `strokeColor` on `_ExcalidrawElementBase`. There is no per-range field yet. |
| Text wrapping | `packages/element/src/textWrapping.ts` | `wrapText` (L398), `getWrappedTextLines` (L448), `parseTokens` (L383). Works on plain strings: wrapped `text` is derived from `originalText` by inserting `\n`, so any range offsets must be defined against `originalText` and mapped onto the wrapped lines. |
| Text measurement | `packages/element/src/textMeasurements.ts` | `measureText`, `getLineWidth`, `getTextWidth`, `getLineHeightInPx`, `charWidth`, `setCustomTextMetricsProvider`. |
| Text helpers | `packages/element/src/textElement.ts` | Container/bound-text helpers and `redrawTextBoundingBox`-style logic. |
| Text factory | `packages/element/src/newElement.ts` | `newTextElement` (L337), `refreshTextDimensions` (L540). |
| Canvas render | `packages/element/src/renderElement.ts` | Text branch at ~L660–717. Splits `element.text` on `\n` and calls `context.fillText(line, …)` once per line with one `fillStyle = applyDarkModeFilter(strokeColor, dark)`. Per-range colour/highlight means filling each run and measuring the x offset of each segment, with care for RTL (`isRTL`) and textAlign center/right. Elements are cached in `elementWithCanvasCache`; the cache key must change when ranges change. |
| SVG export | `packages/excalidraw/renderer/staticSvgScene.ts` | ~L780–845. One `<text>` per line with a `fill` attribute. Per-range styling would map to `<tspan fill>`, plus `<rect>` for highlights. |
| Restore | `packages/excalidraw/data/restore.ts` | `case "text":` at L555 uses `restoreElementWithProperties`. A new field needs a default and validation here, such as clamping ranges to the text length. |
| WYSIWYG editor | `packages/excalidraw/wysiwyg/textWysiwyg.tsx` | `textWysiwyg` (L250) uses a **plain `<textarea>`** (L533) with `onChange(nextOriginalText)`. A textarea cannot render per-range colour, and text edits shift range offsets, so ranges must be remapped on change. |
| Collab reconciliation | `packages/excalidraw/data/reconcile.ts` | Whole-element last-writer-wins by `version`/`versionNonce`, and skips elements being edited locally. A new element field syncs automatically if it is mutated through `mutateElement`/`newElementWith`, which bump the version. |
| Collab app | `excalidraw-app/collab/Collab.tsx` (`_reconcileElements` L772, `broadcastElements` L971, `syncElements` L982), `excalidraw-app/data/firebase.ts`, `excalidraw-app/collab/Portal.tsx` | Changes are probably not needed if the field rides on the element. |
| Colour actions | `packages/excalidraw/actions/actionProperties.tsx` | `actionChangeStrokeColor` (L366) and `actionChangeBackgroundColor` (L445) use `resolveColorTarget`, `changeProperty`, `getColorUpdate`, `syncStickyNoteInk`. A label "Text color" exists in `locales/en.json`. |
| Locales | `packages/excalidraw/locales/en.json` | New UI labels go here. Other locales come from Crowdin. |

### Existing tests touching these areas
- `packages/element/tests/textWrapping.test.ts`, `packages/element/tests/textElement.test.ts`
- `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`
- `packages/excalidraw/tests/data/restore.test.ts` (+ `__snapshots__/restore.test.ts.snap`)
- `packages/excalidraw/tests/data/reconcile.test.ts`
- `packages/excalidraw/actions/actionProperties.test.tsx`, `packages/excalidraw/tests/actionStyles.test.tsx`, `packages/excalidraw/tests/colorTargets.test.ts`
- `packages/excalidraw/tests/export.test.tsx` (+ snap), `packages/excalidraw/tests/scene/export.test.ts` (+ snap), `packages/utils/tests/export.test.ts`
- `packages/excalidraw/tests/clipboard.test.tsx`, `packages/excalidraw/clipboard.test.ts` (copy/paste of text elements)
- Many `__snapshots__/*.snap` files serialize full elements. A new text field with a non-undefined default **will churn snapshots** (App, history, regressionTests, restore, export…). Prefer an optional field omitted when empty, or plan a reviewed `yarn test:update`.

## Coexistence risks
- **CLAUDE.md / AGENTS.md / copilot-instructions present.** Untouched by default. Their rules (ownerDocument/ownerWindow, `Merge<>`, run `yarn test:update` and `yarn test:typecheck`) should be carried into the change spec.
- **`.sdlc/` not in `.gitignore`.** It *is* excluded through the main repo's `.git/info/exclude`, so `git add -A` will not stage it in this worktree. Adding a `.gitignore` entry is optional; skip it unless the user wants it portable.
- **Git worktree.** The stash is shared with other worktrees and sessions. Rollback anchors should be commits or SHA refs, not `git stash`.
- **Committed env files** (`.env.development/.production/.test`) are off-limits.
- **Snapshot-updating test command.** `yarn test:update` rewrites snapshots, so it can hide regressions if used as the verify step.

## Proposed off-limits
`.env`, `.env.*` (incl. `.env.development`, `.env.production`, `.env.test`), `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.claude/**`, `.mcp.json`, `.cursor/**`, `node_modules/**`, `dist/**`, `build/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**` (generated .d.ts), `yarn.lock`, `.git/**`, `.sdlc/**`.
