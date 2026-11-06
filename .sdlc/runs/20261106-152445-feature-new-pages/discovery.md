# Brownfield discovery: excalidraw-3

- Run: `20261106-152445-feature-new-pages` (intent hint: feature-new, "pages": a tab bar to create, rename, reorder and delete pages, each with its own elements and viewport, saved in one file and shared in collaboration)
- Mode: first-time, full Tier 1 scan
- Built: 2026-11-06T09:57:02Z, plugin 0.10.1
- Result: **pass**. The Tier 2b stack profile was triggered and written to `.sdlc/baseline/stack-profile.md`.

## 1. Git state

| | |
|---|---|
| HEAD | `14bb42edee3d6fee6be264e3ee78670b3b9cee79` (feat(editor): lay Mermaid diagrams out with Pele, #12480) |
| Branch | `EX-NF-12/argon4-plus-flash38` |
| Dirty | no (clean tree) |
| Remotes | `origin` https://github.com/tl-ai-labs/excalidraw.git, `upstream` https://github.com/excalidraw/excalidraw.git |
| Worktree | yes. `.git` is a file pointing at `/Users/macbook/Documents/GitHub/Google-Projects/excalidraw/.git/worktrees/excalidraw-3`. The git root matches cwd. |
| Tracked files | 1,327 (sampling not needed) |
| `.gitignore` covers `.sdlc/` | **no**. `.sdlc/` is ignored instead through the main repo's `.git/info/exclude` (line 7), which this worktree shares. |

## 2. Directory topology (depth 2)

```
.claude/  .codesandbox/  .github/  .husky/
dev-docs/        docs, src, static          (Docusaurus site, not a workspace)
examples/        with-nextjs, with-script-in-browser
excalidraw-app/  app-language, collab, components, data, share, tests
firebase-project/
packages/        common, element, excalidraw, fractional-indexing, laser-pointer, math, utils
public/          screenshots
scripts/         stats, wasm, woff2
```

Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `excalidraw-app/index.html`, `packages/excalidraw/index.tsx`, `packages/element/src/index.ts`, `packages/common/src/index.ts`.

## Detected stacks

All of it is Node + TypeScript (TS 5.9.3, `strict`, ESNext modules, `moduleResolution: bundler`, `jsx: react-jsx`). Yarn 1.22.22 workspaces.

| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` (root, private) | node-typescript | react, vite, vitest, yarn-workspaces |
| `excalidraw-app/package.json` | node-typescript | react, vite, jotai, socket.io-client, firebase, sentry |
| `packages/excalidraw/package.json` | node-typescript | react, jotai + jotai-scope, radix-ui, sass, codemirror, roughjs |
| `packages/element/package.json` | node-typescript | (pure TS, depends on common, math, fractional-indexing) |
| `packages/common/package.json` | node-typescript | (pure TS) |
| `examples/with-nextjs/package.json` | node-typescript | next, react |
| `dev-docs/package.json` | node-javascript | docusaurus (not a workspace member) |

No Python, Go, Rust, JVM, Ruby, PHP or Elixir manifests.

## 4. Test / build scripts

- **Proposed test command: `yarn test:app --watch=false`**
  - Source: `package.json#scripts.test` is `yarn test:app`, which is `vitest`. `--watch=false` is the same flag `scripts.test:update` uses. CI (`.github/workflows/test.yml`) runs `yarn test:app`.
  - Bare `yarn test` starts vitest in **watch mode** on an interactive terminal, so don't use it as a gate.
  - CLAUDE.md says to run `yarn test:update` before committing. That rewrites snapshots, so as a pass/fail gate it would hide snapshot regressions. Gate on `yarn test:app --watch=false`. Use `yarn test:update` only when a snapshot change is intended, and review the `__snapshots__` diff.
- Companion checks (CI `lint.yml`): `yarn test:typecheck` (tsc), `yarn test:code` (eslint, max-warnings 0), `yarn test:other` (prettier). Run everything with `yarn test:all`.
- Targeted run: `yarn test:app --watch=false packages/excalidraw/tests/<name>.test.tsx`
- Vitest config: one root `vitest.config.mts` (jsdom, globals, `setupTests.ts`, `@excalidraw/*` aliases pointing at source, coverage thresholds lines 60 / branches 70 / functions 63 / statements 60).
- Baseline status: **not run**. Tier 1 doesn't execute tests, and `.sdlc/pre-check-status.json` records the test probe as `skip`. Gate 0 should confirm the command and, ideally, get a green baseline before Phase 7.

## 5. Docs

- `README.md`: project landing ("open source virtual hand-drawn style whiteboard, collaborative and end-to-end encrypted")
- `CLAUDE.md`: monorepo layout, `yarn test:typecheck` / `yarn test:update` / `yarn fix`, path aliases, esbuild for packages and Vite for the app
- `AGENTS.md`: use `app.ownerDocument` / `app.ownerWindow` rather than globals for new DOM APIs. Prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit & …`.
- `.github/copilot-instructions.md`: functional components plus hooks, PascalCase components, camelCase functions, ALL_CAPS constants, prefer immutable data and allocation-free code
- `CONTRIBUTING.md`: link to docs.excalidraw.com
- `dev-docs/README.md`: Docusaurus site (`dev-docs/docs/{@excalidraw,codebase,introduction}`)
- `packages/excalidraw/README.md`, `packages/excalidraw/CHANGELOG.md`, `packages/excalidraw/locales/README.md`
- No ADR directory.

## Detected AI/agent setup

| Path | Type |
|---|---|
| `.claude/` | claude-code-dir (gitignored) |
| `.claude/settings.local.json` | claude-code-settings-local (top-level keys: `env`) |
| `CLAUDE.md` | claude-instructions |
| `AGENTS.md` | agents-instructions |
| `.github/copilot-instructions.md` | copilot-instructions |

Not present: `.mcp.json`, `.cursor/`, `.cursorrules`, Aider config, `.continue/`, `.roo/`, `CLAUDE.local.md`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## 7. Env keys (names only)

All three env files are **committed to git** (Vite public build config). I read key names only, never values.

- `.env.development` (20): MODE, VITE_APP_BACKEND_V2_GET_URL, VITE_APP_BACKEND_V2_POST_URL, VITE_APP_LIBRARY_URL, VITE_APP_LIBRARY_BACKEND, VITE_APP_WS_SERVER_URL, VITE_APP_PLUS_LP, VITE_APP_PLUS_APP, VITE_APP_AI_BACKEND, VITE_APP_FIREBASE_CONFIG, VITE_APP_DEV_DISABLE_LIVE_RELOAD, VITE_APP_ENABLE_TRACKING, FAST_REFRESH, VITE_APP_PORT, VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX, VITE_APP_COLLAPSE_OVERLAY, VITE_APP_ENABLE_ESLINT, VITE_APP_ENABLE_PWA, VITE_APP_PLUS_EXPORT_PUBLIC_KEY, VITE_APP_DISABLE_PREVENT_UNLOAD
- `.env.production` (15): a subset of the above
- `.env.test` (1): VITE_DEBUG_DOM
- Referenced in code (`process.env.*`, `import.meta.env.*`): 30 names, listed in `baseline.json#env_keys_referenced_in_code`. Collaboration uses `VITE_APP_WS_SERVER_URL` and `VITE_APP_FIREBASE_CONFIG`. The pages feature shouldn't need any new keys.

## 8. Monorepo, submodules, LFS, infra

- **Monorepo:** yarn workspaces (`excalidraw-app`, `packages/*`, `examples/*`), 10 workspace packages plus `dev-docs` outside the workspace. No pnpm, nx, turbo, lerna or rush. Workspaces define no test scripts: one root vitest run covers everything, filtered by path.
- **Submodules:** none (`.gitmodules` absent).
- **Git LFS:** none. `.gitattributes` is only `* text=auto eol=lf`.
- **Infra:** `Dockerfile`, `docker-compose.yml`, `vercel.json`, `firebase-project/`, `.codesandbox/`, `.husky/` (the pre-commit `yarn lint-staged` line is commented out, so it's a no-op), and 12 GitHub workflows (test, lint, size-limit, stats, autorelease, docker, sentry, locales-coverage, and others). No terraform, GitLab CI, CircleCI or Jenkins.

## 9. Regulated-repo signals

None found (no SECURITY/PRIVACY/COMPLIANCE/HIPAA/SOC2/PCI/GDPR files or dirs, no CODEOWNERS). `regulated_repo_warning_required: false`.

## Coexistence risks

- **Claude Code project config:** `.claude/settings.local.json` exists (gitignored). The plugin won't touch it.
- **Instruction files:** `CLAUDE.md`, `AGENTS.md` and `.github/copilot-instructions.md` are read-only guidance for the architect. They are off-limits by default.
- **`.sdlc/` not gitignored:** "Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run." *Mitigating fact:* in this clone `.sdlc/` is already excluded through the main repo's `.git/info/exclude` (shared by the worktree), so `git add -A` currently does **not** pick it up. That exclusion is local only, so adding `.sdlc/` to `.gitignore` is optional here.
- No Cursor, Aider, custom MCP or repo-local routing-policy to coexist with.

## Repo-state risks for this feature

- **Huge hotspot files:** `packages/excalidraw/components/App.tsx` (11,493 lines), `packages/excalidraw/types.ts` (1,671), `packages/excalidraw/data/restore.ts` (1,429), `excalidraw-app/collab/Collab.tsx` (1,106). Any edit needs small, anchored hunks.
- **Aggressive unanchored `.gitignore` patterns:** `build`, `dist`, `firebase`, `html`, `coverage`, `logs`, `meta*.json` match at any depth. Don't name a new file or folder after any of them (for example `components/html/`) or it will be silently untracked.
- **Snapshots:** 10 `__snapshots__` dirs. Changing `AppState` defaults or the export format will move snapshots (for example `packages/excalidraw/tests/__snapshots__`). Regenerate with `yarn test:update`, then review.
- **Locales:** `packages/excalidraw/locales/*.json` are Crowdin-managed (`crowdin.yml`). Add new UI strings to `en.json` only.
- **Persistence surfaces the feature touches:** the file format (`packages/excalidraw/data/json.ts` `serializeAsJSON` / `ExportedDataState` in `data/types.ts`, `VERSIONS.excalidraw`), restore (`data/restore.ts` `restoreElements` / `restoreAppState`), AppState persistence flags (`APP_STATE_STORAGE_CONF` in `packages/excalidraw/appState.ts`, keyed browser/export/server), app local storage (`excalidraw-app/data/LocalData.ts`, `localStorage.ts`, `tabSync.ts`), the share link (`excalidraw-app/data/index.ts`, `firebase.ts`) and collaboration (`excalidraw-app/collab/Collab.tsx`, `Portal.tsx`, `WS_SUBTYPES` in `excalidraw-app/app_constants.ts`, `reconcileElements` in `data/reconcile.ts`). Backward compatibility with existing single-page `.excalidraw` files and older collab peers is a design concern for the architect.
- **Worktree:** the stash stack is shared with the main checkout. Use WIP commits, not a bare `git stash`.
- **Baseline unknown:** tests and typecheck have not been run on HEAD.
- No LFS, no submodules, no encrypted secrets (no gpg/sops/git-crypt/age/pem files tracked).

## Proposed off-limits

Hard (default):
- `.env`, `.env.*` (covers the tracked `.env.development`, `.env.production`, `.env.test`)
- `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- `node_modules/**`, `**/node_modules/**`, `dist/**`, `**/dist/**`, `build/**`, `**/build/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**` (generated `.d.ts`, gitignored)
- `.git/**`, `.sdlc/**`

Soft suggestions (Gate 0 decides):
- `packages/excalidraw/locales/*.json` except `en.json` (Crowdin)
- `**/__snapshots__/**`: regenerate only, never hand-edit
- `.github/workflows/**`, `Dockerfile`, `docker-compose.yml`, `vercel.json`, `firebase-project/**`: infra, not needed for pages

## Stack profile (Tier 2b)

Triggered: the primary stack is React + TypeScript (Vite, yarn workspaces), and the only shipped adapters are `generic.md`, `nest.md` and `python.md`. The profile is at `.sdlc/baseline/stack-profile.md`.

## Scan notes

One combined shell call was rejected by the permission classifier. I re-ran it as smaller commands and lost no data. Total scan time was well inside the timebox.
