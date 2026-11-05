import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import {
  ELBOW_ARROW_CORNER_RADIUS,
  generateElbowArrowShape,
  ShapeCache,
} from "../src/shape";
import { getCanvasPadding } from "../src/renderElement";

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

  it("generates arrowhead shapes for line elements and omits them when null", () => {
    const points = [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)];
    const withHeads = API.createElement({
      type: "line",
      points,
      startArrowhead: "arrow",
      endArrowhead: "arrow",
    });
    const withEnd = API.createElement({
      type: "line",
      points,
      startArrowhead: null,
      endArrowhead: "arrow",
    });
    const withoutHeads = API.createElement({
      type: "line",
      points,
      startArrowhead: null,
      endArrowhead: null,
    });

    expect(
      ShapeCache.generateElementShape(withHeads, null).length,
    ).toBeGreaterThan(1);
    expect(
      ShapeCache.generateElementShape(withEnd, null).length,
    ).toBeGreaterThan(1);
    expect(ShapeCache.generateElementShape(withoutHeads, null)).toHaveLength(1);
  });

  it.each(["arrow", "line"] as const)(
    "scales %s arrowhead shapes with arrowheadSize",
    (type) => {
      const getSpread = (
        arrowhead: "arrow" | "triangle" | "bar",
        arrowheadSize: number,
      ) => {
        const element = API.createElement({
          type,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
          startArrowhead: null,
          endArrowhead: arrowhead,
          roughness: 0,
          arrowheadSize,
        });
        const drawables = ShapeCache.generateElementShape(element, null);
        let spread = 0;
        for (const set of drawables[1].sets) {
          for (const op of set.ops) {
            for (let i = 0; i + 1 < op.data.length; i += 2) {
              spread = Math.max(
                spread,
                Math.hypot(op.data[i] - 200, op.data[i + 1]),
              );
            }
          }
        }
        return spread;
      };

      for (const arrowhead of ["arrow", "triangle", "bar"] as const) {
        const base = getSpread(arrowhead, 1);
        expect(base).toBeGreaterThan(0);
        expect(getSpread(arrowhead, 0.5) / base).toBeCloseTo(0.5, 1);
        expect(getSpread(arrowhead, 1.5) / base).toBeCloseTo(1.5, 1);
      }
    },
  );
});

describe("getCanvasPadding", () => {
  const points = [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)];

  it.each(["arrow", "line"] as const)(
    "scales padding for %s elements with arrowheads",
    (type) => {
      for (const head of ["startArrowhead", "endArrowhead"] as const) {
        const create = (arrowheadSize?: number) =>
          API.createElement({
            type,
            points,
            startArrowhead: null,
            endArrowhead: null,
            [head]: "arrow",
            arrowheadSize,
          });

        expect(getCanvasPadding(create(1.5))).toBe(60);
        expect(getCanvasPadding(create())).toBe(40);
        expect(getCanvasPadding(create(1))).toBe(40);
        expect(getCanvasPadding(create(0.5))).toBe(40);
      }

      const noHeads = API.createElement({
        type,
        points,
        startArrowhead: null,
        endArrowhead: null,
        arrowheadSize: 1.5,
      });
      expect(getCanvasPadding(noHeads)).toBe(20);
    },
  );
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
