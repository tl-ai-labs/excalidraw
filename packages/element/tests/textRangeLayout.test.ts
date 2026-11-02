import {
  getRenderedLineOffsets,
  getTextLineLeft,
  getTextLineRuns,
  layoutTextLine,
} from "../src/textRangeLayout";
import { applyTextRangeStyle } from "../src/textRanges";

describe("textRangeLayout", () => {
  const T = "Bid request timeout 120ms";
  const measure = (text: string) => text.length * 10;
  const RED = "#ff0000";

  it("offsets across explicit newlines", () => {
    expect(getRenderedLineOffsets("ab\ncd", "ab\ncd")).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
  });

  it("offsets skip whitespace dropped at a soft break", () => {
    expect(getRenderedLineOffsets("hello\nworld", "hello world")).toEqual([
      [0, 1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10, 11],
    ]);
  });

  it("offsets follow NFC normalization of a wrapped token", () => {
    const text = "café\nau lait";
    const originalText = "cafe\u0301 au lait";
    const offsets = getRenderedLineOffsets(text, originalText);
    expect(offsets?.[0]).toEqual([0, 1, 2, 3, 5]);
  });

  it("a text out of step with its source gives null", () => {
    expect(getRenderedLineOffsets("xyz", "abc")).toBeNull();
  });

  it("no ranges gives null", () => {
    const element = {
      text: "hello",
      originalText: "hello",
    };
    expect(getTextLineRuns(element)).toBeNull();
  });

  it("a range lands on its wrapped line", () => {
    const textRanges = applyTextRangeStyle(
      { originalText: T },
      { start: 20, end: 25 },
      { color: RED },
    );
    const element = {
      text: "Bid request\ntimeout 120ms",
      originalText: T,
      textRanges,
    };
    const lineRuns = getTextLineRuns(element);
    expect(lineRuns).not.toBeNull();
    expect(lineRuns?.[0]).toBeNull();
    expect(lineRuns?.[1]).toEqual([
      {
        start: 0,
        end: 8,
        text: "timeout ",
        color: null,
        highlight: null,
      },
      {
        start: 8,
        end: 13,
        text: "120ms",
        color: RED,
        highlight: null,
      },
    ]);
  });

  it("a range across a soft wrap splits and skips the dropped space", () => {
    const textRanges = applyTextRangeStyle(
      { originalText: T },
      { start: 8, end: 16 },
      { color: RED },
    );
    const element = {
      text: "Bid request\ntimeout 120ms",
      originalText: T,
      textRanges,
    };
    const lineRuns = getTextLineRuns(element);
    expect(lineRuns).not.toBeNull();
    expect(lineRuns?.[0]).toEqual([
      {
        start: 0,
        end: 8,
        text: "Bid requ",
        color: null,
        highlight: null,
      },
      {
        start: 8,
        end: 11,
        text: "est",
        color: RED,
        highlight: null,
      },
    ]);
    expect(lineRuns?.[1]).toEqual([
      {
        start: 0,
        end: 4,
        text: "time",
        color: RED,
        highlight: null,
      },
      {
        start: 4,
        end: 13,
        text: "out 120ms",
        color: null,
        highlight: null,
      },
    ]);
  });

  it("re-wrapping keeps the same characters", () => {
    const textRanges = applyTextRangeStyle(
      { originalText: T },
      { start: 20, end: 25 },
      { color: RED },
    );
    const element1 = {
      text: T,
      originalText: T,
      textRanges,
    };
    const element2 = {
      text: "Bid\nrequest\ntimeout\n120ms",
      originalText: T,
      textRanges,
    };

    const runs1 = getTextLineRuns(element1);
    const redRun1 = runs1?.[0]?.find((run) => run.color === RED);
    expect(redRun1?.text).toBe("120ms");

    const runs2 = getTextLineRuns(element2);
    const redRun2 = runs2?.[3]?.find((run) => run.color === RED);
    expect(redRun2?.text).toBe("120ms");
  });

  it("a fixed-width wrap maps exactly", () => {
    const textRanges = applyTextRangeStyle(
      { originalText: T },
      { start: 20, end: 25 },
      { color: RED },
    );
    const element = {
      text: "Bid request\ntimeout 120ms",
      originalText: T,
      textRanges,
      autoResize: false,
    };
    const lineRuns = getTextLineRuns(element);
    expect(lineRuns).not.toBeNull();
    expect(lineRuns?.[0]).toBeNull();
    const redRun = lineRuns?.[1]?.find((run) => run.color === RED);
    expect(redRun?.text).toBe("120ms");
  });

  it("a stale text renders unstyled", () => {
    const textRanges = applyTextRangeStyle(
      { originalText: T },
      { start: 20, end: 25 },
      { color: RED },
    );
    const element = {
      text: "something else",
      originalText: T,
      textRanges,
    };
    expect(getTextLineRuns(element)).toBeNull();
  });

  it("a surrogate pair stays in one run", () => {
    const text = "a😀b";
    const originalText = "a😀b";
    const textRanges = applyTextRangeStyle(
      { originalText },
      { start: 1, end: 2 },
      { color: RED },
    );
    const element = {
      text,
      originalText,
      textRanges,
    };
    const lineRuns = getTextLineRuns(element);
    expect(lineRuns).not.toBeNull();
    const runs = lineRuns?.[0];
    expect(runs).toBeDefined();
    expect(runs?.some((run) => run.start === 2)).toBe(false);
  });

  it("left-to-right pieces", () => {
    const textRanges = applyTextRangeStyle(
      { originalText: T },
      { start: 20, end: 25 },
      { color: RED },
    );
    const lineRuns = getTextLineRuns({
      text: T,
      originalText: T,
      textRanges,
    });
    expect(lineRuns?.[0]).toBeDefined();
    const layout = layoutTextLine(T, lineRuns![0]!, "ltr", measure);
    expect(layout.width).toBe(250);
    expect(layout.pieces).toEqual([
      {
        text: "Bid request timeout ",
        x: 0,
        width: 200,
        color: null,
        highlight: null,
        direction: "ltr",
      },
      {
        text: "120ms",
        x: 200,
        width: 50,
        color: RED,
        highlight: null,
        direction: "ltr",
      },
    ]);
  });

  it("right-to-left pieces run from the right", () => {
    const line = "אבג דה";
    const runs = [
      {
        start: 0,
        end: 3,
        text: "אבג",
        color: null,
        highlight: null,
      },
      {
        start: 3,
        end: 6,
        text: " דה",
        color: RED,
        highlight: null,
      },
    ];
    const layout = layoutTextLine(line, runs, "rtl", measure);
    expect(layout.width).toBe(60);
    expect(layout.pieces).toEqual([
      {
        text: "אבג",
        x: 30,
        width: 30,
        color: null,
        highlight: null,
        direction: "rtl",
      },
      {
        text: " דה",
        x: 0,
        width: 30,
        color: RED,
        highlight: null,
        direction: "rtl",
      },
    ]);
  });

  it("an ltr word inside rtl text keeps its order", () => {
    const line = "אב abc גד";
    const runs = [
      {
        start: 0,
        end: 3,
        text: "אב ",
        color: null,
        highlight: null,
      },
      {
        start: 3,
        end: 5,
        text: "ab",
        color: RED,
        highlight: null,
      },
      {
        start: 5,
        end: 9,
        text: "c גד",
        color: null,
        highlight: null,
      },
    ];
    const layout = layoutTextLine(line, runs, "rtl", measure);
    const redPiece = layout.pieces.find((piece) => piece.color === RED);
    expect(redPiece).toEqual({
      text: "ab",
      x: 30,
      width: 20,
      color: RED,
      highlight: null,
      direction: "ltr",
    });
  });

  it("getTextLineLeft", () => {
    const elementWidth = 400;
    const lineWidth = 250;
    expect(getTextLineLeft("left", elementWidth, lineWidth)).toBe(0);
    expect(getTextLineLeft("center", elementWidth, lineWidth)).toBe(75);
    expect(getTextLineLeft("right", elementWidth, lineWidth)).toBe(150);
  });

  it("an emoji on an rtl line", () => {
    const line = "😀אב";
    const runs = [
      {
        start: 0,
        end: line.length,
        text: line,
        color: RED,
        highlight: null,
      },
    ];
    const layout = layoutTextLine(line, runs, "rtl", measure);
    const joinedText = layout.pieces.map((p) => p.text).join("");
    expect(joinedText).toBe(line);

    const loneSurrogateRegex =
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    for (const piece of layout.pieces) {
      expect(loneSurrogateRegex.test(piece.text)).toBe(false);
      expect(piece.direction === "ltr" || piece.direction === "rtl").toBe(true);
    }
  });
});
