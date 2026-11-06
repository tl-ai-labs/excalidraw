# Discovery - excalidraw (Tier 1, first-time)

- Run: `20261105-213840-feature-new-rich-text-spans`
- Built: 2026-11-05T16:10:30Z, plugin 0.10.1
- Intent hint: feature-new - let users colour or highlight part of a text element; styling saved, collaborated, rendered on canvas and kept in SVG export.

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-NF-11/opus55-plus-flash38-v2` (main branch: `master`)
- Working tree: **clean**
- Remote: `origin` -> https://github.com/tl-ai-labs/excalidraw.git
- 1327 tracked files (small enough for a full scan; no sampling)
- `.gitignore` does **not** cover `.sdlc/` (`gitignore_covers_sdlc: false`), **but** `.git/info/exclude` already lists `.sdlc/`, so in this clone `git add -A` will not stage run artifacts (verified with `git check-ignore`). That exclusion is local to this clone.

## Directory topology
Top level: `.claude/` (gitignored), `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/` (Docusaurus site), `examples/` (`with-nextjs`, `with-script-in-browser`), `excalidraw-app/` (excalidraw.com app: `collab/`, `data/`, `share/`, `components/`, `tests/`), `firebase-project/`, `packages/` (`common`, `element`, `excalidraw`, `math`, `utils`, `fractional-indexing`, `laser-pointer`), `public/`, `scripts/`.

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` (root) | node-typescript | React 19, Vite 5, Vitest 3 (jsdom), TypeScript 5.9 strict, Yarn 1 workspaces |
| `excalidraw-app/package.json` | node-typescript | React, Vite, Firebase, socket.io-client, jotai |
| `packages/excalidraw/package.json` | node-typescript | React, jotai, roughjs, perfect-freehand, esbuild build |
| `examples/with-nextjs/package.json` | node-typescript | Next.js (example only) |

No pre-authored adapter matches (shipped: generic, nest, python), so the **Tier 2b adaptive stack profile was triggered** and written to `.sdlc/baseline/stack-profile.md`.

## Monorepo
Yarn classic workspaces: `excalidraw-app`, `packages/*`, `examples/*`. Internal packages resolve through path aliases (`@excalidraw/common`, `@excalidraw/element`, `@excalidraw/excalidraw`, `@excalidraw/math`, `@excalidraw/utils`, ...) in `tsconfig.json` and `vitest.config.mts`. There are no per-package test scripts: one root vitest config runs all packages. Scope a run with a path filter.

## Test / build commands
- **Proposed:** `yarn test:app --watch=false` (source: `package.json#scripts.test` -> `yarn test:app` -> `vitest`; `yarn.lock` present). A bare `yarn test` starts vitest in **watch mode**, so pass `--watch=false`.
- Per CLAUDE.md: `yarn test:update` (vitest with snapshot update) before committing, plus `yarn test:typecheck` (tsc). Lint: `yarn test:code` (eslint, max-warnings 0). Everything: `yarn test:all`.
- Gate 0 must confirm. Tests were **not** run in discovery, so baseline pass/fail is unknown. 149 tracked `*.test.ts(x)` files; snapshot tests live under `__snapshots__/`, so a feature touching rendering or element shape will probably change snapshots.

## Docs
README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md (links to docs site), .github/copilot-instructions.md, dev-docs/ (Docusaurus), and READMEs in packages/excalidraw, common, element, math, utils and laser-pointer. No ADR directory.

## Detected AI/agent setup
| Path | Type |
|---|---|
| `.claude/` (gitignored) | Claude Code project dir |
| `.claude/settings.local.json` | Claude Code local settings |
| `CLAUDE.md` | Claude instructions (monorepo layout, `yarn test:update`, `yarn test:typecheck`) |
| `AGENTS.md` | Agent guidelines: use `app.ownerDocument`/`app.ownerWindow` over globals; prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` |
| `.github/copilot-instructions.md` | Copilot coding standards (functional components, immutability, performance over RAM) |

Not present: `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `CLAUDE.local.md`, a repo-local `routing-policy.yaml`, or `gemini*.{yaml,json}`.

## Env files (key names only)
- `.env.development` (20 keys), `.env.production` (15 keys), `.env.test` (1 key: `VITE_DEBUG_DOM`). All three are **tracked in git** (upstream convention: public URLs and config, no secret-shaped key names). `.env.local` and `.env.*.local` are gitignored and absent.
- Code references 30 env names (`import.meta.env.*` / `process.env.*`), mostly `VITE_APP_*`; the CI scripts reference `OSS_STATS_TOKEN`. None of this matters to the intended feature.

## Source topology, submodules, LFS
- Entry points: `packages/excalidraw/index.tsx`, `packages/*/src/index.ts`, `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`.
- Submodules: none. Git-LFS: none (`.gitattributes` holds only `* text=auto eol=lf`).
- Generated files: `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts` ("GENERATED CODE -- DO NOT EDIT").
- Infra: Dockerfile, docker-compose.yml, vercel.json, firebase-project/, 12 GitHub workflows (test, lint, size-limit, test-coverage-pr, ...). The Husky pre-commit hook exists but its `lint-staged` line is commented out.

## Feature-relevant landmarks (orientation only, for the architect)
- Text element type: `packages/element/src/types.ts` (`ExcalidrawTextElement`, ~L253) - fields `text`, `originalText`, `fontSize`, `fontFamily`, `textAlign`, `lineHeight`, `autoResize`, `containerId`, `baseFontSize`, `labelPosition`. No span/rich-text field exists yet.
- Construction: `packages/element/src/newElement.ts` (`newTextElement`, L337).
- Restore and migration of saved scenes: `packages/excalidraw/data/restore.ts` (`case "text"`, L555).
- Canvas render: `packages/element/src/renderElement.ts` (per-line `context.fillText`, ~L707).
- SVG export: `packages/excalidraw/renderer/staticSvgScene.ts` (one `<text>` per line, ~L816; fill from `strokeColor` through `applyDarkModeFilter`).
- Editing: `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (textarea-based editor), `packages/excalidraw/components/App.text.ts`.
- Wrapping and measuring: `packages/element/src/textWrapping.ts`, `textMeasurements.ts`, `textElement.ts`.
- Collaboration: `packages/excalidraw/data/reconcile.ts` (whole-element version/versionNonce reconciliation), `excalidraw-app/collab/`.
- Style actions: `packages/excalidraw/actions/actionProperties.tsx`, `actionStyles.ts`, `colorTargets.ts`.
- UI strings: `packages/excalidraw/locales/en.json` (other locales are Crowdin-managed).

## Regulated-repo signals
None found (no SECURITY/PRIVACY/COMPLIANCE/HIPAA/SOC2/PCI/GDPR files, no CODEOWNERS). `regulated_repo_warning_required: false`.

## Coexistence risks
- **`.sdlc/` not gitignored** (mitigated locally: `.git/info/exclude` covers it, so the risk applies only to other clones): "Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run."
- Agent instruction files (CLAUDE.md, AGENTS.md, .github/copilot-instructions.md) stay untouched. Their rules should carry into the change spec's conventions.
- No Cursor, Aider, custom MCP or repo-local routing policy, so there's no tooling-coexistence risk beyond the above.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `node_modules/**`, `**/node_modules/**`, `dist/**`, `**/dist/**`, `build/**`, `**/build/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `.git/**`, `.sdlc/**`.

Optional (Gate 0 to decide): non-English `packages/excalidraw/locales/*.json` (Crowdin-managed), `.github/workflows/**`, `yarn.lock` (unless a dependency is deliberately added).

## Notes
- Tier 1 finished well within the timebox.
- `.sdlc/policy.yaml` is absent; `.sdlc/project.json` sets default policy `opus55-plus-flash38`.
