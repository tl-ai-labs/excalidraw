import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { arrayToMap } from "@excalidraw/common";

import {
  applyStyleToRange,
  getStyleRunsForLines,
  normalizeStyleRanges,
  sanitizeStyleRanges,
  shiftStyleRangesForEdit,
} from "../src/textStyleRanges";
import {
  getBoundTextMaxWidth,
  getTextStyleRunLayout,
} from "../src/textElement";
import { wrapText } from "../src/textWrapping";
import { setCustomTextMetricsProvider } from "../src/textMeasurements";
import { ElementsDelta } from "../src/delta";
import { newElementWith } from "../src/mutateElement";
import { newTextElement } from "../src/newElement";

import type {
  ExcalidrawTextElement,
  FontString,
  FractionalIndex,
  SceneElementsMap,
} from "../src/types";

const font = "10px Cascadia, Segoe UI Emoji" as FontString;
const sample = "Bid request timeout 120ms";
const red = "#f00";
const blue = "#00f";
const yellow = "#ff0";
const base = "#1e1e1e";

const coloured = (runs: { text: string; strokeColor?: string }[][]) =>
  runs
    .flat()
    .filter((run) => run.strokeColor === red)
    .map((run) => run.text)
    .join("");

describe("textStyleRanges", () => {
  describe("normalizeStyleRanges", () => {
    it("clamps, drops empty or colourless ranges and sorts", () => {
      expect(
        normalizeStyleRanges(
          [
            { start: 8, end: 99, strokeColor: red },
            { start: 2, end: 2, strokeColor: "#0f0" },
            { start: -3, end: 2, backgroundColor: yellow },
            { start: 4, end: 6 },
          ],
          10,
        ),
      ).toEqual([
        { start: 0, end: 2, backgroundColor: yellow },
        { start: 8, end: 10, strokeColor: red },
      ]);
    });

    it("merges adjacent and overlapping same-style ranges", () => {
      expect(
        normalizeStyleRanges(
          [
            { start: 0, end: 3, strokeColor: red },
            { start: 3, end: 5, strokeColor: red },
            { start: 4, end: 8, strokeColor: red },
          ],
          10,
        ),
      ).toEqual([{ start: 0, end: 8, strokeColor: red }]);
    });

    it("lets later entries win inside an overlap", () => {
      expect(
        normalizeStyleRanges(
          [
            { start: 0, end: 6, strokeColor: red },
            { start: 3, end: 9, strokeColor: blue },
          ],
          10,
        ),
      ).toEqual([
        { start: 0, end: 3, strokeColor: red },
        { start: 3, end: 9, strokeColor: blue },
      ]);
    });

    it("returns undefined when nothing remains", () => {
      expect(normalizeStyleRanges(undefined, 10)).toBe(undefined);
      expect(normalizeStyleRanges([], 10)).toBe(undefined);
      expect(
        normalizeStyleRanges([{ start: 1, end: 1, strokeColor: red }], 10),
      ).toBe(undefined);
    });

    it("sanitizeStyleRanges keeps only well-formed entries", () => {
      const value = [
        null,
        3,
        [],
        { start: NaN, end: 2, strokeColor: red },
        { start: 0, end: 1.5, strokeColor: red },
        { start: 0, end: 2 },
        { start: 0, end: 2, strokeColor: 5 },
        { start: 1, end: 3, strokeColor: red, extra: true },
      ];
      expect(sanitizeStyleRanges(value, 10)).toEqual([
        { start: 1, end: 3, strokeColor: red },
      ]);
      expect(sanitizeStyleRanges({ start: 0 }, 10)).toBe(undefined);
    });
  });

  describe("applyStyleToRange", () => {
    it("splits a range when applied over part of it", () => {
      expect(
        applyStyleToRange(
          [{ start: 0, end: 10, strokeColor: red }],
          3,
          6,
          { strokeColor: blue },
          10,
          base,
        ),
      ).toEqual([
        { start: 0, end: 3, strokeColor: red },
        { start: 3, end: 6, strokeColor: blue },
        { start: 6, end: 10, strokeColor: red },
      ]);
    });

    it("keeps the other property and fills gaps", () => {
      expect(
        applyStyleToRange(
          [{ start: 2, end: 4, strokeColor: red }],
          0,
          6,
          { backgroundColor: yellow },
          10,
          base,
        ),
      ).toEqual([
        { start: 0, end: 2, backgroundColor: yellow },
        { start: 2, end: 4, strokeColor: red, backgroundColor: yellow },
        { start: 4, end: 6, backgroundColor: yellow },
      ]);
    });

    it("clears with the base colour or transparent", () => {
      const cleared = applyStyleToRange(
        [{ start: 0, end: 5, strokeColor: red, backgroundColor: yellow }],
        0,
        5,
        { strokeColor: base },
        10,
        base,
      );
      expect(cleared).toEqual([{ start: 0, end: 5, backgroundColor: yellow }]);
      expect(
        applyStyleToRange(
          cleared,
          0,
          5,
          { backgroundColor: "transparent" },
          10,
          base,
        ),
      ).toBe(undefined);
    });
  });

  describe("shiftStyleRangesForEdit", () => {
    const prev = "abcdefghij";
    const ranges = [{ start: 4, end: 7, strokeColor: red }];
    const insert = (at: number, s: string) =>
      shiftStyleRangesForEdit(
        ranges,
        prev,
        prev.slice(0, at) + s + prev.slice(at),
        undefined,
      );
    const remove = (from: number, to: number) =>
      shiftStyleRangesForEdit(
        ranges,
        prev,
        prev.slice(0, from) + prev.slice(to),
        undefined,
      );

    it("shifts on insert before, inside and after a range", () => {
      expect(insert(0, "XY")).toEqual([{ start: 6, end: 9, strokeColor: red }]);
      expect(insert(5, "XY")).toEqual([{ start: 4, end: 9, strokeColor: red }]);
      expect(insert(9, "XY")).toEqual([{ start: 4, end: 7, strokeColor: red }]);
    });

    it("does not colour text typed at a range's edges", () => {
      expect(insert(4, "X")).toEqual([{ start: 5, end: 8, strokeColor: red }]);
      expect(insert(7, "X")).toEqual([{ start: 4, end: 7, strokeColor: red }]);
    });

    it("shifts on delete before, overlapping and inside a range", () => {
      expect(remove(0, 2)).toEqual([{ start: 2, end: 5, strokeColor: red }]);
      expect(remove(3, 5)).toEqual([{ start: 3, end: 5, strokeColor: red }]);
      expect(remove(5, 6)).toEqual([{ start: 4, end: 6, strokeColor: red }]);
    });

    it("drops a range whose text is deleted entirely", () => {
      expect(remove(3, 8)).toBe(undefined);
    });

    it("uses the caret to place an ambiguous insertion", () => {
      const aa = [{ start: 0, end: 2, strokeColor: red }];
      expect(shiftStyleRangesForEdit(aa, "aa", "aaa", 1)).toEqual([
        { start: 1, end: 3, strokeColor: red },
      ]);
      expect(shiftStyleRangesForEdit(aa, "aa", "aaa", 2)).toEqual([
        { start: 0, end: 3, strokeColor: red },
      ]);
      expect(shiftStyleRangesForEdit(aa, "aa", "aaa", 3)).toEqual([
        { start: 0, end: 2, strokeColor: red },
      ]);
    });
  });

  describe("getStyleRunsForLines", () => {
    const range = [{ start: 20, end: 25, strokeColor: red }];

    afterEach(() => {
      setCustomTextMetricsProvider(undefined);
    });

    it("splits a single line into runs", () => {
      expect(getStyleRunsForLines(sample, sample, range)).toEqual([
        [{ text: "Bid request timeout " }, { text: "120ms", strokeColor: red }],
      ]);
    });

    it("follows soft wraps and trimmed spaces", () => {
      const wrapped = wrapText(sample, font, 100);
      const lines = wrapped.split("\n");
      const runs = getStyleRunsForLines(sample, wrapped, [
        { start: 12, end: 25, strokeColor: red },
      ]);
      runs.forEach((line, i) => {
        expect(line.map((run) => run.text).join("")).toBe(lines[i]);
        if (lines[i] === "Bid" || lines[i] === "request") {
          expect(line.some((run) => run.strokeColor)).toBe(false);
        }
      });
      expect(coloured(runs)).toBe("timeout120ms");
    });

    it("keeps hard line breaks and empty lines aligned", () => {
      const text = "ab\n\ncd";
      expect(
        getStyleRunsForLines(text, text, [
          { start: 4, end: 5, strokeColor: red },
        ]),
      ).toEqual([
        [{ text: "ab" }],
        [],
        [{ text: "c", strokeColor: red }, { text: "d" }],
      ]);
    });

    it("survives a bound-text container's wrapping", () => {
      const text = newTextElement({
        x: 0,
        y: 0,
        fontSize: 10,
        text: sample,
        styleRanges: range,
      });
      const container = API.createElement({
        type: "rectangle",
        width: 120,
        boundElements: [{ type: "text", id: text.id }],
      });
      const boundText = newElementWith(text, {
        containerId: container.id,
      });
      const wrapped = wrapText(
        boundText.originalText,
        font,
        getBoundTextMaxWidth(container, boundText),
      );
      const runs = getStyleRunsForLines(boundText.originalText, wrapped, range);
      expect(runs[runs.length - 1]).toEqual([
        { text: "120ms", strokeColor: red },
      ]);
    });

    it("survives a font change that re-wraps the same text", () => {
      setCustomTextMetricsProvider({
        getLineWidth: (text, f) => text.length * parseFloat(f),
      });
      const small = wrapText(sample, font, 200);
      const large = wrapText(
        sample,
        "20px Cascadia, Segoe UI Emoji" as FontString,
        200,
      );
      expect(small.split("\n").length).not.toBe(large.split("\n").length);
      expect(coloured(getStyleRunsForLines(sample, small, range))).toBe(
        "120ms",
      );
      expect(coloured(getStyleRunsForLines(sample, large, range))).toBe(
        "120ms",
      );
    });
  });

  describe("getTextStyleRunLayout", () => {
    it("positions runs by measured prefix widths", () => {
      const text = newTextElement({
        x: 0,
        y: 0,
        text: "hello world",
        styleRanges: [{ start: 6, end: 11, strokeColor: red }],
      });
      const left = newElementWith(text, { width: 200, textAlign: "left" });
      expect(getTextStyleRunLayout(left, undefined)).toEqual([
        [
          { text: "hello ", x: 0, width: 60 },
          { text: "world", strokeColor: red, x: 60, width: 50 },
        ],
      ]);
      const center = newElementWith(text, { width: 200, textAlign: "center" });
      expect(getTextStyleRunLayout(center, undefined)).toEqual([
        [
          { text: "hello ", x: 45, width: 60 },
          { text: "world", strokeColor: red, x: 105, width: 50 },
        ],
      ]);
    });

    it("is null without ranges or for RTL text", () => {
      expect(
        getTextStyleRunLayout(
          newTextElement({ x: 0, y: 0, text: "hello" }),
          undefined,
        ),
      ).toBe(null);
      const rtl = newTextElement({
        x: 0,
        y: 0,
        text: "שלום עולם",
        styleRanges: [{ start: 0, end: 4, strokeColor: red }],
      });
      expect(getTextStyleRunLayout(rtl, undefined)).toBe(null);
    });
  });

  describe("undo/redo of styleRanges via ElementsDelta", () => {
    const options = {
      excludedProperties: new Set(["version", "versionNonce"] as const),
    };
    const createText = (
      styleRanges?: { start: number; end: number; strokeColor: string }[],
    ) => ({
      ...newTextElement({ x: 0, y: 0, text: "test text", styleRanges }),
      index: "a0" as FractionalIndex,
    });

    it("restores the previous ranges on undo and re-applies them on redo", () => {
      const before = createText();
      const after = newElementWith(before, {
        styleRanges: [{ start: 0, end: 4, strokeColor: red }],
      });
      const beforeMap = arrayToMap([before]) as SceneElementsMap;
      const afterMap = arrayToMap([after]) as SceneElementsMap;
      const delta = ElementsDelta.calculate(beforeMap, afterMap);

      const [undone, undoVisible] = delta
        .inverse()
        .applyTo(afterMap, afterMap, options);
      expect(
        (undone.get(before.id) as ExcalidrawTextElement | undefined)
          ?.styleRanges,
      ).toBe(undefined);
      expect(undoVisible).toBe(true);

      const [redone, redoVisible] = delta.applyTo(
        beforeMap,
        beforeMap,
        options,
      );
      expect(
        (redone.get(before.id) as ExcalidrawTextElement | undefined)
          ?.styleRanges,
      ).toEqual([{ start: 0, end: 4, strokeColor: red }]);
      expect(redoVisible).toBe(true);
    });

    it("does not record an equal-content styleRanges change", () => {
      const text = createText([{ start: 0, end: 4, strokeColor: red }]);
      const next = newElementWith(text, {
        styleRanges: [{ start: 0, end: 4, strokeColor: red }],
      });
      const delta = ElementsDelta.calculate(
        arrayToMap([text]) as SceneElementsMap,
        arrayToMap([next]) as SceneElementsMap,
      );
      const updated = delta.updated[text.id];
      expect(updated?.inserted ?? {}).not.toHaveProperty("styleRanges");
      expect(updated?.deleted ?? {}).not.toHaveProperty("styleRanges");
    });
  });
});
