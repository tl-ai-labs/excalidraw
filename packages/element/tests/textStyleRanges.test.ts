import { describe, expect, it } from "vitest";

import { getFontString } from "@excalidraw/common";
import {
  adjustTextStyleRangesForTextChange,
  applyTextStyleRange,
  mapWrappedLinesToOriginalOffsets,
  newElement,
  newTextElement,
  normalizeTextStyleRanges,
  redrawTextBoundingBox,
  Scene,
  splitLineIntoStyledRuns,
  syncInvalidIndices,
  wrapText,
} from "@excalidraw/element";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import {
  reconcileElements,
  type RemoteExcalidrawElement,
} from "@excalidraw/excalidraw/data/reconcile";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

describe("textStyleRanges", () => {
  describe("normalizeTextStyleRanges", () => {
    it("clamps offsets, drops invalid/empty/transparent, sorts, splits overlaps (later wins), and merges adjacent identical styles", () => {
      const normalized = normalizeTextStyleRanges(
        [
          { start: -5, end: 6, color: "#ff0000" },
          { start: 3, end: 10, color: "#0000ff" },
          { start: 10, end: 12, color: "#0000ff" },
          { start: 12, end: 12, color: "#00ff00" }, // empty
          { start: 13, end: 15 }, // no style
          { start: 13, end: 15, highlight: "transparent" }, // transparent highlight
          { start: 14, end: 100, highlight: "#ffff00" },
          { start: NaN, end: 5, color: "#111111" },
        ],
        18,
      );

      expect(normalized).toEqual([
        { start: 0, end: 3, color: "#ff0000" },
        { start: 3, end: 12, color: "#0000ff" },
        { start: 14, end: 18, highlight: "#ffff00" },
      ]);
    });

    it("returns [] when textLength is 0 or ranges are absent", () => {
      expect(normalizeTextStyleRanges(undefined, 10)).toEqual([]);
      expect(
        normalizeTextStyleRanges([{ start: 0, end: 5, color: "red" }], 0),
      ).toEqual([]);
    });
  });

  describe("applyTextStyleRange", () => {
    it("applies color and highlight independently and removes properties with null or transparent", () => {
      const len = 25;
      let ranges = applyTextStyleRange(undefined, len, 20, 25, {
        color: "#e03131",
      });
      expect(ranges).toEqual([{ start: 20, end: 25, color: "#e03131" }]);

      ranges = applyTextStyleRange(ranges, len, 20, 25, {
        highlight: "#fff3bf",
      });
      expect(ranges).toEqual([
        { start: 20, end: 25, color: "#e03131", highlight: "#fff3bf" },
      ]);

      ranges = applyTextStyleRange(ranges, len, 22, 25, { color: null });
      expect(ranges).toEqual([
        { start: 20, end: 22, color: "#e03131", highlight: "#fff3bf" },
        { start: 22, end: 25, highlight: "#fff3bf" },
      ]);

      ranges = applyTextStyleRange(ranges, len, 0, len, {
        highlight: "transparent",
      });
      expect(ranges).toEqual([{ start: 20, end: 22, color: "#e03131" }]);
    });
  });

  describe("adjustTextStyleRangesForTextChange", () => {
    const baseText = "Bid request timeout 120ms";
    const baseRanges = [{ start: 20, end: 25, color: "#e03131" }];

    it("shifts range when inserting before it", () => {
      const next = adjustTextStyleRangesForTextChange(
        baseRanges,
        baseText,
        "API Bid request timeout 120ms",
      );
      expect(next).toEqual([{ start: 24, end: 29, color: "#e03131" }]);
    });

    it("does not inherit style when inserting at a range's start", () => {
      const next = adjustTextStyleRangesForTextChange(
        baseRanges,
        baseText,
        "Bid request timeout ~120ms",
      );
      expect(next).toEqual([{ start: 21, end: 26, color: "#e03131" }]);
    });

    it("inherits style when inserting strictly inside a range", () => {
      const next = adjustTextStyleRangesForTextChange(
        baseRanges,
        baseText,
        "Bid request timeout 1200ms",
      );
      expect(next).toEqual([{ start: 20, end: 26, color: "#e03131" }]);
    });

    it("inherits style when inserting at a range's end", () => {
      const next = adjustTextStyleRangesForTextChange(
        baseRanges,
        baseText,
        "Bid request timeout 120ms!",
      );
      expect(next).toEqual([{ start: 20, end: 26, color: "#e03131" }]);
    });

    it("removes deleted parts and shifts remaining range", () => {
      const next = adjustTextStyleRangesForTextChange(
        baseRanges,
        baseText,
        "Bid timeout 120ms",
      );
      expect(next).toEqual([{ start: 12, end: 17, color: "#e03131" }]);

      const partialDelete = adjustTextStyleRangesForTextChange(
        baseRanges,
        baseText,
        "Bid request timeout 120",
      );
      expect(partialDelete).toEqual([{ start: 20, end: 23, color: "#e03131" }]);
    });
  });

  describe("wrapping alignment and run splitting", () => {
    it("maps wrapped lines back to originalText offsets including trimmed whitespace", () => {
      const original = "Bid request   timeout 120ms";
      const wrapped = "Bid request\ntimeout\n120ms";
      const mapped = mapWrappedLinesToOriginalOffsets(original, wrapped);

      expect(mapped).toEqual([
        { text: "Bid request", start: 0, end: 11 },
        { text: "timeout", start: 14, end: 21 },
        { text: "120ms", start: 22, end: 27 },
      ]);

      const ranges = [{ start: 22, end: 27, color: "#e03131" }];
      expect(
        splitLineIntoStyledRuns(mapped[2].text, mapped[2].start, ranges),
      ).toEqual([{ text: "120ms", start: 22, end: 27, color: "#e03131" }]);
    });

    it("keeps ranges aligned when wrapping inside a bound-text container", () => {
      const scene = new Scene();
      const container = newElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 120,
        height: 80,
      });
      const originalText = "Bid request timeout 120ms";
      const textEl = newTextElement({
        x: 0,
        y: 0,
        text: originalText,
        originalText,
        containerId: container.id,
        styleRanges: [{ start: 20, end: 25, color: "#e03131" }],
      });
      scene.replaceAllElements(
        syncInvalidIndices([
          {
            ...container,
            boundElements: [{ id: textEl.id, type: "text" }],
          },
          textEl,
        ]),
      );

      const wrapped = wrapText(originalText, getFontString(textEl), 100);
      redrawTextBoundingBox(textEl, container, scene);
      const updated = scene.getElement(textEl.id) as typeof textEl;

      const mapped = mapWrappedLinesToOriginalOffsets(
        updated.originalText,
        updated.text || wrapped,
      );
      const allRuns = mapped.flatMap((line) =>
        splitLineIntoStyledRuns(
          line.text,
          line.start,
          updated.styleRanges ?? [],
        ),
      );
      const styledRun = allRuns.find((r) => r.color === "#e03131");
      expect(styledRun?.text).toBe("120ms");
    });
  });

  describe("restore and reconciliation", () => {
    it("leaves legacy text elements without styleRanges untouched on restore", () => {
      const legacyText = newTextElement({
        x: 0,
        y: 0,
        text: "Legacy text",
      });
      expect("styleRanges" in legacyText).toBe(false);

      const [restored] = restoreElements([legacyText], null);
      expect("styleRanges" in restored).toBe(false);
    });

    it("clamps and normalizes out-of-bounds styleRanges on restore", () => {
      const textEl = newTextElement({
        x: 0,
        y: 0,
        text: "Hello",
        styleRanges: [
          { start: -3, end: 3, color: "#e03131" },
          { start: 2, end: 99, highlight: "#fff3bf" },
        ],
      });

      const [restored] = restoreElements([textEl], null);
      if (restored.type !== "text") {
        throw new Error("expected text element");
      }
      expect(restored.styleRanges).toEqual([
        { start: 0, end: 2, color: "#e03131" },
        { start: 2, end: 5, highlight: "#fff3bf" },
      ]);
    });

    it("keeps the winner's text and styleRanges together during reconciliation", () => {
      const base = newTextElement({
        x: 0,
        y: 0,
        text: "Bid request timeout 120ms",
        styleRanges: [{ start: 20, end: 25, color: "#e03131" }],
      });

      const local = {
        ...base,
        version: 2,
        versionNonce: 200,
        index: "a0",
      } as unknown as OrderedExcalidrawElement;

      const remote = {
        ...base,
        text: "Timeout 500ms",
        originalText: "Timeout 500ms",
        styleRanges: [{ start: 8, end: 13, color: "#1971c2" }],
        version: 3,
        versionNonce: 100,
        index: "a0",
      } as unknown as RemoteExcalidrawElement;

      const reconciled = reconcileElements([local], [remote], {
        ...getDefaultAppState(),
        editingTextElement: null,
      } as any);

      expect(reconciled).toHaveLength(1);
      const winner = reconciled[0];
      if (winner.type !== "text") {
        throw new Error("expected text element");
      }
      expect(winner.originalText).toBe("Timeout 500ms");
      expect(winner.styleRanges).toEqual([
        { start: 8, end: 13, color: "#1971c2" },
      ]);
    });
  });
});
