import { pointFrom } from "@excalidraw/math";
import {
  CaptureUpdateAction,
  getArrowheadPoints,
  getCanvasPadding,
  ShapeCache,
} from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";

import type {
  Arrowhead,
  ArrowheadSize,
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { actionCopyStyles, actionPasteStyles } from "../actions/actionStyles";
import { serializeAsJSON } from "../data/json";
import { restoreElements } from "../data/restore";
import { Excalidraw } from "../index";
import { exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, fireEvent, render, screen, waitFor } from "./test-utils";

const { h } = window;

const makeArrow = (overrides: {
  arrowheadSize?: ArrowheadSize;
  startArrowhead?: Arrowhead | null;
  endArrowhead?: Arrowhead | null;
}) =>
  API.createElement({
    type: "arrow",
    x: 0,
    y: 0,
    width: 200,
    height: 0,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
    endArrowhead: "arrow",
    roughness: 0,
    ...overrides,
  }) as ExcalidrawArrowElement;

const getSvgHeadSpread = (svg: SVGSVGElement) => {
  const ys: number[] = [];
  svg.querySelectorAll("path").forEach((path) => {
    const numbers = (path.getAttribute("d") || "").match(
      /-?\d*\.?\d+(?:e[-+]?\d+)?/gi,
    );
    (numbers || []).forEach((value, index) => {
      if (index % 2 === 1) {
        ys.push(Number(value));
      }
    });
  });
  return Math.max(...ys) - Math.min(...ys);
};

const exportSvg = (elements: readonly ExcalidrawElement[]) =>
  exportScene({
    type: "svg",
    data: {
      elements: elements as readonly NonDeletedExcalidrawElement[],
      appState: {},
      files: null,
    },
  });

const getElement = (id: string) =>
  h.elements.find((element) => element.id === id) as ExcalidrawLinearElement;

// captured into the store snapshot so undo only reverts the change under test
const setScene = (elements: ExcalidrawElement[]) => {
  API.updateScene({
    elements,
    captureUpdate: CaptureUpdateAction.NEVER,
  });
};

const select = (element: ExcalidrawElement) => {
  API.setSelectedElements([element] as NonDeletedExcalidrawElement[]);
};

const copyPasteStyles = (
  source: ExcalidrawElement,
  target: ExcalidrawElement,
) => {
  setScene([source, target]);
  select(source);
  API.executeAction(actionCopyStyles);
  select(target);
  API.executeAction(actionPasteStyles);
};

describe("arrowhead size", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    // https://github.com/floating-ui/floating-ui/issues/1908#issuecomment-1301553793
    await act(async () => {});
  });

  it("keeps a small arrowheadSize through restore and exports a smaller head", async () => {
    const [small] = restoreElements(
      [makeArrow({ arrowheadSize: "small" })],
      null,
    ) as ExcalidrawLinearElement[];
    const [base] = restoreElements([makeArrow({})], null);

    expect(small.arrowheadSize).toBe("small");

    const smallSvg = await exportSvg([small]);
    const baseSvg = await exportSvg([base]);
    expect(getSvgHeadSpread(smallSvg)).toBeLessThan(getSvgHeadSpread(baseSvg));
  });

  it("fits large heads inside the export frame and keeps default frames unchanged", async () => {
    const largeSvg = await exportSvg([makeArrow({ arrowheadSize: "large" })]);
    const mediumSvg = await exportSvg([makeArrow({ arrowheadSize: "medium" })]);
    const baseSvg = await exportSvg([makeArrow({})]);

    const largeHeight = Number(largeSvg.getAttribute("height"));
    const baseHeight = Number(baseSvg.getAttribute("height"));

    expect(largeHeight).toBeGreaterThanOrEqual(
      getSvgHeadSpread(largeSvg) + 19.99,
    );
    expect(largeHeight).toBeGreaterThan(baseHeight);
    expect(Number(mediumSvg.getAttribute("height"))).toBe(baseHeight);
  });

  it("shows the arrowhead size control only when a selected element has an arrowhead", () => {
    const headed = makeArrow({});
    setScene([headed]);
    select(headed);
    expect(screen.queryByTestId("arrowheadSize-small")).not.toBeNull();

    const headless = makeArrow({ startArrowhead: null, endArrowhead: null });
    setScene([headless]);
    select(headless);
    expect(screen.queryByTestId("arrowheadSize-small")).toBeNull();
  });

  it("picking a size updates the arrow and undo restores the previous size", () => {
    const arrow = makeArrow({ arrowheadSize: "small" });
    setScene([arrow]);
    select(arrow);
    const version = getElement(arrow.id).version;

    fireEvent.click(screen.getByTestId("arrowheadSize-large"));
    expect(getElement(arrow.id).arrowheadSize).toBe("large");
    expect(getElement(arrow.id).version).toBeGreaterThan(version);

    Keyboard.undo();
    expect(getElement(arrow.id).arrowheadSize).toBe("small");
  });

  it("picking a size on an arrow without one and undoing leaves it unset", () => {
    const arrow = makeArrow({});
    setScene([arrow]);
    select(arrow);

    fireEvent.click(screen.getByTestId("arrowheadSize-small"));
    expect(getElement(arrow.id).arrowheadSize).toBe("small");

    Keyboard.undo();
    expect(getElement(arrow.id).arrowheadSize).toBeUndefined();
  });

  it("picking a size on an elbow arrow re-routes it and keeps its points valid", () => {
    const arrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 100)],
      endArrowhead: "arrow",
      roughness: 0,
      elbowed: true,
    }) as ExcalidrawArrowElement;
    setScene([arrow]);
    select(arrow);
    const version = getElement(arrow.id).version;

    fireEvent.click(screen.getByTestId("arrowheadSize-large"));

    const updated = getElement(arrow.id);
    expect(updated.arrowheadSize).toBe("large");
    expect(updated.version).toBeGreaterThan(version);
    expect(updated.points.length).toBeGreaterThanOrEqual(2);
    updated.points.forEach(([x, y]) => {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });
  });

  it("getCanvasPadding counts a start-only head and grows for large heads", () => {
    const startOnly = { startArrowhead: "arrow", endArrowhead: null } as const;

    expect(getCanvasPadding(makeArrow(startOnly))).toBe(40);
    expect(
      getCanvasPadding(makeArrow({ ...startOnly, arrowheadSize: "large" })),
    ).toBe(60);
    expect(
      getCanvasPadding(makeArrow({ ...startOnly, arrowheadSize: "small" })),
    ).toBe(20);
    expect(
      getCanvasPadding(makeArrow({ startArrowhead: null, endArrowhead: null })),
    ).toBe(20);
  });

  it("paste styles copies a small arrowheadSize onto an arrow without one", () => {
    const source = makeArrow({ arrowheadSize: "small" });
    const target = makeArrow({});
    copyPasteStyles(source, target);

    expect(getElement(target.id).arrowheadSize).toBe("small");
  });

  it("paste styles from an arrow without arrowheadSize clears a large target", () => {
    const source = makeArrow({});
    const target = makeArrow({ arrowheadSize: "large" });
    copyPasteStyles(source, target);

    const pasted = getElement(target.id);
    const copied = getElement(source.id);
    expect(pasted.arrowheadSize).toBeUndefined();
    expect(
      getArrowheadPoints(
        pasted,
        ShapeCache.generateElementShape(pasted, null),
        "end",
        "arrow",
      ),
    ).toEqual(
      getArrowheadPoints(
        copied,
        ShapeCache.generateElementShape(copied, null),
        "end",
        "arrow",
      ),
    );

    const serialized = JSON.parse(
      serializeAsJSON(h.elements, h.state, {}, "local"),
    ).elements.find((element: ExcalidrawElement) => element.id === target.id);
    expect("arrowheadSize" in serialized).toBe(false);

    Keyboard.undo();
    expect(getElement(target.id).arrowheadSize).toBe("large");
  });

  it("paste styles between arrows without arrowheadSize adds no key", () => {
    const source = makeArrow({});
    const target = makeArrow({});
    copyPasteStyles(source, target);

    expect("arrowheadSize" in getElement(target.id)).toBe(false);
  });
});

describe("arrowhead size in compact and mobile panels", () => {
  beforeAll(() => {
    // jsdom has no ResizeObserver, which the radix popover measures with
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it.each(["tablet", "phone"] as const)(
    "shows the arrowhead size control in the %s arrow properties popover",
    async (formFactor) => {
      await render(
        <Excalidraw UIOptions={{ getFormFactor: () => formFactor }} />,
      );
      fireEvent.resize(window);
      await waitFor(() =>
        expect(h.app.editorInterface.formFactor).toBe(formFactor),
      );

      const headed = makeArrow({});
      setScene([headed]);
      select(headed);
      API.setAppState({ openPopup: "compactArrowProperties" });
      await waitFor(() =>
        expect(screen.queryByTestId("arrowheadSize-small")).not.toBeNull(),
      );

      fireEvent.click(screen.getByTestId("arrowheadSize-large"));
      expect(getElement(headed.id).arrowheadSize).toBe("large");

      const headless = makeArrow({ startArrowhead: null, endArrowhead: null });
      setScene([headless]);
      select(headless);
      API.setAppState({ openPopup: "compactArrowProperties" });
      await waitFor(() =>
        expect(screen.queryByTestId("arrowheadSize-small")).toBeNull(),
      );

      await act(async () => {});
    },
  );
});
