import React from "react";

import { ARROWHEAD_SIZE } from "@excalidraw/common";
import {
  getArrowheadPoints,
  getArrowheadSize,
  getElementBounds,
  ShapeCache,
} from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import { restoreElements } from "../data/restore";
import { Excalidraw } from "../index";
import { exportScene } from "../scene/export";

import { Keyboard, UI } from "./helpers/ui";
import { act, fireEvent, render, screen } from "./test-utils";

const { h } = window;

/** an arrow as saved to a file, `length` long, pointing right */
const savedArrow = (
  props: Record<string, unknown> = {},
  length = 200,
): ExcalidrawElement =>
  ({
    type: "arrow",
    id: "arrow",
    x: 0,
    y: 0,
    width: length,
    height: 0,
    points: [
      [0, 0],
      [length, 0],
    ],
    roughness: 0,
    strokeWidth: 2,
    startArrowhead: null,
    endArrowhead: "arrow",
    ...props,
  } as unknown as ExcalidrawElement);

const restoreArrow = (props?: Record<string, unknown>, length?: number) => {
  const [arrow] = restoreElements([savedArrow(props, length)], null);
  return arrow as NonDeleted<ExcalidrawArrowElement>;
};

/**
 * Width and height spanned by the arrowheads of the (only) arrow in the SVG,
 * from the coordinates of their paths (all but the first, the arrow's line)
 */
const getSvgArrowheadExtent = (svg: SVGSVGElement) => {
  const [, ...arrowheadPaths] = Array.from(svg.querySelectorAll("path"));
  expect(arrowheadPaths.length).toBeGreaterThan(0);
  const numbers = arrowheadPaths.flatMap((path) =>
    (path.getAttribute("d")!.match(/-?\d+(\.\d+)?/g) ?? []).map(Number),
  );
  const xs = numbers.filter((_, i) => i % 2 === 0);
  const ys = numbers.filter((_, i) => i % 2 === 1);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

const exportArrowToSvg = (arrow: NonDeletedExcalidrawElement) =>
  exportScene({
    type: "svg",
    data: {
      elements: [arrow],
      appState: getDefaultAppState(),
      files: {},
    },
    config: { canvasBackgroundColor: false },
  });

const getEndArrowheadPoints = (arrow: ExcalidrawArrowElement) =>
  getArrowheadPoints(
    arrow,
    ShapeCache.generateElementShape(arrow, null),
    "end",
    arrow.endArrowhead!,
  )!;

describe("arrowhead size", () => {
  describe("restore", () => {
    it("keeps the arrowhead size of arrows that have one", () => {
      expect(restoreArrow({ arrowheadSize: 0.5 }).arrowheadSize).toBe(0.5);
    });

    it("leaves arrows saved without an arrowhead size without one", () => {
      const arrow = restoreArrow();
      expect("arrowheadSize" in arrow).toBe(false);
      // drawn at today's size
      expect(getEndArrowheadPoints(arrow)).toEqual(
        getEndArrowheadPoints(restoreArrow({ arrowheadSize: 1 })),
      );
    });

    it("drops invalid arrowhead sizes and clamps out of range ones", () => {
      expect(restoreArrow({ arrowheadSize: "big" }).arrowheadSize).toBe(
        undefined,
      );
      expect(restoreArrow({ arrowheadSize: NaN }).arrowheadSize).toBe(
        undefined,
      );
      expect(restoreArrow({ arrowheadSize: 0 }).arrowheadSize).toBe(0.25);
      expect(restoreArrow({ arrowheadSize: 100 }).arrowheadSize).toBe(4);
    });
  });

  describe("SVG export", () => {
    it("renders a smaller arrowhead for a smaller size", async () => {
      const small = getSvgArrowheadExtent(
        await exportArrowToSvg(restoreArrow({ arrowheadSize: 0.5 })),
      );
      const regular = getSvgArrowheadExtent(
        await exportArrowToSvg(restoreArrow()),
      );

      expect(small.width).toBeLessThan(regular.width * 0.6);
      // smaller arrowheads open up wider, so they don't shrink as much across
      expect(small.height).toBeLessThan(regular.height * 0.8);
      expect(small.width).toBeGreaterThan(0);
    });

    it("renders a larger arrowhead for a larger size", async () => {
      const large = getSvgArrowheadExtent(
        await exportArrowToSvg(restoreArrow({ arrowheadSize: 1.5 })),
      );
      const regular = getSvgArrowheadExtent(
        await exportArrowToSvg(restoreArrow()),
      );

      expect(large.width).toBeGreaterThan(regular.width * 1.4);
    });

    it("fits the export to arrowheads larger than the default", async () => {
      const regular = await exportArrowToSvg(restoreArrow());
      const large = await exportArrowToSvg(restoreArrow({ arrowheadSize: 2 }));

      // the arrow is horizontal, its bounds only grow vertically
      expect(regular.getAttribute("width")).toBe(large.getAttribute("width"));
      expect(Number(large.getAttribute("height"))).toBeGreaterThan(
        Number(regular.getAttribute("height")) +
          // the sides, at 20° to the arrow, reaching out on both sides
          2 * getArrowheadSize("arrow", 2) * Math.sin(Math.PI / 9) -
          1,
      );
    });
  });

  describe("geometry", () => {
    it("scales the arrowhead by the size", () => {
      const [, , x3] = getEndArrowheadPoints(restoreArrow());
      const [, , smallX3] = getEndArrowheadPoints(
        restoreArrow({ arrowheadSize: 0.5 }),
      );
      // the sides' ends, back from the tip at 200
      expect(200 - smallX3).toBeLessThan((200 - x3) / 2 + 1);
      expect(200 - smallX3).toBeGreaterThan((200 - x3) / 2 - 1);
    });

    it("still fits arrowheads on short segments", () => {
      // too short for either the default or the large size
      const regular = getEndArrowheadPoints(restoreArrow({}, 20));
      const large = getEndArrowheadPoints(
        restoreArrow({ arrowheadSize: ARROWHEAD_SIZE.large }, 20),
      );
      expect(large).toEqual(regular);

      // short for the default size, but not the small one
      const small = getEndArrowheadPoints(
        restoreArrow({ arrowheadSize: ARROWHEAD_SIZE.small }, 30),
      );
      const [, , smallX3] = small;
      expect(30 - smallX3).toBeLessThan(getArrowheadSize("arrow", 0.5));
    });

    it("includes arrowheads larger than the default in the bounds", () => {
      const elementsMap = new Map();
      const [, y1, , y2] = getElementBounds(restoreArrow(), elementsMap);
      const [, smallY1, , smallY2] = getElementBounds(
        restoreArrow({ arrowheadSize: ARROWHEAD_SIZE.small }),
        elementsMap,
      );
      const [x1, largeY1, x2, largeY2] = getElementBounds(
        restoreArrow({ arrowheadSize: ARROWHEAD_SIZE.large }),
        elementsMap,
      );

      // default (and smaller) arrowheads aren't part of the bounds
      expect([smallY1, smallY2]).toEqual([y1, y2]);
      expect(y2 - y1).toBe(0);
      // larger ones are, by how far their sides reach from the arrow
      const [, , , y3, , y4] = getEndArrowheadPoints(
        restoreArrow({ arrowheadSize: ARROWHEAD_SIZE.large }),
      );
      expect(largeY1).toBeCloseTo(Math.min(y3, y4), 0);
      expect(largeY2).toBeCloseTo(Math.max(y3, y4), 0);
      expect([x1, x2]).toEqual([0, 200]);
    });
  });

  describe("properties panel", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("sets the arrowhead size of the selected arrow, undoably", async () => {
      // drawn, so that its creation is undone separately
      const arrow = UI.createElement("arrow", { width: 200, height: 0 });
      expect("arrowheadSize" in arrow).toBe(false);

      const medium = (await screen.findByTestId(
        "arrowheadSize-medium",
      )) as HTMLInputElement;
      expect(medium.checked).toBe(true);

      act(() => {
        fireEvent.click(screen.getByTestId("arrowheadSize-small"));
      });
      expect(h.elements[0]).toEqual(
        expect.objectContaining({ arrowheadSize: ARROWHEAD_SIZE.small }),
      );
      expect(h.state.currentItemArrowheadSize).toBe(ARROWHEAD_SIZE.small);

      Keyboard.undo();
      expect(h.elements[0].isDeleted).toBe(false);
      expect(
        (h.elements[0] as ExcalidrawArrowElement).arrowheadSize,
      ).toBeUndefined();

      Keyboard.redo();
      expect((h.elements[0] as ExcalidrawArrowElement).arrowheadSize).toBe(
        ARROWHEAD_SIZE.small,
      );
    });

    it("draws new arrows with the chosen size", async () => {
      UI.clickTool("arrow");
      act(() => {
        fireEvent.click(screen.getByTestId("arrowheadSize-large"));
      });
      const arrow = UI.createElement("arrow", { width: 200, height: 100 });
      expect(arrow.arrowheadSize).toBe(ARROWHEAD_SIZE.large);
    });
  });
});
