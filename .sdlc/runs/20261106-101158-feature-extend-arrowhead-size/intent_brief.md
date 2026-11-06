# Intent Brief — feature-extend — Per-element arrowhead size

## Context

The module is arrowheads on arrows and lines. Today each head type has a fixed size (`getArrowheadSize` in `packages/element/src/bounds.ts:727-745`). The size only shrinks automatically when the last segment is very short (`getArrowheadPoints`, bounds.ts:1058-1087). The feature was requested in excalidraw/excalidraw#6712.

- **Before:** a short arrow between two small boxes carries a head almost as big as the boxes, and the properties panel has no size control.
- **After:** the properties panel shows an arrowhead size control, and the same arrow can show a small head in proportion to it.

Discovery's code map is in `.sdlc/runs/20261106-101158-feature-extend-arrowhead-size/discovery.md`, with the stack profile in `.sdlc/baseline/stack-profile.md`.

## Goal

Add an optional per-element arrowhead size to linear elements (arrows and lines with heads). It is set from a new properties-panel control and has a default. An element without the property renders exactly as it does today.

The architect decides these at design time; the proposal below can be revised at Gate 0:
- **Shape of the property:** one optional field on `ExcalidrawLinearElement` that applies to both heads (e.g. `arrowheadSize`). When it is absent or null, today's size is used.
- **Values:** named presets (e.g. small / medium = today's size / large) mapped to a scale factor, in the style of `STROKE_WIDTH` in `packages/common/src/constants.ts`. The control is a RadioSelection next to the arrowhead pickers and reuses the existing `small`/`medium`/`large` locale strings where they fit.
- **Scaling:** the scale applies to `getArrowheadSize` and stays consistent with `getArrowheadAngle`, the cardinality/crowfoot markers and the existing short-segment fitting.
- **Next arrow:** a `currentItemArrowheadSize` appState default, so the chosen size carries over to the next arrow drawn, as the head type already does.

The change touches:
- types
- creation
- restore defaults for old files
- history deltas and collaboration
- head geometry and bounds
- canvas and SVG rendering
- the properties panel
- i18n

## Files in scope

Element package:
- `packages/element/src/types.ts`: the new optional field
- `packages/element/src/bounds.ts`: size, angle, head points and the size beyond the last segment
- `packages/element/src/shape.ts`: head shapes for canvas and SVG
- `packages/element/src/renderElement.ts`: canvas padding for large heads
- `packages/element/src/newElement.ts`: creation defaults
- `packages/element/src/arrowheads.ts`
- `packages/element/src/elbowArrow.ts`: room reserved for heads
- `packages/element/src/transform.ts`: label margin and skeleton pass-through
- `packages/element/src/convertToShape.ts`
- `packages/element/src/flowchart.ts`
- `packages/element/src/binding.ts`: only if the architect finds it needs the size
- `packages/element/src/delta.ts`: history and collaboration deltas, only if the new field needs explicit handling

Common package:
- `packages/common/src/constants.ts`: size keys and values

Editor package (`packages/excalidraw/`):
- `actions/actionProperties.tsx`: the new action and panel control
- `actions/types.ts` and `actions/index.ts`: action wiring
- `actions/actionStyles.ts`: copy/paste styles
- `actions/actionFlip.ts`
- `components/Actions.tsx`: desktop and compact panels
- `components/shapeActionPredicates.ts`
- `components/App.tsx`, `components/App.drawshape.ts` and `components/ConvertElementTypePopup.tsx`: creation sites
- `appState.ts` and `types.ts`: the appState default and its storage config
- `data/restore.ts`: defaults and validation for old files
- `renderer/staticSvgScene.ts`: only if SVG export needs it
- `locales/en.json`
- `CHANGELOG.md`: one entry under Unreleased

Tests:
- `packages/element/tests/bounds.test.ts`
- `packages/element/tests/shape.test.ts`
- `packages/excalidraw/actions/actionProperties.test.tsx`
- `packages/excalidraw/tests/data/restore.test.ts`
- `packages/excalidraw/tests/scene/export.test.ts`
- `packages/excalidraw/tests/helpers/api.ts`
- New test files: `packages/element/tests/arrowheadSize.test.ts` and `packages/excalidraw/tests/arrowheadSize.test.tsx`
- `**/__snapshots__/*.snap`: only where adding the appState key changes a snapshot. Element snapshots must stay unchanged.

Docs:
- `dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx`, if the skeleton API passes the property through

## Files off-limits

- The project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- The AI configs: `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- `packages/excalidraw/locales/*.json` other than `en.json`, because those come from Crowdin
- `packages/excalidraw/types/**`, which is generated
- `excalidraw-app/**`
- Everything else not listed in scope

## Acceptance criteria

1. In jsdom tests, an arrow with the new (smaller) size restores, and its SVG export renders a smaller head than the default.
2. An old arrow without the property restores to today's size. Existing element and geometry snapshots stay unchanged; only snapshots that capture appState gain the new key.
3. Element bounds follow the size: a larger head grows the bounds, and the short-segment fitting still clamps the head.
4. The properties panel shows the size control for arrows (and for lines that have heads). Changing it updates the selected elements and is undoable.
5. Saved files without the property, and collaborators on older versions, render identically. The field is optional, so older clients ignore it.
6. `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` all pass.

## Non-goals

- Separate start and end sizes (unless revised at Gate 0)
- Free numeric sizes or a slider
- Translations other than en.json
- excalidraw.com app-only changes
- Changing default head sizes or the existing short-segment fitting rule
- Elbow-arrow routing changes beyond keeping the head clearance consistent

## Gate 0 — approved 2026-11-06

- Intent: feature-extend
- Policy: opus55-plus-flash38
- Auth mode: estimated
- Test command: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
- .gitignore `.sdlc/` entry: declined (n). `.sdlc/` is covered by `.git/info/exclude`.
- Design choices proposed at Gate 0 were approved: one `arrowheadSize` field; small/medium/large presets with medium as today's size; a missing field means today's size; lines with heads included; `currentItemArrowheadSize` appState default.
- Write contract frozen: 39 allowlist entries (Files in scope above, unchanged) and 17 off-limits patterns (project defaults, AI configs, packages/excalidraw/types/**, excalidraw-app/**). The non-English locale files are excluded because they are not on the allowlist.
