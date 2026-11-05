# Intent Brief — feature-extend — Per-element arrowhead size

## Context

Module: arrowheads on arrows and lines. Today the size is fixed per head type
(`getArrowheadSize` in `packages/element/src/bounds.ts`) and only shrinks automatically on very
short segments (`getArrowheadSizeBeyondLastSegment` / legible-size fitting in the same file).
Requested in excalidraw/excalidraw#6712.

Before: a short arrow between two small boxes carries a head almost as big as the boxes, and the
properties panel offers no size control.

(Source: user's brief, `../prompts/EX-FE-09/brief.txt`, captured verbatim in substance.)

## Goal

An optional per-element arrowhead size, set from a control in the properties panel, with a default.

After: the properties panel shows an arrowhead size control and the same short arrow displays a
small, proportionate head.

Proposed shape (open to revision at Gate 0): a new optional property on arrow/line elements
(working name `arrowheadSize`, applied to both heads) holding a small preset scale —
S / M / L — rendered as a `ButtonIconSelect` in the properties panel next to the arrowhead
pickers, mirrored by an `appState.currentItemArrowheadSize` for new elements. Absent / `M` equals
today's size exactly. The scale multiplies the per-type base from `getArrowheadSize` and is then
subject to the existing short-segment fitting, so the fitted size never exceeds the scaled size.

## Files in scope

Types & creation
- `packages/element/src/types.ts` — new optional element property
- `packages/element/src/newElement.ts` — creation option + default
- `packages/excalidraw/types.ts`, `packages/excalidraw/appState.ts` — `currentItemArrowheadSize` + storage config
- `packages/excalidraw/components/App.tsx`, `packages/excalidraw/components/App.drawshape.ts`,
  `packages/excalidraw/components/ConvertElementTypePopup.tsx`,
  `packages/element/src/flowchart.ts`, `packages/element/src/convertToShape.ts` — pass the property when creating arrows

Restore / history / collaboration
- `packages/excalidraw/data/restore.ts` — default/normalize for old files (no property → today's size)
- `packages/element/src/delta.ts`, `packages/element/src/reconcile.ts` — only if needed for the new property to round-trip through history and collab (read-first; edit only if a change is required)

Geometry, bounds & rendering
- `packages/element/src/bounds.ts` — size-aware `getArrowheadSize` / `getArrowheadAngle` / `getArrowheadPoints` / bounds, consistent with short-segment fitting
- `packages/element/src/shape.ts` — arrowhead shapes (canvas + SVG via rough.js)
- `packages/element/src/renderElement.ts` — canvas render path
- `packages/element/src/elbowArrow.ts`, `packages/element/src/transform.ts` — callers of `getArrowheadSize` (keep spacing consistent with the size)
- `packages/element/src/index.ts` — exports, if a new helper/type is exported

Properties panel & i18n
- `packages/excalidraw/actions/actionProperties.tsx` — new `changeArrowheadSize` action + panel control
- `packages/excalidraw/actions/types.ts` — `ActionName` union
- `packages/excalidraw/actions/actionStyles.ts` — copy/paste styles carries the size
- `packages/excalidraw/components/Actions.tsx` — render the control where arrowheads are shown
- `packages/excalidraw/components/icons.tsx` — icons for the presets, if needed
- `packages/excalidraw/locales/en.json` — new labels (other locales untouched; Crowdin fills them)

Tests & snapshots
- `packages/excalidraw/tests/helpers/api.ts` — `API.createElement` option
- `packages/excalidraw/tests/data/restore.test.ts`, `packages/excalidraw/tests/scene/export.test.ts`,
  `packages/element/tests/bounds.test.ts`, `packages/element/tests/shape.test.ts` — new/extended tests
- `packages/excalidraw/tests/**/__snapshots__/**`, `packages/element/src/__tests__/__snapshots__/**`,
  `packages/element/tests/__snapshots__/**`, `packages/utils/tests/__snapshots__/**` — snapshot updates
  (appState snapshots gain `currentItemArrowheadSize`; element snapshots must NOT change for old arrows)

Docs
- `packages/excalidraw/CHANGELOG.md` — Unreleased entry

## Files off-limits

- Project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
  `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- AI configs detected: `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- Ticket-specific: `yarn.lock`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`,
  `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `packages/excalidraw/locales/*.json` other than `en.json`,
  `dev-dist/**`

## Acceptance criteria

1. jsdom test: an arrow with the new (smaller) size restores and renders a smaller head in SVG export than the same arrow at the default size.
2. jsdom test: an old arrow without the property restores to today's size; existing element snapshots are unchanged (only appState snapshots gain the new `currentItem*` field).
3. Bounds follow the size (test in `bounds.test.ts`), and stay consistent with the existing short-segment fitting.
4. The properties panel shows the arrowhead size control for arrows/lines; changing it updates selected elements and the current-item default.
5. Collaborators on older versions keep rendering identically (property is optional/additive; no change to existing fields' meaning).
6. `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.

## Non-goals

- Separate start/end sizes (one size applies to both heads) — unless revised at Gate 0.
- Changing default head sizes or the short-segment fitting algorithm itself.
- Translating labels into locales other than `en.json`.
- Changing arrowhead types, the Mermaid/skeleton public API beyond an additive optional field, or the excalidraw-app.

## Gate 0 — final scope (approved 2026-11-04)

- Approved as proposed; auth mode `estimated`; policy `opus55-only`; test command `yarn test:app --watch=false`
  (plus `yarn test:typecheck`, `yarn test:code`; snapshots via `yarn test:update`).
- Design: single S / M / L preset `arrowheadSize` applying to both heads; absent / M = today's size.
- `.gitignore` added to the allowlist (default yes to the Gate 0 prompt): append a `.sdlc/` line.
- Write contract frozen with 35 allowlist entries (Files in scope above + `.gitignore`) and 18 off-limits patterns.
  Locale files other than `en.json` are outside the allowlist and therefore refused.
