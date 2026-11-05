# Discovery: excalidraw (EX-FE-09 worktree)

- Run: `20261105-feature-extend-arrowhead-size` (mode: first-time, full Tier 1 scan)
- Built at: 2026-11-05T11:15:50Z, plugin mmo 0.10.1
- Upcoming intent (context only): feature-extend, adding a per-element arrowhead size property and a properties-panel control.

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-FE-09/argon4-plus-sonnet55`. Working tree is **clean**.
- Remote: `origin` -> https://github.com/tl-ai-labs/excalidraw.git
- This is a **git worktree**. Its git dir is shared with `/Users/apple/Documents/GitHub/excalidraw/.git`.
- `.gitignore` does **not** list `.sdlc/`, but the shared `.git/info/exclude` has `.sdlc/` (line 7). Run artifacts are therefore already ignored and won't show up in `git add -A`.
- 1,327 tracked files. No large-repo sampling was needed.

## Directory topology
Top level: `.claude/`, `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/` (Docusaurus site), `examples/` (with-nextjs, with-script-in-browser), `excalidraw-app/` (excalidraw.com app), `firebase-project/`, `packages/` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `public/`, `scripts/`.

Entry points:
- `packages/excalidraw/index.tsx` (library)
- `excalidraw-app/index.tsx` and `excalidraw-app/App.tsx` (app)
- `packages/*/src/index.ts` (each package)

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` (root, yarn@1.22.22 workspaces) | node-typescript | React 19, Vite 5, Vitest 3, TypeScript 5.9 strict |
| `packages/excalidraw/package.json` | node-typescript | React (library built with esbuild) |
| `excalidraw-app/package.json` | node-typescript | React, Vite |
| `examples/with-nextjs/package.json` | node-typescript | Next.js |
| `examples/with-script-in-browser/package.json` | node-typescript | React, Vite |
| `dev-docs/package.json` (not a workspace member) | node-typescript | Docusaurus |

The plugin has no pre-authored adapter for React/TypeScript (it ships only generic, nest and python), so **Tier 2b was triggered**. The learned profile is at `.sdlc/baseline/stack-profile.md`.

## Test / build commands
- **Proposed test command: `yarn test:app --watch=false`.** Source: `package.json#scripts.test` = `yarn test:app` = `vitest`. A bare `vitest` starts in watch mode, so the proposal adds `--watch=false`.
- Targeted form: `yarn test:app --watch=false packages/excalidraw/actions/actionProperties.test.tsx`
- CLAUDE.md asks for `yarn test:update` (vitest with snapshot update, no watch) before committing and `yarn test:typecheck` (`tsc`) for types. There is also `yarn test:code` (eslint, max-warnings 0) and `yarn test:all`.
- Gate 0 must confirm the command. Tests were **not run** during discovery, so whether any tests already fail is unknown.

## Docs present
- `README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` (points to the docs site), `dev-docs/README.md`, `packages/excalidraw/README.md`, `packages/excalidraw/CHANGELOG.md`, `.github/copilot-instructions.md`
- No ADR directory.
- AGENTS.md rules:
  - For new DOM APIs, use `app.ownerDocument` / `app.ownerWindow`.
  - Prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit & Overrides`.

## Detected AI/agent setup
- `.claude/` with `settings.local.json`: untracked and gitignored.
- `.github/copilot-instructions.md`: tracked. Holds TS/React coding standards.
- `CLAUDE.md`, `AGENTS.md`: tracked project instructions.
- None of these were found: Cursor, Aider, Continue, Roo, `.mcp.json`, `routing-policy.yaml`, gemini configs.

## Env files (key names only)
- `.env.development`: 20 keys. `.env.production`: 15 keys. `.env.test`: `VITE_DEBUG_DOM`.
- All three are **tracked in git** (upstream convention: public Vite config such as backend URLs and Firebase config). No `.env` or `.env.local` exists.
- Code references 30 env names through `import.meta.env` / `process.env`. These include the `VITE_APP_*` keys plus CI-only names such as `OSS_STATS_TOKEN` and `GITHUB_SHA`.
- None of these are relevant to the arrowhead feature.

## Monorepo / submodules / LFS
- Yarn workspaces: `excalidraw-app`, `packages/*`, `examples/*` (10 members).
- There are no per-package test scripts. A single root `vitest.config.mts` resolves the `@excalidraw/*` aliases to source.
- Submodules: none. LFS: none (`.gitattributes` only has `* text=auto eol=lf`).

## Infra hints
- Dockerfile, docker-compose.yml, vercel.json, firebase-project/
- 12 GitHub workflows, including `test.yml`, `lint.yml`, `test-coverage-pr.yml` and `size-limit.yml`.
- Husky is installed, but the `pre-commit` hook's lint-staged line is commented out, so the hook does nothing.

## Regulated-repo signals
None detected.

## Coexistence risks
- `.claude/settings.local.json` exists (your local Claude Code settings). The plugin never touches it.
- `.github/copilot-instructions.md`, `CLAUDE.md` and `AGENTS.md` hold project conventions. They are off-limits by default but should be read as convention input.
- `.sdlc/` is not in `.gitignore`. It is already ignored through the shared `.git/info/exclude`, so Gate 0 does not need to add `.gitignore` to the allowlist. Note that this protection is local to the clone and not committed.
- No Cursor, Aider, custom MCP or repo-local routing-policy risks.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.mcp.json`, `**/node_modules/**`, `**/dist/**`, `**/build/**`, `**/.next/**`, `dev-dist/**`, `coverage/**`, `packages/*/types/**` (generated d.ts), `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts` (generated wasm wrappers), `yarn.lock`, `.git/**`, `.sdlc/**`.

## Pointers for the upcoming feature (orientation only)
- Element type: `packages/element/src/types.ts` (`ExcalidrawLinearElement.startArrowhead/endArrowhead`, `Arrowhead` union)
- Sizes: `packages/element/src/bounds.ts` (`getArrowheadSize`, `getArrowheadAngle`, and arrowhead point math). Callers include `elbowArrow.ts` and `transform.ts`.
- Panel action: `packages/excalidraw/actions/actionProperties.tsx` (`actionChangeArrowhead`, `actionChangeArrowProperties`)
- Action names: `packages/excalidraw/actions/types.ts`
- Panel layout: `packages/excalidraw/components/Actions.tsx`
- Defaults: `packages/excalidraw/appState.ts` (`currentItem*`) and `packages/excalidraw/types.ts` (AppState)
- Construction: `packages/element/src/newElement.ts` (`newArrowElement`)
- Load and migration: `packages/excalidraw/data/restore.ts`
- Strings: `packages/excalidraw/locales/en.json`
- Tests: `packages/excalidraw/actions/actionProperties.test.tsx` and `packages/element/tests/bounds.test.ts`
