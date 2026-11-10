# Brownfield discovery — project baseline (built by run 20261109-163637-feature-new-pages)

Mode: first-time (full Tier 1 scan, plus Tier 2b stack profile). Intent hint: `feature-new`. Plugin 0.10.1.
The scan ran inside its timebox. The repo has 1,327 tracked files, so no sampling was needed.

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-NF-12/opus55-plus-flash38-agsdk`. The working tree
  is clean.
- This folder is a **git worktree**: `.git` is a file pointing at
  `/Users/macbook/Documents/GitHub/Google-Projects/excalidraw/.git/worktrees/EX-NF-12`. The git root matches the cwd.
- Remotes: `origin` https://github.com/tl-ai-labs/excalidraw.git, `upstream` https://github.com/excalidraw/excalidraw.git
- `gitignore_covers_sdlc: false`, because `.gitignore` has no `.sdlc` line. However, the shared
  `.git/info/exclude` contains `.sdlc/` (`git check-ignore` confirms it), so `.sdlc/` is in practice already
  ignored here.

## Directory topology
Top level: `.claude/`, `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/` (Docusaurus site), `examples/`
(`with-nextjs`, `with-script-in-browser`), `excalidraw-app/` (`app-language`, `collab`, `components`, `data`, `share`,
`tests`), `firebase-project/`, `packages/` (`common`, `element`, `excalidraw`, `fractional-indexing`,
`laser-pointer`, `math`, `utils`), `public/`, `scripts/`.

Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `packages/excalidraw/index.tsx`,
`packages/{common,element,math,utils,fractional-indexing,laser-pointer}/src/index.ts`,
`examples/with-script-in-browser/index.tsx`.

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| package.json (root) | node-typescript | yarn workspaces, vitest, vite, strict TS, eslint (--max-warnings=0), prettier |
| packages/excalidraw/package.json | node-typescript | React (peer 17/18/19), jotai via `editor-jotai`, radix-ui, sass, roughjs, codemirror |
| excalidraw-app/package.json | node-typescript | React 19, Vite, jotai via `app-jotai`, firebase, socket.io-client, sentry |
| examples/with-nextjs/package.json | node-typescript | Next.js |
| dev-docs/package.json | node-typescript | Docusaurus (not a workspace member) |

None of the pre-authored adapters (generic, nest, python) match, so **Tier 2b ran**. See
`.sdlc/baseline/stack-profile.md`.

## Test / build commands
- **Proposed test command:** `yarn test:app --watch=false`. Source: `package.json#scripts.test`, which is
  `yarn test:app`, which runs `vitest`. Without `--watch=false`, vitest starts in watch mode.
- CLAUDE.md says: "Always run `yarn test:update` before committing" (vitest `--update --watch=false`, which
  rewrites snapshots). Type safety: `yarn test:typecheck` (tsc).
- Other options: `yarn test:code` (eslint), `yarn test:all` (typecheck + lint + prettier + vitest). For a scoped
  run, use `yarn test:app --watch=false <path>`.
- Gate 0 should confirm the choice with the user.

## Docs present
README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md (it points to docs.excalidraw.com), `.github/copilot-instructions.md`,
package READMEs (excalidraw, common, element, math, utils, laser-pointer), `dev-docs/README.md`,
`examples/with-nextjs/README.md`, `packages/excalidraw/locales/README.md`. There are no ADR directories.

Rules from these files that the spec must carry:
- AGENTS.md: use `app.ownerDocument` / `app.ownerWindow` instead of globals, and prefer the `Merge<Base, Overrides>`
  utility type.
- copilot-instructions: put performance first, prefer immutable code, use `?.` / `??`.
- CLAUDE.md: Yarn workspaces, path aliases in `vitest.config.mts`, esbuild for packages and Vite for the app.

## Detected AI/agent setup
| Path | Type |
|---|---|
| `.claude/` | Claude Code project dir (gitignored by the repo) |
| `.claude/settings.local.json` | Claude Code local settings (contents not read) |
| `CLAUDE.md` | Claude instructions |
| `AGENTS.md` | Agent instructions |
| `.github/copilot-instructions.md` | GitHub Copilot instructions |

Not found: `.claude/settings.json`, `CLAUDE.local.md`, `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`,
`.continue/`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env keys
- Env files present: `.env.development`, `.env.production`, `.env.test`. All three are committed.
- **Key names from these files were not collected.** The permission classifier denied reading them, even for names
  only. No values or names were read. If Gate 0 needs them, ask the user or re-attempt with explicit permission.
- Env vars referenced in code (names only):
  - `import.meta.env`: `VITE_APP_AI_BACKEND`, `VITE_APP_BACKEND_V2_GET_URL`, `VITE_APP_BACKEND_V2_POST_URL`,
    `VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX`, `VITE_APP_DISABLE_PREVENT_UNLOAD`, `VITE_APP_DISABLE_SENTRY`,
    `VITE_APP_ENABLE_TRACKING`, `VITE_APP_FIREBASE_CONFIG`, `VITE_APP_GIT_SHA`, `VITE_APP_LIBRARY_BACKEND`,
    `VITE_APP_LIBRARY_URL`, `VITE_APP_PLUS_APP`, `VITE_APP_PLUS_EXPORT_PUBLIC_KEY`, `VITE_APP_PLUS_LP`,
    `VITE_APP_WS_SERVER_URL`, `VITE_WORKER_ID`, `DEV`, `MODE`, `PROD`, `PKG_NAME`, `PKG_VERSION`
  - `process.env` (scripts/CI): `GITHUB_REPOSITORY`, `GITHUB_RUN_ID`, `GITHUB_SERVER_URL`, `GITHUB_SHA`,
    `IS_PREACT`, `OSS_STATS_API_URL`, `OSS_STATS_TOKEN`, `PR_TITLE`, `RUNNER_NAME`, `VITE_DEBUG_DOM`

## Monorepo / submodules / LFS
- Monorepo: **Yarn workspaces** (`package.json#workspaces`: `excalidraw-app`, `packages/*`, `examples/*`), yarn
  1.22.22. There is no nx, turbo, lerna, rush or pnpm. One root vitest config covers every package; to run one
  package's tests, scope by path.
- Submodules: none (there is no `.gitmodules`).
- LFS: none. `.gitattributes` contains only `* text=auto eol=lf`.

## Infra hints
`Dockerfile`, `docker-compose.yml`, `vercel.json`, `firebase-project/`, `.github/workflows/` (12 workflows, including
test.yml, lint.yml, size-limit.yml, test-coverage-pr.yml). Not present: terraform, GitLab CI, CircleCI, Jenkins.
There is a Husky pre-commit hook, but its `yarn lint-staged` line is commented out.

## Regulated-repo signals
None found. There are no SECURITY/PRIVACY/COMPLIANCE/HIPAA/SOC2/PCI/GDPR docs, no compliance directories and no
CODEOWNERS. `regulated_repo_warning_required: false`.

## Coexistence risks
- **`.sdlc/` not in `.gitignore`.** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets,
  backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create
  if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run.
  *Mitigation already in place:* the shared `.git/info/exclude` lists `.sdlc/`, so `git add -A` currently skips it.
  The `.gitignore` edit is optional.
- **Agent instruction files** (CLAUDE.md, AGENTS.md, .github/copilot-instructions.md): the plugin will not edit
  them. Their coding rules should be carried into the change spec.
- No Cursor, Aider, custom MCP or repo-local routing-policy configs, so there are no conflicts from those.

## Proposed off-limits
`.git/**`, `.sdlc/**`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.env`, `.env.*`,
`.env.local`, `node_modules/**`, `**/node_modules/**`, `dist/**`, `**/dist/**`, `build/**`, `**/build/**`, `.next/**`,
`dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, `packages/*/types/**`,
`packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts` and `packages/excalidraw/subset/woff2/woff2-wasm.ts`
(both GENERATED CODE), `**/__snapshots__/**`, `yarn.lock`.

Advisory, so Gate 0 can decide:
- Non-English `packages/excalidraw/locales/*.json` files are Crowdin-managed. Add new strings to `en.json` only.
- `.github/workflows/**`
- `firebase-project/**`

Note: if this feature changes AppState or rendering, snapshot updates under `**/__snapshots__/**` are expected
through `yarn test:update`. Gate 0 may want to move that entry into scope, or allow it only through the test
command.
