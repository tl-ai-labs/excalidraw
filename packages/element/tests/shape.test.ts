import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { newElementWith } from "../src/mutateElement";
import {
  ELBOW_ARROW_CORNER_RADIUS,
  generateElbowArrowShape,
  ShapeCache,
} from "../src/shape";

import type { Drawable, Op } from "roughjs/bin/core";

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

describe("arrowhead size", () => {
  const getHead = (
    arrow: Parameters<typeof ShapeCache.generateElementShape>[0],
  ): Drawable => {
    const shape = ShapeCache.generateElementShape(arrow, null);
    if (!Array.isArray(shape)) {
      throw new Error("expected an array shape");
    }
    const head = shape[1];
    if (!head || typeof head === "string") {
      throw new Error("expected an arrowhead drawable");
    }
    return head;
  };

  const getHeadXExtent = (head: Drawable) => {
    const xs: number[] = [];
    for (const set of head.sets) {
      for (const op of set.ops) {
        if (op.op === "bcurveTo") {
          xs.push(op.data[0], op.data[2], op.data[4]);
        } else if (op.op === "lineTo" || op.op === "move") {
          xs.push(op.data[0]);
        }
      }
    }
    return Math.max(...xs) - Math.min(...xs);
  };

  it("draws a smaller arrowhead shape for the small preset", () => {
    const points = [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)];
    const defaultArrow = API.createElement({
      type: "arrow",
      points,
      endArrowhead: "triangle",
      roughness: 0,
    });
    const smallArrow = API.createElement({
      type: "arrow",
      points,
      endArrowhead: "triangle",
      roughness: 0,
      arrowheadSize: "small",
    });
    const defaultHead = getHead(defaultArrow);
    const smallHead = getHead(smallArrow);

    expect(getHeadXExtent(smallHead)).toBeLessThan(getHeadXExtent(defaultHead));
  });

  it("regenerates the shape when the size changes", () => {
    const arrow = API.createElement({
      type: "arrow",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
      endArrowhead: "triangle",
      roughness: 0,
    });
    const cachedHead = getHead(arrow);
    const largeArrow = newElementWith(arrow, { arrowheadSize: "large" });
    const largeHead = getHead(largeArrow);

    expect(largeHead).not.toBe(cachedHead);
    expect(getHeadXExtent(largeHead)).toBeGreaterThan(
      getHeadXExtent(cachedHead),
    );
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
