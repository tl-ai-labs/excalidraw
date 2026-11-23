import { describe, expect, it, vi } from "vitest";

import { FONT_FAMILY, THEME, getFontString } from "@excalidraw/common";

import {
  applyStyleToRange,
  drawElementOnCanvas,
  getStyledRunsForLine,
  getStyledTextLines,
  getUniformRangeStyle,
  mapWrappedLinesToOriginalOffsets,
  newTextElement,
  normalizeTextRanges,
  sanitizeTextRanges,
  shiftTextRanges,
  shiftTextRangesOnEdit,
  wrapText,
} from "../index";

import type { TextStyleRange } from "../types";

describe("textRanges", () => {
  describe("normalizeTextRanges", () => {
    it("clamps offsets, drops invalid/empty/styleless ranges, and merges adjacent identical ranges", () => {
      const input: TextStyleRange[] = [
        { start: -5, end: 3, color: "#e03131" },
        { start: 3, end: 6, color: "#e03131" },
        { start: 6, end: 6, color: "#1971c2" }, // empty
        { start: 7, end: 9 }, // no style
        { start: 8, end: 20, highlight: "#ffec99" }, // clamped to 10
        { start: 2, end: 4, highlight: "transparent" }, // transparent highlight ignored
      ];

      expect(normalizeTextRanges(input, 10)).toEqual([
        { start: 0, end: 6, color: "#e03131" },
        { start: 8, end: 10, highlight: "#ffec99" },
      ]);
    });

    it("resolves overlapping ranges with later ranges winning per property", () => {
      const input: TextStyleRange[] = [
        { start: 0, end: 10, color: "#e03131" },
        { start: 4, end: 8, highlight: "#ffec99" },
        { start: 6, end: 12, color: "#1971c2" },
      ];

      expect(normalizeTextRanges(input, 12)).toEqual([
        { start: 0, end: 4, color: "#e03131" },
        { start: 4, end: 6, color: "#e03131", highlight: "#ffec99" },
        { start: 6, end: 8, color: "#1971c2", highlight: "#ffec99" },
        { start: 8, end: 12, color: "#1971c2" },
      ]);
    });
  });

  describe("sanitizeTextRanges", () => {
    it("returns undefined for legacy/missing/empty/invalid inputs", () => {
      expect(sanitizeTextRanges(undefined, 10)).toBeUndefined();
      expect(sanitizeTextRanges(null, 10)).toBeUndefined();
      expect(sanitizeTextRanges([], 10)).toBeUndefined();
      expect(sanitizeTextRanges("not-an-array", 10)).toBeUndefined();
      expect(
        sanitizeTextRanges(
          [
            null,
            { start: "0", end: 5, color: "#e03131" },
            { start: NaN, end: 5, color: "#e03131" },
            { start: 10, end: 15, color: "#e03131" },
            { start: 0, end: 5, highlight: "transparent" },
          ],
          10,
        ),
      ).toBeUndefined();
    });

    it("clamps valid ranges to textLength", () => {
      expect(
        sanitizeTextRanges(
          [{ start: -2, end: 50, color: "#e03131", highlight: "#ffec99" }],
          12,
        ),
      ).toEqual([
        { start: 0, end: 12, color: "#e03131", highlight: "#ffec99" },
      ]);
    });
  });

  describe("applyStyleToRange", () => {
    it("splits existing ranges, preserves untouched properties, and clears properties with null/transparent", () => {
      const r1 = applyStyleToRange(undefined, 20, 25, { color: "#e03131" }, 25);
      expect(r1).toEqual([{ start: 20, end: 25, color: "#e03131" }]);

      // Add highlight to overlapping span [18, 23)
      const r2 = applyStyleToRange(r1, 18, 23, { highlight: "#ffec99" }, 25);
      expect(r2).toEqual([
        { start: 18, end: 20, highlight: "#ffec99" },
        { start: 20, end: 23, color: "#e03131", highlight: "#ffec99" },
        { start: 23, end: 25, color: "#e03131" },
      ]);

      // Clear highlight with "transparent" on [18, 23) -> merges color back to [20, 25)
      const r3 = applyStyleToRange(
        r2,
        18,
        23,
        { highlight: "transparent" },
        25,
      );
      expect(r3).toEqual([{ start: 20, end: 25, color: "#e03131" }]);

      // Clear color with null on [21, 24) -> splits into two ranges
      const r4 = applyStyleToRange(r3, 21, 24, { color: null }, 25);
      expect(r4).toEqual([
        { start: 20, end: 21, color: "#e03131" },
        { start: 24, end: 25, color: "#e03131" },
      ]);
    });
  });

  describe("shiftTextRanges & shiftTextRangesOnEdit", () => {
    const base: TextStyleRange[] = [
      { start: 20, end: 25, color: "#e03131", highlight: "#ffec99" },
    ];

    it("shifts right on insertion before or at start of range", () => {
      expect(shiftTextRanges(base, 0, 0, 4)).toEqual([
        { start: 24, end: 29, color: "#e03131", highlight: "#ffec99" },
      ]);
      expect(shiftTextRanges(base, 20, 0, 2)).toEqual([
        { start: 22, end: 27, color: "#e03131", highlight: "#ffec99" },
      ]);
    });

    it("expands on insertion strictly inside range and leaves unchanged at/after end", () => {
      expect(shiftTextRanges(base, 22, 0, 3)).toEqual([
        { start: 20, end: 28, color: "#e03131", highlight: "#ffec99" },
      ]);
      expect(shiftTextRanges(base, 25, 0, 3)).toEqual(base);
    });

    it("handles deletions before, inside, overlapping head/tail, and covering whole range", () => {
      // Before range
      expect(shiftTextRanges(base, 0, 4, 0)).toEqual([
        { start: 16, end: 21, color: "#e03131", highlight: "#ffec99" },
      ]);
      // Strictly inside range
      expect(shiftTextRanges(base, 21, 2, 0)).toEqual([
        { start: 20, end: 23, color: "#e03131", highlight: "#ffec99" },
      ]);
      // Overlapping head [18, 22)
      expect(shiftTextRanges(base, 18, 4, 0)).toEqual([
        { start: 18, end: 21, color: "#e03131", highlight: "#ffec99" },
      ]);
      // Overlapping tail [23, 27)
      expect(shiftTextRanges(base, 23, 4, 0)).toEqual([
        { start: 20, end: 23, color: "#e03131", highlight: "#ffec99" },
      ]);
      // Covering entire range [19, 26)
      expect(shiftTextRanges(base, 19, 7, 0)).toEqual([]);
    });

    it("computes minimal edit diff with shiftTextRangesOnEdit", () => {
      const prev = "Bid request timeout 120ms";
      const ranges: TextStyleRange[] = [
        { start: 20, end: 25, color: "#e03131" },
      ];

      const inserted = "RPC Bid request timeout 120ms";
      const afterInsert = shiftTextRangesOnEdit(ranges, prev, inserted);
      expect(afterInsert).toEqual([{ start: 24, end: 29, color: "#e03131" }]);
      expect(inserted.slice(afterInsert[0].start, afterInsert[0].end)).toBe(
        "120ms",
      );

      const editedInside = "RPC Bid request timeout 1200ms";
      const afterInside = shiftTextRangesOnEdit(
        afterInsert,
        inserted,
        editedInside,
      );
      expect(afterInside).toEqual([{ start: 24, end: 30, color: "#e03131" }]);
      expect(editedInside.slice(afterInside[0].start, afterInside[0].end)).toBe(
        "1200ms",
      );

      const deletedAll = "RPC Bid request timeout ";
      expect(
        shiftTextRangesOnEdit(afterInside, editedInside, deletedAll),
      ).toEqual([]);
    });
  });

  describe("wrapping & styled runs alignment", () => {
    it("maps soft-wrapped lines back to originalText offsets and splits ranges across lines", () => {
      const originalText = "Bid request timeout 120ms";
      const font = getFontString({
        fontSize: 20,
        fontFamily: FONT_FAMILY.Helvetica,
      });
      // In test env, each char is 10px wide, so maxWidth 140 wraps after "Bid request"
      const wrapped = wrapText(originalText, font, 140);
      expect(wrapped).toBe("Bid request\ntimeout 120ms");

      const mapped = mapWrappedLinesToOriginalOffsets(wrapped, originalText);
      expect(mapped).toEqual([
        { text: "Bid request", start: 0, end: 11 },
        { text: "timeout 120ms", start: 12, end: 25 },
      ]);

      // Range spanning across the soft wrap boundary: "request timeout" [4, 19)
      const ranges: TextStyleRange[] = [
        { start: 4, end: 19, color: "#1971c2" },
        { start: 20, end: 25, color: "#e03131", highlight: "#ffec99" },
      ];

      const styledLines = getStyledTextLines(wrapped, originalText, ranges);
      expect(styledLines).toEqual([
        [
          { text: "Bid ", start: 0, end: 4 },
          { text: "request", start: 4, end: 11, color: "#1971c2" },
        ],
        [
          { text: "timeout", start: 12, end: 19, color: "#1971c2" },
          { text: " ", start: 19, end: 20 },
          {
            text: "120ms",
            start: 20,
            end: 25,
            color: "#e03131",
            highlight: "#ffec99",
          },
        ],
      ]);
    });

    it("handles hard newlines and empty lines accurately", () => {
      const originalText = "Hello\n\nWorld";
      const ranges: TextStyleRange[] = [
        { start: 7, end: 12, color: "#e03131" },
      ];

      const styledLines = getStyledTextLines(
        originalText,
        originalText,
        ranges,
      );
      expect(styledLines).toEqual([
        [{ text: "Hello", start: 0, end: 5 }],
        [{ text: "", start: 6, end: 6 }],
        [{ text: "World", start: 7, end: 12, color: "#e03131" }],
      ]);
    });

    it("getUniformRangeStyle reports uniform vs mixed styles", () => {
      const ranges: TextStyleRange[] = [
        { start: 5, end: 10, color: "#e03131", highlight: "#ffec99" },
      ];
      expect(getUniformRangeStyle(ranges, 5, 10, "#000000")).toEqual({
        color: "#e03131",
        highlight: "#ffec99",
      });
      expect(getUniformRangeStyle(ranges, 0, 10, "#000000")).toEqual({
        color: null,
        highlight: null,
      });
      expect(getUniformRangeStyle(ranges, 0, 5, "#000000")).toEqual({
        color: "#000000",
        highlight: "transparent",
      });
    });

    it("getStyledRunsForLine returns exact line text when concatenated", () => {
      const line = { text: "abcdef", start: 10, end: 16 };
      const ranges: TextStyleRange[] = [
        { start: 11, end: 13, color: "#e03131" },
        { start: 14, end: 16, highlight: "#ffec99" },
      ];
      const runs = getStyledRunsForLine(line, ranges);
      expect(runs.map((r) => r.text).join("")).toBe("abcdef");
    });
  });

  describe("canvas rendering per run", () => {
    it("draws highlight rect behind run and fillText per run with the right fillStyle", () => {
      const element = newTextElement({
        x: 0,
        y: 0,
        text: "Bid request timeout 120ms",
        strokeColor: "#1e1e1e",
        ranges: [
          { start: 20, end: 25, color: "#e03131", highlight: "#ffec99" },
        ],
      });

      const calls: Array<{ op: string; args: unknown[]; fillStyle: string }> =
        [];
      const ctx = {
        canvas: { isConnected: true, setAttribute: vi.fn() },
        font: "",
        fillStyle: "",
        textAlign: "left",
        save: vi.fn(),
        restore: vi.fn(),
        measureText: (t: string) => ({ width: t.length * 10 }),
        fillRect(
          this: { fillStyle: string },
          x: number,
          y: number,
          w: number,
          h: number,
        ) {
          calls.push({
            op: "fillRect",
            args: [x, y, w, h],
            fillStyle: this.fillStyle,
          });
        },
        fillText(
          this: { fillStyle: string },
          text: string,
          x: number,
          y: number,
        ) {
          calls.push({
            op: "fillText",
            args: [text, x, y],
            fillStyle: this.fillStyle,
          });
        },
      } as unknown as CanvasRenderingContext2D;

      drawElementOnCanvas(element, {} as any, ctx, {
        theme: THEME.LIGHT,
      } as any);

      // Highlight rect drawn first behind text for "120ms" (chars 20..25 => x=200, w=50)
      expect(calls[0]).toMatchObject({
        op: "fillRect",
        fillStyle: "#ffec99",
      });
      expect((calls[0].args as number[])[0]).toBe(200);
      expect((calls[0].args as number[])[2]).toBe(50);

      // Text runs drawn with their respective colors
      expect(calls[1]).toMatchObject({
        op: "fillText",
        fillStyle: "#1e1e1e",
      });
      expect((calls[1].args as unknown[])[0]).toBe("Bid request timeout ");
      expect(calls[2]).toMatchObject({
        op: "fillText",
        fillStyle: "#e03131",
      });
      expect((calls[2].args as unknown[])[0]).toBe("120ms");
      expect((calls[2].args as number[])[1]).toBe(200);
    });
  });
});
