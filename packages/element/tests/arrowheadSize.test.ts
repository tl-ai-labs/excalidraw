import { describe, expect, it } from "vitest";
import { arrayToMap } from "@excalidraw/common";
import {
  ARROWHEAD_SIZE_KEYS,
  getArrowheadSizeScale,
  isArrowheadSize,
} from "@excalidraw/common";
import { pointFrom, pointRotateRads } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import {
  elementsOverlappingBBox,
  getArrowheadAngle,
  getArrowheadPoints,
  getArrowheadSize,
  getElementAbsoluteCoords,
  getElementBounds,
} from "../src/bounds";
import { hitElementItself } from "../src/collision";
import { newElementWith } from "../src/mutateElement";
import { newArrowElement, newLinearElement } from "../src/newElement";
import { ShapeCache } from "../src/shape";

import type { ArrowheadSize } from "../src/types";

describe("arrowhead size", () => {
  describe("constants and scaling", () => {
    it("maps presets to scale factors", () => {
      expect(getArrowheadSizeScale("small")).toBe(0.6);
      expect(getArrowheadSizeScale("medium")).toBe(1);
      expect(getArrowheadSizeScale("large")).toBe(1.5);
      expect(getArrowheadSizeScale(null)).toBe(1);
      expect(getArrowheadSizeScale(undefined)).toBe(1);
      expect(getArrowheadSizeScale("huge" as ArrowheadSize)).toBe(1);

      expect(isArrowheadSize("small")).toBe(true);
      expect(isArrowheadSize("medium")).toBe(true);
      expect(isArrowheadSize("large")).toBe(true);
      expect(isArrowheadSize("huge")).toBe(false);
      expect(isArrowheadSize(null)).toBe(false);
      expect(isArrowheadSize(undefined)).toBe(false);
      expect(isArrowheadSize(1)).toBe(false);
      expect(isArrowheadSize({})).toBe(false);
      expect(ARROWHEAD_SIZE_KEYS).toEqual(["small", "medium", "large"]);
    });

    it("scales the base size", () => {
      expect(getArrowheadSize("arrow")).toBe(25);
      expect(getArrowheadSize("arrow", 1.5)).toBe(37.5);
      expect(getArrowheadSize("arrow", 0.6)).toBe(15);
    });

    it("keeps the arrow head's angle proportions at any scale", () => {
      // ARROW_ARROWHEAD_WIDEST_SIZE is 10 in bounds.ts
      for (const scale of [0.6, 1.5]) {
        const fullSize = getArrowheadSize("arrow", scale);
        const widestSize = 10 * scale;
        expect(getArrowheadAngle("arrow", fullSize, scale)).toBe(20);
        expect(getArrowheadAngle("arrow", widestSize, scale)).toBe(30);
      }
    });
  });

  describe("head points geometry", () => {
    const createStraightArrow = (arrowheadSize?: ArrowheadSize | null) =>
      API.createElement({
        type: "arrow",
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
        endArrowhead: "triangle",
        arrowheadSize,
        roughness: 0,
        strokeWidth: 2,
      });

    it("no field and medium give today's head points", () => {
      for (const endArrowhead of [
        "triangle" as const,
        "arrow" as const,
        "cardinality_one_or_many" as const,
      ]) {
        const base = API.createElement({
          type: "arrow",
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
          endArrowhead,
          roughness: 0,
          strokeWidth: 2,
        });
        const nullSize = API.createElement({
          type: "arrow",
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
          endArrowhead,
          arrowheadSize: null,
          roughness: 0,
          strokeWidth: 2,
        });
        const medium = API.createElement({
          type: "arrow",
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
          endArrowhead,
          arrowheadSize: "medium",
          roughness: 0,
          strokeWidth: 2,
        });

        const basePoints = getArrowheadPoints(
          base,
          ShapeCache.generateElementShape(base, null),
          "end",
          endArrowhead,
        );
        const nullPoints = getArrowheadPoints(
          nullSize,
          ShapeCache.generateElementShape(nullSize, null),
          "end",
          endArrowhead,
        );
        const mediumPoints = getArrowheadPoints(
          medium,
          ShapeCache.generateElementShape(medium, null),
          "end",
          endArrowhead,
        );

        expect(nullPoints).toEqual(basePoints);
        expect(mediumPoints).toEqual(basePoints);
      }
    });

    it("small and large heads scale the head extent", () => {
      const base = createStraightArrow();
      const small = createStraightArrow("small");
      const large = createStraightArrow("large");

      const basePts = getArrowheadPoints(
        base,
        ShapeCache.generateElementShape(base, null),
        "end",
        "triangle",
      )!;
      const smallPts = getArrowheadPoints(
        small,
        ShapeCache.generateElementShape(small, null),
        "end",
        "triangle",
      )!;
      const largePts = getArrowheadPoints(
        large,
        ShapeCache.generateElementShape(large, null),
        "end",
        "triangle",
      )!;

      // base tip is at (200, 0); corner points are (x1, y1) and (x2, y2)
      const baseDist = 200 - basePts[2];
      const smallDist = 200 - smallPts[2];
      const largeDist = 200 - largePts[2];

      expect(smallDist).toBeCloseTo(baseDist * 0.6);
      expect(largeDist).toBeCloseTo(baseDist * 1.5);
    });

    it("a short last segment still clamps a large head", () => {
      const arrowMedium = API.createElement({
        type: "arrow",
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(20, 0)],
        endArrowhead: "arrow",
        arrowheadSize: "medium",
        roughness: 0,
        strokeWidth: 2,
      });
      const arrowLarge = API.createElement({
        type: "arrow",
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(20, 0)],
        endArrowhead: "arrow",
        arrowheadSize: "large",
        roughness: 0,
        strokeWidth: 2,
      });

      const ptsMed = getArrowheadPoints(
        arrowMedium,
        ShapeCache.generateElementShape(arrowMedium, null),
        "end",
        "arrow",
      )!;
      const ptsLarge = getArrowheadPoints(
        arrowLarge,
        ShapeCache.generateElementShape(arrowLarge, null),
        "end",
        "arrow",
      )!;

      const lengthMed = 20 - (ptsMed[2] + ptsMed[4]) / 2;
      const lengthLarge = 20 - (ptsLarge[2] + ptsLarge[4]) / 2;

      expect(lengthLarge).toBeLessThan(37.5);
      expect(lengthLarge).toBeLessThanOrEqual(lengthMed * 1.5 + 0.001);
    });
  });

  describe("element bounds and hit testing", () => {
    const createStraightArrow = (arrowheadSize?: ArrowheadSize | null) =>
      API.createElement({
        type: "arrow",
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
        endArrowhead: "triangle",
        arrowheadSize,
        roughness: 0,
        strokeWidth: 2,
      });

    it("large heads widen the element bounds", () => {
      const base = createStraightArrow();
      const large = createStraightArrow("large");

      const baseBounds = getElementBounds(base, arrayToMap([base]));
      const largeBounds = getElementBounds(large, arrayToMap([large]));

      expect(largeBounds[3] - largeBounds[1]).toBeGreaterThan(
        baseBounds[3] - baseBounds[1],
      );

      const largePts = getArrowheadPoints(
        large,
        ShapeCache.generateElementShape(large, null),
        "end",
        "triangle",
      )!;

      for (let i = 0; i < largePts.length; i += 2) {
        const px = large.x + largePts[i];
        const py = large.y + largePts[i + 1];
        expect(px).toBeGreaterThanOrEqual(largeBounds[0] - 0.001);
        expect(px).toBeLessThanOrEqual(largeBounds[2] + 0.001);
        expect(py).toBeGreaterThanOrEqual(largeBounds[1] - 0.001);
        expect(py).toBeLessThanOrEqual(largeBounds[3] + 0.001);
      }
    });

    it("small, medium and lines keep today's bounds", () => {
      const base = createStraightArrow();
      const small = createStraightArrow("small");
      const medium = createStraightArrow("medium");

      const baseBounds = getElementBounds(base, arrayToMap([base]));
      expect(getElementBounds(small, arrayToMap([small]))).toEqual(baseBounds);
      expect(getElementBounds(medium, arrayToMap([medium]))).toEqual(
        baseBounds,
      );

      const lineBase = API.createElement({
        type: "line",
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
        strokeWidth: 2,
      });
      const lineLarge = API.createElement({
        type: "line",
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
        arrowheadSize: "large",
        strokeWidth: 2,
      });
      expect(getElementBounds(lineLarge, arrayToMap([lineLarge]))).toEqual(
        getElementBounds(lineBase, arrayToMap([lineBase])),
      );
    });

    it("hit results are unchanged at small and medium", () => {
      const base = createStraightArrow();
      const small = createStraightArrow("small");
      const medium = createStraightArrow("medium");

      const pointsToTest = [
        pointFrom<GlobalPoint>(base.x + 100, base.y),
        pointFrom<GlobalPoint>(base.x + 100, base.y + 5),
        pointFrom<GlobalPoint>(base.x + 185, base.y + 5),
      ];

      for (const pt of pointsToTest) {
        const baseHit = hitElementItself({
          point: pt,
          element: base,
          threshold: 10,
          elementsMap: arrayToMap([base]),
        });
        const smallHit = hitElementItself({
          point: pt,
          element: small,
          threshold: 10,
          elementsMap: arrayToMap([small]),
        });
        const mediumHit = hitElementItself({
          point: pt,
          element: medium,
          threshold: 10,
          elementsMap: arrayToMap([medium]),
        });

        expect(smallHit).toBe(baseHit);
        expect(mediumHit).toBe(baseHit);
      }
    });

    it("the precise test stays shaft-only at large", () => {
      const large = createStraightArrow("large");
      const elementsMap = arrayToMap([large]);

      const shaftHit = hitElementItself({
        point: pointFrom(large.x + 100, large.y),
        element: large,
        threshold: 10,
        elementsMap,
      });
      const farHit = hitElementItself({
        point: pointFrom(large.x + 100, large.y + 60),
        element: large,
        threshold: 10,
        elementsMap,
      });

      expect(shaftHit).toBe(true);
      expect(farHit).toBe(false);
    });

    it("box selection follows a large head", () => {
      const base = createStraightArrow();
      const large = createStraightArrow("large");

      const largeBounds = getElementBounds(large, arrayToMap([large]));
      // shaft is from 0 to 200 at y=0, margin 5px vertically doesn't cover large head
      const containBox: [number, number, number, number] = [
        base.x - 5,
        base.y - 5,
        base.x + 205,
        base.y + 5,
      ];

      expect(largeBounds[1]).toBeLessThan(containBox[1]);
      expect(largeBounds[3]).toBeGreaterThan(containBox[3]);

      const selBase = elementsOverlappingBBox({
        elements: [base],
        bounds: containBox,
        type: "contain",
      });
      const selLarge = elementsOverlappingBBox({
        elements: [large],
        bounds: containBox,
        type: "contain",
      });

      expect(selBase).toEqual([base]);
      expect(selLarge).toEqual([]);
    });

    it("changing the size refreshes cached bounds", () => {
      const arrow = createStraightArrow();
      const bounds1 = getElementBounds(arrow, arrayToMap([arrow]));
      const updated = newElementWith(arrow, { arrowheadSize: "large" });
      const bounds2 = getElementBounds(updated, arrayToMap([updated]));

      expect(bounds2[3] - bounds2[1]).toBeGreaterThan(bounds1[3] - bounds1[1]);
    });

    it("has equal bounds for large arrow without arrowheads", () => {
      const arrowNoHeadBase = API.createElement({
        type: "arrow",
        x: 0,
        y: 0,
        width: 100,
        height: 0,
        roughness: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
        startArrowhead: null,
        endArrowhead: null,
      });
      const arrowNoHeadLarge = API.createElement({
        type: "arrow",
        x: 0,
        y: 0,
        width: 100,
        height: 0,
        roughness: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
        startArrowhead: null,
        endArrowhead: null,
        arrowheadSize: "large",
      });

      const baseBounds = getElementBounds(
        arrowNoHeadBase,
        arrayToMap([arrowNoHeadBase]),
      );
      const largeBounds = getElementBounds(
        arrowNoHeadLarge,
        arrayToMap([arrowNoHeadLarge]),
      );
      expect(largeBounds).toEqual(baseBounds);
    });

    it.each([
      { endArrowhead: "arrow" as const, angle: 0 },
      { endArrowhead: "arrow" as const, angle: Math.PI / 4 },
      { endArrowhead: "triangle" as const, angle: 0 },
      { endArrowhead: "triangle" as const, angle: Math.PI / 4 },
      { endArrowhead: "bar" as const, angle: 0 },
      { endArrowhead: "bar" as const, angle: Math.PI / 4 },
      { endArrowhead: "circle" as const, angle: 0 },
      { endArrowhead: "circle" as const, angle: Math.PI / 4 },
      { endArrowhead: "circle_outline" as const, angle: 0 },
      { endArrowhead: "circle_outline" as const, angle: Math.PI / 4 },
      { endArrowhead: "diamond" as const, angle: 0 },
      { endArrowhead: "diamond" as const, angle: Math.PI / 4 },
      { endArrowhead: "cardinality_many" as const, angle: 0 },
      { endArrowhead: "cardinality_many" as const, angle: Math.PI / 4 },
      { endArrowhead: "cardinality_one_or_many" as const, angle: 0 },
      { endArrowhead: "cardinality_one_or_many" as const, angle: Math.PI / 4 },
      { endArrowhead: "cardinality_zero_or_one" as const, angle: 0 },
      { endArrowhead: "cardinality_zero_or_one" as const, angle: Math.PI / 4 },
      { endArrowhead: "cardinality_exactly_one" as const, angle: 0 },
      { endArrowhead: "cardinality_exactly_one" as const, angle: Math.PI / 4 },
      { endArrowhead: "cardinality_zero_or_many" as const, angle: 0 },
      { endArrowhead: "cardinality_zero_or_many" as const, angle: Math.PI / 4 },
      { endArrowhead: "arrow" as const, angle: Math.PI / 2 },
      { endArrowhead: "arrow" as const, angle: Math.PI },
      {
        startArrowhead: "triangle" as const,
        endArrowhead: null,
        angle: Math.PI / 4,
      },
    ])(
      "covers drawn arrowhead bounds for $endArrowhead / $startArrowhead at angle $angle",
      ({ startArrowhead, endArrowhead, angle }) => {
        const baseEl = API.createElement({
          type: "arrow",
          x: 0,
          y: 0,
          width: 100,
          height: 0,
          roughness: 0,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
          angle,
          startArrowhead,
          endArrowhead,
        });
        const largeEl = API.createElement({
          type: "arrow",
          x: 0,
          y: 0,
          width: 100,
          height: 0,
          roughness: 0,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
          angle,
          startArrowhead,
          endArrowhead,
          arrowheadSize: "large",
        });

        const baseMap = arrayToMap([baseEl]);
        const largeMap = arrayToMap([largeEl]);
        const baseBounds = getElementBounds(baseEl, baseMap);
        const largeBounds = getElementBounds(largeEl, largeMap);

        const baseWidth = baseBounds[2] - baseBounds[0];
        const baseHeight = baseBounds[3] - baseBounds[1];
        const largeWidth = largeBounds[2] - largeBounds[0];
        const largeHeight = largeBounds[3] - largeBounds[1];

        expect(largeWidth).toBeGreaterThanOrEqual(baseWidth - 0.5);
        expect(largeHeight).toBeGreaterThanOrEqual(baseHeight - 0.5);

        const [, , , , cx, cy] = getElementAbsoluteCoords(largeEl, largeMap);
        const headDrawables = ShapeCache.generateElementShape(
          largeEl,
          null,
        ).slice(1);

        for (const drawable of headDrawables) {
          for (const set of drawable.sets) {
            for (const op of set.ops) {
              for (let i = 0; i < op.data.length; i += 2) {
                const rotated = pointRotateRads(
                  pointFrom<GlobalPoint>(
                    largeEl.x + op.data[i],
                    largeEl.y + op.data[i + 1],
                  ),
                  pointFrom<GlobalPoint>(cx, cy),
                  largeEl.angle,
                );
                expect(rotated[0]).toBeGreaterThanOrEqual(largeBounds[0] - 0.5);
                expect(rotated[0]).toBeLessThanOrEqual(largeBounds[2] + 0.5);
                expect(rotated[1]).toBeGreaterThanOrEqual(largeBounds[1] - 0.5);
                expect(rotated[1]).toBeLessThanOrEqual(largeBounds[3] + 0.5);
              }
            }
          }
        }
      },
    );
  });

  describe("element factories", () => {
    it("factories write no key without a size", () => {
      const arrowUndefined = newArrowElement({
        type: "arrow",
        x: 0,
        y: 0,
        arrowheadSize: undefined,
      });
      const arrowNull = newArrowElement({
        type: "arrow",
        x: 0,
        y: 0,
        arrowheadSize: null,
      });
      const arrowSmall = newArrowElement({
        type: "arrow",
        x: 0,
        y: 0,
        arrowheadSize: "small",
      });

      expect("arrowheadSize" in arrowUndefined).toBe(false);
      expect("arrowheadSize" in arrowNull).toBe(false);
      expect(arrowSmall.arrowheadSize).toBe("small");

      const linearUndefined = newLinearElement({
        type: "line",
        x: 0,
        y: 0,
        arrowheadSize: undefined,
      });
      const linearNull = newLinearElement({
        type: "line",
        x: 0,
        y: 0,
        arrowheadSize: null,
      });
      const linearSmall = newLinearElement({
        type: "line",
        x: 0,
        y: 0,
        arrowheadSize: "small",
      });

      expect("arrowheadSize" in linearUndefined).toBe(false);
      expect("arrowheadSize" in linearNull).toBe(false);
      expect(linearSmall.arrowheadSize).toBe("small");
    });
  });
});
