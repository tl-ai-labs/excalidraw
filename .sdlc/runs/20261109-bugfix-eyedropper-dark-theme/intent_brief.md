# Intent Brief — bugfix — Eyedropper saves dark-mode-transformed colour

## Context
Observed: in dark theme Excalidraw draws every colour through a dark-mode transform. The eyedropper (pick a colour from the canvas for stroke or background) reads the transformed pixel and saves it as the new colour. Picking a near-black rectangle turns the target shape near-white. Reported in excalidraw/excalidraw#10867.

## Goal
Expected: the target shape shows the same colour as the picked rectangle, and the colour picker's hex value matches it.

Files involved: packages/common/src/colors.ts (an inverse of the dark-mode colour transform) and the eyedropper and its users in packages/excalidraw (components/EyeDropper.tsx, actions/actionProperties.tsx, App.bucketFill.ts, App.cursor.ts). The inverse must round-trip, not special-case black and white.

## Files in scope
- packages/common/src/colors.ts
- packages/common/src/colors.test.ts
- packages/excalidraw/components/EyeDropper.tsx
- packages/excalidraw/actions/actionProperties.tsx
- packages/excalidraw/components/App.bucketFill.ts
- packages/excalidraw/components/App.cursor.ts
- packages/excalidraw/tests/eyeDropper.test.tsx — the reproducing test (a bugfix run proves the fix with a test that fails on the bug first)
- packages/common/src/__snapshots__/colors.test.ts.snap — only if the new colours tests add snapshots
- packages/excalidraw/tests/__snapshots__/** — only snapshot churn from the eyedropper tests
- packages/excalidraw/CHANGELOG.md — companion entry for the fix
- packages/excalidraw/index.tsx — companion: only if the inverse is re-exported next to applyDarkModeFilter

## Files off-limits
Project defaults from .sdlc/project.json off_limits_default, plus the AI configs detected by discovery.

## Acceptance criteria
How we know it's fixed: unit tests in packages/common/src/colors.test.ts for the round trip and jsdom tests in packages/excalidraw/tests/eyeDropper.test.tsx picking a colour in dark theme; the test fails before the fix; yarn test:typecheck, yarn test:code and yarn test:app pass.

## Non-goals
- No change to how dark mode renders (applyDarkModeFilter output stays the same; existing palette snapshot unchanged).
- No change to eyedropper behaviour in light theme.

## Gate 0 — approved 2026-11-09
- Auth mode: estimated
- Policy: opus55-plus-flash38-agsdk
- Test command: yarn test:typecheck && yarn test:code && yarn test:app --watch=false
- AI configs (CLAUDE.md, .github/copilot-instructions.md): off-limits
- .gitignore `.sdlc/` entry: declined (not in scope; note in final report)
- Write contract frozen: allowlist = "Files in scope" above (11 paths); off-limits = project defaults + both AI configs + yarn.lock
