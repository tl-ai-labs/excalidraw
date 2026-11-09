# Requirements — feature-extend — Per-element arrowhead size

Run: `20261109-131655-feature-extend-arrowhead-size` · Intent: feature-extend (delta requirements) ·
Source: `intent_brief.md` (Gate 0, 2026-11-09), excalidraw/excalidraw#6712.

## Delta summary

Today an arrowhead's size is fixed per head type (`getArrowheadSize` in `packages/element/src/bounds.ts`) and
only shrinks automatically on short final segments. This change adds an **optional per-element arrowhead size**
on linear elements (arrows and lines), a **properties-panel control** to set it, an appState default for new
elements (`currentItemArrowheadSize`), and makes every consumer of head geometry (canvas, SVG export, bounds,
hit-testing) honour it. An element without the property behaves exactly as today.

## In scope

1. A new optional property on `ExcalidrawLinearElement` holding the element's arrowhead size; absent means the
   default size (today's geometry, unchanged).
2. A set of selectable sizes: the default (today's size) plus at least one smaller and one larger size.
3. The size scales both start and end heads of the element, for every head type, and composes with the existing
   short-segment auto-shrink (the smaller of the two wins; the auto-shrink rule itself is unchanged).
4. Head geometry, canvas rendering, SVG export, element bounds and hit-testing all use the same scaled size.
5. A properties-panel control, shown wherever the arrowhead controls are shown today, that sets the size on the
   selected arrow/line elements and on `appState.currentItemArrowheadSize` for new elements.
6. New arrows/lines created by the user (drawing tool, flowchart, element-type conversion) pick up
   `currentItemArrowheadSize`.
7. Restore of saved/imported scenes: an element without the property keeps it absent (default); an invalid value
   is dropped to the default. `currentItemArrowheadSize` restores with a default in appState.
8. Copy/paste styles carries the size; history (undo/redo) and collaboration carry it as an ordinary element
   property.
9. Skeleton API (`convertToExcalidrawElements`) passes the property through when given.
10. English label strings in `packages/excalidraw/locales/en.json`; a `CHANGELOG.md` entry for the new public
    element/appState surface; skeleton API docs only if the skeleton passes it through.
11. Tests: element-level unit tests for geometry and bounds, editor-level jsdom tests for the control, restore
    and SVG export.

## Out of scope

1. Translations other than English (Crowdin handles them; non-English locales are not in the allowlist).
2. Changing the short-segment auto-shrink behaviour beyond composing with the new size.
3. `excalidraw-app/**` (collab server, storage, app layer) — the collab payload is generic over element props.
4. Free-form numeric sizes typed by the user (a fixed set of choices is enough).
5. Different sizes for the start and end heads of one element.
6. `.gitignore`, env files, AI config files, and every other off-limits path from Gate 0.

## Functional requirements

### Element package (`packages/element`)

- **FR-1** `ExcalidrawLinearElement` gains one optional property for the arrowhead size; its type is a closed set
  of values (or a value from a closed set of scales) exported for use by the editor.
- **FR-2** Head geometry (`getArrowheadSize` / `getArrowheadPoints` and the code that fits a head to the last
  segment) takes the element's size into account: the default yields byte-identical points to today; smaller and
  larger sizes scale the head proportionally; the short-segment fitting still applies on top.
- **FR-3** Element bounds (`getElementBounds` and the arrowhead parts of bounds computation) follow the scaled head,
  so a larger head grows the bounds and a smaller head shrinks them when the head defines the extent.
- **FR-4** Shape generation for canvas rendering and hit-testing (`shape.ts`, `renderElement.ts`) uses the scaled
  head, so a click on a large head's area hits the element and the drawn head matches the bounds.
- **FR-5** Element factories (`newLinearElement` / `newArrowElement`) accept the size as an option; when it is not
  given, or given as the default, the created element does not carry the key (so element snapshots are
  unchanged).
- **FR-6** The skeleton transform passes the size through to the created element when the skeleton specifies it.

### Editor package (`packages/excalidraw`)

- **FR-7** `AppState` gains `currentItemArrowheadSize`, defaulting to the default size; it is part of the
  restorable/ persisted appState the same way `currentItemStartArrowhead` / `currentItemEndArrowhead` are.
- **FR-8** A properties-panel action (new `ActionName`) renders a control (a discrete-choice `RadioSelection` in
  the pattern of `actionChangeStrokeWidth`) shown under the same predicate as the arrowhead pickers; choosing a
  value updates every selected linear element and `currentItemArrowheadSize`, and is recorded for undo.
- **FR-9** New linear elements created in the editor (drawing, flowchart-created arrows, element-type conversion)
  take `currentItemArrowheadSize`; the default value leaves the key absent per FR-5.
- **FR-10** `restore` keeps an element's valid size, drops an invalid value (key absent, default size), and leaves
  an element without the key unchanged; appState restore falls back to the default for a missing/invalid
  `currentItemArrowheadSize`.
- **FR-11** Copy styles / paste styles (`actionStyles.ts`) copies the size along with the arrowheads.
- **FR-12** SVG export (`staticSvgScene.ts` via the shared shape code) draws heads at the element's size.
- **FR-13** English strings for the control's label and each option are added to `en.json`; `CHANGELOG.md` notes
  the new element property, appState key and action.

## Non-functional requirements

- **NFR-1 Backward compatibility.** A scene saved without the property loads, renders, exports and hit-tests
  exactly as before. Element and geometry snapshots stay unchanged; only snapshots that capture appState may gain
  `currentItemArrowheadSize` (Gate 0 snapshot rule).
- **NFR-2 Collaboration safety.** The property is additive and optional; an older client receiving an element
  with it loads the element without error (rendering it at its default size). No change to the reconcile or
  versioning logic beyond what an ordinary property mutation already does.
- **NFR-3 Consistency.** Canvas, SVG, bounds and hit-testing compute the head from one shared function, so they
  cannot disagree.
- **NFR-4 Type safety and lint.** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.
  Code follows `AGENTS.md` (owner document/window, `Merge<>` over `Omit &`) and the repo's style.
- **NFR-5 Performance.** No measurable cost on the render path: the size lookup is a constant-time scale, no new
  allocations per frame beyond today's head computation.

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| (none) | — | The change adds a geometric styling property; no personal data is read, stored or transmitted. |

## Role matrix

| Role | Resource | Action |
|---|---|---|
| Editor user | Selected arrow/line element | Set arrowhead size (via properties panel; undoable) |
| Editor user | `appState.currentItemArrowheadSize` | Set (via the same control) |
| Collaborator / viewer | Element | Read (renders at the element's size; older clients at default) |
| Library host (API) | Skeleton element | Set via `convertToExcalidrawElements` |

No authz model exists in the editor library; the change adds none.

## Acceptance criteria

- **AC-1** A jsdom test restores a scene holding an arrow with a smaller-than-default size, exports it to SVG and
  shows its head is drawn smaller than the same arrow at the default size.
- **AC-2** A test restores an arrow without the property: the restored element has no size key, and its head
  points and bounds equal today's; existing element and geometry snapshots pass unchanged.
- **AC-3** An element-level test shows the bounds of an arrow grow with a larger size and shrink with a smaller
  one (where the head defines the extent), and that the default equals today's bounds.
- **AC-4** An element-level test shows the head on a short final segment is the smaller of the auto-shrunk size
  and the chosen size (composition with the existing fitting).
- **AC-5** A jsdom test selects an arrow, uses the new properties-panel control, and finds the element's size and
  `currentItemArrowheadSize` updated; undo restores the previous size; a newly drawn arrow picks up the chosen size.
- **AC-6** `restore` drops an invalid size value to the default, and appState restore defaults a missing
  `currentItemArrowheadSize`.
- **AC-7** `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` passes, with no failures that
  were not already failing before the run.

## Assumptions (to confirm at Gate 1)

- **A-1 Representation.** The size is a small closed set of named presets (e.g. `small` / `medium` / `large`, or a
  similar set the architect fixes) mapped to scale factors on today's per-type size, with the default = today's
  exact size (scale 1). The architect may instead choose numeric scale values from a closed list; either way the
  type is a closed union and the default is represented by the key's absence on elements.
- **A-2 One size per element.** One size applies to both heads (start and end).
- **A-3 Lines.** The control is shown for any linear element that can carry arrowheads (the existing `arrowheads`
  predicate), so lines with heads get it too.

## Open questions for HITL

1. Is the preset set (A-1) acceptable, and should the larger option(s) exist at all, or only smaller sizes than
   today's? Default reading: offer smaller and larger.
2. Should the control be hidden when an element has no arrowheads at all? Default reading: follow the existing
   `arrowheads` predicate exactly, without a new condition.
