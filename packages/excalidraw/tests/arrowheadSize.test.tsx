import { pointFrom } from "@excalidraw/math";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { LocalPoint } from "@excalidraw/math";

import { Excalidraw, restoreElements } from "../index";
import { exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { fireEvent, render, screen } from "./test-utils";

const { h } = window;

const getSvgArrowheadSpan = (svg: SVGSVGElement) => {
  // The arrow shaft is the first <g>, arrowheads follow as subsequent <g>s
  const paths = Array.from(svg.querySelectorAll("path"));
  // The shaft path is the horizontal line from (0,0) to (200,0);
  // arrowhead paths have smaller x/y extents around the tip.
  const arrowheadPaths = paths.slice(1);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const path of arrowheadPaths) {
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
  it("restores arrow with arrowheadSize and renders smaller head in SVG export", async () => {
    const smallArrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 200,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
      endArrowhead: "arrow",
      arrowheadSize: 0.5,
      roundness: null,
      roughness: 0,
    });
    const defaultArrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 200,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
      endArrowhead: "arrow",
      roundness: null,
      roughness: 0,
    });

    const [restoredSmall] = restoreElements([smallArrow], null);
    expect((restoredSmall as any).arrowheadSize).toBe(0.5);

    const svgSmall = await exportScene({
      type: "svg",
      data: {
        elements: [restoredSmall as NonDeletedExcalidrawElement],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
    });
    const svgDefault = await exportScene({
      type: "svg",
      data: {
        elements: [defaultArrow],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
    });

    const smallSpan = getSvgArrowheadSpan(svgSmall);
    const defaultSpan = getSvgArrowheadSpan(svgDefault);
    expect(smallSpan).toBeGreaterThan(0);
    expect(smallSpan).toBeLessThan(defaultSpan);
  });

  it("restores old arrows without adding arrowheadSize and drops invalid values", () => {
    const oldArrow = API.createElement({
      type: "arrow",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
      endArrowhead: "arrow",
    });
    expect("arrowheadSize" in oldArrow).toBe(false);

    const [restoredOld] = restoreElements([oldArrow], null);
    expect("arrowheadSize" in restoredOld).toBe(false);

    const invalidArrow = {
      ...oldArrow,
      arrowheadSize: -1,
    };
    const [restoredInvalid] = restoreElements([invalidArrow], null);
    expect("arrowheadSize" in restoredInvalid).toBe(false);
  });

  it("updates selected arrows and currentItemArrowheadSize from properties panel", async () => {
    await render(<Excalidraw />);

    const arrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 100,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
      endArrowhead: "arrow",
    });

    API.setElements([arrow]);
    API.setSelectedElements([arrow]);

    const smallBtn = await screen.findByTestId("arrowheadSize-small");
    fireEvent.click(smallBtn);

    expect(API.getElement(arrow).arrowheadSize).toBe(0.5);
    expect(h.state.currentItemArrowheadSize).toBe(0.5);

    const largeBtn = screen.getByTestId("arrowheadSize-large");
    fireEvent.click(largeBtn);

    expect(API.getElement(arrow).arrowheadSize).toBe(1.5);
    expect(h.state.currentItemArrowheadSize).toBe(1.5);
  });
});
