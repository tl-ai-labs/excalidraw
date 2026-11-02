# Requirements — Partial colour and highlight in text elements

Run: `20261102-feature-new-rich-text-spans` · Job: feature-new · Base commit: 14bb42ed
Source: `intent_brief.md` (approved at Gate 0, revision 2). Where this file and the brief differ, the brief wins.

## In scope

1. A styled-range data model on text elements: a colour, a highlight, or both, over part of `originalText`.
2. Ranges kept aligned through text edits, line wrapping, bound-text containers, font changes and list renumbering.
3. Canvas rendering per run, and PNG export through the same path.
4. SVG export with tspans.
5. Colour controls that apply to a selection while editing text.
6. Restore of old files and of malformed ranges.
7. Saving, undo and copying through the existing element pipeline.
8. A range merge inside `reconcileElements`, on both of its outcomes, that reaches every collab path with no `excalidraw-app` source change.
9. Docs and changelog for the new field.

## Out of scope

1. Merging the characters of two concurrent text edits. The text keeps its one winner; only ranges are merged.
2. Merge guarantees for clients on a build without this feature. Ranges they leave misaligned are clamped by `restore`.
3. Per-range font family, font size, bold or italic.
4. Replacing the `<textarea>` with a rich-text editor.
5. Backend, Firebase rules or `excalidraw-app` source changes.
6. Translating new strings. Crowdin manages every locale other than `en.json`.
7. Any new endpoint, storage backend, background job or retry logic.
8. Any change under `**/__snapshots__/**`, or to any path the write contract does not allow.

## Functional requirements

### Data model (`packages/element`)

- **FR-1** A text element may carry an optional list of styled ranges. Each range gives a start, an end, and a colour, a highlight, or both. The field is absent on text with no ranges; it is never an empty list.
- **FR-2** Range offsets index `originalText`, never the wrapped `text`.
- **FR-3** When `originalText` changes by an insert or a delete, every range stays on its own characters: it shifts when the change is before it, grows or shrinks when the change is inside it, and is dropped when all its characters are gone. The plan states what happens to an insert exactly at a range's edge.
- **FR-4** Ranges stay aligned with what is drawn after wrapping, including the whitespace wrapping removes at a line break, after a container resize, an auto-resize toggle and a font family or size change.
- **FR-5** List renumbering in `listMarker.ts`, which rewrites `originalText`, keeps ranges on their characters.
- **FR-6** Bound text keeps its ranges when bound to, unbound from or wrapped in a container, and through sticky note label layout. A sticky note's ink sync changes the base colour only.
- **FR-7** Offsets never split a surrogate pair when a line is drawn in runs.
- **FR-8** New text elements, duplicates, and elements created through `convertToExcalidrawElements` (`transform.ts`) carry the field, and the skeleton accepts it.
- **FR-9** Undo and redo restore ranges together with the text they belong to (`delta.ts`). A remote merge is not captured as a local undo step.

### Canvas rendering (`packages/element`)

- **FR-10** A line with styled runs is drawn run by run, with each run in its own colour and each highlight behind its text, at the positions the same line would have unstyled. This holds for left, centre and right alignment, for all line heights, and for bound text.
- **FR-11** A range's colours follow the same theme treatment as the element's base colour, so dark mode handles them the same way.
- **FR-12** A line with no styled run is drawn exactly as today, with one `fillText`.
- **FR-13** A change to an element's ranges shows on the canvas even when the element's `version` did not change, which is the case after a merge.

### Editor (`packages/excalidraw`)

- **FR-14** The text editor maps the current `<textarea>` selection to offsets into `originalText`.
- **FR-15** With a selection, choosing a colour or highlight applies it to that range. The editor stays open and the selection stays in place while the user works the colour controls, including their popover.
- **FR-16** With no selection, colouring changes the base colour as it does today and leaves range overrides in place. This holds while editing and when the element is selected on the canvas.
- **FR-17** The user can clear the colour or highlight from a selection.
- **FR-18** A styled range is visible while editing. The `<textarea>` stays; the plan states how the range shows, for approval at Gate 2.
- **FR-19** Ranges follow the text while the user types, and the committed element carries them. Committing empty text behaves as today.
- **FR-20** Copying and pasting a text element keeps its ranges. Plain text copied out of the editor stays plain, and text pasted into the editor follows FR-3. Copy-and-paste styles transfers base style only and leaves the target's ranges in place, because ranges are offsets into one specific text.
- **FR-21** New UI strings are added to `locales/en.json` only.

### SVG export (`packages/excalidraw`)

- **FR-22** A line with styled runs is written as one `<text>` holding `<tspan>`s with the right `fill`, and highlights are drawn behind the text. Positions match the canvas.
- **FR-23** A line with no styled run is written exactly as today, byte for byte.

### Restore (`packages/excalidraw`)

- **FR-24** `restore` leaves legacy text alone: no field is added.
- **FR-25** `restore` clamps out-of-bounds ranges and drops malformed ones, including a bad colour value. It removes the field when no range is left.
- **FR-26** `restore` keeps every piece of data the merge depends on, since `Collab.tsx:782` runs it before reconciling.

### Reconciliation (`packages/excalidraw/data/reconcile.ts`)

- **FR-27** `reconcileElements` keeps its signature. The element's text resolves to one winner as it does today, and ranges from both sides are merged on both outcomes, remote taken and remote discarded.
- **FR-28** The merge keeps the winner's `version` and `versionNonce`, so it starts no broadcast of its own.
- **FR-29** The plan sets the range identity and clear-tracking data that tells a stale peer from a concurrent one, for approval at Gate 2. A range cleared on one client does not come back from a peer that was merely behind.
- **FR-30** The losing side's ranges are placed on the same characters in the winning text. Those whose characters are all gone are dropped.
- **FR-31** The merge is commutative and idempotent: merging either way gives identical ranges whichever side wins, and repeating it changes nothing. The existing `bumpElementVersions` step at `Collab.tsx` must therefore cause no drift. Overlapping styles resolve to the same result on both clients.
- **FR-32** A remote update that arrives while the local user edits that text does not lose the remote ranges once the edit is committed, even though the element is dropped at `reconcile.ts:31` today.
- **FR-33** Elements with no ranges on either side reconcile exactly as they do today.
- **FR-34** The merge reaches the live socket and scene init path (`Collab.tsx:784`), the Firebase save path (`firebase.ts:225`) and the app load path (`App.tsx:352`) with no `excalidraw-app` source change.

### Docs

- **FR-35** `json-schema.mdx`, `excalidraw-element-skeleton.mdx`, `utils/restore.mdx` and the package `CHANGELOG.md` describe the field and how `restore` treats it.

## Non-functional requirements

- **NFR-1** Unstyled text keeps its existing canvas and SVG output byte for byte, so no existing snapshot changes.
- **NFR-2** Unstyled text pays no new per-frame cost beyond one check that the field is absent.
- **NFR-3** No new dependency, in any `package.json`.
- **NFR-4** Range colours come from files and from peers, so they are untrusted. They reach the SVG through attribute APIs, never through string-built markup, and `restore` validates them (FR-25).
- **NFR-5** Clear-tracking data stays bounded in normal use. The plan states the bound.
- **NFR-6** Merge cost is negligible for elements with no ranges (FR-33), and reconcile stays linear in the number of elements for scenes with ordinary text.
- **NFR-7** Project style holds: strict TypeScript, and `yarn test:code` passes. Verification never uses `yarn test:update`.

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| Range offsets and colours | None. Styling data only | Carried and encrypted with the element, as today |
| Range identity and clear-tracking data | None, provided it is not derived from a user | Must be random or content-derived. It must not hold a username, socket id or any other collaborator identity |
| Text content | Unchanged by this feature | Unchanged |

## Role matrix

| Role | Text element ranges | Action |
|---|---|---|
| Editor (local, or a collaborator in a room) | Own scene | Create, change, clear |
| User in view mode | Any | Read only: sees rendered styling, and the existing view-mode rules stop text editing |
| Host app using the library | Elements it passes in | Read and write through element data and the skeleton |

## Acceptance criteria

- **AC-1** Unit tests on the range model cover insert and delete shifting.
- **AC-2** Unit tests cover ranges staying aligned through wrapping.
- **AC-3** Unit tests cover restore of legacy text, and clamping or dropping of bad ranges.
- **AC-4** A jsdom test applies a colour to a selection in the editor and asserts element data.
- **AC-5** SVG export tests assert tspans with the right fill.
- **AC-6** Reconcile, different ranges: from a common start, each client styles a different range, and both ranges end up on both clients.
- **AC-7** Reconcile, style against text edit: one client styles a range while the other inserts or deletes text elsewhere, and the range stays on the same characters in the winning text.
- **AC-8** Reconcile, text edit inside a range: the range shrinks or grows with its characters.
- **AC-9** Reconcile, both edit text: the text resolves to one winner. Losing-side ranges stay on characters that still exist in the winning text, and ranges whose characters are all gone are dropped.
- **AC-10** Reconcile, overlap: both clients style the same characters differently, and both end with the same result.
- **AC-11** Reconcile, cleared range: a range cleared on one client does not come back from a peer that was merely behind.
- **AC-12** Reconcile, order independence: merging local into remote and remote into local gives identical ranges, whichever side wins, and repeating a merge changes nothing.
- **AC-13** Reconcile, mid-edit: a remote update that arrives while the local user edits that text does not lose the remote ranges once the edit is committed.
- **AC-14** Reconcile, unstyled text: elements with no ranges reconcile exactly as they do today.
- **AC-15** A test in `excalidraw-app/tests/collab.test.tsx` shows a remote update with ranges reaching the scene through the collab path, and ranges surviving a restore before reconcile.
- **AC-16** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass, measured against the failures already there before the run.
- **AC-17** No file under `**/__snapshots__/**` changes, and no existing snapshot test fails.

## Open questions for HITL

Two items the brief assigns to Gate 2, not this gate: the range identity and clear-tracking data (FR-29), and how a styled range shows while editing (FR-18).

Three requirements above are this run's reading of what the brief leaves open. Please confirm them or correct them here:

1. **FR-17:** the brief has no clear control, but its cleared-range test needs one. This adds a way to clear colour or highlight from a selection.
2. **FR-20:** the brief lists the clipboard and style actions in scope without saying what they do. This keeps ranges on element copy and leaves them out of copy-and-paste styles.
3. **FR-13:** the brief does not mention this. A merge keeps the element's `version`, so anything keyed on `version` could keep showing the old styling; the plan must cover it.
