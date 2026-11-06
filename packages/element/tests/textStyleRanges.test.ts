import { newTextElement } from "../src/newElement";
import { newElementWith } from "../src/mutateElement";
import { deepCopyElement, duplicateElement } from "../src/duplicate";
import { convertToExcalidrawElements } from "../src/transform";
import { ElementsDelta } from "../src/delta";
import {
  normalizeTextStyleRanges,
  applyTextStyleRange,
  shiftTextStyleRangesOnEdit,
  getWrappedLineTextRuns,
  getTextElementLineRuns,
  getSelectionTextStyle,
  areTextStyleRangesEqual,
} from "../src/textStyleRanges";

import type { TextStyleRange } from "../src/textStyleRanges";
import type { SceneElementsMap } from "../src/types";

const freezeRanges = (ranges: TextStyleRange[]): readonly TextStyleRange[] => {
  ranges.forEach((range) => Object.freeze(range));
  return Object.freeze(ranges);
};

describe("textStyleRanges", () => {
  it("normalizes, clamps, resolves overlaps, and merges adjacent textStyleRanges", () => {
    const input = freezeRanges([
      { start: -5, end: 3, strokeColor: "red" },
      { start: 2, end: 6, backgroundColor: "yellow" },
      { start: 6, end: 6, strokeColor: "blue" },
      { start: 10, end: 8, strokeColor: "green" },
      { start: 8, end: 12, strokeColor: "transparent" },
      { start: 12, end: 15, strokeColor: "#000" },
      { start: 15, end: 100, backgroundColor: "pink" },
    ]);
    const snapshot = JSON.stringify(input);

    expect(normalizeTextStyleRanges(input, 20, "#000")).toEqual([
      { start: 0, end: 2, strokeColor: "red" },
      {
        start: 2,
        end: 3,
        strokeColor: "red",
        backgroundColor: "yellow",
      },
      { start: 3, end: 6, backgroundColor: "yellow" },
      { start: 15, end: 20, backgroundColor: "pink" },
    ]);
    expect(JSON.stringify(input)).toBe(snapshot);

    // adjacent identical ranges are merged
    expect(
      normalizeTextStyleRanges(
        [
          { start: 0, end: 2, strokeColor: "red" },
          { start: 2, end: 4, strokeColor: "red" },
        ],
        10,
        "#000",
      ),
    ).toEqual([{ start: 0, end: 4, strokeColor: "red" }]);

    // later ranges override earlier ones
    expect(
      normalizeTextStyleRanges(
        [
          { start: 0, end: 6, strokeColor: "red" },
          { start: 2, end: 4, strokeColor: "blue" },
        ],
        10,
        "#000",
      ),
    ).toEqual([
      { start: 0, end: 2, strokeColor: "red" },
      { start: 2, end: 4, strokeColor: "blue" },
      { start: 4, end: 6, strokeColor: "red" },
    ]);

    // empty / invalid input
    expect(normalizeTextStyleRanges(undefined, 10, "#000")).toEqual([]);
    expect(normalizeTextStyleRanges(null, 10, "#000")).toEqual([]);
    expect(normalizeTextStyleRanges([], 10, "#000")).toEqual([]);
    expect(
      normalizeTextStyleRanges(
        [{ start: 0, end: 2, strokeColor: "red" }],
        0,
        "#000",
      ),
    ).toEqual([]);
    expect(
      normalizeTextStyleRanges(
        [{ start: 0, end: 2, strokeColor: "red" }],
        NaN,
        "#000",
      ),
    ).toEqual([]);
  });

  it("applies and clears strokeColor and backgroundColor on character selections without mutating inputs", () => {
    const input = freezeRanges([{ start: 0, end: 10, strokeColor: "red" }]);
    const snapshot = JSON.stringify(input);

    const withBackground = applyTextStyleRange(
      input,
      10,
      { start: 2, end: 5 },
      { backgroundColor: "yellow" },
      "#000",
    );
    expect(withBackground).toEqual([
      { start: 0, end: 2, strokeColor: "red" },
      {
        start: 2,
        end: 5,
        strokeColor: "red",
        backgroundColor: "yellow",
      },
      { start: 5, end: 10, strokeColor: "red" },
    ]);
    expect(JSON.stringify(input)).toBe(snapshot);

    // clearing strokeColor via the element strokeColor keeps the background
    expect(
      applyTextStyleRange(
        withBackground,
        10,
        { start: 2, end: 5 },
        { strokeColor: "#000" },
        "#000",
      ),
    ).toEqual([
      { start: 0, end: 2, strokeColor: "red" },
      { start: 2, end: 5, backgroundColor: "yellow" },
      { start: 5, end: 10, strokeColor: "red" },
    ]);

    // clearing backgroundColor via "transparent" keeps the strokeColor
    expect(
      applyTextStyleRange(
        withBackground,
        10,
        { start: 2, end: 5 },
        { backgroundColor: "transparent" },
        "#000",
      ),
    ).toEqual([{ start: 0, end: 10, strokeColor: "red" }]);

    // selection is clamped to the text
    expect(
      applyTextStyleRange(
        [],
        10,
        { start: -3, end: 100 },
        { backgroundColor: "yellow" },
        "#000",
      ),
    ).toEqual([{ start: 0, end: 10, backgroundColor: "yellow" }]);

    // empty selection returns the normalised ranges
    expect(
      applyTextStyleRange(
        input,
        10,
        { start: 5, end: 5 },
        { strokeColor: "blue" },
        "#000",
      ),
    ).toEqual([{ start: 0, end: 10, strokeColor: "red" }]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("shifts ranges accurately on text insertion, deletion, and replacement", () => {
    const input = freezeRanges([
      { start: 0, end: 5, strokeColor: "red" },
      { start: 6, end: 11, backgroundColor: "blue" },
    ]);
    const snapshot = JSON.stringify(input);
    const prev = "hello world";

    // insertion at the end of the first range
    expect(shiftTextStyleRangesOnEdit(input, prev, "helloX world")).toEqual([
      { start: 0, end: 5, strokeColor: "red" },
      { start: 7, end: 12, backgroundColor: "blue" },
    ]);

    // insertion inside the first range expands it
    expect(shiftTextStyleRangesOnEdit(input, prev, "heXllo world")).toEqual([
      { start: 0, end: 6, strokeColor: "red" },
      { start: 7, end: 12, backgroundColor: "blue" },
    ]);

    // deletion between the ranges shifts the following range
    expect(shiftTextStyleRangesOnEdit(input, prev, "helloworld")).toEqual([
      { start: 0, end: 5, strokeColor: "red" },
      { start: 5, end: 10, backgroundColor: "blue" },
    ]);

    // deleting a range in full removes it
    expect(shiftTextStyleRangesOnEdit(input, prev, "hello ")).toEqual([
      { start: 0, end: 5, strokeColor: "red" },
    ]);

    // replacement spanning both ranges
    expect(shiftTextStyleRangesOnEdit(input, prev, "helYrld")).toEqual([
      { start: 0, end: 3, strokeColor: "red" },
      { start: 4, end: 7, backgroundColor: "blue" },
    ]);

    // unchanged text returns the ranges as-is
    expect(shiftTextStyleRangesOnEdit(input, prev, prev)).toEqual(input);

    // emptied text drops everything
    expect(shiftTextStyleRangesOnEdit(input, prev, "")).toEqual([]);

    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("maps originalText ranges onto wrapped visual lines and runs", () => {
    // soft-wrapped lines, the range spans the dropped soft-wrap space
    const ranges: readonly TextStyleRange[] = [
      { start: 3, end: 9, strokeColor: "red" },
    ];
    const first = getWrappedLineTextRuns(
      { text: "hello", start: 0, end: 5 },
      ranges,
    );
    const second = getWrappedLineTextRuns(
      { text: "world", start: 6, end: 11 },
      ranges,
    );

    expect(first).toEqual([
      { text: "hel", start: 0, end: 3 },
      { text: "lo", start: 3, end: 5, strokeColor: "red" },
    ]);
    expect(second).toEqual([
      { text: "wor", start: 6, end: 9, strokeColor: "red" },
      { text: "ld", start: 9, end: 11 },
    ]);

    // no intersecting ranges -> single unstyled run
    expect(
      getWrappedLineTextRuns({ text: "abc", start: 20, end: 23 }, ranges),
    ).toEqual([{ text: "abc", start: 20, end: 23 }]);

    // empty line
    expect(
      getWrappedLineTextRuns({ text: "", start: 5, end: 5 }, ranges),
    ).toEqual([{ text: "", start: 5, end: 5 }]);

    // hard newlines
    const lines = getTextElementLineRuns(
      {
        text: "ab\ncd",
        originalText: "ab\ncd",
        fontSize: 20,
        fontFamily: 1,
        width: 100,
        autoResize: true,
        strokeColor: "#000",
        textStyleRanges: [{ start: 1, end: 4, strokeColor: "red" }],
      },
      undefined,
      undefined,
    );

    expect(lines).toHaveLength(2);
    expect(lines.map((runs) => runs.map((run) => run.text).join(""))).toEqual([
      "ab",
      "cd",
    ]);
    expect(lines[0].map((run) => [run.text, run.strokeColor])).toEqual([
      ["a", undefined],
      ["b", "red"],
    ]);
    expect(lines[1].map((run) => [run.text, run.strokeColor])).toEqual([
      ["c", "red"],
      ["d", undefined],
    ]);
    for (const runs of lines) {
      for (let i = 1; i < runs.length; i++) {
        expect(runs[i].start).toBe(runs[i - 1].end);
      }
    }

    // selection style
    const element = {
      originalText: "hello world",
      strokeColor: "#000",
      textStyleRanges: [
        {
          start: 0,
          end: 5,
          strokeColor: "red",
          backgroundColor: "yellow",
        },
      ],
    };
    expect(getSelectionTextStyle(element, { start: 2, end: 4 })).toEqual({
      strokeColor: "red",
      backgroundColor: "yellow",
    });
    expect(getSelectionTextStyle(element, { start: 6, end: 11 })).toEqual({
      strokeColor: "#000",
      backgroundColor: "transparent",
    });
    expect(getSelectionTextStyle(element, { start: 0, end: 11 })).toEqual({
      strokeColor: null,
      backgroundColor: null,
    });

    // equality
    expect(
      areTextStyleRangesEqual(
        [{ start: 0, end: 2, strokeColor: "red" }],
        [{ start: 0, end: 2, strokeColor: "red" }],
      ),
    ).toBe(true);
    expect(
      areTextStyleRangesEqual(
        [{ start: 0, end: 2, strokeColor: "red" }],
        [{ start: 0, end: 2, strokeColor: "blue" }],
      ),
    ).toBe(false);
    expect(areTextStyleRangesEqual(undefined, [])).toBe(true);
  });

  it("preserves and clones textStyleRanges across newTextElement, newElementWith, JSON copy, duplicateElement, convertToExcalidrawElements, and ElementsDelta", () => {
    // 1. newTextElement normalizes and defaults to an enumerable []
    const styled = newTextElement({
      x: 0,
      y: 0,
      text: "hello world",
      textStyleRanges: [
        { start: 0, end: 5, strokeColor: "#ff0000" },
        { start: 50, end: 60, strokeColor: "#00ff00" },
      ],
    });
    const unstyled = newTextElement({ x: 0, y: 0, text: "hello world" });

    expect(styled.textStyleRanges).toEqual([
      { start: 0, end: 5, strokeColor: "#ff0000" },
    ]);
    expect(unstyled.textStyleRanges).toEqual([]);
    expect(Object.keys(unstyled)).toContain("textStyleRanges");
    expect(
      Object.prototype.propertyIsEnumerable.call(unstyled, "textStyleRanges"),
    ).toBe(true);

    // 2. newElementWith + JSON round-trips
    const movedStyled = newElementWith(styled, { x: 10 });
    const movedUnstyled = newElementWith(unstyled, { x: 10 });
    expect(movedStyled.textStyleRanges).toEqual(styled.textStyleRanges);
    expect(movedUnstyled.textStyleRanges).toEqual([]);
    expect(Object.keys(movedUnstyled)).toContain("textStyleRanges");
    expect(JSON.parse(JSON.stringify(movedStyled)).textStyleRanges).toEqual(
      styled.textStyleRanges,
    );
    expect(JSON.parse(JSON.stringify(movedUnstyled)).textStyleRanges).toEqual(
      [],
    );

    // 3. deepCopyElement / duplicateElement clone the range objects
    const copy = deepCopyElement(styled);
    expect(copy.textStyleRanges).toEqual(styled.textStyleRanges);
    expect(copy.textStyleRanges).not.toBe(styled.textStyleRanges);
    expect(copy.textStyleRanges![0]).not.toBe(styled.textStyleRanges![0]);

    const duplicate = duplicateElement(null, new Map(), styled);
    expect(duplicate.id).not.toBe(styled.id);
    expect(duplicate.textStyleRanges).toEqual(styled.textStyleRanges);
    expect(duplicate.textStyleRanges).not.toBe(styled.textStyleRanges);
    expect(duplicate.textStyleRanges![0]).not.toBe(styled.textStyleRanges![0]);
    expect(deepCopyElement(unstyled).textStyleRanges).toEqual([]);

    // 4. convertToExcalidrawElements preserves ranges
    const [converted] = convertToExcalidrawElements([
      {
        type: "text",
        x: 0,
        y: 0,
        text: "hello world",
        textStyleRanges: [{ start: 0, end: 5, strokeColor: "#ff0000" }],
      },
    ]);
    expect((converted as typeof styled).textStyleRanges).toEqual([
      { start: 0, end: 5, strokeColor: "#ff0000" },
    ]);

    const labelled = convertToExcalidrawElements([
      {
        type: "rectangle",
        x: 0,
        y: 0,
        label: {
          text: "hi",
          textStyleRanges: [{ start: 0, end: 1, strokeColor: "#ff0000" }],
        },
      },
    ]);
    const label = labelled.find((el) => el.type === "text") as typeof styled;
    expect(label.textStyleRanges).toEqual([
      { start: 0, end: 1, strokeColor: "#ff0000" },
    ]);

    // 5. ElementsDelta diffs and inverts textStyleRanges changes
    const changed = newElementWith(styled, {
      textStyleRanges: [{ start: 0, end: 5, strokeColor: "#00ff00" }],
    });
    const prevElements = new Map([
      [styled.id, styled],
    ]) as unknown as SceneElementsMap;
    const nextElements = new Map([
      [styled.id, changed],
    ]) as unknown as SceneElementsMap;

    const delta = ElementsDelta.calculate(prevElements, nextElements);
    const updated = delta.updated[styled.id];
    expect(updated).toBeDefined();
    expect((updated.deleted as any).textStyleRanges).toEqual([
      { start: 0, end: 5, strokeColor: "#ff0000" },
    ]);
    expect((updated.inserted as any).textStyleRanges).toEqual([
      { start: 0, end: 5, strokeColor: "#00ff00" },
    ]);

    const inverted = delta.inverse().updated[styled.id];
    expect((inverted.deleted as any).textStyleRanges).toEqual([
      { start: 0, end: 5, strokeColor: "#00ff00" },
    ]);
    expect((inverted.inserted as any).textStyleRanges).toEqual([
      { start: 0, end: 5, strokeColor: "#ff0000" },
    ]);
  });
});
