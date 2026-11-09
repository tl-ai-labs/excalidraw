# Intent Brief — feature-extend — Per-element arrowhead size

## Context
Module: arrowheads on arrows and lines. Today the size is fixed per head type (`getArrowheadSize` in
`packages/element/src/bounds.ts`) and only shrinks automatically on very short segments. Requested in
excalidraw/excalidraw#6712.

Seed (user's words): "Let users choose the size of an arrow's heads through a new per-element property and a
properties-panel control."

## Goal
New capability: an optional per-element arrowhead size, set from a control in the properties panel, with a
default.

- Before: a short arrow between two small boxes carries a head almost as big as the boxes, and the properties
  panel offers no size control.
- After: the properties panel shows an arrowhead size control and the same arrow displays a small,
  proportionate head.

Constraints: files saved without the property, and collaborators on older versions, must keep rendering
identically; bounds, hit-testing and export must stay consistent with the new size and with the existing
short-segment fitting. Touches types, creation, restore defaults for old files, history deltas and
collaboration, head geometry and bounds, canvas and SVG rendering, the properties panel and i18n.

## Files in scope
Element package:
- `packages/element/src/types.ts` (new optional property on `ExcalidrawLinearElement`)
- `packages/element/src/newElement.ts` (creation)
- `packages/element/src/bounds.ts` (`getArrowheadSize` / `getArrowheadPoints` / beyond-last-segment fitting)
- `packages/element/src/shape.ts` (head geometry for canvas + SVG + hit-testing)
- `packages/element/src/renderElement.ts` (canvas rendering)
- `packages/element/src/arrowheads.ts`
- `packages/element/src/delta.ts` (history deltas, only if it needs the new key)
- `packages/element/src/transform.ts` (skeleton API passthrough)
- `packages/element/src/index.ts` (exports)
- `packages/element/src/elbowArrow.ts`, `packages/element/src/convertToShape.ts`,
  `packages/element/src/flowchart.ts` (reference arrowheads / create linear elements)
- `packages/element/src/binding.ts` (only if the size affects binding)

Common package:
- `packages/common/src/constants.ts` (only if the size needs constants)

Editor package:
- `packages/excalidraw/data/restore.ts` (default for old files)
- `packages/excalidraw/types.ts`, `packages/excalidraw/appState.ts` (`currentItemArrowheadSize`)
- `packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/actions/types.ts`,
  `packages/excalidraw/actions/index.ts`, `packages/excalidraw/actions/actionStyles.ts`,
  `packages/excalidraw/actions/actionFlip.ts`
- `packages/excalidraw/components/Actions.tsx`, `packages/excalidraw/components/shapeActionPredicates.ts`,
  `packages/excalidraw/components/App.tsx` (new elements pick up `currentItemArrowheadSize`),
  `packages/excalidraw/components/App.drawshape.ts`,
  `packages/excalidraw/components/ConvertElementTypePopup.tsx`
- `packages/excalidraw/components/icons.tsx` (only if the control needs icons)
- `packages/excalidraw/renderer/staticSvgScene.ts` (SVG export, only if needed)
- `packages/excalidraw/locales/en.json` (English only; other locales come from Crowdin)
- `packages/excalidraw/CHANGELOG.md` (companion: public element/API surface changes)

Docs:
- `dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx` (only if the skeleton API passes
  the property through)

Tests:
- `packages/excalidraw/tests/arrowheadSize.test.tsx` (new)
- `packages/element/tests/arrowheadSize.test.ts` (new)
- `packages/element/tests/bounds.test.ts`, `packages/element/tests/shape.test.ts`
- `packages/excalidraw/actions/actionProperties.test.tsx`
- `packages/excalidraw/tests/data/restore.test.ts`, `packages/excalidraw/tests/scene/export.test.ts`
- `packages/excalidraw/tests/helpers/api.ts`
- `packages/excalidraw/tests/__snapshots__/**` and `packages/element/tests/__snapshots__/**`, with this rule:
  element and geometry snapshots stay unchanged; only snapshots that capture appState may gain the new key.

Test command: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
Auth mode: estimated. Policy: opus55-plus-flash38-agsdk. `.gitignore`: not touched (the local
`.git/info/exclude` covers `.sdlc/`; run evidence is force-added at commit).

## Files off-limits
- Project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
  `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- AI configs: `.github/copilot-instructions.md`, `CLAUDE.md`, `AGENTS.md`
- Generated: `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`
- Non-English locales: `packages/excalidraw/locales/*.json` except `en.json`
- `excalidraw-app/**` (app layer; the collab payload is generic over element props)

## Acceptance criteria
- jsdom tests show an arrow with the new size restores and renders a smaller head in SVG export.
- An old arrow without the property restores to today's size, with existing snapshots unchanged.
- Bounds follow the size.
- `yarn test:typecheck`, `yarn test:code` and `yarn test:app` pass.

## Non-goals
- Translating the new strings into non-English locales.
- Changing the existing short-segment auto-shrink behaviour, except to compose with the new size.
- Changes to the excalidraw-app collaboration server or storage.

## Gate 0
Approved 2026-11-09 (auth: estimated, policy: opus55-plus-flash38-agsdk). Write contract frozen: 42 allowlist, 17 off-limits patterns; non-English locales excluded by absence from the allowlist.
