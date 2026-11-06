import React from "react";

import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { actionFlipHorizontal } from "../actions/actionFlip";
import { actionCopyStyles, actionPasteStyles } from "../actions/actionStyles";
import { restoreAppState, restoreElements } from "../data/restore";
import { Excalidraw } from "../index";
import { exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard, UI } from "./helpers/ui";
import { fireEvent, render, screen } from "./test-utils";

const { h } = window;

const getById = (id: string) =>
  h.elements.find((el) => el.id === id)! as NonDeletedExcalidrawElement;

const sizeOf = (id: string) =>
  (getById(id) as { arrowheadSize?: string | null }).arrowheadSize;

const clickSize = (size: "small" | "medium" | "large") => {
  fireEvent.click(screen.queryByTestId(`arrowheadSize-${size}`)!);
};

// drop the fields restore assigns per call
const stable = (element: ExcalidrawElement) => {
  const { index, version, versionNonce, updated, ...rest } = element;
  return rest;
};

// extent of the head path, the last path drawn for the arrow
const headExtent = async (element: NonDeletedExcalidrawElement) => {
  const svg = await exportScene({
    type: "svg",
    data: { elements: [element], files: null },
  });
  const paths = [...svg.querySelectorAll("path")];
  const d = paths[paths.length - 1].getAttribute("d") ?? "";
  const numbers = (d.match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []).map(Number);
  const xs = numbers.filter((_, i) => i % 2 === 0);
  const ys = numbers.filter((_, i) => i % 2 === 1);
  return Math.hypot(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
};

describe("arrowhead size", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("shows the control for arrows and for lines with a head", () => {
    const arrow = API.createElement({ type: "arrow", id: "arrow" });
    const line = API.createElement({ type: "line", id: "line" });
    const headedLine = {
      ...API.createElement({ type: "line", id: "headed", x: 300 }),
      endArrowhead: "arrow" as const,
    };
    API.setElements([arrow, line, headedLine]);

    API.setSelectedElements([arrow]);
    expect(screen.queryByTestId("arrowheadSize-medium")).not.toBeNull();
    API.setSelectedElements([headedLine]);
    expect(screen.queryByTestId("arrowheadSize-medium")).not.toBeNull();
    API.setSelectedElements([line]);
    expect(screen.queryByTestId("arrowheadSize-medium")).toBeNull();

    API.clearSelection();
    UI.clickTool("arrow");
    expect(screen.queryByTestId("arrowheadSize-medium")).not.toBeNull();
  });

  it("changing the size updates selection and the default", () => {
    const a = API.createElement({ type: "arrow", id: "a" });
    const b = API.createElement({ type: "arrow", id: "b", x: 200 });
    API.setElements([a, b]);
    API.setSelectedElements([a, b]);

    clickSize("large");

    expect(sizeOf("a")).toBe("large");
    expect(sizeOf("b")).toBe("large");
    expect(h.state.currentItemArrowheadSize).toBe("large");
    expect(
      (screen.queryByTestId("arrowheadSize-large") as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("picking medium stores medium", () => {
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      arrowheadSize: "large",
    });
    API.setElements([arrow]);
    API.setSelectedElements([arrow]);

    clickSize("medium");

    expect(sizeOf("arrow")).toBe("medium");
  });

  it("undo restores the previous size", () => {
    const arrow = UI.createElement("arrow", { x: 10, width: 100 });

    clickSize("small");

    Keyboard.undo();
    expect(sizeOf(arrow.id)).toBeUndefined();
    Keyboard.redo();
    expect(sizeOf(arrow.id)).toBe("small");
  });

  it("new arrows take the current size", () => {
    API.setAppState({ currentItemArrowheadSize: "small" });
    const small = UI.createElement("arrow", { size: 100 });
    expect(sizeOf(small.id)).toBe("small");

    API.setAppState({ currentItemArrowheadSize: null });
    const plain = UI.createElement("arrow", { x: 300, size: 100 });
    expect("arrowheadSize" in getById(plain.id)).toBe(false);
  });

  it("paste styles copies the size", () => {
    const source = API.createElement({
      type: "arrow",
      id: "source",
      arrowheadSize: "large",
    });
    const target = API.createElement({ type: "arrow", id: "target", x: 300 });
    API.setElements([source, target]);

    API.setSelectedElements([getById("source")]);
    API.executeAction(actionCopyStyles);
    API.setSelectedElements([getById("target")]);
    API.executeAction(actionPasteStyles);

    expect(sizeOf("target")).toBe("large");
  });

  it("flip keeps the size", () => {
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      arrowheadSize: "small",
    });
    API.setElements([arrow]);
    API.setSelectedElements([arrow]);

    API.executeAction(actionFlipHorizontal);

    expect(sizeOf("arrow")).toBe("small");
  });

  it("restore keeps valid sizes and drops others", () => {
    const base = API.createElement({ type: "arrow", id: "arrow" });
    const small = { ...base, arrowheadSize: "small" as const };
    const huge = {
      ...base,
      arrowheadSize: "huge",
    } as unknown as ExcalidrawElement;
    const empty = { ...base, arrowheadSize: null };

    const [restoredSmall] = restoreElements([small], null);
    const [restoredHuge] = restoreElements([huge], null);
    const [restoredNull] = restoreElements([empty], null);
    const [restoredPlain] = restoreElements([base], null);

    expect((restoredSmall as typeof small).arrowheadSize).toBe("small");
    expect("arrowheadSize" in restoredHuge).toBe(false);
    expect("arrowheadSize" in restoredNull).toBe(false);
    expect("arrowheadSize" in restoredPlain).toBe(false);
    // a dropped size leaves the same element as one that never had it
    expect(stable(restoredHuge)).toEqual(stable(restoredPlain));
  });

  it("restoreAppState validates the default", () => {
    type Imported = Parameters<typeof restoreAppState>[0];
    expect(
      restoreAppState(
        { currentItemArrowheadSize: "large" } as unknown as Imported,
        null,
      ).currentItemArrowheadSize,
    ).toBe("large");
    expect(
      restoreAppState(
        { currentItemArrowheadSize: "huge" } as unknown as Imported,
        null,
      ).currentItemArrowheadSize,
    ).toBe(null);
    expect(restoreAppState({}, null).currentItemArrowheadSize).toBe(null);
  });

  it("SVG export draws a smaller small head", async () => {
    const points: LocalPoint[] = [pointFrom(0, 0), pointFrom(200, 0)];
    const plain = {
      ...API.createElement({
        type: "arrow",
        width: 200,
        height: 0,
        roughness: 0,
        points,
      }),
      endArrowhead: "arrow" as const,
    };
    const small = { ...plain, arrowheadSize: "small" as const };

    const smallExtent = await headExtent(small as NonDeletedExcalidrawElement);
    const plainExtent = await headExtent(plain as NonDeletedExcalidrawElement);

    expect(smallExtent).toBeLessThan(plainExtent * 0.9);
  });
});
