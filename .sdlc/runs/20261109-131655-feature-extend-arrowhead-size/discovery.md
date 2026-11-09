# Brownfield discovery: EX-FE-09 (Excalidraw monorepo)

- Run: `20261109-131655-feature-extend-arrowhead-size` (mode: first-time, Tier 1)
- Intent hint: feature-extend. Let users pick the size of an arrow's heads through a new per-element property and a properties-panel control.
- Plugin version: 0.10.1

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-FE-09/opus55-plus-flash38-agsdk`, working tree clean.
- Remote `origin` is https://github.com/tl-ai-labs/excalidraw.git
- This is a **git worktree**. Its gitdir is `/Users/sriram/excalidraw-agy/.git/worktrees/EX-FE-09`, and the git root matches the cwd.
- 1327 tracked files, so no sampling was needed.
- `gitignore_covers_sdlc: false`. The committed `.gitignore` does not list `.sdlc/`. In practice `.sdlc/` is still ignored, through the main repo's `.git/info/exclude` (line 7). That exclude is local-only and shared by all worktrees.

## Directory topology
Top level: `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/`, `examples/`, `excalidraw-app/`, `firebase-project/`, `packages/`, `public/`, `scripts/`.
- `packages/`: common, element, excalidraw, fractional-indexing, laser-pointer, math, utils
- `excalidraw-app/`: app-language, collab, components, data, share, tests
- `examples/`: with-nextjs, with-script-in-browser

Entry points: `packages/excalidraw/index.tsx` (library), `packages/element/src/index.ts`, `packages/common/src/index.ts`, `packages/math/src/index.ts`, `excalidraw-app/index.tsx` / `App.tsx` (app).

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` (root, yarn@1.22.22 workspaces) | node-typescript | react, vite, vitest |
| `packages/excalidraw/package.json` | node-typescript | react, jotai, esbuild |
| `excalidraw-app/package.json` | node-typescript | react, jotai, firebase, socket.io-client, vite |
| `examples/with-nextjs/package.json` | node-typescript | next, react |
| `examples/with-script-in-browser/package.json` | node-typescript | react, vite |

The TypeScript setup is 5.9.3 with `strict: true`, ESM (`"type": "module"`), `moduleResolution: bundler` and `jsx: react-jsx`. Internal packages resolve through path aliases in `vitest.config.mts` and `tsconfig.json`.
None of the pre-authored adapters (generic, nest, python) fits this stack, so the **Tier 2b stack profile was triggered**. It is at `.sdlc/baseline/stack-profile.md`.

## Test / build commands
- Proposed test command: **`yarn test`**, from `package.json#scripts.test`. It runs `yarn test:app`, which runs `vitest`, and yarn.lock is present.
- Non-interactive form (recommended for Phase 7): `yarn test:app --watch=false [path-filter]`. On a TTY, vitest starts in watch mode.
- CLAUDE.md says to run `yarn test:update` before committing (it updates snapshots) and `yarn test:typecheck` (`tsc`).
- Other commands: lint is `yarn test:code`, the prettier check is `yarn test:other`, the full gate is `yarn test:all`, and auto-fix is `yarn fix`.
- Gate 0 should confirm which of these Phase 7 uses.

## Docs
- `README.md` is the product readme for excalidraw.com.
- `CLAUDE.md` describes the monorepo layout and the commands above.
- `AGENTS.md` has 2 rules:
  - Use `app.ownerDocument` / `app.ownerWindow` instead of DOM globals.
  - Prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit & ...`.
- `CONTRIBUTING.md` is a short pointer.
- `dev-docs/` holds the docs site (`dev-docs/README.md`, `dev-docs/docs/{@excalidraw,codebase,introduction,assets}`).
- There are no ADR directories.

## Detected AI/agent setup
| Path | Type |
|---|---|
| `.github/copilot-instructions.md` | github-copilot |
| `CLAUDE.md` | claude-instructions |
| `AGENTS.md` | agents-instructions |

Not present: `.claude/` (it is listed in `.gitignore`), `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `CLAUDE.local.md`, any `routing-policy.yaml`, and any `gemini*.{yaml,json}`.

## Env file keys (names only)
- `.env.development` (20 keys): MODE, VITE_APP_BACKEND_V2_GET_URL, VITE_APP_BACKEND_V2_POST_URL, VITE_APP_LIBRARY_URL, VITE_APP_LIBRARY_BACKEND, VITE_APP_WS_SERVER_URL, VITE_APP_PLUS_LP, VITE_APP_PLUS_APP, VITE_APP_AI_BACKEND, VITE_APP_FIREBASE_CONFIG, VITE_APP_DEV_DISABLE_LIVE_RELOAD, VITE_APP_ENABLE_TRACKING, FAST_REFRESH, VITE_APP_PORT, VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX, VITE_APP_COLLAPSE_OVERLAY, VITE_APP_ENABLE_ESLINT, VITE_APP_ENABLE_PWA, VITE_APP_PLUS_EXPORT_PUBLIC_KEY, VITE_APP_DISABLE_PREVENT_UNLOAD
- `.env.production` (15 keys): a subset of the development keys.
- `.env.test`: VITE_DEBUG_DOM
- All 3 env files are **tracked in git**. Upstream does this on purpose: they hold public `VITE_APP_*` client config. They stay off-limits anyway.
- Env vars referenced in code (`process.env.*` / `import.meta.env.*`): the `VITE_APP_*` keys above plus DEV, PROD, MODE, VITE_APP_DISABLE_SENTRY, VITE_APP_GIT_SHA, VITE_WORKER_ID, PKG_NAME, PKG_VERSION, IS_PREACT, and CI vars (GITHUB_*, RUNNER_NAME, PR_TITLE, OSS_STATS_API_URL, OSS_STATS_TOKEN).
- None of these is relevant to the arrowhead-size feature.

## Monorepo / submodules / LFS
- Monorepo: **yarn workspaces** (`excalidraw-app`, `packages/*`, `examples/*`), 10 packages. No package has its own test script: vitest runs from the root, so filter by path (`yarn test:app --watch=false packages/element`).
- Submodules: none.
- Git-LFS: none. `.gitattributes` holds only `* text=auto eol=lf`.

## Infra hints
`Dockerfile`, `docker-compose.yml`, `.github/workflows/` (12 workflows, including test.yml, lint.yml and test-coverage-pr.yml), `vercel.json`, `firebase-project/`. No terraform, GitLab CI, CircleCI or Jenkins.

## Regulated-repo signals
None found. There is no SECURITY/PRIVACY/COMPLIANCE/HIPAA/SOC2/PCI/GDPR file, no regulated directory, and no CODEOWNERS file. `regulated_repo_warning_required: false`.

## Coexistence risks
- **GitHub Copilot instructions** are at `.github/copilot-instructions.md`. The plugin never touches them. They ask for TypeScript, performance-first code, immutable data, and optional chaining / nullish coalescing, which matches the repo style.
- **Husky + lint-staged pre-commit hooks** live in `.husky/` and `.lintstagedrc.js`. Any commit runs eslint/prettier on staged files.
- **`.sdlc/` not gitignored:** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. (Mitigation already in place: `.sdlc/` is in the main repo's `.git/info/exclude`, so `git add -A` currently skips it on this machine. That protection is not committed.)

## Proposed off-limits
- Env files: `.env`, `.env.*`, `.env.local`
- AI/agent config: `.github/copilot-instructions.md`, `.claude/**`, `CLAUDE.local.md`, `.mcp.json`. `CLAUDE.md` and `AGENTS.md` are guidance and stay untouched unless the user opts them in.
- Build and generated output: `node_modules/**`, `dist/**`, `build/**`, `dev-dist/**`, `coverage/**`, `.next/**`, `packages/excalidraw/types/**`
- Generated code (`// GENERATED CODE -- DO NOT EDIT!`): `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`
- `.git/**`, `.sdlc/**`

## Pointers for the intent (arrowhead size)
These files are where the existing arrowhead feature lives. They are listed for the architect, not edited:
- Element type: `packages/element/src/types.ts`. `ExcalidrawLinearElement` has `startArrowhead` / `endArrowhead` (around lines 369-377).
- Arrowhead geometry: `packages/element/src/bounds.ts`. Look at `getArrowheadSize(arrowhead)` (hard-coded px per type, around line 727), `getArrowheadAngle(arrowhead, size)` (already supports a scaled-down size) and `getArrowheadPoints` (around line 992).
- Rendering and shapes: `packages/element/src/shape.ts`, `renderElement.ts`.
- Element factories: `packages/element/src/newElement.ts` (`newLinearElement`, `newArrowElement`).
- Normalization: `packages/element/src/arrowheads.ts`.
- Restore and load: `packages/excalidraw/data/restore.ts` (the arrow branch, around lines 670-710). A new property needs a default there for old files.
- Properties panel action: `packages/excalidraw/actions/actionProperties.tsx`. `actionChangeArrowhead` is around line 1960, `actionChangeArrowProperties` around line 2058, and `actionChangeStrokeWidth` (around line 716) is a good pattern for a discrete-size `RadioSelection`. `Range` is imported for a slider.
- Action names: `packages/excalidraw/actions/types.ts` (the `ActionName` union).
- Panel layout and predicates: `packages/excalidraw/components/Actions.tsx`, `components/shapeActionPredicates.ts` (`arrowheads` predicate).
- AppState defaults: `packages/excalidraw/appState.ts` and `packages/excalidraw/types.ts`. These hold the `currentItemStartArrowhead` / `currentItemEndArrowhead` pattern, which a `currentItem...` size would mirror.
- Copy styles: `packages/excalidraw/actions/actionStyles.ts` (copies arrowheads).
- Locales: `packages/excalidraw/locales/en.json` (`labels.arrowheads`). Edit only en.json; Crowdin handles the other locales.
- Tests: `packages/excalidraw/actions/actionProperties.test.tsx`, `packages/element/tests/shape.test.ts`, `packages/excalidraw/tests/data/restore.test.ts`. Snapshot tests elsewhere may change when element shape fields change, which is why CLAUDE.md asks for `yarn test:update`.
