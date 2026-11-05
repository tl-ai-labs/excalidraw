# SDLC run ledger

Machine mirror: [ledger.json](ledger.json). Each run's records are in `runs/<run-id>/`.

| Run | Intent | Outcome | Files | Tests | Cost | Branch / commit |
|---|---|---|---:|---|---:|---|
| [20261105-105313-feature-new-text-range-styles](runs/20261105-105313-feature-new-text-range-styles/SUMMARY.md) | feature-new | accepted | 26 (2 new) | 2662 pass, 0 fail | $34.20 (provisional) | `EX-NF-11/argon4-agsdk-only`, uncommitted on `14bb42ede` |

## 20261105-105313-feature-new-text-range-styles: styled ranges in text elements

- **What:** text colour and highlight on part of a text element. Ranges are stored as `textStyles` (UTF-16 offsets into `originalText`, colours as canonical hex). They are drawn per run on canvas and as `<tspan>`/`<rect>` in SVG, previewed in the editor, and carried through restore and collaboration.
- **Policy:** `argon4-agsdk-only`. Every step ran on `gemini-4-argon`, with `claude-opus-5-5` orchestrating.
- **Cost:** $14.70 dispatched, plus $19.49 orchestration overhead from transcripts, unverified. Re-run `collect-orchestrator-usage.mjs` after the session closes.
- **Tests:** 2662 passed, 47 skipped, 1 todo. The todo is the existing one at `linearElementEditor.test.tsx:1401`. Baseline was 2632. No snapshots were regenerated.
- **Behaviour notes:**
  - A selection covering the whole text recolours the whole element.
  - After exiting the editor, undoing a range change takes two steps, the same as a whole-element colour change.
- **Open:** the eyedropper from the highlight picker previews on element `backgroundColor`. The fix needs `LayerUI.tsx`, `ColorPicker.tsx` and `colorPickerUtils.ts`, which were outside the allowlist.
