import { wrapText } from "../src/textWrapping";
import {
  adjustTextStyleRangesForSplice,
  applyTextStyleToRange,
  clearTextStyleProperty,
  getTextSplice,
  getTextStyleOfRange,
  getTextStyleRunsByLine,
  mapWrappedTextToOriginalText,
  normalizeTextStyleRanges,
  shiftTextStyleRanges,
} from "../src/textStyleRanges";

import type { FontString, TextStyleRange } from "../src/types";

const RED = "#e03131";
const BLUE = "#1971c2";
const YELLOW = "#ffec99";

// `measureText` is mocked to the text's length, times 10 (see
// `CanvasTextMetricsProvider`)
const font = "10px Virgil" as FontString;

/** the text each range covers, with its style */
const describeRanges = (text: string, ranges: readonly TextStyleRange[]) =>
  ranges.map(({ start, end, ...style }) => ({
    text: text.slice(start, end),
    ...style,
  }));

describe("applyTextStyleToRange", () => {
  const text = "Bid request timeout 120ms";

  it("styles a range of plain text", () => {
    const ranges = applyTextStyleToRange(
      undefined,
      20,
      25,
      { strokeColor: RED },
      text.length,
    );
    expect(ranges).toEqual([{ start: 20, end: 25, strokeColor: RED }]);
    expect(describeRanges(text, ranges)).toEqual([
      { text: "120ms", strokeColor: RED },
    ]);
  });

  it("splits ranges it overlaps, keeping their other styles", () => {
    const red = applyTextStyleToRange(
      undefined,
      12,
      25,
      { strokeColor: RED },
      text.length,
    );
    const highlighted = applyTextStyleToRange(
      red,
      4,
      19,
      { backgroundColor: YELLOW },
      text.length,
    );
    expect(describeRanges(text, highlighted)).toEqual([
      { text: "request ", backgroundColor: YELLOW },
      { text: "timeout", strokeColor: RED, backgroundColor: YELLOW },
      { text: " 120ms", strokeColor: RED },
    ]);
  });

  it("clears a property with null, dropping ranges left unstyled", () => {
    const red = applyTextStyleToRange(
      undefined,
      0,
      text.length,
      { strokeColor: RED },
      text.length,
    );
    const cleared = applyTextStyleToRange(
      red,
      4,
      11,
      { strokeColor: null },
      text.length,
    );
    expect(describeRanges(text, cleared)).toEqual([
      { text: "Bid ", strokeColor: RED },
      { text: " timeout 120ms", strokeColor: RED },
    ]);
    expect(
      applyTextStyleToRange(cleared, 0, 30, { strokeColor: null }, 25),
    ).toEqual([]);
  });

  it("merges adjacent ranges of the same style", () => {
    const first = applyTextStyleToRange(
      undefined,
      0,
      3,
      { strokeColor: BLUE },
      text.length,
    );
    expect(
      applyTextStyleToRange(first, 3, 11, { strokeColor: BLUE }, text.length),
    ).toEqual([{ start: 0, end: 11, strokeColor: BLUE }]);
  });

  it("returns the same ranges if nothing changes", () => {
    const ranges = applyTextStyleToRange(
      undefined,
      0,
      3,
      { strokeColor: BLUE },
      text.length,
    );
    expect(
      applyTextStyleToRange(ranges, 1, 2, { strokeColor: BLUE }, text.length),
    ).toBe(ranges);
    expect(
      applyTextStyleToRange(ranges, 2, 2, { strokeColor: RED }, text.length),
    ).toBe(ranges);
  });

  it("clamps to the text", () => {
    expect(
      applyTextStyleToRange(undefined, 20, 99, { strokeColor: RED }, 25),
    ).toEqual([{ start: 20, end: 25, strokeColor: RED }]);
  });
});

describe("getTextStyleOfRange", () => {
  const ranges = [
    { start: 2, end: 5, backgroundColor: YELLOW },
    { start: 5, end: 8, backgroundColor: YELLOW, strokeColor: RED },
  ];

  it("gets the value shared by all of the range", () => {
    expect(getTextStyleOfRange(ranges, 2, 8, "backgroundColor")).toBe(YELLOW);
    expect(getTextStyleOfRange(ranges, 5, 7, "strokeColor")).toBe(RED);
  });

  it("gets null where none of the range is styled", () => {
    expect(getTextStyleOfRange(ranges, 0, 2, "backgroundColor")).toBe(null);
    expect(getTextStyleOfRange(ranges, 2, 5, "strokeColor")).toBe(null);
  });

  it("gets undefined for mixed values", () => {
    expect(getTextStyleOfRange(ranges, 0, 4, "backgroundColor")).toBe(
      undefined,
    );
    expect(getTextStyleOfRange(ranges, 4, 6, "strokeColor")).toBe(undefined);
    expect(getTextStyleOfRange(ranges, 6, 10, "strokeColor")).toBe(undefined);
  });
});

describe("clearTextStyleProperty", () => {
  it("clears one property, keeping the other", () => {
    expect(
      clearTextStyleProperty(
        [
          { start: 0, end: 3, strokeColor: RED },
          { start: 3, end: 6, strokeColor: RED, backgroundColor: YELLOW },
        ],
        "strokeColor",
      ),
    ).toEqual([{ start: 3, end: 6, backgroundColor: YELLOW }]);
  });
});

describe("normalizeTextStyleRanges", () => {
  it("drops malformed, empty and style-less ranges", () => {
    expect(
      normalizeTextStyleRanges(
        [
          null,
          "foo",
          { start: "0", end: 3, strokeColor: RED },
          { start: 3, end: 3, strokeColor: RED },
          { start: 5, end: 2, strokeColor: RED },
          { start: 0, end: 4 },
          { start: 0, end: 4, strokeColor: "" },
          { start: 6, end: 8, strokeColor: RED, junk: true },
        ],
        10,
      ),
    ).toEqual([{ start: 6, end: 8, strokeColor: RED }]);
    expect(normalizeTextStyleRanges(undefined, 10)).toEqual([]);
    expect(normalizeTextStyleRanges({}, 10)).toEqual([]);
  });

  it("clamps to the text, sorts, and lets later ranges win overlaps", () => {
    expect(
      normalizeTextStyleRanges(
        [
          { start: 6, end: 20, strokeColor: BLUE },
          { start: -4, end: 4, strokeColor: RED },
          { start: 2, end: 7, strokeColor: BLUE },
        ],
        10,
      ),
    ).toEqual([
      { start: 0, end: 2, strokeColor: RED },
      { start: 2, end: 10, strokeColor: BLUE },
    ]);
  });

  it("returns already normalized ranges as they are", () => {
    const ranges = [{ start: 0, end: 2, strokeColor: RED }];
    expect(normalizeTextStyleRanges(ranges, 10)).toBe(ranges);
  });
});

describe("text edits", () => {
  describe("getTextSplice", () => {
    it("finds an insertion", () => {
      expect(getTextSplice("Hello world", "Hello big world")).toEqual({
        index: 6,
        deleteCount: 0,
        insertCount: 4,
      });
    });

    it("finds a deletion", () => {
      expect(getTextSplice("Hello big world", "Hello world")).toEqual({
        index: 6,
        deleteCount: 4,
        insertCount: 0,
      });
    });

    it("finds a replacement", () => {
      expect(getTextSplice("timeout 120ms", "timeout 250ms")).toEqual({
        index: 8,
        deleteCount: 2,
        insertCount: 2,
      });
    });

    it("resolves ambiguous edits with the caret", () => {
      // typing `a` at the start of `aa`
      expect(getTextSplice("aa", "aaa", 1)).toEqual({
        index: 0,
        deleteCount: 0,
        insertCount: 1,
      });
      expect(getTextSplice("aa", "aaa")).toEqual({
        index: 2,
        deleteCount: 0,
        insertCount: 1,
      });
      // backspacing the first `a` of `aaa`
      expect(getTextSplice("aaa", "aa", 0)).toEqual({
        index: 0,
        deleteCount: 1,
        insertCount: 0,
      });
    });

    it("ignores a caret that doesn't fit the edit", () => {
      expect(getTextSplice("abc", "abXc", 0)).toEqual({
        index: 2,
        deleteCount: 0,
        insertCount: 1,
      });
    });

    it("finds no splice for the same text", () => {
      expect(getTextSplice("abc", "abc")).toBe(null);
    });
  });

  // "Bid request timeout 120ms", with "120ms" red
  const text = "Bid request timeout 120ms";
  const ranges = [{ start: 20, end: 25, strokeColor: RED }];

  const edit = (
    nextText: string,
    caret?: number,
    prevRanges: readonly TextStyleRange[] = ranges,
  ) =>
    describeRanges(
      nextText,
      shiftTextStyleRanges(prevRanges, text, nextText, caret) ?? [],
    );

  it("shifts ranges after an insertion before them", () => {
    expect(edit("Bid request socket timeout 120ms")).toEqual([
      { text: "120ms", strokeColor: RED },
    ]);
  });

  it("shifts ranges after a deletion before them", () => {
    expect(edit("Bid timeout 120ms")).toEqual([
      { text: "120ms", strokeColor: RED },
    ]);
  });

  it("leaves ranges before an edit as they are", () => {
    const highlighted = [{ start: 0, end: 3, backgroundColor: YELLOW }];
    expect(
      shiftTextStyleRanges(highlighted, text, `${text} (p99)`, text.length + 6),
    ).toEqual(highlighted);
  });

  it("grows a range typed into", () => {
    expect(edit("Bid request timeout 1200ms", 24)).toEqual([
      { text: "1200ms", strokeColor: RED },
    ]);
  });

  it("grows a range typed on at its end", () => {
    expect(edit(`${text}!`, text.length + 1)).toEqual([
      { text: "120ms!", strokeColor: RED },
    ]);
  });

  it("doesn't grow a range typed in front of", () => {
    expect(edit("Bid request timeout ~120ms", 21)).toEqual([
      { text: "120ms", strokeColor: RED },
    ]);
  });

  it("doesn't style text typed at the start of the text", () => {
    const styled = [{ start: 0, end: 3, strokeColor: RED }];
    expect(edit(`New ${text}`, 4, styled)).toEqual([
      { text: "Bid", strokeColor: RED },
    ]);
  });

  it("shrinks a range deleted from", () => {
    expect(edit("Bid request timeout 12ms", 22)).toEqual([
      { text: "12ms", strokeColor: RED },
    ]);
  });

  it("drops a range deleted entirely", () => {
    expect(edit("Bid request timeout ", 20)).toEqual([]);
  });

  it("styles text replacing a range like the range", () => {
    // "120ms" selected and typed over
    expect(edit("Bid request timeout 2s", 22)).toEqual([
      { text: "2s", strokeColor: RED },
    ]);
  });

  it("shrinks a range a deletion overlaps", () => {
    // "timeout 12" deleted
    expect(edit("Bid request 0ms", 12)).toEqual([
      { text: "0ms", strokeColor: RED },
    ]);
  });

  it("keeps ranges on either side of an edit between them", () => {
    const twoRanges = [
      { start: 0, end: 3, backgroundColor: YELLOW },
      { start: 20, end: 25, strokeColor: RED },
    ];
    expect(edit("Bid timeout 120ms", 4, twoRanges)).toEqual([
      { text: "Bid", backgroundColor: YELLOW },
      { text: "120ms", strokeColor: RED },
    ]);
  });

  it("splices with adjustTextStyleRangesForSplice", () => {
    expect(
      adjustTextStyleRangesForSplice(
        [
          { start: 2, end: 6, strokeColor: RED },
          { start: 8, end: 10, strokeColor: BLUE },
        ],
        { index: 4, deleteCount: 5, insertCount: 1 },
      ),
    ).toEqual([
      // the replacement continues the range it starts in
      { start: 2, end: 5, strokeColor: RED },
      { start: 5, end: 6, strokeColor: BLUE },
    ]);
  });

  it("returns the same ranges if the text didn't change", () => {
    expect(shiftTextStyleRanges(ranges, text, text)).toBe(ranges);
    expect(shiftTextStyleRanges(undefined, text, "foo")).toEqual([]);
  });
});

describe("wrapping", () => {
  it("maps wrapped text back to the original", () => {
    const originalText = "Hello world foo";
    const map = mapWrappedTextToOriginalText("Hello\nworld\nfoo", originalText);
    expect(Array.from(map)).toEqual([
      0, 1, 2, 3, 4, -1, 6, 7, 8, 9, 10, -1, 12, 13, 14,
    ]);
  });

  it("maps a long word broken across lines", () => {
    const map = mapWrappedTextToOriginalText("abc\ndef\nx", "abcdef x");
    expect(Array.from(map)).toEqual([0, 1, 2, -1, 3, 4, 5, -1, 7]);
  });

  it("maps hard line breaks onto themselves", () => {
    const map = mapWrappedTextToOriginalText("ab\n\ncd", "ab\n\ncd");
    expect(Array.from(map)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("splits wrapped lines into runs, whatever the wrapping width", () => {
    const originalText = "Bid request timeout 120ms";
    const styleRanges = [
      { start: 12, end: 25, strokeColor: RED },
      { start: 20, end: 25, strokeColor: RED, backgroundColor: YELLOW },
    ];

    const runs = (width: number) =>
      getTextStyleRunsByLine({
        text: wrapText(originalText, font, width),
        originalText,
        styleRanges: normalizeTextStyleRanges(styleRanges, 25),
      });

    // "timeout 120ms" fits a line of 13 chars (130px)
    expect(runs(130)).toEqual([
      [{ text: "Bid request", strokeColor: null, backgroundColor: null }],
      [
        { text: "timeout ", strokeColor: RED, backgroundColor: null },
        { text: "120ms", strokeColor: RED, backgroundColor: YELLOW },
      ],
    ]);

    // narrower: a run is split where the line wraps, and the whitespace
    // dropped at the break isn't drawn
    expect(runs(80)).toEqual([
      [{ text: "Bid", strokeColor: null, backgroundColor: null }],
      [{ text: "request", strokeColor: null, backgroundColor: null }],
      [{ text: "timeout", strokeColor: RED, backgroundColor: null }],
      [{ text: "120ms", strokeColor: RED, backgroundColor: YELLOW }],
    ]);

    // a word broken across lines keeps its style on each part
    expect(runs(30)!.slice(-2)).toEqual([
      [{ text: "120", strokeColor: RED, backgroundColor: YELLOW }],
      [{ text: "ms", strokeColor: RED, backgroundColor: YELLOW }],
    ]);
  });

  it("gets no runs for text styled as a whole", () => {
    expect(getTextStyleRunsByLine({ text: "foo", originalText: "foo" })).toBe(
      null,
    );
    expect(
      getTextStyleRunsByLine({
        text: "foo",
        originalText: "foo",
        styleRanges: [],
      }),
    ).toBe(null);
  });

  it("never splits a surrogate pair", () => {
    const originalText = "a😀b";
    // a (stale) range ending inside the emoji
    const runs = getTextStyleRunsByLine({
      text: originalText,
      originalText,
      styleRanges: [{ start: 0, end: 2, strokeColor: RED }],
    });
    expect(runs).toEqual([
      [
        { text: "a😀", strokeColor: RED, backgroundColor: null },
        { text: "b", strokeColor: null, backgroundColor: null },
      ],
    ]);
  });
});
