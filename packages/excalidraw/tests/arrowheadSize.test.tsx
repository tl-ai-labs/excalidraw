import React from "react";
import { pointFrom } from "@excalidraw/math";

import {
  getArrowheadSize,
  getNonDeletedElements,
  newArrowElement,
} from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";
import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import { restoreAppState, restoreElements } from "../data/restore";
import { Excalidraw } from "../index";
import { exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { fireEvent, render, screen } from "./test-utils";

const { h } = window;

const getSvgPathsYExtent = (svg: SVGSVGElement) => {
  const paths = Array.from(svg.querySelectorAll("path"));
  let minY = Infinity;
  let maxY = -Infinity;
  for (const path of paths) {
    const d = path.getAttribute("d") || "";
    const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    for (let i = 1; i < nums.length; i += 2) {
      minY = Math.min(minY, nums[i]);
      maxY = Math.max(maxY, nums[i]);
    }
  }
  return maxY - minY;
};

describe("arrowheadSize", () => {
  describe("restore", () => {
    it("preserves valid arrowheadSize on restore and drops invalid values", () => {
      const smallArrow = API.createElement({
        type: "arrow",
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
        endArrowhead: "arrow",
        arrowheadSize: "small",
      });
      const invalidArrow = {
        ...API.createElement({
          type: "arrow",
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
          endArrowhead: "arrow",
        }),
        arrowheadSize: "huge" as any,
      };

      const restored = restoreElements([smallArrow, invalidArrow], null);

      expect((restored[0] as ExcalidrawArrowElement).arrowheadSize).toBe(
        "small",
      );
      expect("arrowheadSize" in restored[1]).toBe(false);
    });

    it("restores an old arrow without arrowheadSize without adding the key and with today's size", () => {
      const oldArrow = API.createElement({
        type: "arrow",
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
        endArrowhead: "arrow",
      });
      expect("arrowheadSize" in oldArrow).toBe(false);

      const serialized = JSON.parse(JSON.stringify([oldArrow]));
      const [restored] = restoreElements(serialized, null) as [
        ExcalidrawArrowElement,
      ];

      expect("arrowheadSize" in restored).toBe(false);
      expect(getArrowheadSize("arrow", restored.arrowheadSize)).toBe(25);
    });

    it("omits arrowheadSize when creating an arrow with medium default", () => {
      const mediumArrow = newArrowElement({
        type: "arrow",
        x: 0,
        y: 0,
        endArrowhead: "arrow",
        arrowheadSize: "medium",
      });
      const smallArrow = newArrowElement({
        type: "arrow",
        x: 0,
        y: 0,
        endArrowhead: "arrow",
        arrowheadSize: "small",
      });

      expect("arrowheadSize" in mediumArrow).toBe(false);
      expect(smallArrow.arrowheadSize).toBe("small");
    });

    it("validates currentItemArrowheadSize in restoreAppState", () => {
      const valid = restoreAppState(
        { currentItemArrowheadSize: "large" },
        null,
      );
      expect(valid.currentItemArrowheadSize).toBe("large");

      const invalid = restoreAppState(
        { currentItemArrowheadSize: "giant" as any },
        null,
      );
      expect(invalid.currentItemArrowheadSize).toBe("medium");
    });
  });

  describe("SVG export", () => {
    it("renders a smaller arrowhead in SVG export for arrowheadSize 'small'", async () => {
      const smallInput = API.createElement({
        type: "arrow",
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
        endArrowhead: "arrow",
        arrowheadSize: "small",
        roundness: null,
        roughness: 0,
      });
      const defaultInput = API.createElement({
        type: "arrow",
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
        endArrowhead: "arrow",
        roundness: null,
        roughness: 0,
      });

      const restoredSmallElements = getNonDeletedElements(
        restoreElements([smallInput], null),
      );
      const restoredDefaultElements = getNonDeletedElements(
        restoreElements([defaultInput], null),
      );

      expect(
        (restoredSmallElements[0] as ExcalidrawArrowElement).arrowheadSize,
      ).toBe("small");
      expect("arrowheadSize" in restoredDefaultElements[0]).toBe(false);

      const appState = { ...getDefaultAppState(), exportBackground: false };
      const smallSvg = await exportScene({
        type: "svg",
        data: {
          elements: restoredSmallElements,
          appState,
          files: {},
        },
      });
      const defaultSvg = await exportScene({
        type: "svg",
        data: {
          elements: restoredDefaultElements,
          appState,
          files: {},
        },
      });

      const smallHeadHeight = getSvgPathsYExtent(smallSvg);
      const defaultHeadHeight = getSvgPathsYExtent(defaultSvg);

      expect(smallHeadHeight).toBeGreaterThan(0);
      expect(smallHeadHeight).toBeLessThan(defaultHeadHeight);
    });
  });

  describe("properties panel", () => {
    it("shows the arrowhead size control for arrows and updates element & appState", async () => {
      await render(<Excalidraw />);

      UI.clickTool("arrow");
      const smallRadio = screen.getByTestId("arrowheadSize-small");
      const mediumRadio = screen.getByTestId("arrowheadSize-medium");
      const largeRadio = screen.getByTestId("arrowheadSize-large");

      expect(mediumRadio).toBeChecked();

      fireEvent.click(smallRadio);
      expect(h.state.currentItemArrowheadSize).toBe("small");

      const arrow = UI.createElement("arrow", {
        x: 0,
        y: 0,
        width: 200,
        height: 0,
      });
      expect((arrow.get() as ExcalidrawArrowElement).arrowheadSize).toBe(
        "small",
      );

      fireEvent.click(largeRadio);
      expect((arrow.get() as ExcalidrawArrowElement).arrowheadSize).toBe(
        "large",
      );
    });
  });
});
