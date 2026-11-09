import { CaptureUpdateAction } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { LocalPoint } from "@excalidraw/math";

import { actionCopyStyles, actionPasteStyles } from "../actions";
import { restoreAppState, restoreElements } from "../data/restore";
import { Excalidraw } from "../index";
import { exportScene } from "../scene/export";
import { API } from "../tests/helpers/api";
import { Keyboard, UI } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

const { h } = window;

const createArrow = () =>
  API.createElement({
    type: "arrow",
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
    roughness: 0,
    endArrowhead: "arrow",
  });

const getSize = (element: ExcalidrawElement) =>
  (API.getElement(element) as ExcalidrawLinearElement).arrowheadSize;

const getMaxAbsY = (svg: SVGSVGElement): number => {
  let max = 0;
  svg.querySelectorAll("path").forEach((path) => {
    const d = path.getAttribute("d") || "";
    const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
    for (let i = 1; i < nums.length; i += 2) {
      max = Math.max(max, Math.abs(nums[i]));
    }
  });
  return max;
};

describe("arrowhead size", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("sets the size of the selected arrow and the default", () => {
    const arrow = createArrow();
    API.setElements([arrow]);
    API.setSelectedElements([arrow]);

    UI.clickOnTestId("arrowheadSize-small");

    expect(getSize(arrow)).toBe("small");
    expect(h.state.currentItemArrowheadSize).toBe("small");
  });

  it("undo restores the previous size", () => {
    const arrow = createArrow();
    API.updateScene({
      elements: [arrow],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([arrow]);

    UI.clickOnTestId("arrowheadSize-small");
    expect(getSize(arrow)).toBe("small");

    Keyboard.undo();
    expect(API.getElement(arrow).isDeleted).toBe(false);
    expect(getSize(arrow)).toBeUndefined();

    Keyboard.redo();
    expect(API.getElement(arrow).isDeleted).toBe(false);
    expect(getSize(arrow)).toBe("small");
  });

  it("choosing the current size is a no-op", () => {
    const arrow = createArrow();
    API.setElements([arrow]);
    API.setSelectedElements([arrow]);

    const initialVersion = API.getElement(arrow).version;
    UI.clickOnTestId("arrowheadSize-medium");

    const current = API.getElement(arrow);
    expect(current.version).toBe(initialVersion);
    expect(Object.prototype.hasOwnProperty.call(current, "arrowheadSize")).toBe(
      false,
    );
  });

  it("choosing medium clears the size", () => {
    const arrow = { ...createArrow(), arrowheadSize: "large" as const };
    API.setElements([arrow]);
    API.setSelectedElements([arrow]);

    UI.clickOnTestId("arrowheadSize-medium");

    const updated = API.getElement(arrow) as ExcalidrawLinearElement;
    expect(updated.arrowheadSize).toBeUndefined();
    expect(JSON.stringify(updated)).not.toContain("arrowheadSize");
    expect(h.state.currentItemArrowheadSize).toBe("medium");
  });

  it("new arrows take the chosen size", () => {
    API.setAppState({ currentItemArrowheadSize: "large" });

    const arrow = UI.createElement("arrow", {
      x: 0,
      y: 0,
      width: 100,
      height: 0,
    });

    expect((arrow.get() as ExcalidrawLinearElement).arrowheadSize).toBe(
      "large",
    );
  });

  it("paste styles carries the size", () => {
    const sourceArrow = { ...createArrow(), arrowheadSize: "small" as const };
    const targetArrow = createArrow();
    API.setElements([sourceArrow, targetArrow]);

    API.setSelectedElements([sourceArrow]);
    API.executeAction(actionCopyStyles);

    API.setSelectedElements([targetArrow]);
    API.executeAction(actionPasteStyles);

    expect(getSize(targetArrow)).toBe("small");
  });

  it("exports a smaller head to SVG", async () => {
    const base = createArrow();
    const [smallArrow] = restoreElements(
      [{ ...base, arrowheadSize: "small" }],
      null,
    );
    const [defaultArrow] = restoreElements([base], null);

    const exportOne = (elements: readonly NonDeletedExcalidrawElement[]) =>
      exportScene({
        type: "svg",
        data: {
          elements,
          appState: { viewBackgroundColor: "#ffffff" },
          files: {},
        },
        config: { canvasBackgroundColor: false },
      });

    const smallSvg = (await exportOne([
      smallArrow as NonDeletedExcalidrawElement,
    ])) as SVGSVGElement;
    const defaultSvg = (await exportOne([
      defaultArrow as NonDeletedExcalidrawElement,
    ])) as SVGSVGElement;

    expect(getMaxAbsY(smallSvg)).toBeLessThan(getMaxAbsY(defaultSvg));
  });

  it("restores an arrow without a size unchanged", () => {
    const arrow = createArrow();
    const [restored] = restoreElements(
      [arrow],
      null,
    ) as ExcalidrawLinearElement[];

    expect(
      Object.prototype.hasOwnProperty.call(restored, "arrowheadSize"),
    ).toBe(false);
    expect(restored.points).toEqual(arrow.points);
    expect((restored as any).endArrowhead).toBe("arrow");
  });

  it("restore drops invalid and default sizes", () => {
    const restored = restoreElements(
      [
        { ...createArrow(), arrowheadSize: "huge" } as any,
        { ...createArrow(), arrowheadSize: "medium" },
        { ...createArrow(), arrowheadSize: "small" },
      ],
      null,
    ) as ExcalidrawLinearElement[];

    expect(
      Object.prototype.hasOwnProperty.call(restored[0], "arrowheadSize"),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(restored[1], "arrowheadSize"),
    ).toBe(false);
    expect(restored[2].arrowheadSize).toBe("small");
  });

  it("appState restore defaults the size", () => {
    expect(restoreAppState({}, null).currentItemArrowheadSize).toBe("medium");
    expect(
      restoreAppState({ currentItemArrowheadSize: "huge" } as any, null)
        .currentItemArrowheadSize,
    ).toBe("medium");
    expect(
      restoreAppState({ currentItemArrowheadSize: "large" }, null)
        .currentItemArrowheadSize,
    ).toBe("large");
  });
});
