# Brownfield discovery: Tier 1

- **Run:** `20261106-161723-bugfix-eyedropper-dark` (intent hint: bugfix)
- **Mode:** first-time
- **Built at:** 2026-11-06T10:48:46Z
- **Plugin:** mmo 0.10.1

## Git state
- HEAD `4872083c044491b6d5c96ae134a75464f96d6831` on branch `EX-BF-04/opus55-plus-flash38-v2`. The latest commit is "feat(editor): bucketfill cursor + eyedropper support (#11849)".
- The working tree is clean.
- Remote: `origin` -> `https://github.com/tl-ai-labs/excalidraw.git`.
- This checkout is a **git worktree** (`.git` is a file). The stash stack is shared with other worktrees.
- `.gitignore` **does not** cover `.sdlc/` (`gitignore_covers_sdlc: false`). However, `.sdlc/` is already ignored in practice through the shared `/Users/apple/Documents/GitHub/excalidraw/.git/info/exclude` (line 7). `git status` and `git add -A` do not show `.sdlc/` in this clone. The exclude is not committed, so a fresh clone would not inherit it.

## Directory topology
The top level holds `.claude/`, `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/`, `examples/`, `excalidraw-app/`, `firebase-project/`, `packages/`, `public/` and `scripts/`.
- `packages/` contains `common`, `element`, `excalidraw`, `fractional-indexing`, `laser-pointer`, `math` and `utils`.
- `examples/` contains `with-nextjs` and `with-script-in-browser`.
- Entry points are `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx` and `packages/excalidraw/index.tsx`.
- The repo has 1267 tracked files, 121 of which are `*.test.ts(x)` files.

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` (root) | node-typescript | React 19 types, Vite 5, Vitest 3, Yarn 1 workspaces |
| `excalidraw-app/package.json` | node-typescript | react, jotai, vite |
| `packages/excalidraw/package.json` | node-typescript | react, jotai |
| `examples/with-nextjs/package.json` | node-typescript | next, react |
| `examples/with-script-in-browser/package.json` | node-typescript | react, vite |
| `dev-docs/package.json` (not a workspace) | node-typescript | docusaurus, react |

TypeScript runs in `strict` mode with ESM and `moduleResolution: bundler`. Internal packages resolve through path aliases in `tsconfig.json` and `vitest.config.mts`.

**Stack adapter:** none of the shipped adapters fits (`generic`, `nest`, `python`). The primary stack is React and TypeScript, so **the Tier 2b adaptive stack profile is triggered**. No `.sdlc/baseline/stack-profile.md` exists yet.

## Test / build / run
- **Proposed test command:** `yarn test`, taken from `package.json#scripts.test` (`yarn.lock` is present). It resolves to `vitest`, which **watches by default**. For pipeline use, prefer `yarn test:app --watch=false [path]`, for example `packages/excalidraw/tests/eyeDropper.test.tsx`.
- **Type check:** `yarn test:typecheck` (`tsc`).
- **Lint:** `yarn test:code` (eslint, `--max-warnings=0`).
- CLAUDE.md says to run `yarn test:update` before committing. It updates snapshots.
- Gate 0 must confirm the command. Tier 1 did not run the tests, so their baseline pass/fail status is unknown.

## Docs present
- `README.md`
- `CLAUDE.md`: monorepo layout and the yarn commands
- `CONTRIBUTING.md`: a pointer to docs.excalidraw.com
- `.github/copilot-instructions.md`: TypeScript and React coding standards
- `dev-docs/` (a Docusaurus site)
- Per-package READMEs
- No ADR directory, ARCHITECTURE.md or AGENTS.md

## Detected AI/agent setup
- `.claude/`, which contains `.claude/settings.local.json`. It is gitignored and has an `env` block. The values were not read.
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- No `.mcp.json`, Cursor, Aider, Continue or Roo config. No `routing-policy.yaml` and no `gemini*` config.

## Env keys (names only)
- `.env.development`, `.env.production` and `.env.test` are **tracked in git**, as upstream Excalidraw does. Together they hold 21 distinct keys, all `VITE_*` plus `MODE` and `FAST_REFRESH`. Examples: `VITE_APP_FIREBASE_CONFIG`, `VITE_APP_WS_SERVER_URL`, `VITE_APP_PLUS_EXPORT_PUBLIC_KEY`.
- The code references 24 env names through `import.meta.env` / `process.env`. See `baseline.json`.

## Monorepo / submodules / LFS
- **Monorepo:** Yarn workspaces over `excalidraw-app`, `packages/*` and `examples/*`. A single root vitest config covers every package, and the packages have no test scripts of their own.
- **Submodules:** none.
- **LFS:** none. `.gitattributes` holds only `* text=auto eol=lf`.

## Infra hints
- `Dockerfile` and `docker-compose.yml`
- 11 GitHub workflows, including `test.yml`, `lint.yml` and `test-coverage-pr.yml`
- `vercel.json` and `firebase-project/`
- A Husky `pre-commit` hook exists, but its `lint-staged` call is commented out, so it does nothing.

## Regulated-repo signals
None detected.

## Coexistence risks
- **`.sdlc/` not gitignored:** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. *(This risk is mitigated locally, because `.git/info/exclude` already ignores `.sdlc/`. Adding the `.gitignore` entry is optional.)*
- **Claude Code local settings:** `.claude/settings.local.json` defines an `env` block. The plugin leaves it untouched. It is gitignored.
- **Copilot instructions:** `.github/copilot-instructions.md` is present. The plugin leaves it untouched.
- **Tracked env files:** `.env.development` and `.env.production` are committed. They are off-limits, and their values were never read.
- **Worktree:** the git stash is shared across worktrees. Avoid bare `git stash` / `git stash pop`.

## Proposed off-limits
`.git/**`, `.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/**`, `**/node_modules/**`, `**/dist/**`, `**/build/**`, `.next/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts` (both generated), `.sdlc/**`

## Orientation for this run (bugfix: eyedropper)
Files whose names match the run slug:
- `packages/excalidraw/components/EyeDropper.tsx`
- `packages/excalidraw/components/EyeDropper.scss`
- `packages/excalidraw/tests/eyeDropper.test.tsx`

## Scan notes
This was a full Tier 1 scan. It finished well inside the timebox, and no sampling was needed.
