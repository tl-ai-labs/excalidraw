import {
  applyTextStyle,
  diffText,
  getStyledLines,
  getStyledRunPositions,
  getUniformRangeStyle,
  normalizeStyleRanges,
  sanitizeStyleRanges,
  shiftStyleRanges,
} from "../src/textStyleRanges";

import type { TextStyleRange } from "../src/types";

describe("textStyleRanges", () => {
  it("normalize sorts, clamps and drops empty or style-less ranges", () => {
    const ranges: TextStyleRange[] = [
      { start: 6, end: 15, color: "red" },
      { start: 4, end: 2, color: "blue" },
      { start: 2, end: 5 },
      { start: 1, end: 3, color: "green" },
    ];

    const result = normalizeStyleRanges(ranges, 10);
    expect(result).toEqual([
      { start: 1, end: 3, color: "green" },
      { start: 6, end: 10, color: "red" },
    ]);
  });

  it("normalize merges adjacent ranges with identical style and resolves overlaps", () => {
    const ranges: TextStyleRange[] = [
      { start: 0, end: 3, color: "red" },
      { start: 3, end: 5, color: "red" },
      { start: 4, end: 8, highlight: "yellow" },
    ];

    const result = normalizeStyleRanges(ranges, 10);
    expect(result).toEqual([
      { start: 0, end: 4, color: "red" },
      { start: 4, end: 5, color: "red", highlight: "yellow" },
      { start: 5, end: 8, highlight: "yellow" },
    ]);
  });

  it("applyTextStyle splits a range and keeps the other property", () => {
    const initial: TextStyleRange[] = [
      { start: 0, end: 10, color: "red", highlight: "yellow" },
    ];

    const result = applyTextStyle(initial, 3, 6, { color: "blue" }, 10);
    expect(result).toEqual([
      { start: 0, end: 3, color: "red", highlight: "yellow" },
      { start: 3, end: 6, color: "blue", highlight: "yellow" },
      { start: 6, end: 10, color: "red", highlight: "yellow" },
    ]);
  });

  it("applyTextStyle with null removes only that property", () => {
    const initial: TextStyleRange[] = [
      { start: 0, end: 10, color: "red", highlight: "yellow" },
    ];

    const withoutHighlight = applyTextStyle(
      initial,
      2,
      4,
      { highlight: null },
      10,
    );
    expect(withoutHighlight).toEqual([
      { start: 0, end: 2, color: "red", highlight: "yellow" },
      { start: 2, end: 4, color: "red" },
      { start: 4, end: 10, color: "red", highlight: "yellow" },
    ]);

    const withoutColor = applyTextStyle(initial, 0, 10, { color: null }, 10);
    expect(withoutColor).toEqual([{ start: 0, end: 10, highlight: "yellow" }]);
  });

  it("applyTextStyle fills uncovered gaps", () => {
    const result = applyTextStyle([], 2, 5, { highlight: "yellow" }, 8);
    expect(result).toEqual([{ start: 2, end: 5, highlight: "yellow" }]);
  });

  it("diffText derives a single replacement", () => {
    expect(diffText("hello", "hello")).toBeNull();

    expect(diffText("abcd", "abXcd")).toEqual({
      from: 2,
      to: 2,
      insertLength: 1,
    });

    expect(diffText("abcd", "ab")).toEqual({
      from: 2,
      to: 4,
      insertLength: 0,
    });

    const repeatedEdit = diffText("aaaa", "aaba");
    expect(repeatedEdit).not.toBeNull();
    expect(repeatedEdit!.to).toBeGreaterThanOrEqual(repeatedEdit!.from);
  });

  it("shiftStyleRanges moves ranges after an insertion and keeps those before", () => {
    const ranges: TextStyleRange[] = [
      { start: 0, end: 2, color: "red" },
      { start: 5, end: 8, color: "blue" },
    ];
    const edit = { from: 3, to: 3, insertLength: 3 };

    const result = shiftStyleRanges(ranges, edit, 20);
    expect(result).toEqual([
      { start: 0, end: 2, color: "red" },
      { start: 8, end: 11, color: "blue" },
    ]);
  });

  it("insertion strictly inside a range extends it, at a boundary it does not", () => {
    const ranges: TextStyleRange[] = [{ start: 2, end: 5, color: "red" }];

    // strictly inside at 3
    expect(
      shiftStyleRanges(ranges, { from: 3, to: 3, insertLength: 1 }, 10),
    ).toEqual([{ start: 2, end: 6, color: "red" }]);

    // at start boundary 2
    expect(
      shiftStyleRanges(ranges, { from: 2, to: 2, insertLength: 1 }, 10),
    ).toEqual([{ start: 3, end: 6, color: "red" }]);

    // at end boundary 5
    expect(
      shiftStyleRanges(ranges, { from: 5, to: 5, insertLength: 1 }, 10),
    ).toEqual([{ start: 2, end: 5, color: "red" }]);
  });

  it("deletion shrinks overlapping ranges and drops emptied ones", () => {
    const ranges: TextStyleRange[] = [
      { start: 2, end: 6, color: "red" },
      { start: 7, end: 9, color: "blue" },
    ];
    const edit = { from: 4, to: 8, insertLength: 0 };

    const result = shiftStyleRanges(ranges, edit, 10);
    expect(result).toEqual([
      { start: 2, end: 4, color: "red" },
      { start: 4, end: 5, color: "blue" },
    ]);
  });

  it("getStyledLines maps ranges across a soft wrap that dropped whitespace", () => {
    const originalText = "hello world";
    const text = "hello\nworld";
    const ranges: TextStyleRange[] = [{ start: 4, end: 7, color: "red" }];

    const lines = getStyledLines(originalText, text, ranges);
    expect(lines).toEqual([
      [
        { text: "hell", start: 0, color: null, highlight: null },
        { text: "o", start: 4, color: "red", highlight: null },
      ],
      [
        { text: "w", start: 6, color: "red", highlight: null },
        { text: "orld", start: 7, color: null, highlight: null },
      ],
    ]);
  });

  it("getStyledLines maps ranges across hard newlines and kept whitespace", () => {
    const originalText = "ab\ncd ef";
    const text = "ab\ncd \nef";
    const ranges: TextStyleRange[] = [
      { start: 1, end: 7, highlight: "yellow" },
    ];

    const lines = getStyledLines(originalText, text, ranges);
    expect(lines).toEqual([
      [
        { text: "a", start: 0, color: null, highlight: null },
        { text: "b", start: 1, color: null, highlight: "yellow" },
      ],
      [{ text: "cd ", start: 3, color: null, highlight: "yellow" }],
      [
        { text: "e", start: 6, color: null, highlight: "yellow" },
        { text: "f", start: 7, color: null, highlight: null },
      ],
    ]);
  });

  it("getStyledLines with no ranges returns one plain run per non-empty line", () => {
    const text = "hello\n\nworld";
    const lines = getStyledLines(text, text, []);
    expect(lines).toEqual([
      [{ text: "hello", start: 0, color: null, highlight: null }],
      [],
      [{ text: "world", start: 7, color: null, highlight: null }],
    ]);
  });

  it("getStyledRunPositions honours alignment and RTL", () => {
    const widths = [10, 20];
    const boxWidth = 100;

    expect(getStyledRunPositions(widths, "left", boxWidth, false)).toEqual([
      0, 10,
    ]);
    expect(getStyledRunPositions(widths, "center", boxWidth, false)).toEqual([
      35, 45,
    ]);
    expect(getStyledRunPositions(widths, "right", boxWidth, false)).toEqual([
      70, 80,
    ]);
    expect(getStyledRunPositions(widths, "right", boxWidth, true)).toEqual([
      90, 70,
    ]);
  });

  it("getUniformRangeStyle reports a shared value only", () => {
    const ranges: TextStyleRange[] = [
      { start: 0, end: 4, color: "red" },
      { start: 4, end: 8, color: "blue" },
    ];

    expect(getUniformRangeStyle(ranges, 1, 3, "color")).toBe("red");
    expect(getUniformRangeStyle(ranges, 2, 6, "color")).toBeNull();
    expect(getUniformRangeStyle(ranges, 8, 10, "color")).toBeNull();
  });

  it("sanitizeStyleRanges drops malformed entries", () => {
    expect(sanitizeStyleRanges("invalid", 10)).toBeNull();

    const malformed = [
      { start: "0", end: 2, color: "red" },
      { start: 1, end: 3, color: 123 },
      { start: 4, end: 6 },
      { start: 7, end: 15, color: "blue" },
    ];

    const sanitized = sanitizeStyleRanges(malformed, 10);
    expect(sanitized).toEqual([{ start: 7, end: 10, color: "blue" }]);
  });
});
