# Discovery: Excalidraw monorepo (EX-NF-11 worktree)

Run: `20261105-000000-feature-new-rich-text-spans` | Mode: first-time | Built: 2026-11-05T07:03:07Z | Plugin 0.10.1
Upcoming job (feature-new): let users colour or highlight part of a text element, with the styling saved, synced through collaboration, drawn on the canvas and kept in SVG export.

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-NF-11/argon4-plus-sonnet55`. The working tree is clean.
- Remote `origin` is https://github.com/tl-ai-labs/excalidraw.git.
- This folder is a **git worktree**. Its git dir is `/Users/apple/Documents/GitHub/excalidraw/.git`, and the stash stack is shared with the other worktrees.
- `.gitignore` does **not** list `.sdlc/`. Git still ignores it through the shared `.git/info/exclude` (line 7, `.sdlc/`), so `git status` stays clean today.
- 1327 tracked files. Normal size, no sampling needed.

## Topology
The root is a yarn-workspaces monorepo:
- `packages/`: `common`, `element`, `excalidraw`, `fractional-indexing`, `laser-pointer`, `math`, `utils`
- `excalidraw-app/`: the excalidraw.com app (`collab/`, `data/`, `components/`, `share/`, `tests/`)
- `examples/`: `with-nextjs`, `with-script-in-browser`
- Also `dev-docs/` (docs site), `firebase-project/`, `public/`, `scripts/`

Entry points:
- `packages/excalidraw/index.tsx`
- `packages/element/src/index.ts`
- `packages/common/src/index.ts`
- `excalidraw-app/index.tsx` and `excalidraw-app/App.tsx`

## Detected stacks
- `package.json`: **node-typescript**. It uses React 19 (library), Vite 5 (app), vitest 3 with jsdom and vitest-canvas-mock, esbuild (package builds), TypeScript 5.9 strict, yarn 1.22.22 and Node >=18.
- There is no pre-authored adapter for React/TS, so the **Tier 2b adaptive profile was triggered**. It is written to `.sdlc/baseline/stack-profile.md`.

## Test / build commands
- Proposed: `yarn test`, from `package.json#scripts.test`. It resolves to `vitest` in **watch mode**.
  - For non-interactive runs use `yarn test:app --watch=false [path]`.
  - CLAUDE.md asks for `yarn test:update` (updates snapshots) before committing.
- Typecheck: `yarn test:typecheck`. Lint: `yarn test:code`. Format check: `yarn test:other`. Fix: `yarn fix`.
- Gate 0 should confirm which command to use.

## Docs present
- Instruction and repo docs: README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md (a pointer to docs.excalidraw.com) and .github/copilot-instructions.md.
- Package READMEs under `packages/*`, plus `dev-docs/README.md`. No ADR directory.
- AGENTS.md rules:
  - Use `app.ownerDocument` / `app.ownerWindow` instead of DOM globals.
  - Prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit & …`.
- Copilot instructions: prefer performant, allocation-free code and immutable data, with PascalCase types and ALL_CAPS constants.

## Detected AI/agent setup
- `.claude/settings.local.json`: Claude Code local settings, with an `env` key only
- `CLAUDE.md` and `AGENTS.md`
- `.github/copilot-instructions.md`
- None of these were found: `.mcp.json`, Cursor, Aider, Continue, Roo, `routing-policy.yaml`, gemini config.

## Env keys (names only)
- `.env.development`, `.env.production` and `.env.test` are **tracked in git**. They hold public Vite config (backend URLs, flags). No `.env` or `.env.local` exists.
- Keys referenced in code are `VITE_APP_*`, CI `GITHUB_*` vars, and `OSS_STATS_API_URL` / `OSS_STATS_TOKEN` (stats script). The full list is in `baseline.json`.

## Monorepo, submodules, LFS
- Yarn workspaces, with 10 workspace packages.
- One root vitest config with path aliases (`vitest.config.mts`) maps `@excalidraw/*` to the `src` folders.
- Submodules: none.
- LFS: none. `.gitattributes` holds only `* text=auto eol=lf`.

## Infra hints
- Dockerfile, docker-compose.yml, `.github/workflows/` (test, lint, size-limit, stats and others), vercel.json, firebase-project, and husky with lint-staged.

## Regulated-repo signals
None found.

## Job-relevant map (rich text spans)
- Type: `ExcalidrawTextElement` in `packages/element/src/types.ts:253`. It has `text`, `originalText`, `fontSize`, `fontFamily`, `baseFontSize`, `lineHeight` and `autoResize`.
- Creation and update:
  - `packages/element/src/newElement.ts`: `newTextElement` at line 337, `refreshTextDimensions` at line 540
  - `packages/element/src/mutateElement.ts`: mutation bumps `version`
  - `packages/element/src/textElement.ts`, `textMeasurements.ts`, `textWrapping.ts`
- Editor:
  - `packages/excalidraw/wysiwyg/textWysiwyg.tsx`: a textarea-based editor with `onChange` / `onSubmit(nextOriginalText)`
  - `packages/excalidraw/components/App.text.ts`: `handleTextWysiwyg`
  - `packages/excalidraw/actions/colorTargets.ts`: the stroke colour target resolution. It already knows about `editingTextElement`.
  - `packages/excalidraw/actions/actionProperties.tsx`: the colour picker actions
- Canvas: `packages/element/src/renderElement.ts`. `case "text"` is near line 1164, and the per-line `context.fillText` call is near line 707. Lines are drawn through an offscreen element-canvas cache.
- SVG: `packages/excalidraw/renderer/staticSvgScene.ts`. `renderElementToSvg` writes one `<text>` per line near lines 795-830, with `fill=strokeColor` and dark-mode filtering. It is called from `packages/excalidraw/scene/export.ts`.
- Restore: `packages/excalidraw/data/restore.ts` (`case "text"` near line 555). New fields need defaults and normalisation here.
- Collaboration:
  - `packages/excalidraw/data/reconcile.ts` and `excalidraw-app/collab/Collab.tsx` reconcile whole elements by version and have no text-specific logic.
  - History and undo diff element props in `packages/element/src/delta.ts` and `store.ts`.
- Other places that touch text: `packages/element/src/duplicate.ts`, `packages/excalidraw/clipboard.ts`, `packages/element/src/transform.ts` (skeleton API), and `packages/excalidraw/actions/actionBoundText.tsx`.
- Tests:
  - `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`
  - `packages/element/tests/textElement.test.ts`, `newElement.test.ts`, `textWrapping.test.ts`, `delta.test.tsx`, `duplicate.test.tsx`
  - `packages/excalidraw/tests/data/restore.test.ts` (and its snapshot), `tests/data/reconcile.test.ts`, `tests/scene/export.test.ts` (and its snapshot), `tests/export.test.tsx`, `tests/colorTargets.test.ts`, `actions/actionProperties.test.tsx`, `tests/clipboard.test.tsx`
  - `packages/utils/tests/export.test.ts`

## Coexistence risks
- **Claude Code project config present.** `.claude/settings.local.json` exists. The plugin will not touch it.
- **Repo instruction files present.** CLAUDE.md, AGENTS.md and .github/copilot-instructions.md are off-limits by default. Their conventions should be carried into the change spec.
- **`.sdlc/` not covered by `.gitignore`.**
  - Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run.
  - Mitigation already in place: the shared `.git/info/exclude` ignores `.sdlc/` for this worktree.
- **Shared worktree state.** This is a worktree, so the git dir and stash are shared with other checkouts. Never use bare `git stash`.
- **Pre-commit hooks.** husky runs lint-staged on commit (prettier and eslint), so commits may be reformatted or rejected.
- **Snapshot tests.** Many large snapshot tests exist (`restore`, `export`, `App`, `regressionTests`). Adding a field to text elements will change those snapshots, which then need `yarn test:update` and review.

## Proposed off-limits
- Env files: `.env.development`, `.env.production`, `.env.test`, `.env`, `.env.*`, `.env.local`
- AI config and instructions: `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- Dependencies: `node_modules/**`, `**/node_modules/**`
- Build output:
  - `packages/*/dist/**`, `packages/*/build/**`
  - `excalidraw-app/{build,dist,dev-dist}/**`
  - `examples/*/{build,dist}/**`, `examples/with-nextjs/.next/**`
  - `dev-docs/build/**`
- Repo internals: `.git/**`, `.sdlc/**`
