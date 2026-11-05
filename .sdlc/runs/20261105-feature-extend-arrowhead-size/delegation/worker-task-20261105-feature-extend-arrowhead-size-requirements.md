Changes asked for this step:

Gate 1 answer: revise. Change only what these comments ask; leave every other requirement as it is (the person did not object to FR-9, FR-12 or the 0.5/1/1.5 presets).

The person's comments, verbatim: "FR-13 doesn't say what pasting styles does when the source element has no arrowheadSize, while every other style paste carries, the arrowheads included, makes the target match the source even when the source value is empty (actionStyles.ts:190). No acceptance criterion tests FR-13 either."

Context checked in the code (by the orchestrator, not the person's words): in packages/excalidraw/actions/actionStyles.ts, lines 185-192 set `startArrowhead: elementStylesToCopyFrom.startArrowhead, endArrowhead: elementStylesToCopyFrom.endArrowhead` unconditionally, null included, inside `if (newElement.type === "arrow" && isArrowElement(elementStylesToCopyFrom))`, and then re-route elbow arrows. So that block only runs for arrow-to-arrow pastes.

What to change:
1. Rewrite FR-13 so pasting styles makes the target's `arrowheadSize` match the source's in every case, alongside the arrowheads. When the source has a numeric `arrowheadSize`, the target gets that value. When the source has none, the target ends with no `arrowheadSize` (today's default size), including when the target had one before the paste. State which source/target pairs this applies to, consistent with the existing arrowhead-paste block (arrow to arrow), or say explicitly if it is wider. Keep the elbow re-route.
2. Add an acceptance criterion (a Vitest test in an allowlisted test file, e.g. packages/excalidraw/actions/*.test.tsx or packages/excalidraw/tests/**) that covers both cases: copying from a source with `arrowheadSize: 1.5` sets 1.5 on a target that had none, and copying from a source with no `arrowheadSize` onto a target with `arrowheadSize: 0.5` leaves the target with `arrowheadSize === undefined`.
Keep the existing AC numbering stable. Add the new criterion as the next number before the full-suite criterion, or append it, and say which.

Edit the pieces you handed in and hand each changed one in again.