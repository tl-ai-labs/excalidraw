Changes asked for this step:

Gate 1 decision: revise. Apply exactly these changes to requirements.md; everything else is approved as written and must not change.

1. Presets and range. Small = 0.5, Medium = 1 (the default, omitted from elements), Large = 1.5; Large is capped at 1.5x. In FR-1 and FR-3, define the supported range as finite numbers in [0.5, 1.5] inclusive. FR-3: restore keeps any in-range value other than 1, and strips 1, out-of-range values, and every invalid value FR-3 already lists. FR-4: `currentItemArrowheadSize` falls back to 1 when it is missing or outside the same range. Update the FR-16 examples to match (e.g. 0.4 and 1.6 are stripped, 0.75 is kept).

2. Bounds stay as they are: keep out-of-scope item 3, and state its reason there. The size does not change the existing short-segment fitting, so a head's extent along the shaft stays on the shaft. Only its sideways extent can go past the shaft's bounding box, and that is already true at today's sizes.

3. AC-3 and FR-15 must say they test head geometry from `getArrowheadPoints`, not the element's bounding box. Add a measurable criterion: on a long straight last segment (long enough that no head is shortened), each head type's sideways half-width at scale s (0.5 and 1.5) equals s times its half-width at scale 1, within float tolerance. The head angle must not change with the scale when the head is not shortened. Add an explicit regression test: an `arrow` head at Small (0.5) stays at 20 degrees. State in FR-6 that `getArrowheadAngle` must compare the drawn size against the SCALED full size (getArrowheadSize(arrowhead, scale)); if it compared against the unscaled 25px, Small would widen to about 28 degrees.

4. Add a known limit under Out of scope, instead of any padding guarantee. Exported images frame the shafts plus the 10px export padding, so wide heads can be cropped at the image edge. Some heads already reach past the padding at today's size: bar 15px, cardinality-one markers 20px. At 1.5x the arrow head reaches 12.8px sideways, bar 22.5px and cardinality-one markers 30px. This run does not fix that. Do NOT claim that a 1.5x head stays inside the 10px padding; it does not.

5. Correct out-of-scope item 6. `restoreElementWithProperties` in packages/excalidraw/data/restore.ts spreads unknown element fields (`...element`) for forward compatibility, so older clients keep `arrowheadSize` through restore and edits and draw the head at today's size. They do not drop the field. Remove the "may drop the field on edit" wording.

Edit the pieces you handed in and hand each changed one in again.