# Brownfield discovery

Run `20261102-103113-feature-new-text-range-styling` · mode `first-time` · intent hint `feature-new` · built 2026-11-02T05:08:05Z

Excalidraw is a Yarn workspaces TypeScript and React monorepo. Discovery was read-only outside `.sdlc/`, and no
tests, builds or installs were run.

## Needs a decision at Gate 0

- **Test command.** Proposed `yarn test:app --watch=false`. Not run, so the pass/fail baseline is unknown.
- **`.sdlc/` ignore rule.** `.gitignore` doesn't cover it, but `.git/info/exclude` does in this clone. See Coexistence risks.
- **Branch.** `EX-NF-11/flash-agsdk-only-v38` is named after the policy, not this feature. Confirm it's the intended branch.
- **Scope of the feature.** Whether range styles can change text metrics (bold, size, font) or are paint-only
  (color, underline) sets the size of the work. See `.sdlc/baseline/stack-profile.md`, note 2.

## Git state

| Item | Value |
| --- | --- |
| HEAD | `14bb42edee3d6fee6be264e3ee78670b3b9cee79` |
| Branch | `EX-NF-11/flash-agsdk-only-v38`, no upstream configured |
| Dirty | No |
| Relative to `master` | Same commit (0 ahead, 0 behind) |
| Relative to `origin/master` | Same commit |
| Relative to `upstream/master` | 5 behind, 0 ahead |
| In-progress merge or rebase | None |
| Stashes | None |
| `gitignore_covers_sdlc` | `false` (effectively ignored through `.git/info/exclude:7`) |
| Remotes | `origin` tl-ai-labs/excalidraw, `upstream` excalidraw/excalidraw |

## Directory topology

- `packages/`: `common`, `element`, `excalidraw`, `fractional-indexing`, `laser-pointer`, `math`, `utils`
- `excalidraw-app/`: the excalidraw.com app
- `examples/`: `with-nextjs`, `with-script-in-browser`
- `dev-docs/`: Docusaurus site, outside the workspace with its own `yarn.lock`
- `firebase-project/`, `public/`, `scripts/`

There are 1,327 tracked files, so standard rather than sample-based discovery applied.

## Detected stacks

| Manifest | Stack | Frameworks |
| --- | --- | --- |
| `package.json` | node-typescript | React, Vite, Vitest, Yarn workspaces |
| `packages/excalidraw/package.json` | node-typescript | React, jotai, Radix UI, esbuild, Sass, roughjs |
| `excalidraw-app/package.json` | node-typescript | React, Vite, Firebase, socket.io-client, Sentry, jotai |
| `examples/with-nextjs/package.json` | node-typescript | Next.js |
| `dev-docs/package.json` | node-javascript | Docusaurus |

No pre-authored adapter exists for this stack, so Tier 2b ran and wrote `.sdlc/baseline/stack-profile.md`.

## Test, build and run

| Purpose | Command |
| --- | --- |
| Tests (proposed) | `yarn test:app --watch=false` |
| One package | `yarn test:app --watch=false packages/element` |
| Types | `yarn test:typecheck` |
| Lint | `yarn test:code` |
| Formatting | `yarn test:other` |
| Dev server | `yarn start` |
| Package build | `yarn build:packages` |

Source: `package.json#scripts.test`, which resolves to `test:app` (vitest), with `--watch=false` taken from
`scripts.test:all`.

- Plain `yarn test` runs vitest in watch mode on a TTY.
- `yarn test:update`, which `CLAUDE.md` asks for before committing, rewrites snapshots. It's a commit step, not a
  check, because it would make snapshot regressions pass.
- CI runs `yarn test:app` on Node 20. This machine has Node v24.18.0.
- The pre-commit hook body is commented out, so nothing enforces lint at commit time.

## Docs

`README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` (a link to the hosted docs), `dev-docs/README.md`,
`packages/excalidraw/CHANGELOG.md`, `packages/utils/CHANGELOG.md`. There is no `ARCHITECTURE.md` and no ADR directory.

## Detected AI/agent setup

| Path | Type |
| --- | --- |
| `.claude/` | Claude Code, ignored by `.gitignore` |
| `.claude/settings.local.json` | Claude Code, presence only, not read |
| `CLAUDE.md` | Project instructions |
| `AGENTS.md` | Project instructions |
| `.github/copilot-instructions.md` | Copilot instructions |

No Cursor, Aider, Continue or Roo config, `.mcp.json`, `routing-policy.yaml` or `gemini*` config was found.
`AGENTS.md` isn't in the standard list; it's included here because it does the same job.

## Env keys (names only)

- `.env.development`: 20 keys, `.env.production`: 15 keys, `.env.test`: 1 key, 21 distinct in total.
- 30 names are referenced in code. This repo reads env through `import.meta.env`, so that pattern was added to the
  standard `process.env` search.
- All three env files are tracked in git. Names are in `baseline.json`. No values were recorded.

## Source topology

- **Monorepo:** Yarn workspaces (`excalidraw-app`, `packages/*`, `examples/*`). No package has its own test
  script; one root vitest config covers everything.
- **Submodules:** none.
- **Git LFS:** none. `.gitattributes` holds only `* text=auto eol=lf`.
- **Entry points:** `excalidraw-app/index.tsx`, `packages/excalidraw/index.tsx`, `packages/*/src/index.ts`.
- **Infra:** `Dockerfile`, `docker-compose.yml`, `.github/workflows/` (12 workflows), `vercel.json`, `firebase-project/`.

## Regulated-repo signals

None. There are no compliance documents at the root, no compliance-named directories, and no `CODEOWNERS` file.
`regulated_repo_warning_required` is `false`.

## Coexistence risks

- **`.sdlc/` is not in `.gitignore`.** Your `.gitignore` doesn't cover `.sdlc/`. Gate 0 will offer to add `.gitignore`
  (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the
  run. The usual warning that artifacts are visible to `git add -A` doesn't apply in this clone, because
  `.git/info/exclude` already ignores `.sdlc/`. That file isn't committed, so a fresh clone or another contributor
  would not be protected.
- **Existing AI instructions stay in force.** `CLAUDE.md`, `AGENTS.md` and `.github/copilot-instructions.md` stay
  untouched, and their rules apply to generated code.

## Repo-state risks

- `origin/master` is 5 commits behind `upstream/master`. That matters if this work is meant to go upstream.
- The branch has no upstream and no commits yet.
- `.sdlc/pre-check-status.json` shows `ok: false`, with `discovery_smoke` pending and `test_command_probe` skipped.
  The orchestrator still has to post discovery and supply the test command.
- Tests are unverified on this machine. If failures appear, they can't yet be told apart from pre-existing ones.

## Proposed off-limits

- **Env:** `.env`, `.env.*`, `.env.local`
- **AI config:** `.claude/**`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `.github/copilot-instructions.md`,
  `.mcp.json`, `.cursor/rules/**`
- **Build output:** `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `dev-dist/**` (each also at any depth),
  `coverage/**`, `html/**`, `packages/excalidraw/types/**`
- **Generated:** `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`
- **Internal:** `.sdlc/**`, `.git/**`

This list includes the defaults from `.sdlc/project.json`. No tracked file sits under the build-output patterns.

Advisory: locale files other than `packages/excalidraw/locales/en.json` are managed by Crowdin. Add UI strings to
`en.json` only. They aren't listed above because a glob would also block `en.json`.
