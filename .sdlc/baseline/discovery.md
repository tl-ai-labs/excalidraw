# Discovery: 20261106-120000-bugfix-eyedropper-dark-theme

Mode: first-time (full Tier 1 scan). Built 2026-11-06. Plugin 0.10.1.
Run intent: bugfix. "In dark theme the eyedropper saves the on-screen dark-mode colour instead of the element's real colour."

## Git state
- HEAD `4872083c044491b6d5c96ae134a75464f96d6831` ("feat(editor): bucketfill cursor + eyedropper support (#11849)", 2026-08-07)
- Branch `EX-BF-04/argon4-plus-sonnet55`; main branch `master`
- Working tree: clean (`dirty: false`)
- Remote: `origin` https://github.com/tl-ai-labs/excalidraw.git
- This folder is a **git worktree** (gitdir `/Users/apple/Documents/GitHub/excalidraw/.git/worktrees/EX-BF-041`). `git rev-parse --show-toplevel` equals cwd, so the precondition passes.
- `.gitignore` does **not** cover `.sdlc/` (`gitignore_covers_sdlc: false`). However, the shared `.git/info/exclude` (line 7: `.sdlc/`) already ignores it locally, and `git status --ignored` confirms `.sdlc/` is ignored. It does ignore `.claude`, `build`, `dist`, `node_modules`, `coverage`, `dev-dist`, `packages/excalidraw/types`, `.env.*.local`.

## Directory topology
Top level: `.claude/`, `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/` (Docusaurus site, own yarn.lock), `examples/` (with-nextjs, with-script-in-browser), `excalidraw-app/` (excalidraw.com app: collab, components, data, share, tests), `firebase-project/`, `packages/` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `public/`, `scripts/`.
About 1,267 tracked files, so no sampling was needed.

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` (root) | node-typescript | yarn workspaces (yarn 1.22.22), vitest 3, vite 5, TypeScript 5.9 strict |
| `packages/excalidraw/package.json` | node-typescript | React 19, jotai, roughjs |
| `excalidraw-app/package.json` | node-typescript | React, Vite, jotai, firebase, socket.io-client |
| `examples/with-nextjs/package.json` | node-typescript | Next.js |
| `dev-docs/package.json` | node-javascript | Docusaurus (not a workspace member) |

No pre-authored adapter matches React/TypeScript (shipped: generic, nest, python), so the Tier 2b stack profile was triggered and written to `.sdlc/baseline/stack-profile.md`.

## Test / build commands
- Proposed: **`yarn test:app --watch=false`** (from `package.json#scripts.test` -> `yarn test:app` -> `vitest`). Plain `yarn test` starts vitest in **watch mode** and would hang a non-interactive run.
- Focused runs: `yarn vitest run packages/excalidraw/tests/eyeDropper.test.tsx` (also `bucketFill.test.tsx`, `packages/common/src/colors.test.ts`).
- CLAUDE.md asks for `yarn test:update` (vitest with `--update`, which rewrites snapshots) before committing, and `yarn test:typecheck` (`tsc`) for types. Lint: `yarn test:code`; formatting: `yarn fix`.
- Vitest runs from the root only: jsdom environment, `setupTests.ts` (imports `vitest-canvas-mock`), globals on, and `@excalidraw/*` aliases resolve to source. No workspace package has its own `scripts.test`.
- Gate 0 must confirm the command.

## Docs
`README.md`, `CLAUDE.md` (monorepo layout, yarn commands), `CONTRIBUTING.md` (links to docs site), `dev-docs/README.md` and `dev-docs/docs/`, `packages/excalidraw/CHANGELOG.md`, `.github/copilot-instructions.md`. No ARCHITECTURE.md, AGENTS.md or ADR directory.

## Detected AI/agent setup
- `.claude/` with `.claude/settings.local.json` (gitignored; contents not recorded)
- `CLAUDE.md` (tracked)
- `.github/copilot-instructions.md` (tracked; coding standards: TypeScript, prefer immutable data, performance)
- None found: `.mcp.json`, `.cursor/`, `.cursorrules`, Aider, `.continue/`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`

## Env keys (names only)
- `.env.development` (tracked): 20 keys, VITE_APP_* plus MODE, FAST_REFRESH
- `.env.production` (tracked): 15 keys
- `.env.test` (tracked): VITE_DEBUG_DOM
- Referenced in code via `import.meta.env` / `process.env`: 24 names (see baseline.json). None of them matter for this bugfix.

## Monorepo, submodules, LFS, infra
- Monorepo: yarn workspaces (`excalidraw-app`, `packages/*`, `examples/*`), 10 packages.
- Submodules: none. LFS: none (`.gitattributes` only sets `* text=auto eol=lf`).
- Infra: Dockerfile, docker-compose.yml, vercel.json, firebase-project/, 11 GitHub workflows (test.yml, lint.yml, test-coverage-pr.yml, size-limit.yml and others). There is a Husky `pre-commit` hook, but its `yarn lint-staged` line is commented out, so it does nothing.

## Regulated-repo signals
None found. `regulated_repo_warning_required: false`.

## Coexistence risks
- **`.sdlc/` not gitignored** (lower risk here: `.git/info/exclude` already ignores `.sdlc/` in this clone, though that rule doesn't travel to other clones): "Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run."
- **Git worktree:** the stash stack is shared with the main checkout and other worktrees. Rollback should use commits or backups, never a bare `git stash`.
- **Claude Code / Copilot config:** `.claude/settings.local.json` and `.github/copilot-instructions.md` exist. Both stay untouched.
- **Snapshot updates:** `yarn test:update` rewrites `__snapshots__`. A run that uses it may change snapshot files outside the intended scope. Review them before accepting.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `.github/copilot-instructions.md`, `node_modules/**` (all levels), `dist/**`, `build/**`, `.next/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**` (generated), `.yarn/**`, `.git/**`.

## Task context: eyedropper and dark mode (for the brief)

### Eyedropper code
- `packages/excalidraw/components/EyeDropper.tsx`: the core component. `getCurrentColor` (lines ~80-95) reads `app.canvas.getContext("2d").getImageData(...)` at the cursor and returns `rgbToHex(r,g,b)` of the **rendered pixel**. That raw value goes to `onChange` (live preview mutation of selected elements, line ~122), to the preview swatch background (line ~130) and to `onSelect` on pointerup (line ~161). Nothing here checks the theme.
- `packages/excalidraw/components/EyeDropper.scss`: `.excalidraw-eye-dropper-preview` has `filter: var(--theme-filter)`, so in dark mode the swatch is CSS-filtered on top of its colour.
- `packages/excalidraw/components/LayerUI.tsx` (~lines 505-560): mounts `<EyeDropper>` from `activeEyeDropperAtom` and implements `onChange` (mutates `backgroundColor`/`strokeColor` of selected elements, or sets `currentItem*Color`). `onSelect` forwards to the atom's `onSelect`.
- `packages/excalidraw/components/App.tsx`: `openEyeDropper` (~line 2963) is the `i` shortcut / stroke-background picker, and its `onSelect` writes the colour to app state or the selected elements. ~5485 holds Alt with bucketfill, which calls `bucketFill.openTemporaryEyeDropper()`. ~5837 is Alt keyup, which closes it.
- `packages/excalidraw/components/App.bucketFill.ts` (added in 4872083c): `openTemporaryEyeDropper` (colorPickerType `elementBackground`, `keepOpenOnAlt: true`, onSelect runs `actionChangeBucketFillBackgroundColor` with the picked colour). `closeTemporaryEyeDropper`.
- `packages/excalidraw/components/ColorPicker/ColorPicker.tsx` (~line 90, ~173-196): toggles the eyedropper from the colour picker UI.

### How dark mode is applied
- The static canvas has **no** CSS filter. Element colours are converted at render time: `packages/element/src/renderElement.ts` sets `context.fillStyle`/`strokeStyle` to `applyDarkModeFilter(color, theme === THEME.DARK)` (~lines 356, 489, 749) and uses `context.filter = DARK_THEME_FILTER` for images (~456). The grid uses `applyDarkModeFilter` in `packages/excalidraw/renderer/staticScene.ts`. The canvas background goes through the same function in `packages/excalidraw/renderer/helpers.ts` (~76). So `getImageData` on the static canvas returns **dark-transformed** pixels.
- `packages/common/src/colors.ts`: `applyDarkModeFilter(color, enable)` (line 83) is the JS version of `invert(93%) hue-rotate(180deg)`, built from `cssInvert` and `cssHueRotate` (both module-private), with `DARK_MODE_COLORS_CACHE`. `rgbToHex` is at line 289. **No inverse function exists** in the codebase.
- `packages/common/src/constants.ts:194`: `DARK_THEME_FILTER = "invert(93%) hue-rotate(180deg)"`.
- CSS: `packages/excalidraw/css/theme.scss` (~185) defines `--theme-filter: invert(93%) hue-rotate(180deg)` under `.theme--dark`. `packages/excalidraw/css/styles.scss` (~120) applies it only to the **interactive** canvas.
- Note for the architect: an exact inverse is not guaranteed. The 93% invert squeezes channels into [18,237], and the clamp/rounding loses information, so whole-palette colours may need a lookup rather than pure maths. That is a design decision for the change spec.

### Existing tests nearby
- `packages/excalidraw/tests/eyeDropper.test.tsx`: one test (preview positioning). No colour or theme assertions.
- `packages/excalidraw/tests/bucketFill.test.tsx`: the "temporarily activates the background eye dropper while Alt is held" test (~line 153). It calls the atom's `onSelect` directly with `#ff8787`.
- `packages/common/src/colors.test.ts` and `__snapshots__/colors.test.ts.snap`: `applyDarkModeFilter` unit and palette snapshot tests. This is the natural home for inverse-function tests.
- `packages/excalidraw/tests/colorPickerHotkeys.test.ts` and `colorInput.test.tsx`: colour-picker neighbours.
- Caveat: tests run in jsdom with `vitest-canvas-mock`, so `getImageData` returns mocked pixels and not real rendering. A regression test probably needs to stub `getImageData` or test a pure helper.

### Suggested in-scope candidates
`packages/excalidraw/components/EyeDropper.tsx`, `packages/common/src/colors.ts` (if an inverse helper is added; `packages/common/src/index.ts` already does `export * from "./colors"`), `packages/excalidraw/components/EyeDropper.scss` (only if the preview double-filter is in scope), and the test files `packages/excalidraw/tests/eyeDropper.test.tsx` and `packages/common/src/colors.test.ts`.
