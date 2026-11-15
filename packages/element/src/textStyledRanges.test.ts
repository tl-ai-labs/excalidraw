import {
  COLOR_PALETTE,
  DEFAULT_FONT_FAMILY,
  getFontString,
} from "@excalidraw/common";

import {
  applyStyleToRange,
  clearColorFromStyledRanges,
  getCommonStyleInRange,
  getLineStyledRuns,
  mapWrappedLinesToOriginalOffsets,
  normalizeStyledRanges,
  shiftStyledRangesOnTextEdit,
} from "./textStyledRanges";
import { getWrappedTextLines, wrapText } from "./textWrapping";

describe("textStyledRanges", () => {
  describe("normalizeStyledRanges", () => {
    it("returns undefined for empty, null, or zero-length text", () => {
      expect(normalizeStyledRanges(undefined, 10)).toBeUndefined();
      expect(normalizeStyledRanges([], 10)).toBeUndefined();
      expect(
        normalizeStyledRanges([{ start: 0, end: 5, color: "#e03131" }], 0),
      ).toBeUndefined();
    });

    it("clamps out-of-bounds ranges and drops empty or style-less ranges", () => {
      expect(
        normalizeStyledRanges(
          [
            { start: -5, end: 3, color: "#e03131" },
            { start: 3, end: 3, color: "#2f9e44" },
            { start: 4, end: 8 },
            { start: 5, end: 8, backgroundColor: COLOR_PALETTE.transparent },
            { start: 6, end: 20, backgroundColor: "#fff3bf" },
          ],
          10,
        ),
      ).toEqual([
        { start: 0, end: 3, color: "#e03131" },
        { start: 6, end: 10, backgroundColor: "#fff3bf" },
      ]);
    });

    it("resolves overlapping ranges with later range winning and merges adjacent identical ranges", () => {
      expect(
        normalizeStyledRanges(
          [
            { start: 0, end: 6, color: "#e03131" },
            { start: 3, end: 9, color: "#1971c2" },
            { start: 9, end: 12, color: "#1971c2" },
          ],
          12,
        ),
      ).toEqual([
        { start: 0, end: 3, color: "#e03131" },
        { start: 3, end: 12, color: "#1971c2" },
      ]);
    });
  });

  describe("applyStyleToRange", () => {
    it("applies color and backgroundColor independently without clobbering the other", () => {
      const text = "Bid request timeout 120ms";
      let ranges = applyStyleToRange(undefined, text.length, 20, 25, {
        color: "#e03131",
      });
      expect(ranges).toEqual([{ start: 20, end: 25, color: "#e03131" }]);

      ranges = applyStyleToRange(ranges, text.length, 20, 25, {
        backgroundColor: "#fff3bf",
      });
      expect(ranges).toEqual([
        { start: 20, end: 25, color: "#e03131", backgroundColor: "#fff3bf" },
      ]);

      // Clearing highlight with transparent preserves color
      ranges = applyStyleToRange(ranges, text.length, 20, 25, {
        backgroundColor: COLOR_PALETTE.transparent,
      });
      expect(ranges).toEqual([{ start: 20, end: 25, color: "#e03131" }]);

      // Clearing color removes the range
      ranges = applyStyleToRange(ranges, text.length, 20, 25, { color: null });
      expect(ranges).toBeUndefined();
    });

    it("splits existing ranges on partial overlap", () => {
      const ranges = applyStyleToRange(
        [{ start: 0, end: 10, color: "#e03131" }],
        10,
        3,
        7,
        { backgroundColor: "#fff3bf" },
      );
      expect(ranges).toEqual([
        { start: 0, end: 3, color: "#e03131" },
        { start: 3, end: 7, color: "#e03131", backgroundColor: "#fff3bf" },
        { start: 7, end: 10, color: "#e03131" },
      ]);
    });

    it("clears color overrides while keeping highlights", () => {
      expect(
        clearColorFromStyledRanges(
          [
            { start: 0, end: 3, color: "#e03131" },
            { start: 5, end: 9, color: "#1971c2", backgroundColor: "#fff3bf" },
          ],
          10,
        ),
      ).toEqual([{ start: 5, end: 9, backgroundColor: "#fff3bf" }]);
    });
  });

  describe("shiftStyledRangesOnTextEdit", () => {
    const baseRanges = [{ start: 20, end: 25, color: "#e03131" }];
    const baseText = "Bid request timeout 120ms";

    it("shifts ranges forward when inserting before", () => {
      const nextText = "API Bid request timeout 120ms";
      expect(
        shiftStyledRangesOnTextEdit(baseRanges, baseText, nextText, 4),
      ).toEqual([{ start: 24, end: 29, color: "#e03131" }]);
    });

    it("expands range when inserting inside", () => {
      const nextText = "Bid request timeout 1200ms";
      expect(
        shiftStyledRangesOnTextEdit(baseRanges, baseText, nextText, 23),
      ).toEqual([{ start: 20, end: 26, color: "#e03131" }]);
    });

    it("leaves range unchanged when inserting after", () => {
      const nextText = "Bid request timeout 120ms!";
      expect(
        shiftStyledRangesOnTextEdit(baseRanges, baseText, nextText, 26),
      ).toEqual([{ start: 20, end: 25, color: "#e03131" }]);
    });

    it("shifts ranges backward when deleting before", () => {
      const nextText = "request timeout 120ms";
      expect(
        shiftStyledRangesOnTextEdit(baseRanges, baseText, nextText, 0),
      ).toEqual([{ start: 16, end: 21, color: "#e03131" }]);
    });

    it("shrinks range when deleting part of it", () => {
      const nextText = "Bid request timeout 120";
      expect(
        shiftStyledRangesOnTextEdit(baseRanges, baseText, nextText, 23),
      ).toEqual([{ start: 20, end: 23, color: "#e03131" }]);
    });

    it("drops range when deleting across the entire range", () => {
      const nextText = "Bid request timeout ";
      expect(
        shiftStyledRangesOnTextEdit(baseRanges, baseText, nextText, 20),
      ).toBeUndefined();
    });

    it("uses cursorAfterEdit to disambiguate repeated characters", () => {
      const ranges = [{ start: 2, end: 3, color: "#e03131" }]; // third "a" in "aaa"
      expect(shiftStyledRangesOnTextEdit(ranges, "aaa", "aaaa", 1)).toEqual([
        { start: 3, end: 4, color: "#e03131" },
      ]);
    });
  });

  describe("wrapping and line runs", () => {
    it("maps wrapped lines back to originalText offsets across soft and hard breaks", () => {
      const originalText = "Bid request   timeout\n120ms";
      const font = getFontString({
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: 20,
      });
      const wrapped = wrapText(originalText, font, 120);
      const mapped = mapWrappedLinesToOriginalOffsets(originalText, wrapped);
      const fromWrap = getWrappedTextLines(originalText, font, 120);

      expect(mapped).toEqual(fromWrap);

      const ranges = [{ start: 14, end: 21, color: "#e03131" }]; // "timeout"
      const timeoutLine = mapped.find((l) => l.text.includes("timeout"))!;
      const runs = getLineStyledRuns(
        timeoutLine.text,
        timeoutLine.start,
        timeoutLine.end,
        ranges,
      );
      expect(runs).toEqual([
        {
          text: "timeout",
          start: 14,
          end: 21,
          color: "#e03131",
        },
      ]);
    });

    it("splits a single styled range across multiple wrapped lines", () => {
      const originalText = "hello world";
      const wrappedText = "hello\nworld";
      const mapped = mapWrappedLinesToOriginalOffsets(
        originalText,
        wrappedText,
      );
      const ranges = [{ start: 3, end: 8, backgroundColor: "#fff3bf" }]; // "lo wo"

      expect(
        getLineStyledRuns(
          mapped[0].text,
          mapped[0].start,
          mapped[0].end,
          ranges,
        ),
      ).toEqual([
        { text: "hel", start: 0, end: 3 },
        { text: "lo", start: 3, end: 5, backgroundColor: "#fff3bf" },
      ]);

      expect(
        getLineStyledRuns(
          mapped[1].text,
          mapped[1].start,
          mapped[1].end,
          ranges,
        ),
      ).toEqual([
        { text: "wo", start: 6, end: 8, backgroundColor: "#fff3bf" },
        { text: "rld", start: 8, end: 11 },
      ]);
    });
  });

  describe("getCommonStyleInRange", () => {
    it("returns common or mixed styles for a selection", () => {
      const ranges = [
        { start: 5, end: 10, color: "#e03131", backgroundColor: "#fff3bf" },
      ];
      expect(getCommonStyleInRange(ranges, 5, 10, "#1e1e1e")).toEqual({
        color: "#e03131",
        backgroundColor: "#fff3bf",
      });
      expect(getCommonStyleInRange(ranges, 3, 10, "#1e1e1e")).toEqual({
        color: null,
        backgroundColor: null,
      });
    });
  });
});
