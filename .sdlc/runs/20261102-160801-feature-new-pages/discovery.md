# Brownfield discovery

Run: 20261102-160801-feature-new-pages. Mode: first-time. Intent hint: feature-new. Commit: 14bb42ed. The scan used Tier 1 plus Tier 2b. The repo has 1,327 tracked files, so no sampling was needed.

## Git state

- Branch `EX-NF-12/opus55-plus-sonnet55` at `14bb42edee3d6fee6be264e3ee78670b3b9cee79`; working tree clean.
- Remote `origin`: https://github.com/tl-ai-labs/excalidraw.git
- This checkout is a git worktree of `/Users/apple/Documents/GitHub/excalidraw`, and its toplevel matches the current folder.
- `gitignore_covers_sdlc`: false. The root `.gitignore` has no `.sdlc` line. `.sdlc/` is currently ignored by line 7 of the shared `.git/info/exclude`, which applies to this clone only.

## Topology

Yarn workspaces monorepo: `excalidraw-app/` is the web app and `packages/` holds the libraries (`common`, `element`, `excalidraw`, `fractional-indexing`, `laser-pointer`, `math`, `utils`). `examples/` has two integrations, `dev-docs/` is a Docusaurus site outside the workspaces with its own `yarn.lock`, and `firebase-project/` holds Firebase rules.

Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `packages/excalidraw/index.tsx`, and `src/index.ts` in `common`, `element`, `math` and `utils`.

## Detected stacks

- `package.json`: node-typescript. Frameworks from workspace manifests: React 19, Vite 5, Vitest 3, Jotai, Radix UI, socket.io-client, Firebase. Next.js appears only in `examples/with-nextjs`, and Docusaurus only in `dev-docs`.
- No other stack manifests exist.
- No pre-authored adapter matches, so Tier 2b ran. See `.sdlc/baseline/stack-profile.md`.

## Test and build commands

- Proposed test command: `yarn test:app --watch=false`. Gate 0 must confirm it.
- Source: `package.json#scripts.test` points to `test:app` (`vitest`). The detection rule's literal answer is `yarn test`, which enters watch mode on a TTY, so the proposal uses the run-once form from `scripts.test:all`.
- CI runs `yarn test:app` on Node 20.x. Local Node is v24.22.1.
- `CLAUDE.md` asks for `yarn test:update` before committing. It rewrites snapshots, so it cannot serve as a pass/fail check.
- Other checks: `yarn test:typecheck`, `yarn test:code`, `yarn test:other`, `yarn fix`. No workspace defines its own test script; filter by path, as in `yarn test:app --watch=false packages/element`.

## Docs

`README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` (a link to the hosted docs), package READMEs, and `dev-docs/docs/codebase/json-schema.mdx` and `frames.mdx`. There is no `ARCHITECTURE.md` and no ADR directory.

## Detected AI/agent setup

| Path | Type |
| --- | --- |
| `.claude/` | Claude Code project config, gitignored |
| `.claude/settings.local.json` | Claude Code settings, not parsed |
| `CLAUDE.md` | Claude instructions |
| `.github/copilot-instructions.md` | Copilot instructions |

Not found: `.mcp.json`, `.cursor/`, `.cursorrules`, Aider config, `.continue/`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`, `CLAUDE.local.md`.

`AGENTS.md` is recorded as documentation. It holds two coding rules, carried into the stack profile.

## Env keys

Key names only; no values were read or recorded.

- `.env.development`: 20 keys. `.env.production`: 15 keys. `.env.test`: 1 key. All three files are committed. There is no `.env`, `.env.local` or `.env.example`.
- Code reads `process.env` for 9 names and `import.meta.env` for 21 names. Full lists are in `baseline.json`.

## Monorepo, submodules, LFS, infra

- Monorepo: Yarn workspaces, 10 packages.
- Submodules: none.
- Git-LFS: none. `.gitattributes` only sets line endings.
- Tracked symlinks: none.
- Infra: `Dockerfile`, `docker-compose.yml`, `.github/workflows/` (12 workflows), `vercel.json`, `firebase-project/`.
- `.husky/pre-commit` has its only command commented out, so commits run no local hook.

## Regulated-repo signals

None. No marker files, no matching directories, and no `CODEOWNERS` file.

## Coexistence risks

- Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. Repo-specific: today `.sdlc/` is hidden by line 7 of the shared `.git/info/exclude`, so `git add -A` skips it in this clone; that protection is local and does not travel with the repo.
- GitHub Copilot instructions at `.github/copilot-instructions.md` stay untouched. They say to use CSS modules, but only one of 84 stylesheets is a module; component styles are global SCSS nested under `.excalidraw`.

## Proposed off-limits

- Env files: `.env`, `.env.*`, `.env.local`
- AI config: `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`
- From `.sdlc/project.json` defaults, not present on disk: `.mcp.json`, `.cursor/rules/**`
- Dependencies and build output, at root and in workspaces: `node_modules`, `dist`, `build`, `.next`, `dev-dist`, `coverage`, `packages/excalidraw/types`
- Generated code: `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `packages/excalidraw/fonts/ComicShanns/index.ts`, `packages/excalidraw/fonts/Xiaolai/index.ts`
- `.sdlc/**`, `.git/**`

The two font files are marked as generated but also say they were manually rewritten. Neither is likely to matter for this run.

`packages/excalidraw/locales/*.json` other than `en.json` are Crowdin-managed. They are not on this list because the off-limits format has no way to exempt `en.json`; the stack profile tells writers to touch `en.json` only.
