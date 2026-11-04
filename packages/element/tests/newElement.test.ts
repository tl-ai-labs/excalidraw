import * as common from "@excalidraw/common";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import {
  newArrowElement,
  newElement,
  newLinearElement,
} from "../src/newElement";
import { mutateElement, newElementWith } from "../src/mutateElement";

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

describe("arrowheadSize on new linear elements", () => {
  it("newLinearElement leaves out arrowheadSize unless given", () => {
    const without = newLinearElement({ type: "line", x: 0, y: 0 });
    expect(without).not.toHaveProperty("arrowheadSize");

    const withSize = newLinearElement({
      type: "line",
      x: 0,
      y: 0,
      arrowheadSize: "small",
    });
    expect(withSize.arrowheadSize).toBe("small");
  });

  it.each([false, true])(
    "newArrowElement leaves out arrowheadSize unless given (elbowed: %s)",
    (elbowed) => {
      const without = newArrowElement({
        type: "arrow",
        x: 0,
        y: 0,
        elbowed,
      });
      expect(without).not.toHaveProperty("arrowheadSize");

      const withSize = newArrowElement({
        type: "arrow",
        x: 0,
        y: 0,
        elbowed,
        arrowheadSize: "large",
      });
      expect(withSize.arrowheadSize).toBe("large");
    },
  );
});
