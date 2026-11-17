import {
  applyTextStyle,
  diffText,
  getTextStyleRunsByLine,
  normalizeTextStyles,
  shiftTextStyles,
  shiftTextStylesForTextChange,
} from "../textStyles";

describe("normalizeTextStyles", () => {
  it("sorts, clamps, drops empty / unstyled / invalid and merges", () => {
    expect(
      normalizeTextStyles(
        [
          { start: 5, end: 8, color: "red" },
          { start: 0, end: 2, color: "red" },
          { start: 2, end: 5, color: "red" },
          { start: 3, end: 3, color: "blue" },
          { start: 1, end: 2 },
          { start: 6, end: 6, color: "x" },
          { start: 7, end: 100, highlight: "yellow" },
          { start: "a", end: 3, color: "red" },
          null,
          { start: 0, end: 4, color: "transparent" },
        ],
        10,
      ),
    ).toEqual([
      { start: 0, end: 7, color: "red" },
      { start: 7, end: 8, color: "red", highlight: "yellow" },
      { start: 8, end: 10, highlight: "yellow" },
    ]);
  });

  it("lets later overlapping ranges win per property", () => {
    expect(
      normalizeTextStyles(
        [
          { start: 0, end: 6, color: "red", highlight: "yellow" },
          { start: 2, end: 4, color: "blue" },
        ],
        10,
      ),
    ).toEqual([
      { start: 0, end: 2, color: "red", highlight: "yellow" },
      { start: 2, end: 4, color: "blue", highlight: "yellow" },
      { start: 4, end: 6, color: "red", highlight: "yellow" },
    ]);
  });

  it("returns an empty list for garbage or empty text", () => {
    expect(normalizeTextStyles(undefined, 5)).toEqual([]);
    expect(normalizeTextStyles("x", 5)).toEqual([]);
    expect(
      normalizeTextStyles([{ start: 0, end: 3, color: "red" }], 0),
    ).toEqual([]);
  });
});

describe("applyTextStyle", () => {
  it("styles a plain range", () => {
    expect(applyTextStyle(undefined, 10, 2, 5, { color: "red" })).toEqual([
      { start: 2, end: 5, color: "red" },
    ]);
  });

  it("splits and overwrites existing ranges", () => {
    const base = [{ start: 0, end: 10, color: "red", highlight: "yellow" }];
    expect(applyTextStyle(base, 10, 3, 6, { color: "blue" })).toEqual([
      { start: 0, end: 3, color: "red", highlight: "yellow" },
      { start: 3, end: 6, color: "blue", highlight: "yellow" },
      { start: 6, end: 10, color: "red", highlight: "yellow" },
    ]);
  });

  it("clears a property with undefined or transparent", () => {
    const base = [{ start: 0, end: 4, color: "red", highlight: "yellow" }];
    expect(applyTextStyle(base, 10, 0, 4, { color: undefined })).toEqual([
      { start: 0, end: 4, highlight: "yellow" },
    ]);
    expect(
      applyTextStyle(base, 10, 2, 4, { highlight: "transparent" }),
    ).toEqual([
      { start: 0, end: 2, color: "red", highlight: "yellow" },
      { start: 2, end: 4, color: "red" },
    ]);
    expect(
      applyTextStyle(base, 10, 0, 4, {
        color: undefined,
        highlight: undefined,
      }),
    ).toEqual([]);
  });

  it("merges with neighbours of the same style and clamps", () => {
    const base = [{ start: 0, end: 3, color: "red" }];
    expect(applyTextStyle(base, 6, 3, 99, { color: "red" })).toEqual([
      { start: 0, end: 6, color: "red" },
    ]);
  });

  it("ignores an empty selection", () => {
    expect(applyTextStyle(undefined, 5, 2, 2, { color: "red" })).toEqual([]);
  });
});

describe("shiftTextStyles", () => {
  const styles = [{ start: 5, end: 10, color: "red" }];
  const insert = (start: number, insertedText: string) =>
    shiftTextStyles(styles, { start, deletedLength: 0, insertedText });
  const remove = (start: number, deletedLength: number) =>
    shiftTextStyles(styles, { start, deletedLength, insertedText: "" });

  it("shifts ranges after the edit", () => {
    expect(insert(2, "ab")).toEqual([{ start: 7, end: 12, color: "red" }]);
  });

  it("does not touch ranges before the edit", () => {
    expect(insert(12, "ab")).toEqual(styles);
  });

  it("does not extend when inserting at the start", () => {
    expect(insert(5, "ab")).toEqual([{ start: 7, end: 12, color: "red" }]);
  });

  it("extends when inserting strictly inside", () => {
    expect(insert(7, "ab")).toEqual([{ start: 5, end: 12, color: "red" }]);
  });

  it("extends when inserting exactly at the end", () => {
    expect(insert(10, "ab")).toEqual([{ start: 5, end: 12, color: "red" }]);
  });

  it("shrinks and removes on deletion", () => {
    expect(remove(0, 3)).toEqual([{ start: 2, end: 7, color: "red" }]);
    expect(remove(4, 3)).toEqual([{ start: 4, end: 7, color: "red" }]);
    expect(remove(8, 5)).toEqual([{ start: 5, end: 8, color: "red" }]);
    expect(remove(6, 2)).toEqual([{ start: 5, end: 8, color: "red" }]);
    expect(remove(3, 10)).toEqual([]);
    expect(remove(5, 5)).toEqual([]);
  });

  it("handles a replace", () => {
    expect(
      shiftTextStyles(styles, {
        start: 8,
        deletedLength: 2,
        insertedText: "xyz",
      }),
    ).toEqual([{ start: 5, end: 11, color: "red" }]);
    expect(
      shiftTextStyles(styles, {
        start: 3,
        deletedLength: 3,
        insertedText: "x",
      }),
    ).toEqual([{ start: 4, end: 8, color: "red" }]);
  });

  it("derives the edit of an element's text change", () => {
    const prev = "Bid request timeout 120ms";
    const next = "Bid request timeout 1200ms";
    const range = [{ start: 20, end: 25, color: "red" }];
    expect(shiftTextStylesForTextChange(range, prev, next)).toEqual([
      { start: 20, end: 26, color: "red" },
    ]);
    expect(
      shiftTextStylesForTextChange(range, prev, `X${prev}`, {
        edit: { start: 0, deletedLength: 0, insertedText: "X" },
      }),
    ).toEqual([{ start: 21, end: 26, color: "red" }]);
    // same text: same reference, nothing to do
    expect(shiftTextStylesForTextChange(range, prev, prev)).toBe(range);
  });
});

describe("diffText", () => {
  it("uses the caret inside runs of equal characters", () => {
    // typed an "a" at the start of "aaa"
    expect(diffText("aaa", "aaaa", 1)).toEqual({
      start: 0,
      deletedLength: 0,
      insertedText: "a",
    });
    expect(diffText("aaa", "aaaa")).toEqual({
      start: 3,
      deletedLength: 0,
      insertedText: "a",
    });
    expect(diffText("aaaa", "aaa", 0)).toEqual({
      start: 0,
      deletedLength: 1,
      insertedText: "",
    });
  });

  it("diffs by common prefix and suffix", () => {
    expect(diffText("hello world", "hello brave world")).toEqual({
      start: 6,
      deletedLength: 0,
      insertedText: "brave ",
    });
    expect(diffText("hello world", "help")).toEqual({
      start: 3,
      deletedLength: 8,
      insertedText: "p",
    });
  });
});

describe("getTextStyleRunsByLine", () => {
  it("maps runs on lines that were not wrapped", () => {
    expect(
      getTextStyleRunsByLine("ab cd\nef", "ab cd\nef", [
        { start: 3, end: 6, color: "red" },
      ]),
    ).toEqual([
      [{ text: "ab " }, { text: "cd", color: "red" }],
      [{ text: "ef" }],
    ]);
  });

  it("splits a range across a soft wrap", () => {
    // "aaa bbb ccc" wrapped at the spaces, which are dropped
    expect(
      getTextStyleRunsByLine("aaa\nbbb\nccc", "aaa bbb ccc", [
        { start: 2, end: 9, color: "red" },
      ]),
    ).toEqual([
      [{ text: "aa" }, { text: "a", color: "red" }],
      [{ text: "bbb", color: "red" }],
      [{ text: "c", color: "red" }, { text: "cc" }],
    ]);
  });

  it("keeps offsets aligned when several spaces are dropped", () => {
    expect(
      getTextStyleRunsByLine("aa\nbb", "aa   bb", [
        { start: 5, end: 7, highlight: "yellow" },
      ]),
    ).toEqual([[{ text: "aa" }], [{ text: "bb", highlight: "yellow" }]]);
  });

  it("keeps hard newlines next to dropped whitespace aligned", () => {
    expect(
      getTextStyleRunsByLine("aa\n\nbb", "aa \nbb", [
        { start: 4, end: 6, color: "red" },
      ]),
    ).toEqual([[{ text: "aa" }], [], [{ text: "bb", color: "red" }]]);
  });

  it("clamps stale ranges and never throws", () => {
    expect(
      getTextStyleRunsByLine("abc", "abc", [
        { start: 1, end: 50, color: "red" },
        { start: -4, end: 0, color: "blue" },
      ]),
    ).toEqual([[{ text: "a" }, { text: "bc", color: "red" }]]);
    expect(
      getTextStyleRunsByLine("abc", "xyz", [
        { start: 0, end: 3, color: "red" },
      ]),
    ).toEqual([[{ text: "abc" }]]);
  });

  it("returns plain runs without styles", () => {
    expect(getTextStyleRunsByLine("ab\ncd", "ab\ncd", undefined)).toEqual([
      [{ text: "ab" }],
      [{ text: "cd" }],
    ]);
  });
});
