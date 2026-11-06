# Brownfield discovery: excalidraw-3

- Run: `20261106-103201-bugfix-dark-eyedropper` (intent hint: bugfix)
- Mode: first-time (full Tier 1 scan, plus the Tier 2b stack profile)
- Built: 2026-11-06T10:32:01Z, plugin mmo 0.10.1
- Scan finished well inside the timebox. 1,267 tracked files, so no sampling was needed.

## Git state
- HEAD `4872083c044491b6d5c96ae134a75464f96d6831` on branch `EX-BF-04/argon4-agsdk-only`. The default branch is `master`.
- Working tree: **clean**.
- This folder is a **git worktree**: `.git` is a file, and the main clone is at `/Users/macbook/Documents/GitHub/Google-Projects/excalidraw`.
- Remotes: `origin` https://github.com/tl-ai-labs/excalidraw.git, `upstream` https://github.com/excalidraw/excalidraw.git
- `gitignore_covers_sdlc: false`. `.gitignore` has no `.sdlc` entry. `.sdlc/` **is** ignored through the clone's shared `.git/info/exclude` (line 7). Because of that, `git add -A` will not stage it here, though other clones would not inherit the rule.

## Directory topology
Top level: `.claude/`, `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/`, `examples/`, `excalidraw-app/`, `firebase-project/`, `packages/`, `public/`, `scripts/`.
- `packages/`: common, element, excalidraw, fractional-indexing, laser-pointer, math, utils
- `excalidraw-app/`: app-language, collab, components, data, share, tests
- `examples/`: with-nextjs, with-script-in-browser
- Entry points: `packages/excalidraw/index.tsx`, `packages/*/src/index.ts`, `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`

## Detected stacks
- Root `package.json`: node-typescript. A Yarn 1.22.22 workspaces monorepo using React 19, Vite 5, Vitest 3 and TypeScript 5.9.3 in strict mode (ESNext module, `bundler` module resolution).
- `packages/excalidraw`: React, jotai, roughjs.
- `excalidraw-app`: React, Vite, jotai, i18next.
- `examples/with-nextjs`: Next.js. `dev-docs`: Docusaurus. dev-docs is not a workspace and has its own yarn.lock.
- No pre-authored adapter matches: the shipped adapters are generic, nest and python. **Tier 2b ran.** The profile is at `.sdlc/baseline/stack-profile.md`.

## Test / build commands
- Proposed: **`yarn test`**, from `package.json#scripts.test`, which expands to `yarn test:app`, which runs `vitest`.
  - **Caveat:** bare `vitest` starts in **watch mode**. For a non-interactive Phase 7 run, use `yarn test:app --watch=false [paths]`.
  - Targeted example for this bugfix: `yarn test:app --watch=false packages/common/src/colors.test.ts packages/excalidraw/tests/eyeDropper.test.tsx`
- Other scripts:
  - `test:typecheck` (`tsc`)
  - `test:code` (`eslint --max-warnings=0 --ext .js,.ts,.tsx .`)
  - `test:other` (prettier `--list-different`)
  - `test:update` (`vitest --update --watch=false`, the step CLAUDE.md asks for before committing)
  - `test:all` (typecheck + code + other + app)
  - `test:coverage`
  - `fix`
- No workspace package defines its own test script. Every test runs from the root `vitest.config.mts`, which uses jsdom, `globals: true`, `setupTests.ts`, and `@excalidraw/*` aliases that point at `packages/*/src`.
- Gate 0 must confirm the command.

## Docs present
- `README.md`: the project landing page (whiteboard, docs links)
- `CLAUDE.md`: monorepo layout; run `yarn test:update` before committing; `yarn test:typecheck`; `yarn fix`
- `CONTRIBUTING.md`: points at docs.excalidraw.com
- `dev-docs/README.md`: the Docusaurus docs site
- `.github/copilot-instructions.md`: coding standards (TypeScript, functional React, naming)
- No ADR directory, no ARCHITECTURE.md, no AGENTS.md.

## Detected AI/agent setup
- `.claude/` (directory) holding `.claude/settings.local.json`. `.claude` is gitignored.
- `CLAUDE.md` (tracked)
- `.github/copilot-instructions.md` (tracked)
- Not present: `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `CLAUDE.local.md`, any repo-local `routing-policy.yaml`, any `gemini*.{yaml,json}`.

## Env keys (names only)
- `.env.development`: 20 keys. `.env.production`: 15 keys. `.env.test`: `VITE_DEBUG_DOM`. No `.env` or `.env.local` exists.
- Most keys are `VITE_APP_*` (backend URLs, Firebase config, tracking flags, the Plus export public key).
- `process.env.*` references in code: `IS_PREACT`, `PR_TITLE`, `VITE_DEBUG_DOM`. Most configuration goes through `import.meta.env.*`; the full list is in baseline.json.

## Monorepo / submodules / LFS
- Yarn workspaces cover `excalidraw-app`, `packages/*` and `examples/*`: 10 packages in all, listed in baseline.json.
- Submodules: none.
- LFS: none. `.gitattributes` holds only `* text=auto eol=lf`.

## Infra hints
`Dockerfile`, `docker-compose.yml`, 11 GitHub workflows (including `test.yml`, `lint.yml`, `test-coverage-pr.yml`, `size-limit.yml`), `vercel.json`, `firebase-project/`, `crowdin.yml`, `.codesandbox/`, and husky with lint-staged as a pre-commit hook.

## Regulated-repo signals
None found. `regulated_repo_warning_required: false`.

## Coexistence risks
- `.claude/settings.local.json` and `CLAUDE.md` exist. The plugin leaves them untouched.
- `.github/copilot-instructions.md` exists. The plugin leaves it untouched.
- "Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run."
  - Mitigating fact: in this clone, `.sdlc/` is already excluded by `.git/info/exclude`, so `git status` shows it as ignored. The risk only applies to other clones.
- A husky pre-commit hook runs lint-staged (prettier and eslint) on commit. Any commit at the end of the run will reformat staged files.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, the generated `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts` and `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `yarn.lock`, `.git/**`, `.sdlc/**`.

## Intent notes (bugfix: dark-theme eyedropper)
All the named files exist at these paths:
| File | Lines |
|---|---|
| `packages/common/src/colors.ts` | 392 (`applyDarkModeFilter` at line 83, `rgbToHex` at 289, `getBucketFillBackgroundColor` at 260) |
| `packages/excalidraw/components/EyeDropper.tsx` | 248 (samples the canvas with `getImageData` and returns `rgbToHex(...)`, around lines 87-94) |
| `packages/excalidraw/actions/actionProperties.tsx` | 2217 (`actionChangeBucketFillBackgroundColor` at line 492) |
| `packages/excalidraw/components/App.bucketFill.ts` | 280 (class `AppBucketFill`) |
| `packages/excalidraw/components/App.cursor.ts` | 204 (class `AppCursor`) |
| `packages/common/src/colors.test.ts` | 286, plus its snapshot `packages/common/src/__snapshots__/colors.test.ts.snap` |
| `packages/excalidraw/tests/eyeDropper.test.tsx` | 50 (a single preview-position test) |

Related files the person did not name:
- `packages/excalidraw/components/EyeDropper.scss`
- `packages/element/src/bucketFill.ts`
- `packages/excalidraw/tests/bucketFill.test.tsx`
- `packages/element/tests/bucketFill.test.ts`
- `packages/excalidraw/tests/colorPickerHotkeys.test.ts`
- `packages/excalidraw/components/App.tsx`, which wires the classes at lines 435-436 and 685-687

Note: `colors.test.ts` uses snapshot assertions. Changes to `COLOR_PALETTE` would need `test:update`.
