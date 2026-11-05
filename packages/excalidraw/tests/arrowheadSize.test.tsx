import { pointFrom } from "@excalidraw/math";
import { ARROWHEAD_SIZES, DEFAULT_ARROWHEAD_SIZE } from "@excalidraw/common";
import {
  addNewNodes,
  convertToShape,
  getArrowheadPoints,
  ShapeCache,
} from "@excalidraw/element";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawArrowElement,
  ExcalidrawFlowchartNodeElement,
  ExcalidrawLinearElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw, exportScene } from "../index";
import {
  actionChangeArrowheadSize,
  actionCopyStyles,
  actionPasteStyles,
} from "../actions";
import { convertElementTypes } from "../components/ConvertElementTypePopup";
import { restoreElements } from "../data/restore";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, fireEvent, render } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

const getArrowheadDistance = (arrow: ExcalidrawLinearElement) => {
  ShapeCache.delete(arrow);
  const shapes = ShapeCache.generateElementShape(arrow, null);
  const points = getArrowheadPoints(arrow, shapes, "end", "arrow");
  expect(points).not.toBeNull();
  const [x1, y1, x2, y2] = points!;
  return Math.hypot(x2 - x1, y2 - y1);
};

const getPathSpan = (path: SVGPathElement) => {
  const d = path.getAttribute("d") || "";
  const tokens = d.match(/[MLC]|-?\d+(?:\.\d+)?/g) || [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "M" || token === "L") {
      xs.push(Number(tokens[i + 1]));
      ys.push(Number(tokens[i + 2]));
      i += 2;
    } else if (token === "C") {
      xs.push(
        Number(tokens[i + 1]),
        Number(tokens[i + 3]),
        Number(tokens[i + 5]),
      );
      ys.push(
        Number(tokens[i + 2]),
        Number(tokens[i + 4]),
        Number(tokens[i + 6]),
      );
      i += 6;
    }
  }
  return {
    spanX: Math.max(...xs) - Math.min(...xs),
    spanY: Math.max(...ys) - Math.min(...ys),
  };
};

describe("arrowheadSize", () => {
  it("omits arrowheadSize at default size, sets it on non-default selection, and deletes it when returning to default", async () => {
    const { getByTestId } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );

    const defaultArrow = API.createElement({
      type: "arrow",
      endArrowhead: "arrow",
    });
    expect("arrowheadSize" in defaultArrow).toBe(false);
    expect(h.state.currentItemArrowheadSize).toBe(DEFAULT_ARROWHEAD_SIZE);

    const defaultHeadDist = getArrowheadDistance(defaultArrow);

    UI.clickTool("arrow");
    mouse.down(10, 10);
    mouse.up(110, 110);

    const drawnArrow = h.elements[0] as ExcalidrawArrowElement;
    expect("arrowheadSize" in drawnArrow).toBe(false);

    fireEvent.click(getByTestId("arrowheadSize-small"));

    const updatedSmall = h.elements[0] as ExcalidrawArrowElement;
    expect(updatedSmall.arrowheadSize).toBe(ARROWHEAD_SIZES.sm);
    expect(h.state.currentItemArrowheadSize).toBe(ARROWHEAD_SIZES.sm);

    const smallHeadDist = getArrowheadDistance(updatedSmall);
    expect(smallHeadDist).toBeCloseTo(defaultHeadDist * ARROWHEAD_SIZES.sm, 5);

    fireEvent.click(getByTestId("arrowheadSize-large"));

    const updatedLarge = h.elements[0] as ExcalidrawArrowElement;
    expect("arrowheadSize" in updatedLarge).toBe(false);
    expect(h.state.currentItemArrowheadSize).toBe(DEFAULT_ARROWHEAD_SIZE);
  });

  it("restores the previous arrowheadSize after a single Keyboard.undo()", async () => {
    const { getByTestId } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );

    UI.clickTool("arrow");
    mouse.down(10, 10);
    mouse.up(110, 110);

    fireEvent.click(getByTestId("arrowheadSize-small"));
    expect((h.elements[0] as ExcalidrawArrowElement).arrowheadSize).toBe(
      ARROWHEAD_SIZES.sm,
    );

    fireEvent.click(getByTestId("arrowheadSize-veryLarge"));
    expect((h.elements[0] as ExcalidrawArrowElement).arrowheadSize).toBe(
      ARROWHEAD_SIZES.xl,
    );

    Keyboard.undo();

    expect((h.elements[0] as ExcalidrawArrowElement).arrowheadSize).toBe(
      ARROWHEAD_SIZES.sm,
    );
  });

  it("shows no active preset when multiple arrows with different arrowhead sizes are selected and applies picked preset to all", async () => {
    const { getByTestId } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );

    const arrow1 = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      endArrowhead: "arrow",
    });
    const arrow2 = API.createElement({
      type: "arrow",
      x: 50,
      y: 50,
      endArrowhead: "arrow",
      arrowheadSize: ARROWHEAD_SIZES.sm,
    });
    expect("arrowheadSize" in arrow1).toBe(false);
    expect(arrow2.arrowheadSize).toBe(ARROWHEAD_SIZES.sm);

    h.elements = [arrow1, arrow2];
    API.setSelectedElements([arrow1, arrow2]);

    expect(
      (getByTestId("arrowheadSize-small") as HTMLInputElement).checked,
    ).toBe(false);
    expect(
      (getByTestId("arrowheadSize-medium") as HTMLInputElement).checked,
    ).toBe(false);
    expect(
      (getByTestId("arrowheadSize-large") as HTMLInputElement).checked,
    ).toBe(false);
    expect(
      (getByTestId("arrowheadSize-veryLarge") as HTMLInputElement).checked,
    ).toBe(false);

    fireEvent.click(getByTestId("arrowheadSize-medium"));

    expect((h.elements[0] as ExcalidrawArrowElement).arrowheadSize).toBe(
      ARROWHEAD_SIZES.md,
    );
    expect((h.elements[1] as ExcalidrawArrowElement).arrowheadSize).toBe(
      ARROWHEAD_SIZES.md,
    );
  });

  it("propagates currentItemArrowheadSize to new arrows, flowchart arrows, shape/type conversions, and copy/paste styles", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    act(() => {
      h.app.actionManager.executeAction(
        actionChangeArrowheadSize,
        "ui",
        ARROWHEAD_SIZES.sm,
      );
    });
    expect(h.state.currentItemArrowheadSize).toBe(ARROWHEAD_SIZES.sm);

    // (a) drawing a new arrow with UI.clickTool("arrow") and Pointer drag
    UI.clickTool("arrow");
    mouse.down(10, 10);
    mouse.up(120, 120);

    const drawnArrow = h.elements[0] as ExcalidrawArrowElement;
    expect(drawnArrow.type).toBe("arrow");
    expect(drawnArrow.arrowheadSize).toBe(ARROWHEAD_SIZES.sm);

    // (b) addNewNodes produces a bindingArrow with arrowheadSize === ARROWHEAD_SIZES.sm
    const rect = API.createElement({
      type: "rectangle",
      x: 200,
      y: 200,
      width: 100,
      height: 100,
    });
    API.setElements([rect]);
    const { nodes } = addNewNodes(
      rect as NonDeleted<ExcalidrawFlowchartNodeElement>,
      h.state,
      "right",
      h.app.scene,
      1,
    );
    const bindingArrow = nodes.find(
      (n) => n.type === "arrow",
    ) as ExcalidrawArrowElement;
    expect(bindingArrow.arrowheadSize).toBe(ARROWHEAD_SIZES.sm);

    // (c) convertToShape on an arrow gesture produces an arrow with arrowheadSize === ARROWHEAD_SIZES.sm
    const convertedShape = convertToShape(
      [
        pointFrom<GlobalPoint>(0, 10),
        pointFrom<GlobalPoint>(150, 10),
        pointFrom<GlobalPoint>(130, 0),
        pointFrom<GlobalPoint>(150, 10),
        pointFrom<GlobalPoint>(130, 20),
      ],
      h.state,
      h.app.scene.getNonDeletedElementsMap(),
      null,
    );
    expect(convertedShape?.type).toBe("arrow");
    expect((convertedShape as ExcalidrawArrowElement).arrowheadSize).toBe(
      ARROWHEAD_SIZES.sm,
    );

    // (d) convertElementTypes on a default-sized sharp arrow applies h.state.currentItemArrowheadSize
    const sharpArrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      endArrowhead: "arrow",
      arrowheadSize: DEFAULT_ARROWHEAD_SIZE,
    });
    expect("arrowheadSize" in sharpArrow).toBe(false);
    h.elements = [sharpArrow];
    API.setSelectedElements([sharpArrow]);

    convertElementTypes(h.app, {
      conversionType: "linear",
      nextType: "curvedArrow",
    });

    const curvedArrow = h.elements[0] as ExcalidrawArrowElement;
    expect(curvedArrow.arrowheadSize).toBe(ARROWHEAD_SIZES.sm);

    // (e) actionCopyStyles and actionPasteStyles copies arrowheadSize
    const sourceArrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      endArrowhead: "arrow",
      arrowheadSize: ARROWHEAD_SIZES.xl,
    });
    const targetArrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 100,
      endArrowhead: "arrow",
      arrowheadSize: DEFAULT_ARROWHEAD_SIZE,
    });
    h.elements = [sourceArrow, targetArrow];
    API.setSelectedElements([sourceArrow]);
    act(() => {
      h.app.actionManager.executeAction(actionCopyStyles);
    });

    API.setSelectedElements([targetArrow]);
    act(() => {
      h.app.actionManager.executeAction(actionPasteStyles);
    });

    const updatedTarget = h.elements.find(
      (el) => el.id === targetArrow.id,
    ) as ExcalidrawArrowElement;
    expect(updatedTarget.arrowheadSize).toBe(ARROWHEAD_SIZES.xl);
  });

  it("restores an arrow with arrowheadSize 0.5 and exports a smaller SVG head path than at default size", async () => {
    const baseRawArrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 200,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
      endArrowhead: "arrow",
      roughness: 0,
    });

    const restoredSmall = restoreElements(
      [
        {
          ...baseRawArrow,
          id: "arrow-small-svg",
          seed: 1,
          arrowheadSize: ARROWHEAD_SIZES.sm,
        },
      ],
      null,
    );
    const restoredDefault = restoreElements(
      [
        {
          ...baseRawArrow,
          id: "arrow-default-svg",
          seed: 1,
          arrowheadSize: DEFAULT_ARROWHEAD_SIZE,
        },
      ],
      null,
    );

    expect((restoredSmall[0] as ExcalidrawArrowElement).arrowheadSize).toBe(
      0.5,
    );
    expect("arrowheadSize" in restoredDefault[0]).toBe(false);

    const svgSmall = await exportScene({
      type: "svg",
      data: {
        elements: restoredSmall as readonly NonDeletedExcalidrawElement[],
        appState: { viewBackgroundColor: "#ffffff" },
        files: {},
      },
      config: { canvasBackgroundColor: false },
    });
    const svgDefault = await exportScene({
      type: "svg",
      data: {
        elements: restoredDefault as readonly NonDeletedExcalidrawElement[],
        appState: { viewBackgroundColor: "#ffffff" },
        files: {},
      },
      config: { canvasBackgroundColor: false },
    });

    const smallPaths = svgSmall.querySelectorAll("path");
    const defaultPaths = svgDefault.querySelectorAll("path");
    expect(smallPaths.length).toBeGreaterThanOrEqual(2);
    expect(defaultPaths.length).toBeGreaterThanOrEqual(2);

    const smallHeadSpan = getPathSpan(smallPaths[1]);
    const defaultHeadSpan = getPathSpan(defaultPaths[1]);

    expect(smallHeadSpan.spanX).toBeLessThan(defaultHeadSpan.spanX);
    expect(smallHeadSpan.spanY).toBeLessThan(defaultHeadSpan.spanY);
    expect(smallHeadSpan.spanX).toBeCloseTo(
      defaultHeadSpan.spanX * ARROWHEAD_SIZES.sm,
      1,
    );
    expect(smallHeadSpan.spanY).toBeCloseTo(
      defaultHeadSpan.spanY * ARROWHEAD_SIZES.sm,
      1,
    );
  });
});
