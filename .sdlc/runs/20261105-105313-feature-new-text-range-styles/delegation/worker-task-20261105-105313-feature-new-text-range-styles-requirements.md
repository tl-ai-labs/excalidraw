Changes asked for this step:

Gate 1 revise (from the user): FR-5, FR-8, FR-15, FR-17, AC-1 and AC-4 use isRTL(element.text) to select the RTL/mixed-direction path. isRTL only tests the first strong character, so LTR-first mixed text ('Price: ١٢٠ درهم') would take the LTR left-prefix path and mis-place runs. Select the bidi-aware path per visual line with hasRTLChars(line.text), as textWysiwyg.tsx:671 does for caret placement; keep isRTL only for the base direction (dir / text-anchor). Add an LTR-first mixed-direction case to AC-1 and AC-4.

Code references to verify in the files: packages/common/src/utils.ts lines 384-395 — RE_RTL_CHECK = ^[^LTR]*[RTL], i.e. "first directional character is RTL"; utils.ts lines 397-402 — hasRTLChars(text) = any RTL character, documented as "whether it may be laid out bidirectionally"; packages/excalidraw/wysiwyg/textWysiwyg.tsx lines 669-677 — the editor already routes a line through getLineCaretXFromNativeLayout when hasRTLChars(lineText).

What to change:
1. In FR-5, FR-8, FR-15 and FR-17 (and IS-3 / IS-7 if they name the selector), select the left-prefix path only for a visual line where !hasRTLChars(line.text); select the bidi-aware path (the architect's stated RTL/mixed-direction rule) per visual line where hasRTLChars(line.text) is true, whatever isRTL(element.text) says. State that isRTL(element.text) is used only for the base direction: canvas dir and SVG direction / text-anchor, as today.
2. AC-1: replace the isRTL selector wording with the per-line hasRTLChars selector, and add an LTR-first mixed-direction case (e.g. 'Price: ١٢٠ درهم', where isRTL is false but hasRTLChars is true) asserting it takes the bidi-aware path and its runs cover the right characters.
3. AC-4: same selector fix, and add an LTR-first mixed-direction SVG export case asserting correct tspan fills and highlight rect positions.
Keep all existing ids (FR-1..FR-17, AC-1..AC-6, IS-*, OOS-*) and every other section unchanged; no renumbering. Open questions stays "None" unless this raises one.

Edit the pieces you handed in and hand each changed one in again.