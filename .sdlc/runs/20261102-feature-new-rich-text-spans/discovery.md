# Discovery — 20261102-feature-new-rich-text-spans

Mode: first-time (full Tier 1 scan) plus a Tier 2b stack profile. Built 2026-11-02.
Intent hint: feature-new — let users colour or highlight part of a text element, with the styling saved, synced to collaborators, drawn on the canvas and kept in SVG export.

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-NF-11/opus55-plus-flash38` (master is the main branch). The working tree is clean.
- Remote: `origin` at https://github.com/tl-ai-labs/excalidraw.git
- 1327 tracked files (normal size, no sampling needed).
- `.gitignore` does **not** cover `.sdlc/`. It does ignore `.claude`, `build`, `dist`, `coverage`, `dev-dist` and `.env*.local`.

## Directory topology
Top level: `.claude`, `.codesandbox`, `.github`, `.husky`, `dev-docs`, `examples`, `excalidraw-app`, `firebase-project`, `packages`, `public`, `scripts`.
`packages/`: `common`, `element`, `excalidraw`, `fractional-indexing`, `laser-pointer`, `math`, `utils`.
Entry points: `packages/excalidraw/index.tsx` (library), `excalidraw-app/index.tsx` and `excalidraw-app/App.tsx` (the excalidraw.com app).

## Detected stacks
- `package.json`: node-typescript. Uses Yarn 1.22 workspaces, React 19 types, TypeScript 5.9.3, Vite 5 (app), esbuild (packages) and Vitest 3 with jsdom and vitest-canvas-mock.
- `examples/with-nextjs`: Next.js. This is an example only and not part of the main code.
- No pre-authored adapter matches React/Vite (only generic, nest and python ship), so **Tier 2b ran**. See `.sdlc/baseline/stack-profile.md`.

## Test / build commands
- Proposed test command: **`yarn test:app --watch=false`** (`scripts.test` points to `yarn test:app`, which runs `vitest`; `yarn.lock` is present). `--watch=false` is needed because plain `vitest` starts in watch mode.
- Related commands: `yarn test:typecheck` (tsc), `yarn test:update` (runs tests and updates snapshots; CLAUDE.md asks for this before committing), `yarn test:code` (eslint, zero warnings allowed), `yarn fix`.
- To scope a run to some files: `yarn test:app --watch=false packages/element packages/excalidraw/wysiwyg`.
- Pre-existing failing tests: **unknown**. Tier 1 doesn't run tests, so Gate 0 or Phase 7 should run a baseline first.
- Gate 0 still has to confirm the command with the user (`.sdlc/pre-check-status.json` shows test_command_probe=skip).

## Docs
README.md, CLAUDE.md (monorepo layout, yarn commands), AGENTS.md (use `app.ownerDocument` and `app.ownerWindow` instead of DOM globals; prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types`), CONTRIBUTING.md (points to docs.excalidraw.com), `dev-docs/` (Docusaurus site), and a README in each package. No ADR directory.

## Detected AI/agent setup
- `.claude/` with `settings.local.json` (gitignored)
- `CLAUDE.md`, `AGENTS.md`
- `.github/copilot-instructions.md` (coding standards: TS, functional React, prefer immutable data and fewer allocations)
- Not found: `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env file keys
Files present: `.env.development`, `.env.production`, `.env.test`.
**Key names were not collected.** The permission system refused reads of the env files this session, and I didn't try to get around that. Env var names referenced in code (from `import.meta.env.*` and `process.env.*`) include `VITE_APP_WS_SERVER_URL`, `VITE_APP_FIREBASE_CONFIG`, `VITE_APP_BACKEND_V2_GET_URL`, `VITE_APP_BACKEND_V2_POST_URL`, `VITE_APP_AI_BACKEND`, `VITE_APP_LIBRARY_URL`, `VITE_APP_DISABLE_SENTRY`, `VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX` and others (full list in baseline.json). The intent needs none of them.

## Monorepo, submodules, LFS
- Monorepo: Yarn workspaces (`excalidraw-app`, `packages/*`, `examples/*`). There is one root `vitest.config.mts` that maps `@excalidraw/<pkg>` path aliases to `packages/<pkg>/src`.
- Submodules: none. LFS: none (`.gitattributes` only sets `* text=auto eol=lf`).

## Infra hints
Dockerfile, docker-compose.yml, `.github/workflows/` (test, lint, size-limit, stats, autorelease and more), vercel.json, firebase-project/, .codesandbox/. The `.husky/pre-commit` lint-staged line is commented out.

## Regulated-repo signals
None found.

## Coexistence risks
- **`.sdlc/` not gitignored**: "Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run."
- `.github/copilot-instructions.md` and `CLAUDE.md`/`AGENTS.md` are left untouched. Their conventions should still feed the architect's spec.
- Snapshot churn: adding a field to `ExcalidrawTextElement` will change many `__snapshots__/*.snap` files (restore, export, regression, history). Those updates are expected and should go in the file-scope allowlist.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `node_modules/**`, `**/dist/**`, `**/build/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**` (generated, gitignored), `.git/**`, `.sdlc/**`.

## Relevant to intent (rich text spans)

### Type definitions
- `packages/element/src/types.ts`: `ExcalidrawTextElement` (line ~253: `text`, `originalText`, `fontSize`, `fontFamily`, `textAlign`, `lineHeight`, `autoResize`, `containerId`, `baseFontSize`, `labelPosition`). The span or range style field gets added here.
- `packages/excalidraw/data/types.ts`: serialized scene and import data types.
- `packages/common/src/utility-types.ts`: `Merge<>` helper (AGENTS.md convention).

### Element creation / mutation
- `packages/element/src/newElement.ts`: `newTextElement` (l.337) and `refreshTextDimensions` (l.540). New text gets its default style here, and edits that change the text need span offsets re-checked.
- `packages/element/src/mutateElement.ts`: `mutateElement`, `newElementWith` (l.149), `bumpVersion` (l.188). Version bumps carry the change to collaborators.
- `packages/element/src/textElement.ts`: bound-text helpers (`redrawTextBoundingBox`, container lookup).
- `packages/element/src/textWrapping.ts`: `wrapText` (l.398). Wrapped lines must map back to span offsets in `originalText`.
- `packages/element/src/textMeasurements.ts`: `measureText`, `normalizeText` (l.72; line-ending normalization moves offsets), `getLineHeightInPx`.
- `packages/element/src/duplicate.ts`: element duplication (spans must deep-copy).
- `packages/element/src/listMarker.ts`, `packages/element/src/heading.ts`: recent text-structure features that make good style references.

### Canvas rendering
- `packages/element/src/renderElement.ts`: `drawElementOnCanvas` (l.460). The text branch (~l.680-710) sets `context.font`, `fillStyle` and `textAlign`, then calls `context.fillText` once per line. Per-span colour and highlight rects go here. Note that the render cache (`renderEnvironment.ts` / `renderEnvironmentCaches`) is keyed per element and is invalidated through the version.
- `packages/excalidraw/renderer/staticScene.ts`: static canvas scene loop.
- `packages/common/src/utils.ts`: `getFontString` (l.153), `applyDarkModeFilter` (colours need dark-mode handling).

### SVG export
- `packages/excalidraw/renderer/staticSvgScene.ts`: `renderSceneToSvg` (l.853). The text branch (~l.800-830) creates one `<text>` per line with `fill=strokeColor`. Spans become `<tspan fill=…>` children, and highlights become `<rect>`s behind them.
- `packages/excalidraw/scene/export.ts`: `exportToSvg` (l.969) and the font embedding and subsetting setup.
- `packages/excalidraw/fonts/Fonts.ts`: font loading for export.

### Text editing (WYSIWYG)
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx`: textarea-based editor overlay. Spans have to stay in place when the text changes (insert or delete shifts offsets) and should probably show in the editor.
- `packages/excalidraw/components/App.text.ts`: App's text-editing controller (`startTextEditing`, `handleTextWysiwyg`).
- `packages/excalidraw/components/App.textTool.ts`: text tool creation flow.
- `packages/excalidraw/components/App.tsx`: calls `this.text.startTextEditing` / `handleTextWysiwyg` (l.5519, 6439, 9860).
- `packages/excalidraw/hooks/useTextEditorFocus.ts`: editor focus handling.

### Restore / data migration
- `packages/excalidraw/data/restore.ts`: `restoreElement` (l.541), with the `case "text"` branch at l.555 (`restoreElementWithProperties`), and `restoreElements` (l.960). The new field needs validation and defaulting here (for example, drop invalid ranges and clamp to text length).
- `packages/excalidraw/data/json.ts`: `.excalidraw` serialize and load.
- `packages/excalidraw/clipboard.ts`: copy and paste of elements (spans should go along with them).

### Collaboration / versioning / history
- `packages/excalidraw/data/reconcile.ts`: `shouldDiscardRemoteElement` (l.23; version and versionNonce, local `editingTextElement` wins) and `reconcileElements` (l.73). This is whole-element LWW, so spans only need to sit on the element, with no special merge.
- `excalidraw-app/collab/Collab.tsx`, `excalidraw-app/collab/Portal.tsx`: broadcast and sync (`isSyncableElement` from `excalidraw-app/data/index.ts`).
- `packages/element/src/delta.ts`: `ElementsDelta` (l.1040), undo/redo deltas. Array or object fields need correct diffing and applying.
- `packages/element/src/store.ts`: store and increment capture for history.

### Actions / properties panel
- `packages/excalidraw/actions/actionProperties.tsx`: `actionChangeStrokeColor` (l.366), `actionChangeBackgroundColor` (l.445), `actionChangeFontSize` (l.1007), `actionChangeFontFamily` (l.1168), `actionChangeTextAlign` (l.1561). A span colour or highlight action, or a selection-aware variant of stroke colour while editing, goes here.
- `packages/excalidraw/actions/colorTargets.ts`: decides which element or palette a colour picker targets.
- `packages/excalidraw/actions/actionStyles.ts`: copy and paste styles.
- `packages/excalidraw/actions/index.ts`, `packages/excalidraw/actions/types.ts`: action registry and `ActionName` union.
- `packages/excalidraw/components/Actions.tsx`: renders the properties panel (`SelectedShapeActions`).
- `packages/excalidraw/locales/en.json`: label strings (59 locale files; only `en.json` needs editing).

### Relevant tests
- `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`: editor behaviour.
- `packages/excalidraw/actions/actionProperties.test.tsx`: property actions.
- `packages/excalidraw/tests/data/restore.test.ts` (+ `__snapshots__/restore.test.ts.snap`): migration.
- `packages/excalidraw/tests/data/reconcile.test.ts`: collab reconciliation.
- `packages/excalidraw/tests/export.test.tsx`, `packages/excalidraw/tests/scene/export.test.ts` (+ snapshots), `packages/utils/tests/export.test.ts`: SVG and PNG export.
- `packages/element/tests/newElement.test.ts`, `textElement.test.ts`, `textWrapping.test.ts`, `delta.test.tsx`: element-level tests.
- `packages/excalidraw/tests/history.test.tsx`, `clipboard.test.tsx`, `actionStyles.test.tsx`, `colorTargets.test.ts`, `regressionTests.test.tsx`: wider coverage that snapshot churn will hit.
- `excalidraw-app/tests/collab.test.tsx`: app-level collab.
- Helpers: `packages/excalidraw/tests/helpers/api.ts` (`API.createElement`), `helpers/ui.ts` (`Keyboard`, `Pointer`, `UI`), `tests/test-utils.ts`, `tests/queries/dom.ts` (`getTextEditor`, `updateTextEditor`).

## Notes
- Scan finished within the timebox. No sampling.
- `.sdlc/project.json` exists (default_policy `opus55-plus-flash38`).
