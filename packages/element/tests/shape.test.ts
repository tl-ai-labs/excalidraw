import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import {
  ELBOW_ARROW_CORNER_RADIUS,
  generateElbowArrowShape,
  ShapeCache,
} from "../src/shape";

import type { Op } from "roughjs/bin/core";

describe("arrowhead shapes", () => {
  it.each(["triangle", "diamond_outline", "circle"] as const)(
    "fills %s arrowheads along their outline",
    (arrowhead) => {
      const arrow = API.createElement({
        type: "arrow",
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
        endArrowhead: arrowhead,
        roughness: 2,
      });
      const [, head] = ShapeCache.generateElementShape(arrow, null);
      const [fill, outline] = head.sets;
      const getCurves = (ops: Op[]) =>
        ops.filter((op) => op.op === "bcurveTo").map((op) => op.data);

      expect(fill.type).toBe("fillPath");
      expect(outline.type).toBe("path");
      // the fill only joins up the outline's curves
      expect(getCurves(fill.ops)).toEqual(getCurves(outline.ops));
    },
  );
});

describe("arrowhead size shapes", () => {
  const getHead = (arrowheadSize?: "small" | "medium" | "large") => {
    const arrow = API.createElement({
      type: "arrow",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
      endArrowhead: "triangle",
      roughness: 0,
      arrowheadSize,
    });
    return ShapeCache.generateElementShape(arrow, null)[1];
  };

  // the shaft lies on y = 0, so the head's y coordinates give its height
  const getExtent = (head: ReturnType<typeof getHead>) => {
    const ys = head.sets.flatMap((set) =>
      set.ops.flatMap((op) => op.data.filter((_, i) => i % 2 === 1)),
    );
    return Math.max(...ys) - Math.min(...ys);
  };

  it("draws larger head shapes for larger arrowhead sizes", () => {
    const small = getExtent(getHead("small"));
    const absent = getExtent(getHead());
    const large = getExtent(getHead("large"));

    expect(large).toBeGreaterThan(absent);
    expect(absent).toBeGreaterThan(small);
  });

  it("draws medium head shapes like heads without arrowheadSize", () => {
    expect(getHead("medium").sets).toEqual(getHead().sets);
  });
});

describe("elbow arrow shapes", () => {
  const getCorners = (points: [number, number][]) =>
    generateElbowArrowShape(
      points.map(([x, y]) => pointFrom<LocalPoint>(x, y)),
      ELBOW_ARROW_CORNER_RADIUS,
    ).match(/Q/g)?.length ?? 0;

  it("draws a jog too short to see straight", () => {
    // a fixed segment lined up with the first one, while dragging
    expect(
      getCorners([
        [0, 0],
        [44, 0],
        [44, -1e-12],
        [195, -1e-12],
        [195, 34],
      ]),
    ).toBe(1);
  });

  it("keeps the corners of short segments in a row", () => {
    expect(
      getCorners([
        [0, 0],
        [100, 0],
        [100, 0.5],
        [100.5, 0.5],
        [100.5, 100],
      ]),
    ).toBe(3);
  });

  it("keeps a short U-turn", () => {
    expect(
      getCorners([
        [0, 0],
        [100, 0],
        [100, 0.5],
        [0, 0.5],
        [0, 50],
      ]),
    ).toBe(3);
  });
});
