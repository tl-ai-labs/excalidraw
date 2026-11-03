import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import {
  MAX_STYLE_COLOR_LENGTH,
  MAX_STYLE_RANGES,
  applyStyle,
  normalizeStyleRanges,
  restoreStyleRanges,
  shiftRangesForEdit,
  splitRangesIntoLines,
  withStyleRanges,
} from "../src/textRanges";
import { wrapText } from "../src/textWrapping";

import type {
  ExcalidrawTextElement,
  FontString,
  TextStyleRange,
} from "../src/types";

const freeze = (ranges: TextStyleRange[]): readonly TextStyleRange[] =>
  Object.freeze(ranges.map((range) => Object.freeze({ ...range })));

describe("normalizeStyleRanges", () => {
  it("merges adjacent equal runs", () => {
    expect(
      normalizeStyleRanges(
        [
          { start: 0, end: 3, color: "red" },
          { start: 3, end: 6, color: "red" },
        ],
        10,
      ),
    ).toEqual([{ start: 0, end: 6, color: "red" }]);
  });

  it("resolves overlaps and clamps", () => {
    expect(
      normalizeStyleRanges(
        [
          { start: 0, end: 5, color: "red" },
          { start: 3, end: 8, color: "blue" },
          { start: -2, end: 1, color: "green" },
          { start: 8, end: 99, color: "green" },
        ],
        9,
      ),
    ).toEqual([
      { start: 0, end: 1, color: "green" },
      { start: 1, end: 3, color: "red" },
      { start: 3, end: 8, color: "blue" },
      { start: 8, end: 9, color: "green" },
    ]);
  });

  it("drops empty, inverted and unstyled ranges", () => {
    expect(
      normalizeStyleRanges(
        [
          { start: 2, end: 2, color: "red" },
          { start: 5, end: 3, color: "red" },
          { start: 0, end: 4 },
        ],
        10,
      ),
    ).toEqual([]);
  });
});

describe("applyStyle", () => {
  it("keeps the highlight when applying a colour inside it", () => {
    const ranges = freeze([{ start: 0, end: 10, highlight: "yellow" }]);
    expect(applyStyle(ranges, 3, 6, { color: "red" }, 10)).toEqual([
      { start: 0, end: 3, highlight: "yellow" },
      { start: 3, end: 6, highlight: "yellow", color: "red" },
      { start: 6, end: 10, highlight: "yellow" },
    ]);
    expect(ranges).toEqual([{ start: 0, end: 10, highlight: "yellow" }]);
  });

  it("removes the range when clearing both attributes", () => {
    const ranges = freeze([
      { start: 2, end: 5, color: "red", highlight: "yellow" },
    ]);
    expect(
      applyStyle(ranges, 2, 5, { color: null, highlight: null }, 10),
    ).toEqual([]);
  });

  it("is a no-op for an empty selection", () => {
    const ranges = freeze([{ start: 1, end: 4, color: "red" }]);
    expect(applyStyle(ranges, 2, 2, { color: "blue" }, 10)).toBe(ranges);
  });
});

describe("shiftRangesForEdit", () => {
  const range47 = () => freeze([{ start: 4, end: 7, color: "red" }]);

  it("moves a range when inserting before it", () => {
    expect(shiftRangesForEdit(range47(), "abc def", "XXabc def")).toEqual([
      { start: 6, end: 9, color: "red" },
    ]);
  });

  it("extends a range when inserting inside it", () => {
    expect(shiftRangesForEdit(range47(), "abc def", "abc dXef")).toEqual([
      { start: 4, end: 8, color: "red" },
    ]);
  });

  it("leaves insertions at range start and end unstyled", () => {
    expect(shiftRangesForEdit(range47(), "abc def", "abc Xdef")).toEqual([
      { start: 5, end: 8, color: "red" },
    ]);
    expect(shiftRangesForEdit(range47(), "abc def", "abc defX")).toEqual([
      { start: 4, end: 7, color: "red" },
    ]);
  });

  it("keeps a range when inserting after it", () => {
    const ranges = freeze([{ start: 0, end: 3, color: "red" }]);
    expect(shiftRangesForEdit(ranges, "abc def", "abc dXef")).toEqual([
      { start: 0, end: 3, color: "red" },
    ]);
  });

  it("trims a range on deletion inside and spanning it", () => {
    const ranges = freeze([{ start: 2, end: 8, color: "red" }]);
    expect(shiftRangesForEdit(ranges, "abcdefghij", "abcdghij")).toEqual([
      { start: 2, end: 6, color: "red" },
    ]);
    expect(shiftRangesForEdit(ranges, "abcdefghij", "efghij")).toEqual([
      { start: 0, end: 4, color: "red" },
    ]);
  });

  it("drops a range emptied by deletion", () => {
    const ranges = freeze([{ start: 2, end: 4, color: "red" }]);
    expect(shiftRangesForEdit(ranges, "abcdefghij", "afghij")).toEqual([]);
  });

  it("extends a range on replacement inside it", () => {
    const ranges = freeze([{ start: 0, end: 10, color: "red" }]);
    expect(shiftRangesForEdit(ranges, "abcdefghij", "abcXYZfghij")).toEqual([
      { start: 0, end: 11, color: "red" },
    ]);
  });
});

describe("splitRangesIntoLines", () => {
  const font = "10px Cascadia, Segoe UI Emoji" as FontString;

  it("splits a styled range across a wrap break", () => {
    const originalText = "Hello Excalidraw world";
    const wrapped = wrapText(originalText, font, 100);
    const start = originalText.indexOf("Excalidraw");
    const end = start + "Excalidraw wo".length;
    const lines = splitRangesIntoLines(originalText, wrapped, [
      { start, end, color: "red" },
    ]);
    const wrappedLines = wrapped.split("\n");
    expect(lines.length).toEqual(wrappedLines.length);
    lines.forEach((line, index) => {
      expect(line.runs.map((run) => run.text).join("")).toEqual(
        wrappedLines[index],
      );
    });
    const redText = lines
      .flatMap((line) => line.runs)
      .filter((run) => run.color === "red")
      .map((run) => run.text)
      .join("");
    expect(redText.replace(/\s/g, "")).toEqual("Excalidrawwo");
    expect(
      lines.filter((line) => line.runs.some((run) => run.color === "red"))
        .length,
    ).toEqual(2);
  });

  it("keeps hard line breaks", () => {
    const lines = splitRangesIntoLines("ab\ncd", "ab\ncd", [
      { start: 1, end: 4, highlight: "yellow" },
    ]);
    expect(lines).toEqual([
      { runs: [{ text: "a" }, { text: "b", highlight: "yellow" }] },
      { runs: [{ text: "c", highlight: "yellow" }, { text: "d" }] },
    ]);
  });
});

describe("restoreStyleRanges", () => {
  it("drops invalid entries and clamps", () => {
    expect(
      restoreStyleRanges(
        [
          { start: "a" },
          { start: 1.5, end: 3, color: "red" },
          { start: 0, end: 99, color: "red" },
          null,
          { start: 0, end: 2, color: "" },
        ],
        "hello",
      ),
    ).toEqual([{ start: 0, end: 5, color: "red" }]);
  });

  it("returns undefined for legacy or invalid input", () => {
    expect(restoreStyleRanges(undefined, "hello")).toEqual(undefined);
    expect(restoreStyleRanges(null, "hello")).toEqual(undefined);
    expect(restoreStyleRanges({}, "hello")).toEqual(undefined);
    expect(restoreStyleRanges([], "hello")).toEqual(undefined);
  });
});

describe("withStyleRanges", () => {
  it("omits the key for an empty list and bumps the version", () => {
    const base = API.createElement({
      type: "text",
      text: "hello world",
    }) as ExcalidrawTextElement;
    const styled = withStyleRanges(base, [{ start: 0, end: 5, color: "red" }]);
    expect(styled.styleRanges).toEqual([{ start: 0, end: 5, color: "red" }]);

    const cleared = withStyleRanges(styled, []);
    expect("styleRanges" in cleared).toEqual(false);
    expect(cleared.version).toEqual(styled.version + 1);

    expect(withStyleRanges(styled, [{ start: 0, end: 5, color: "red" }])).toBe(
      styled,
    );
  });
});

describe("style range hardening", () => {
  const manyRanges = (): TextStyleRange[] =>
    Array.from({ length: MAX_STYLE_RANGES + 500 }, (_, i) => ({
      start: i * 2,
      end: i * 2 + 1,
      color: "red",
    }));
  const longTextLength = (MAX_STYLE_RANGES + 500) * 2;

  it("caps the number of ranges in restoreStyleRanges", () => {
    const startedAt = Date.now();
    const result = restoreStyleRanges(manyRanges(), "x".repeat(longTextLength));
    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(result?.length).toEqual(MAX_STYLE_RANGES);
  });

  it("caps the number of ranges in normalizeStyleRanges", () => {
    const startedAt = Date.now();
    const result = normalizeStyleRanges(manyRanges(), longTextLength);
    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(result.length).toEqual(MAX_STYLE_RANGES);
  });

  it("splits multiple ranges across wrapped lines", () => {
    const font = "10px Cascadia, Segoe UI Emoji" as FontString;
    const originalText = "Hello Excalidraw world";
    const wrapped = wrapText(originalText, font, 100);
    const lines = splitRangesIntoLines(originalText, wrapped, [
      { start: 0, end: 5, color: "red" },
      { start: 6, end: 16, color: "blue" },
      { start: 17, end: 22, highlight: "yellow" },
    ]);
    const wrappedLines = wrapped.split("\n");
    expect(lines.length).toEqual(wrappedLines.length);
    lines.forEach((line, index) => {
      expect(line.runs.map((run) => run.text).join("")).toEqual(
        wrappedLines[index],
      );
    });
    const runs = lines.flatMap((line) => line.runs);
    const textOf = (pick: (run: typeof runs[number]) => boolean) =>
      runs
        .filter(pick)
        .map((run) => run.text)
        .join("")
        .replace(/\s/g, "");
    expect(textOf((run) => run.color === "red")).toEqual("Hello");
    expect(textOf((run) => run.color === "blue")).toEqual("Excalidraw");
    expect(textOf((run) => run.highlight === "yellow")).toEqual("world");
  });

  const rejected = [
    "a".repeat(MAX_STYLE_COLOR_LENGTH + 1),
    "url(#x)",
    'red"',
    "red;",
    "<red",
  ];
  const accepted = ["#ff0000", "rgb(1, 2, 3)", "red", "transparent"];

  it("drops implausible colours in restoreStyleRanges", () => {
    rejected.forEach((value) => {
      expect(
        restoreStyleRanges([{ start: 0, end: 2, color: value }], "hello"),
      ).toEqual(undefined);
      expect(
        restoreStyleRanges([{ start: 0, end: 2, highlight: value }], "hello"),
      ).toEqual(undefined);
    });
    accepted.forEach((value) => {
      expect(
        restoreStyleRanges(
          [{ start: 0, end: 2, color: value, highlight: value }],
          "hello",
        ),
      ).toEqual([{ start: 0, end: 2, color: value, highlight: value }]);
    });
  });

  it("drops implausible colours in normalizeStyleRanges", () => {
    rejected.forEach((value) => {
      expect(
        normalizeStyleRanges(
          [
            { start: 0, end: 2, color: value },
            { start: 2, end: 4, highlight: value },
          ],
          5,
        ),
      ).toEqual([]);
    });
    accepted.forEach((value) => {
      expect(
        normalizeStyleRanges(
          [{ start: 0, end: 2, color: value, highlight: value }],
          5,
        ),
      ).toEqual([{ start: 0, end: 2, color: value, highlight: value }]);
    });
  });
});
