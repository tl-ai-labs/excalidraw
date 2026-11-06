# Discovery - excalidraw (Tier 1, incremental refresh)

- Run: `20261106-120759-test-styled-range-undo`
- Built: 2026-11-06T06:39:42Z, plugin 0.10.1
- Intent hint: test
- Refresh decision: **incremental** ("84 files changed since baseline (1 commits)"). Previous baseline: 2026-11-05T16:10:30Z, HEAD `14bb42ed`, run `20261105-213840-feature-new-rich-text-spans`. No stack manifest changed, no new AI-config files and no policy change, so groups 2-6 and 9 and the Tier 2b stack profile are reused unchanged. Full detail for those groups: `.sdlc/baseline/discovery.md` and `.sdlc/baseline/stack-profile.md`.

## Git state (re-scanned)
- HEAD `2447b85d0773b23d83e1c9f4244a74f2bea1af1b` ("EX-NF-11 opus55-plus-flash38-v2: run and evidence") on `EX-NF-11/opus55-plus-flash38-v2`, in sync with `origin`; main branch `master`.
- Working tree clean at scan start. 1395 tracked files (was 1327).
- The delta commit holds the EX-NF-11 rich-text-spans feature (new `packages/element/src/textStyleRanges.ts`; edits to `textElement.ts`, `renderElement.ts`, `newElement.ts`, `types.ts`, `index.ts`, `actions/actionProperties.tsx`, `actions/colorTargets.ts`, `wysiwyg/textWysiwyg.tsx`, `data/restore.ts`, `renderer/staticSvgScene.ts`, `locales/en.json`, `CHANGELOG.md`) and its tests, **plus 65 files under `.sdlc/`**.

## Detected stacks (reused)
node-typescript throughout: root (React 19, Vite 5, Vitest 3/jsdom, TS 5.9 strict, Yarn 1 workspaces), `excalidraw-app`, `packages/excalidraw`, `examples/with-nextjs`. No pre-authored adapter matches; the Tier 2b profile at `.sdlc/baseline/stack-profile.md` still applies (no manifest change, so it was not rebuilt).

## Monorepo (reused)
Yarn classic workspaces `excalidraw-app`, `packages/*`, `examples/*`. One root vitest config covers every package; scope by path.

## Test command
- **Proposed:** `yarn test:app --watch=false` (source `package.json#scripts.test`; bare `yarn test` is watch mode).
- **Scoped for this test intent:** `yarn test:app --watch=false packages/excalidraw/tests/textStyleRanges.test.tsx`
- Also per CLAUDE.md: `yarn test:typecheck`, `yarn test:update`.
- 151 tracked `*.test.ts(x)` files (was 149).
- Gate 0 must confirm. Tests were not run in discovery.

### Likely failing tests at this HEAD (not verified here)
The previous run's records (`.sdlc/runs/20261105-213840-feature-new-rich-text-spans/failures.json` and `review.json`) show Gate 3 ended with:
1. `packages/excalidraw/tests/textStyleRanges.test.tsx > "undo restores the previous ranges and redo re-applies them"` failing: the red range is still there after undo. The senior review put the cause in the test, not the history capture: `beforeEach` seeds via `API.setElements` (no capture), so the range pick records the text as an *added* element and undo marks it deleted while it keeps its red range. Its suggested fix was to commit a baseline with `API.updateScene({ elements: [text], captureUpdate: CaptureUpdateAction.IMMEDIATELY })` before editing, and to assert `isDeleted` is false after undo. The committed test file still uses only `API.setElements` (lines 66, 121, 188), with no `CaptureUpdateAction` import, so the failure most likely persists.
2. `yarn test:typecheck` TS2322 at `textStyleRanges.test.tsx` (29,28) and (190,30): `ExcalidrawTextElement` is not assignable to `NonDeletedExcalidrawElement`.
Run the scoped command at Gate 0 or pre-check to get the real baseline.

## Docs (reused)
README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md, .github/copilot-instructions.md, dev-docs/ (Docusaurus), package READMEs, packages/excalidraw/CHANGELOG.md (changed in the delta). No ADRs.

## Detected AI/agent setup (re-checked; unchanged)
| Path | Type |
|---|---|
| `.claude/` | Claude Code project dir (gitignored) |
| `.claude/settings.local.json` | Claude Code local settings |
| `CLAUDE.md` | Claude instructions |
| `AGENTS.md` | agents instructions |
| `.github/copilot-instructions.md` | Copilot instructions |

No `.mcp.json`, Cursor, Aider, Continue, Roo, repo-local `routing-policy.yaml` or gemini config files.

## Env keys (names only; reused, delta re-checked)
Tracked env files: `.env.development`, `.env.production`, `.env.test`. The delta files reference only `import.meta.env.VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX` and `process.env.IS_PREACT`, both already listed. No new keys.

## Submodules / LFS
None / none (re-checked).

## Regulated-repo signals
None (reused).

## Coexistence risks
- **`.sdlc/` is not gitignored, and part of it is now tracked.** `.gitignore` doesn't cover `.sdlc/`. `.git/info/exclude` does, but only for this clone, and it only hides *untracked* files. Commit `2447b85d` committed 65 `.sdlc/` files: `baseline/*`, `ledger.json`/`ledger.md`, `local/write-contract.json`, `local/executor-agents.json`, `project.json`, `pre-check-status.json`, `CLAUDE-SDLC.md`, and the whole previous run directory, including `packets.json`, which can echo source. Because they are tracked, every change to them shows in `git status` and is staged by `git add -A` / `git commit -a`. This refresh has already modified `.sdlc/baseline/current.json`, so the tree is dirty under `.sdlc/` now. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry; untracking the files already committed (`git rm --cached`) is a separate decision for the user.
- CLAUDE.md / AGENTS.md / copilot-instructions are left alone; their coding rules flow into spec conventions.
- Husky pre-commit hook present but lint-staged is commented out.

## Proposed off-limits (unchanged)
`.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `node_modules/**`, `**/node_modules/**`, `dist/**`, `**/dist/**`, `build/**`, `**/build/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `.git/**`, `.sdlc/**`.
Optional: non-English locale JSONs (Crowdin), `.github/workflows/**`, `yarn.lock`.

## Timing
Incremental refresh well inside bounds; no sampling.
