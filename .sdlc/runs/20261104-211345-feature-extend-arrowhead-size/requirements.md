# Requirements — feature-extend — Per-element arrowhead size

Run: `20261104-211345-feature-extend-arrowhead-size` · Intent: `feature-extend` (delta requirements)
Source: `intent_brief.md` (Gate 0 approved 2026-11-04), `discovery.md`. Upstream request: excalidraw/excalidraw#6712.

## Delta summary

Today every arrowhead has a fixed per-type size (`getArrowheadSize` in `packages/element/src/bounds.ts`:
arrow 25, diamond 12, cardinality 15/20, otherwise 15), shrunk only by the short-segment fitting in
`getArrowheadPoints`. This run adds an optional per-element `arrowheadSize` on linear elements
(arrows and lines), a scale factor on that base size, set from a new properties-panel control. Absent
means today's size, and absent stays absent through creation, restore and export.

## In scope

1. A new `ArrowheadSize` type (`"small" | "medium" | "large"`) and an optional `arrowheadSize` field on
   `ExcalidrawLinearElement` (so on arrows, elbow arrows and lines).
2. Scale constants for the presets (small 0.5, medium 1, large 1.5) in one place.
3. Arrowhead geometry (points, shapes, bounds, hit-testing) uses the base size times the element's scale,
   before the existing short-segment fitting.
4. Every other caller of `getArrowheadSize` that measures a concrete element's head (elbow-arrow routing,
   skeleton label margin in `transform.ts`, binding) uses the same scaled size where it has the element.
5. `getCanvasPadding` considers both start and end heads (fixing the `endArrowhead || endArrowhead` typo)
   and scales its arrowhead padding with the element's arrowhead size.
6. `restore` keeps a valid `arrowheadSize`, drops an invalid one, and never adds the field when it is absent.
7. `newElement` / `newLinearElement` / `newArrowElement` accept an optional `arrowheadSize` and do not write
   the field when it is not given.
8. A new action `changeArrowheadSize` in `actionProperties.tsx` (3-option `ButtonIconSelect`, like stroke width),
   registered in `actions/types.ts`, rendered in `components/Actions.tsx` beside the arrowhead pickers when a
   selected element has an arrowhead, included in copy/paste styles (`actionStyles.ts`), with English labels in
   `locales/en.json` and icons in `icons.tsx` if needed.
9. Test helper `tests/helpers/api.ts` accepts `arrowheadSize` for linear/arrow factories.
10. Tests: unit tests in `packages/element/tests/{bounds,shape,newElement}.test.ts`, restore tests in
    `packages/excalidraw/tests/data/restore.test.ts`, and a new jsdom test
    `packages/excalidraw/tests/arrowheadSize.test.tsx` (panel control, undo, SVG export, bounds).

## Out of scope

1. Independent start and end sizes (one size is shared by both heads).
2. An AppState default such as `currentItemArrowheadSize` ("remember for the next arrow"); newly drawn arrows use the default.
3. Free numeric sizing or a slider.
4. Translations other than `en.json` (Crowdin manages them; they are outside the write contract).
5. Any change under `excalidraw-app/`.
6. Changing the default (medium) head size of any arrowhead type.
7. Rewriting any existing snapshot; `yarn test:update` is not used in this run.
8. Modifying `.gitignore`, `CLAUDE.md`, `AGENTS.md` or other AI configuration.

## Functional requirements

### Element model (`packages/element`)

- **FR-1** — `packages/element/src/types.ts` exports `type ArrowheadSize = "small" | "medium" | "large"`, and
  `ExcalidrawLinearElement` gains `arrowheadSize?: ArrowheadSize`. Derived types that build on it keep using
  `Merge<Base, Overrides>` (AGENTS.md), not `Omit & ...`.
- **FR-2** — One source of truth maps each `ArrowheadSize` to its scale: small 0.5, medium 1, large 1.5
  (e.g. `ARROWHEAD_SIZE_SCALE` in `packages/common/src/constants.ts`), plus a default of `"medium"`. A helper
  returns the scale for an element, treating an absent or unknown value as 1.
- **FR-3** — The arrowhead size used for a concrete element's head is `base(arrowhead) × scale(element)`.
  `getArrowheadSize(arrowhead)` keeps its current signature and values for callers that have no element; the
  scaled size is applied in `getArrowheadPoints` (and anything else that measures a given element's heads)
  **before** the existing short-segment fitting, so the fitting still caps the head on short segments.
- **FR-4** — Arrowhead shapes (`shape.ts#getArrowheadShapes`), element bounds (`bounds.ts`), and hit-testing
  follow the scaled size, so a `"large"` head yields wider bounds than an absent one, which is wider than `"small"`.
- **FR-5** — Elbow-arrow routing (`elbowArrow.ts`), skeleton label margins (`transform.ts`) and binding
  (`binding.ts`) use the scaled size wherever they compute room for a specific element's head; where a caller
  has no element, it keeps today's base size.
- **FR-6** — `renderElement.ts#getCanvasPadding` checks `startArrowhead || endArrowhead` (fixing the typo) and
  scales the arrowhead padding by the element's arrowhead scale, so large heads are not clipped on the
  element canvas; elements with no head, and default-size heads, keep today's padding.
- **FR-7** — `newLinearElement` and `newArrowElement` (and the generic element factory they use) accept an
  optional `arrowheadSize`; when it is `undefined` the returned element has no `arrowheadSize` key at all.
- **FR-8** — `packages/element/src/index.ts` exports the new type and helper(s) needed by `packages/excalidraw`.

### Data (`packages/excalidraw/data`)

- **FR-9** — `restore.ts` keeps `arrowheadSize` on linear and arrow elements when it is one of the three
  allowed values, and omits the key when it is absent or invalid (modelled on `restoreStrokeVariability` /
  `ALLOWED_STROKE_VARIABILITIES`). An element restored without the field has no `arrowheadSize` key.

### Properties panel (`packages/excalidraw`)

- **FR-10** — A new action `actionChangeArrowheadSize` (name `"changeArrowheadSize"`, added to the
  `ActionName` union in `actions/types.ts`) in `actionProperties.tsx`: its `perform` sets `arrowheadSize` on
  every selected linear element that has a start or end arrowhead, through the existing element-mutation path
  (`newElementWith` / `changeProperty`) so the version bumps and the change is captured by history
  (`CaptureUpdateAction.IMMEDIATELY`). It does not touch AppState fields.
- **FR-11** — Its `PanelComponent` renders a 3-option `ButtonIconSelect` (small / medium / large), like
  `actionChangeStrokeWidth`, showing the common value of the selection (absent counts as medium).
- **FR-12** — `components/Actions.tsx` renders `changeArrowheadSize` next to `changeArrowhead` when the
  selection includes an element with an arrowhead (start or end).
- **FR-13** — `actionStyles.ts` copies and pastes `arrowheadSize` with the other arrowhead styles, and Paste
  styles makes every pasted-onto linear element's arrowhead size **match the source**, like every other style it
  carries (the arrowheads included, even when the source value is empty):
  - source has a value → the target gets that value;
  - source has no `arrowheadSize` → the target's own value is cleared, so it renders at the default (medium)
    size, exactly like the source; a `"small"` or `"large"` target does not keep its size.
  A cleared target holds no `"small"`/`"large"` value, and its serialized form (JSON export, `.excalidraw`
  file, clipboard, collab payload) carries no `arrowheadSize` key, the same as an element that never had one.
  The change goes through the existing element-mutation path, so it bumps the version and is undoable.
  Pasting from an absent source onto a target that also has no size leaves the target without the key.
- **FR-14** — `locales/en.json` adds the label for the control and its three options; icons are added to
  `components/icons.tsx` only if no suitable existing icon is reused. DOM access, if any, uses
  `app.ownerDocument` / `ownerWindow` (AGENTS.md), never globals.
- **FR-15** — `tests/helpers/api.ts` element factories accept and pass through `arrowheadSize`.

## Non-functional requirements

- **NFR-1 Backward compatibility** — Files and clipboard payloads without the field render exactly as today.
  Older clients ignore the unknown optional field and render today's size.
- **NFR-2 Snapshot stability** — Every existing snapshot (`packages/**/__snapshots__/**`) stays byte-identical;
  only new snapshot entries from new tests may be added.
- **NFR-3 Collab/history** — The field travels through the existing version bump, history deltas and
  reconciliation; no new AppState field, so app-state snapshots and collab payloads are unchanged.
- **NFR-4 Type safety and lint** — `yarn test:typecheck` and `yarn test:code` (eslint, max-warnings 0) pass.
- **NFR-5 Performance** — The scale lookup is constant-time and allocation-free on the render path
  (`.github/copilot-instructions.md`: performance over allocation).
- **NFR-6 Conventions** — `Merge<Base, Overrides>` over `Omit & ...`; `app.ownerDocument` over DOM globals.

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| `arrowheadSize` (element style enum) | None — a drawing style value, no personal data | Validated on restore; no new storage, network or logging path |

No PII is introduced, read or transmitted by this change.

## Role matrix

Excalidraw has no authorization roles for element styling; every user who can edit a scene can do this.

| Role | Resource | Action |
|---|---|---|
| Editor (any user with edit access) | Selected arrow/line element | Change `arrowheadSize` via the properties panel; copy/paste styles |
| Viewer (view mode / read-only) | Arrow/line element | Sees the rendered size; the control is not shown (existing view-mode behaviour) |
| Collaborator (older client) | Element with `arrowheadSize` | Receives the field, ignores it, renders today's size |

## Acceptance criteria

- **AC-1** — A jsdom test shows that an arrow with `arrowheadSize: "small"` survives `restore` and renders a
  smaller head in SVG export than the same arrow without the property.
- **AC-2** — An old arrow without the property restores to today's size without the field being added
  (no `arrowheadSize` key), an invalid value is dropped, and every existing snapshot is unchanged.
- **AC-3** — Element bounds follow the size: `"large"` is wider than default, which is wider than `"small"`; on
  a very short segment the short-segment fitting still caps the head.
- **AC-4** — The properties panel shows the arrowhead size control for a selected arrow or line with an
  arrowhead (and not for one without); picking a size updates the element and is undoable (undo restores the
  previous value).
- **AC-5** — `getCanvasPadding` accounts for a start-only head and grows for large heads.
- **AC-6** — `newLinearElement` / `newArrowElement` without `arrowheadSize` produce no `arrowheadSize` key;
  with it, they keep the given value.
- **AC-7** — `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass, with no existing
  snapshot rewritten.
- **AC-8** — Copy/paste styles: copying from a `"small"` arrow and pasting onto an arrow without the field makes the
  target `"small"`. Copying from an arrow **without** `arrowheadSize` and pasting onto a `"large"` arrow makes the
  target render at the default size, the same as the source: its head bounds equal the source's at default size,
  and its serialized form (`serializeAsJSON`) has no `arrowheadSize` key. Undo restores `"large"`.

## Open questions for HITL

None blocking — Gate 0 approved the proposed design defaults. For the record:

1. Resolved at Gate 1 (revise): Paste styles makes the target's arrowhead size match the source, an absent
   source size included (it clears the target's size to the default). See FR-13 and AC-8.
2. `.sdlc/` is not in `.gitignore` (it is excluded only by the parent repo's local `.git/info/exclude`);
   `.gitignore` is not modified by this run.
