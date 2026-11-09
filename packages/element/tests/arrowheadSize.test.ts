import { arrayToMap } from "@excalidraw/common";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { getArrowheadPoints, getElementBounds } from "../src/bounds";
import { newArrowElement, newLinearElement } from "../src/newElement";
import { ShapeCache } from "../src/shape";
import { convertToExcalidrawElements } from "../src/transform";
import { isLinearElement } from "../src/typeChecks";

import type { ArrowheadSize } from "../src/types";

describe("arrowheadSize", () => {
  it("keeps today's head without a size", () => {
    const arrow = API.createElement({
      type: "arrow",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
      roughness: 0,
      strokeWidth: 2,
      endArrowhead: "arrow",
    });

    expect(Object.prototype.hasOwnProperty.call(arrow, "arrowheadSize")).toBe(
      false,
    );

    const shape = ShapeCache.generateElementShape(arrow, null);
    const points = getArrowheadPoints(arrow, shape, "end", "arrow");

    expect(points).not.toBeNull();
    const [tipX, tipY, x3, y3, x4, y4] = points!;

    expect(tipX).toBeCloseTo(100);
    expect(tipY).toBeCloseTo(0);

    const dist1 = Math.hypot(x3 - tipX, y3 - tipY);
    const dist2 = Math.hypot(x4 - tipX, y4 - tipY);
    expect(dist1).toBeCloseTo(25);
    expect(dist2).toBeCloseTo(25);
  });

  it("drops the default size at creation", () => {
    const invalidSize = "huge" as ArrowheadSize;
    const baseOpts = {
      x: 0,
      y: 0,
      strokeColor: "#000000",
      backgroundColor: "transparent",
      fillStyle: "solid" as const,
      strokeWidth: 1,
      strokeStyle: "solid" as const,
      roughness: 1,
      opacity: 100,
    };

    const arrowMedium = newArrowElement({
      ...baseOpts,
      type: "arrow",
      arrowheadSize: "medium",
    });
    const arrowInvalid = newArrowElement({
      ...baseOpts,
      type: "arrow",
      arrowheadSize: invalidSize,
    });
    const arrowSmall = newArrowElement({
      ...baseOpts,
      type: "arrow",
      arrowheadSize: "small",
    });

    expect(
      Object.prototype.hasOwnProperty.call(arrowMedium, "arrowheadSize"),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(arrowInvalid, "arrowheadSize"),
    ).toBe(false);
    expect(arrowSmall.arrowheadSize).toBe("small");

    const lineMedium = newLinearElement({
      ...baseOpts,
      type: "line",
      arrowheadSize: "medium",
    });
    const lineInvalid = newLinearElement({
      ...baseOpts,
      type: "line",
      arrowheadSize: invalidSize,
    });
    const lineSmall = newLinearElement({
      ...baseOpts,
      type: "line",
      arrowheadSize: "small",
    });

    expect(
      Object.prototype.hasOwnProperty.call(lineMedium, "arrowheadSize"),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(lineInvalid, "arrowheadSize"),
    ).toBe(false);
    expect(lineSmall.arrowheadSize).toBe("small");
  });

  describe("scales a head proportionally", () => {
    it.each([
      ["small", 0.5],
      ["medium", 1],
      ["large", 1.5],
    ] as const)("scales circle head for size %s (scale %s)", (size, scale) => {
      const baseArrow = API.createElement({
        type: "arrow",
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
        roughness: 0,
        strokeWidth: 2,
        endArrowhead: "circle",
      });
      const arrow = { ...baseArrow, arrowheadSize: size };
      const shape = ShapeCache.generateElementShape(arrow, null);
      const points = getArrowheadPoints(arrow, shape, "end", "circle");

      expect(points).not.toBeNull();
      const [, , diameter] = points!;
      expect(diameter).toBeCloseTo(15 * scale);
    });

    it.each([
      ["small", 0.5],
      ["medium", 1],
      ["large", 1.5],
    ] as const)("scales arrow head for size %s (scale %s)", (size, scale) => {
      const baseArrow = API.createElement({
        type: "arrow",
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
        roughness: 0,
        strokeWidth: 2,
        endArrowhead: "arrow",
      });

      const defaultShape = ShapeCache.generateElementShape(baseArrow, null);
      const defaultPoints = getArrowheadPoints(
        baseArrow,
        defaultShape,
        "end",
        "arrow",
      )!;
      const defaultAngle = Math.atan2(
        defaultPoints[3] - defaultPoints[1],
        defaultPoints[2] - defaultPoints[0],
      );

      const arrow = { ...baseArrow, arrowheadSize: size };
      const shape = ShapeCache.generateElementShape(arrow, null);
      const points = getArrowheadPoints(arrow, shape, "end", "arrow");

      expect(points).not.toBeNull();
      const [tipX, tipY, x3, y3, x4, y4] = points!;

      const dist1 = Math.hypot(x3 - tipX, y3 - tipY);
      const dist2 = Math.hypot(x4 - tipX, y4 - tipY);
      expect(dist1).toBeCloseTo(25 * scale);
      expect(dist2).toBeCloseTo(25 * scale);

      const angle1 = Math.atan2(y3 - tipY, x3 - tipX);
      expect(angle1).toBeCloseTo(defaultAngle);
    });
  });

  describe("composes with short-segment fitting", () => {
    it.each([
      [undefined, 1, 10],
      [undefined, 1, 20],
      [undefined, 1, 100],
      ["small" as const, 0.5, 10],
      ["small" as const, 0.5, 20],
      ["small" as const, 0.5, 100],
    ])(
      "computes circle diameter correctly for size %s and length %s",
      (size, scale, L) => {
        const baseArrow = API.createElement({
          type: "arrow",
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(L, 0)],
          roughness: 0,
          strokeWidth: 2,
          endArrowhead: "circle",
        });
        const arrow =
          size !== undefined
            ? { ...baseArrow, arrowheadSize: size }
            : baseArrow;
        const shape = ShapeCache.generateElementShape(arrow, null);
        const points = getArrowheadPoints(arrow, shape, "end", "circle");

        expect(points).not.toBeNull();
        const [, , diameter] = points!;
        expect(diameter).toBeCloseTo(Math.min(15 * scale, L * 0.5));
      },
    );
  });

  it("grows bounds only for a larger head", () => {
    const baseArrow = API.createElement({
      type: "arrow",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
      roughness: 0,
      strokeWidth: 2,
      endArrowhead: "arrow",
    });

    const noHeadArrow = API.createElement({
      type: "arrow",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
      roughness: 0,
      strokeWidth: 2,
      endArrowhead: null,
    });

    const smallArrow = { ...baseArrow, arrowheadSize: "small" as const };
    const largeArrow = { ...baseArrow, arrowheadSize: "large" as const };

    const noHeadBounds = getElementBounds(
      noHeadArrow,
      arrayToMap([noHeadArrow]),
    );
    const defaultBounds = getElementBounds(baseArrow, arrayToMap([baseArrow]));
    const smallBounds = getElementBounds(smallArrow, arrayToMap([smallArrow]));
    const largeBounds = getElementBounds(largeArrow, arrayToMap([largeArrow]));

    expect(defaultBounds[0]).toBeCloseTo(noHeadBounds[0]);
    expect(defaultBounds[1]).toBeCloseTo(noHeadBounds[1]);
    expect(defaultBounds[2]).toBeCloseTo(noHeadBounds[2]);
    expect(defaultBounds[3]).toBeCloseTo(noHeadBounds[3]);

    expect(smallBounds[0]).toBeCloseTo(defaultBounds[0]);
    expect(smallBounds[1]).toBeCloseTo(defaultBounds[1]);
    expect(smallBounds[2]).toBeCloseTo(defaultBounds[2]);
    expect(smallBounds[3]).toBeCloseTo(defaultBounds[3]);

    const largeHeight = largeBounds[3] - largeBounds[1];
    expect(largeHeight).toBeGreaterThan(0);

    const largeShape = ShapeCache.generateElementShape(largeArrow, null);
    const points = getArrowheadPoints(largeArrow, largeShape, "end", "arrow")!;
    const [, , x3, y3, x4, y4] = points;

    const globalX3 = largeArrow.x + x3;
    const globalY3 = largeArrow.y + y3;
    const globalX4 = largeArrow.x + x4;
    const globalY4 = largeArrow.y + y4;

    expect(globalX3).toBeGreaterThanOrEqual(largeBounds[0]);
    expect(globalX3).toBeLessThanOrEqual(largeBounds[2]);
    expect(globalY3).toBeGreaterThanOrEqual(largeBounds[1]);
    expect(globalY3).toBeLessThanOrEqual(largeBounds[3]);

    expect(globalX4).toBeGreaterThanOrEqual(largeBounds[0]);
    expect(globalX4).toBeLessThanOrEqual(largeBounds[2]);
    expect(globalY4).toBeGreaterThanOrEqual(largeBounds[1]);
    expect(globalY4).toBeLessThanOrEqual(largeBounds[3]);
  });

  it("passes the size through the skeleton API", () => {
    const elements = convertToExcalidrawElements([
      { type: "arrow", x: 0, y: 0, arrowheadSize: "small" },
      { type: "arrow", x: 0, y: 50 },
    ]);

    expect(
      isLinearElement(elements[0]) ? elements[0].arrowheadSize : undefined,
    ).toBe("small");
    expect(
      Object.prototype.hasOwnProperty.call(elements[1], "arrowheadSize"),
    ).toBe(false);
  });

  it("renders an unknown size at default", () => {
    const baseArrow = API.createElement({
      type: "arrow",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
      roughness: 0,
      strokeWidth: 2,
      endArrowhead: "circle",
    });

    const unknownArrow = {
      ...baseArrow,
      arrowheadSize: "huge" as ArrowheadSize,
    };

    const defaultShape = ShapeCache.generateElementShape(baseArrow, null);
    const defaultPoints = getArrowheadPoints(
      baseArrow,
      defaultShape,
      "end",
      "circle",
    );

    const unknownShape = ShapeCache.generateElementShape(unknownArrow, null);
    const unknownPoints = getArrowheadPoints(
      unknownArrow,
      unknownShape,
      "end",
      "circle",
    );

    expect(unknownPoints).toEqual(defaultPoints);
  });
});
