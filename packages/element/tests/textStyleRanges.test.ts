import {
  applyStyleToRange,
  clampRanges,
  getTextStyleLineRuns,
  normalizeRanges,
  sanitizeTextStyleRanges,
  shiftRangesForEdit,
  shiftRangesForSplice,
  withoutStyleRanges,
} from "../src/textStyleRanges";
import { wrapText } from "../src/textWrapping";

import type { FontString, TextStyleRange } from "../src/types";

describe("textStyleRanges", () => {
  // `measureText` width is mocked so every character measures 10px
  const font = "10px Cascadia, Segoe UI Emoji" as FontString;

  it("insert before a range shifts it", () => {
    const r: TextStyleRange[] = [{ start: 6, end: 11, color: "#e03131" }];
    expect(shiftRangesForEdit(r, "hello world", "XXhello world")).toEqual([
      { start: 8, end: 13, color: "#e03131" },
    ]);
  });

  it("insert at a range start shifts it, at its end leaves it", () => {
    const r: TextStyleRange[] = [{ start: 2, end: 4, color: "red" }];
    expect(shiftRangesForSplice(r, 2, 0, 1)).toEqual([
      { start: 3, end: 5, color: "red" },
    ]);
    expect(shiftRangesForSplice(r, 4, 0, 1)).toEqual([
      { start: 2, end: 4, color: "red" },
    ]);
  });

  it("insert inside a range grows it", () => {
    const r: TextStyleRange[] = [{ start: 2, end: 6, color: "red" }];
    expect(shiftRangesForSplice(r, 4, 0, 3)).toEqual([
      { start: 2, end: 9, color: "red" },
    ]);
  });

  it("delete inside a range shrinks it", () => {
    const r: TextStyleRange[] = [{ start: 2, end: 8, color: "red" }];
    expect(shiftRangesForSplice(r, 3, 2, 0)).toEqual([
      { start: 2, end: 6, color: "red" },
    ]);
  });

  it("delete across a boundary trims the range", () => {
    const r: TextStyleRange[] = [{ start: 4, end: 8, color: "red" }];
    expect(shiftRangesForSplice(r, 2, 4, 0)).toEqual([
      { start: 2, end: 4, color: "red" },
    ]);
    expect(shiftRangesForSplice(r, 6, 4, 0)).toEqual([
      { start: 4, end: 6, color: "red" },
    ]);
  });

  it("delete covering a range removes it", () => {
    const r: TextStyleRange[] = [{ start: 4, end: 6, color: "red" }];
    expect(shiftRangesForSplice(r, 3, 5, 0)).toEqual([]);
  });

  it("edit after a range leaves it alone", () => {
    const r: TextStyleRange[] = [{ start: 0, end: 5, color: "red" }];
    expect(shiftRangesForEdit(r, "hello world", "hello worlds")).toEqual([
      { start: 0, end: 5, color: "red" },
    ]);
  });

  it("unchanged text or no ranges returns the same reference", () => {
    const r: TextStyleRange[] = [{ start: 0, end: 1, color: "red" }];
    expect(shiftRangesForEdit(r, "abc", "abc")).toBe(r);
    const empty: TextStyleRange[] = [];
    expect(shiftRangesForEdit(empty, "a", "b")).toBe(empty);
    expect(shiftRangesForEdit(undefined, "a", "b")).toBe(undefined);
  });

  it("applyStyleToRange splits an existing range", () => {
    const r: TextStyleRange[] = [{ start: 0, end: 10, color: "red" }];
    expect(applyStyleToRange(r, 3, 6, { backgroundColor: "#ffec99" })).toEqual([
      { start: 0, end: 3, color: "red" },
      { start: 3, end: 6, color: "red", backgroundColor: "#ffec99" },
      { start: 6, end: 10, color: "red" },
    ]);
  });

  it("applyStyleToRange fills gaps and merges equal neighbours", () => {
    const r: TextStyleRange[] = [
      { start: 0, end: 2, color: "red" },
      { start: 5, end: 7, color: "red" },
    ];
    expect(applyStyleToRange(r, 2, 5, { color: "red" })).toEqual([
      { start: 0, end: 7, color: "red" },
    ]);
  });

  it("applyStyleToRange clears a style with null", () => {
    const r: TextStyleRange[] = [
      { start: 0, end: 4, color: "red", backgroundColor: "#ffec99" },
    ];
    const cleared = applyStyleToRange(r, 0, 4, { backgroundColor: null });
    expect(cleared).toEqual([{ start: 0, end: 4, color: "red" }]);
    expect(applyStyleToRange(cleared, 0, 4, { color: null })).toEqual([]);
  });

  it("applyStyleToRange with an empty span changes nothing", () => {
    const r: TextStyleRange[] = [
      { start: 0, end: 2, color: "red" },
      { start: 4, end: 6, backgroundColor: "#ffec99" },
    ];
    expect(applyStyleToRange(r, 3, 3, { color: "blue" })).toEqual(
      normalizeRanges(r),
    );
  });

  it("normalizeRanges sorts, drops invalid and resolves overlaps", () => {
    const r: TextStyleRange[] = [
      { start: 5, end: 9, color: "a" },
      { start: 2, end: 2, color: "b" },
      { start: 0, end: 6, color: "c" },
      { start: 9, end: 10 },
    ];
    expect(normalizeRanges(r)).toEqual([
      { start: 0, end: 6, color: "c" },
      { start: 6, end: 9, color: "a" },
    ]);
  });

  it("clampRanges clamps to the text length", () => {
    const r: TextStyleRange[] = [
      { start: -3, end: 4, color: "a" },
      { start: 8, end: 20, color: "b" },
      { start: 12, end: 15, color: "c" },
    ];
    expect(clampRanges(r, 10)).toEqual([
      { start: 0, end: 4, color: "a" },
      { start: 8, end: 10, color: "b" },
    ]);
  });

  it("sanitizeTextStyleRanges drops corrupt entries", () => {
    expect(sanitizeTextStyleRanges("nope", 10)).toEqual([]);
    expect(sanitizeTextStyleRanges(null, 10)).toEqual([]);
    const valid = { start: 0, end: 2, color: "red", extra: 1 };
    const input = [
      valid,
      { start: 1.5, end: 3, color: "red" },
      { start: 3, end: 3, color: "red" },
      { start: 3, end: 4 },
      { start: 3, end: 4, color: 42 },
      { start: 3, end: 4, color: "url(http://x)" },
      { start: 3, end: 4, color: "x".repeat(65) },
      { start: 6, end: 20, backgroundColor: "#ffec99" },
    ];
    const result = sanitizeTextStyleRanges(input, 10);
    expect(result).toEqual([
      { start: 0, end: 2, color: "red" },
      { start: 6, end: 10, backgroundColor: "#ffec99" },
    ]);
    expect(result[0]).not.toBe(valid);
    expect("extra" in result[0]).toBe(false);
  });

  it("getTextStyleLineRuns returns null without ranges or on mismatch", () => {
    expect(getTextStyleLineRuns("abc", "abc", [])).toBe(null);
    expect(getTextStyleLineRuns("abc", "abc", undefined)).toBe(null);
    expect(
      getTextStyleLineRuns("abc", "xyz", [{ start: 0, end: 1, color: "red" }]),
    ).toBe(null);
  });

  it("unwrapped multi-line text maps runs per line", () => {
    expect(
      getTextStyleLineRuns("ab\ncd", "ab\ncd", [
        { start: 1, end: 4, color: "red" },
      ]),
    ).toEqual([
      [
        { text: "a", color: null, backgroundColor: null },
        { text: "b", color: "red", backgroundColor: null },
      ],
      [
        { text: "c", color: "red", backgroundColor: null },
        { text: "d", color: null, backgroundColor: null },
      ],
    ]);
  });

  it.each([40, 60, 100, Infinity])(
    "wrapped runs cover exactly the styled characters at width %s",
    (width) => {
      const originalText = "Bid request timeout 120ms and more   words here";
      const colorStart = originalText.indexOf("120ms");
      const hlStart = originalText.indexOf("more   words");
      const ranges: TextStyleRange[] = [
        { start: colorStart, end: colorStart + 5, color: "#e03131" },
        {
          start: hlStart,
          end: hlStart + "more   words".length,
          backgroundColor: "#ffec99",
        },
      ];
      const text = wrapText(originalText, font, width);
      const lines = getTextStyleLineRuns(text, originalText, ranges);
      expect(lines).not.toBe(null);
      const runs = lines!.flat();
      const colored = runs
        .filter((run) => run.color !== null)
        .map((run) => run.text)
        .join("");
      const highlighted = runs
        .filter((run) => run.backgroundColor !== null)
        .map((run) => run.text)
        .join("");
      expect(colored).toBe("120ms");
      expect(highlighted.replace(/\s+/g, "")).toBe("morewords");
      expect(highlighted.startsWith("more")).toBe(true);
      expect(highlighted.endsWith("words")).toBe(true);
    },
  );

  it("withoutStyleRanges drops the key only when present", () => {
    const withKey = {
      id: "a",
      text: "x",
      styleRanges: [{ start: 0, end: 1, color: "red" }] as TextStyleRange[],
    };
    const result = withoutStyleRanges(withKey);
    expect(result).not.toBe(withKey);
    expect("styleRanges" in result).toBe(false);
    expect(result).toEqual({ id: "a", text: "x" });
    expect(withKey.styleRanges).toEqual([{ start: 0, end: 1, color: "red" }]);

    const withoutKey: { id: string; styleRanges?: TextStyleRange[] } = {
      id: "b",
    };
    expect(withoutStyleRanges(withoutKey)).toBe(withoutKey);
  });

  it.each([50, Infinity])(
    "hard line starting with whitespace stays aligned at width %s",
    (width) => {
      const originalText = "alpha beta\n  gamma";
      const start = originalText.indexOf("gamma");
      const ranges: TextStyleRange[] = [
        { start, end: start + 5, color: "red" },
      ];
      const lines = getTextStyleLineRuns(
        wrapText(originalText, font, width),
        originalText,
        ranges,
      );
      expect(lines).not.toBe(null);
      const last = lines![lines!.length - 1];
      const colored = last.filter((run) => run.color !== null);
      expect(colored.length).toBe(1);
      expect(colored[0].text).toBe("gamma");
      expect(colored[0].color).toBe("red");
    },
  );
});
