import {
  MAX_CLEARED_TEXT_STYLE_RANGES,
  MAX_TEXT_STYLE_RANGES,
  MAX_TEXT_STYLE_SEQ,
} from "@excalidraw/common";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { duplicateElement } from "../src/duplicate";
import {
  advanceDuplicatedListMarkers,
  applyListMarkerAdvances,
} from "../src/listMarker";
import { newTextElement } from "../src/newElement";
import { Scene } from "../src/Scene";
import {
  applyTextStyle,
  clearTextStyle,
  createTextStyleRanges,
  getStyledTextLines,
  getTextStyleRuns,
  layoutTextStyleRuns,
  remapTextStyles,
  sanitizeTextStyles,
  withTextStyles,
} from "../src/textStyleRanges";
import { convertToExcalidrawElements } from "../src/transform";

import type {
  ClearedTextStyleRange,
  ExcalidrawTextElement,
  TextStyleRange,
} from "../src/types";

const createText = (
  text: string,
  textStyleRanges?: readonly TextStyleRange[],
  overrides: Partial<ExcalidrawTextElement> = {},
) =>
  ({
    ...API.createElement({ type: "text", text }),
    originalText: text,
    ...(textStyleRanges ? { textStyleRanges } : {}),
    ...overrides,
  } as ExcalidrawTextElement);

const range = (
  start: number,
  end: number,
  overrides: Partial<TextStyleRange> = {},
): TextStyleRange => ({
  id: "a",
  seq: 1,
  start,
  end,
  color: "red",
  ...overrides,
});

const covered = (text: string, { start, end }: TextStyleRange) =>
  text.slice(start, end);

describe("textStyleRanges", () => {
  describe("text edits", () => {
    const worldRange = range(6, 11);
    const hello = () => createText("hello world", [worldRange]);

    it("shifts a range on an insert before it", () => {
      const next = "hello big world";
      const state = remapTextStyles(hello(), next, undefined);

      expect(state?.ranges).toHaveLength(1);
      expect(covered(next, state!.ranges[0])).toBe("world");
    });

    it("shifts a range on a delete before it", () => {
      const state = remapTextStyles(hello(), "world", undefined);

      expect(state?.ranges[0]).toMatchObject({ start: 0, end: 5 });
    });

    it("grows on an insert inside and shrinks on a delete inside", () => {
      const grown = remapTextStyles(hello(), "hello woXXrld", undefined);
      const shrunk = remapTextStyles(hello(), "hello wld", undefined);

      expect(grown?.ranges[0]).toMatchObject({ start: 6, end: 13 });
      expect(shrunk?.ranges[0]).toMatchObject({ start: 6, end: 9 });
    });

    it("keeps an insert at either edge outside the range", () => {
      const atStart = "hello XXworld";
      const atEnd = "hello worldXX";

      expect(
        covered(
          atStart,
          remapTextStyles(hello(), atStart, undefined)!.ranges[0],
        ),
      ).toBe("world");
      expect(
        covered(atEnd, remapTextStyles(hello(), atEnd, undefined)!.ranges[0]),
      ).toBe("world");
    });

    it("drops a range whose characters are all gone, with no tombstone", () => {
      const state = remapTextStyles(hello(), "hello ", undefined);

      expect(state).toEqual({ ranges: [], cleared: [] });
    });

    it("places an insert correctly among repeated characters", () => {
      const state = remapTextStyles(createText("aa", [range(1, 2)]), "aaa", {
        caret: 2,
      });

      expect(state?.ranges[0]).toMatchObject({ start: 2, end: 3 });
    });

    it("keeps ranges through a multi-line indent", () => {
      const next = "    one\n    two\n    three";
      const state = remapTextStyles(
        createText("one\ntwo\nthree", [range(4, 7)]),
        next,
        undefined,
      );

      expect(covered(next, state!.ranges[0])).toBe("two");
    });

    it("keeps ranges through two separate edits", () => {
      const next = "Xfoo bar bazY";
      const state = remapTextStyles(
        createText("foo bar baz", [range(4, 7)]),
        next,
        undefined,
      );

      expect(covered(next, state!.ranges[0])).toBe("bar");
    });

    it("does not carry a range onto a stray shared letter", () => {
      const state = remapTextStyles(
        createText("abc def", [range(4, 7)]),
        "xyz qex",
        undefined,
      );

      expect(state?.ranges).toEqual([]);
    });
  });

  describe("list markers", () => {
    it("keeps ranges through list renumbering and back", () => {
      const original = [
        range(0, 1, { id: "marker", seq: 1 }),
        range(3, 6, { id: "word", seq: 2 }),
      ];
      const element = createText("9. foo", original);
      const scene = new Scene([element], { skipValidation: true });
      const current = () =>
        scene
          .getNonDeletedElementsMap()
          .get(element.id) as ExcalidrawTextElement;

      const advances = advanceDuplicatedListMarkers([element], scene);

      const advanced = current();
      expect(advanced.originalText).toBe("10. foo");
      expect(
        advanced.textStyleRanges?.map((item) =>
          covered(advanced.originalText, item),
        ),
      ).toEqual(["10", "foo"]);

      applyListMarkerAdvances(advances, "prev", scene);

      expect(current().originalText).toBe("9. foo");
      expect(current().textStyleRanges).toEqual(original);
    });
  });

  describe("state changes", () => {
    it("withTextStyles deletes empty fields", () => {
      const copy = {
        ...createText("hello", [range(0, 5)], {
          clearedTextStyleRanges: [{ id: "b", seq: 1 }],
        }),
      };

      const result = withTextStyles(copy, { ranges: [], cleared: [] });

      expect("textStyleRanges" in result).toBe(false);
      expect("clearedTextStyleRanges" in result).toBe(false);
    });

    it("applyTextStyle adds a range after the highest seq", () => {
      const cleared: readonly ClearedTextStyleRange[] = [{ id: "b", seq: 5 }];
      const element = createText("hello world", [range(6, 11, { seq: 2 })], {
        clearedTextStyleRanges: cleared,
      });

      const state = applyTextStyle(
        element,
        { start: 0, end: 5 },
        { color: "blue" },
      );

      expect(state.ranges.find((item) => item.seq === 6)).toMatchObject({
        start: 0,
        end: 5,
        color: "blue",
      });
    });

    it("applyTextStyle replaces a range it fully covers on the same attributes", () => {
      const state = applyTextStyle(
        createText("hello", [range(0, 5)]),
        { start: 0, end: 5 },
        { color: "blue" },
      );

      expect(state.ranges).toHaveLength(1);
      expect(state.ranges[0].color).toBe("blue");
      expect(state.cleared).toEqual([{ id: "a", seq: 1 }]);
    });

    it("applyTextStyle keeps a covered range that sets another attribute", () => {
      const old = range(0, 5, { highlight: "yellow" });

      const state = applyTextStyle(
        createText("hello", [old]),
        { start: 0, end: 5 },
        { color: "blue" },
      );

      expect(state.ranges).toHaveLength(2);
      expect(state.ranges[0]).toEqual(old);
      expect(state.ranges[1].seq).toBeGreaterThan(old.seq);
      expect(state.cleared).toEqual([]);
    });

    it("clearTextStyle splits a range and tombstones the original", () => {
      const state = clearTextStyle(
        createText("0123456789", [range(0, 10)]),
        { start: 3, end: 5 },
        "color",
      );
      const pieces = [...state.ranges].sort((a, b) => a.start - b.start);

      expect(state.cleared).toEqual([{ id: "a", seq: 1 }]);
      expect(pieces).toHaveLength(2);
      expect(pieces[0]).toMatchObject({ start: 0, end: 3, seq: 1 });
      expect(pieces[1]).toMatchObject({ start: 5, end: 10, seq: 1 });
      expect(pieces[0].id).not.toBe("a");
      expect(pieces[1].id).not.toBe("a");
      expect(pieces[0].id).not.toBe(pieces[1].id);
    });

    it("clearTextStyle removes one attribute and keeps the other", () => {
      const state = clearTextStyle(
        createText("hello", [range(0, 5, { highlight: "yellow" })]),
        { start: 0, end: 5 },
        "highlight",
      );

      expect(state.ranges).toHaveLength(1);
      expect(state.ranges[0]).toMatchObject({
        start: 0,
        end: 5,
        color: "red",
      });
      expect("highlight" in state.ranges[0]).toBe(false);
    });

    it("keeps cleared entries within the bound", () => {
      let element = createText("hello");

      for (let index = 0; index < 66; index++) {
        element = withTextStyles(
          { ...element },
          applyTextStyle(element, { start: 0, end: 5 }, { color: "red" }),
        );
      }

      const cleared = element.clearedTextStyleRanges!;
      expect(cleared).toHaveLength(MAX_CLEARED_TEXT_STYLE_RANGES);
      expect(Math.min(...cleared.map((entry) => entry.seq))).toBe(2);
    });
  });

  describe("range cap and seq bound", () => {
    const manyRanges = (count: number, start = 0, end = 1) =>
      Array.from({ length: count }, (_, index) =>
        range(start, end, { id: `r${index}`, seq: index + 1 }),
      );

    it("createTextStyleRanges keeps the highest seq at the cap", () => {
      const ranges = createTextStyleRanges(
        manyRanges(MAX_TEXT_STYLE_RANGES + 5),
        "hello",
      );

      expect(ranges).toHaveLength(MAX_TEXT_STYLE_RANGES);
      expect(Math.min(...ranges!.map((item) => item.seq))).toBe(6);
    });

    it("sanitizeTextStyles keeps the highest seq at the cap", () => {
      const element = createText(
        "hello",
        manyRanges(MAX_TEXT_STYLE_RANGES + 5),
      );

      const result = sanitizeTextStyles(element);

      expect(result.textStyleRanges).toHaveLength(MAX_TEXT_STYLE_RANGES);
      expect(Math.min(...result.textStyleRanges!.map((item) => item.seq))).toBe(
        6,
      );
    });

    it("applyTextStyle at the cap keeps the new range and evicts the lowest", () => {
      const element = createText("hello", manyRanges(MAX_TEXT_STYLE_RANGES));

      const state = applyTextStyle(
        element,
        { start: 1, end: 5 },
        { color: "blue" },
      );

      expect(state.ranges).toHaveLength(MAX_TEXT_STYLE_RANGES);
      expect(
        state.ranges.some(
          (item) => item.color === "blue" && item.start === 1 && item.end === 5,
        ),
      ).toBe(true);
      expect(state.ranges.some((item) => item.id === "r0")).toBe(false);
      expect(state.cleared).toEqual([]);
    });

    it("applyTextStyle never exceeds MAX_TEXT_STYLE_SEQ and the result sanitizes", () => {
      const element = createText("hello", [
        range(0, 1, { id: "top", seq: MAX_TEXT_STYLE_SEQ }),
      ]);

      const state = applyTextStyle(
        element,
        { start: 1, end: 5 },
        { color: "blue" },
      );
      const added = state.ranges.find((item) => item.color === "blue");

      expect(added).toBeDefined();
      expect(added!.seq).toBeLessThanOrEqual(MAX_TEXT_STYLE_SEQ);

      const result = sanitizeTextStyles(withTextStyles({ ...element }, state));
      expect(
        result.textStyleRanges?.some(
          (item) => item.color === "blue" && item.start === 1,
        ),
      ).toBe(true);
    });

    it("sanitizeTextStyles drops a seq above MAX_TEXT_STYLE_SEQ", () => {
      const element = createText(
        "hello",
        [
          range(0, 5, { id: "x", seq: MAX_TEXT_STYLE_SEQ + 1 }),
          range(0, 5, { id: "y", seq: Number.MAX_SAFE_INTEGER }),
          range(0, 5, { id: "ok", seq: 1 }),
        ],
        {
          clearedTextStyleRanges: [
            { id: "c", seq: MAX_TEXT_STYLE_SEQ + 1 },
            { id: "d", seq: Number.MAX_SAFE_INTEGER },
            { id: "e", seq: 2 },
          ],
        },
      );

      const result = sanitizeTextStyles(element);

      expect(result.textStyleRanges?.map((item) => item.id)).toEqual(["ok"]);
      expect(result.clearedTextStyleRanges?.map((item) => item.id)).toEqual([
        "e",
      ]);
    });
  });

  describe("getStyledTextLines", () => {
    it("maps a range across a soft wrap", () => {
      const element = createText("hello\nworld", [range(3, 8)], {
        originalText: "hello world",
      });

      expect(getStyledTextLines(element)).toEqual([
        [
          { start: 0, end: 3 },
          { start: 3, end: 5, color: "red" },
        ],
        [
          { start: 0, end: 2, color: "red" },
          { start: 2, end: 5 },
        ],
      ]);
    });

    it("stays aligned when only the wrapping changes", () => {
      const element = createText("hello world", [range(3, 8)]);

      expect(getStyledTextLines(element)).toEqual([
        [
          { start: 0, end: 3 },
          { start: 3, end: 8, color: "red" },
          { start: 8, end: 11 },
        ],
      ]);
    });

    it("handles hard and empty lines", () => {
      const element = createText("a\n\nb", [range(3, 4)]);

      expect(getStyledTextLines(element)).toEqual([
        null,
        null,
        [{ start: 0, end: 1, color: "red" }],
      ]);
    });

    it("returns null for unstyled text and for a line with no styled run", () => {
      expect(getStyledTextLines(createText("hello"))).toBeNull();

      const lines = getStyledTextLines(createText("a\nb", [range(2, 3)]));

      expect(lines?.[0]).toBeNull();
      expect(lines?.[1]).toEqual([{ start: 0, end: 1, color: "red" }]);
    });

    it("returns null when a line cannot be found in originalText", () => {
      const element = createText("changed", [range(0, 5)], {
        originalText: "hello",
      });

      expect(getStyledTextLines(element)).toBeNull();
    });

    it("leaves an RTL line plain", () => {
      const element = createText("שלום\nworld", [
        range(0, 4),
        range(5, 10, { id: "b", seq: 2 }),
      ]);

      expect(getStyledTextLines(element)).toEqual([
        null,
        [{ start: 0, end: 5, color: "red" }],
      ]);
    });
  });

  describe("getTextStyleRuns", () => {
    it("never splits a surrogate pair", () => {
      const text = "a😀b";
      const runs = getTextStyleRuns(text, 0, [range(0, 2)]);

      expect(runs).toEqual([
        { start: 0, end: 3, color: "red" },
        { start: 3, end: 4 },
      ]);
      expect(text.slice(runs[0].start, runs[0].end)).toBe("a😀");
    });

    it("resolves overlaps by seq per attribute", () => {
      const runs = getTextStyleRuns("abcdefg", 0, [
        range(0, 5, { id: "a", seq: 1, color: "red" }),
        range(2, 7, { id: "b", seq: 2, color: "blue" }),
        {
          id: "c",
          seq: 3,
          start: 0,
          end: 3,
          highlight: "yellow",
        },
      ]);

      expect(runs).toEqual([
        { start: 0, end: 2, color: "red", highlight: "yellow" },
        { start: 2, end: 3, color: "blue", highlight: "yellow" },
        { start: 3, end: 7, color: "blue" },
      ]);
    });
  });

  describe("layoutTextStyleRuns", () => {
    it.each([
      ["left", 0],
      ["center", 45],
      ["right", 90],
    ] as const)("lays runs out from the line start (%s)", (textAlign, x) => {
      const line = "hello world";
      const element = createText(line, undefined, { width: 200, textAlign });
      const first = { start: 0, end: 6, color: "red" };
      const second = { start: 6, end: 11 };

      expect(
        layoutTextStyleRuns(element, line, [first, second], undefined),
      ).toEqual([
        { run: first, x, width: 60 },
        { run: second, x: x + 60, width: 50 },
      ]);
    });
  });

  describe("creation", () => {
    it("createTextStyleRanges fills ids and drops invalid input", () => {
      const ranges = createTextStyleRanges(
        [
          { start: 0, end: 5, color: "red" },
          { start: 0, end: 5, color: "red;x" },
          { start: 3, end: 3, color: "red" },
        ],
        "hello",
      );

      expect(ranges).toHaveLength(1);
      expect(ranges![0].id).toEqual(expect.any(String));
      expect(ranges![0].id).not.toBe("");
      expect(ranges![0].seq).toBe(1);
    });

    it("newTextElement carries ranges and adds no key without them", () => {
      const styled = newTextElement({
        x: 0,
        y: 0,
        text: "hello",
        textStyleRanges: [{ start: 0, end: 5, color: "red" }],
      });
      const plain = newTextElement({ x: 0, y: 0, text: "hello" });

      expect(styled.textStyleRanges).toHaveLength(1);
      expect(styled.textStyleRanges![0].id).toEqual(expect.any(String));
      expect("textStyleRanges" in plain).toBe(false);
    });

    it("convertToExcalidrawElements accepts ranges on text and labels", () => {
      const textStyleRanges = [{ start: 0, end: 5, color: "red" }];
      const elements = convertToExcalidrawElements([
        { type: "text", x: 0, y: 0, text: "hello", textStyleRanges },
        {
          type: "rectangle",
          x: 0,
          y: 100,
          width: 200,
          height: 100,
          label: { text: "hello", textStyleRanges },
        },
      ]);
      const texts = elements.filter(
        (
          element,
        ): element is Extract<typeof elements[number], ExcalidrawTextElement> =>
          element.type === "text",
      );

      expect(texts).toHaveLength(2);
      for (const text of texts) {
        expect(text.textStyleRanges).toHaveLength(1);
        expect(text.textStyleRanges![0].id).toEqual(expect.any(String));
        expect(text.textStyleRanges![0].seq).toEqual(expect.any(Number));
      }
    });

    it("duplicates keep their ranges", () => {
      const element = createText("hello", [range(0, 5)]);

      const duplicate = duplicateElement(null, new Map(), element);

      expect(duplicate.textStyleRanges).toEqual(element.textStyleRanges);
      expect(duplicate.textStyleRanges).not.toBe(element.textStyleRanges);
    });
  });
});
