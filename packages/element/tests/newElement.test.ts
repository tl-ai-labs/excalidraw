import * as common from "@excalidraw/common";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import {
  newElement,
  newLinearElement,
  newTextElement,
} from "../src/newElement";
import { mutateElement, newElementWith } from "../src/mutateElement";
import { duplicateElement } from "../src/duplicate";

describe("element creation time", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    "rectangle",
    "diamond",
    "ellipse",
    "text",
    "line",
    "arrow",
    "freedraw",
    "image",
    "frame",
    "magicframe",
    "embeddable",
    "iframe",
  ] as const)("initializes a new %s before any capture", (type) => {
    vi.spyOn(common, "getUpdatedTimestamp").mockReturnValue(123);
    const element = API.createElement({ type });
    expect(element.created).toBe(123);

    vi.mocked(common.getUpdatedTimestamp).mockReturnValue(456);
    const edited = newElementWith(element, { x: 50 });
    mutateElement(edited, new Map(), { y: 50 });

    expect(edited).toMatchObject({ created: 123, updated: 456 });
  });

  it.each([123, 0, null])(
    "preserves explicit created=%s when reconstructing the same element",
    (created) => {
      const original = newElement({
        type: "rectangle",
        x: 0,
        y: 0,
        created,
      });
      const converted = newLinearElement({ ...original, type: "line" });

      expect(converted).toMatchObject({ id: original.id, created });
    },
  );
});

describe("text style ranges", () => {
  it("normalises styleRanges against originalText", () => {
    const element = newTextElement({
      x: 0,
      y: 0,
      text: "hello",
      styleRanges: [
        { start: 3, end: 99, strokeColor: "#f00" },
        { start: 0, end: 0, strokeColor: "#0f0" },
      ],
    });
    expect(element.styleRanges).toEqual([
      { start: 3, end: 5, strokeColor: "#f00" },
    ]);
  });

  it("omits styleRanges without runs", () => {
    const withoutRanges = newTextElement({
      x: 0,
      y: 0,
      text: "hello",
    });
    const emptyRanges = newTextElement({
      x: 0,
      y: 0,
      text: "hello",
      styleRanges: [],
    });
    expect("styleRanges" in withoutRanges).toBe(false);
    expect("styleRanges" in emptyRanges).toBe(false);
  });

  it("duplicates do not share the styleRanges array", () => {
    const original = newTextElement({
      x: 0,
      y: 0,
      text: "hello",
      styleRanges: [{ start: 0, end: 2, strokeColor: "#f00" }],
    });
    const copy = duplicateElement(null, new Map(), original);
    expect(copy.styleRanges).toEqual(original.styleRanges);
    expect(copy.styleRanges).not.toBe(original.styleRanges);
  });
});
