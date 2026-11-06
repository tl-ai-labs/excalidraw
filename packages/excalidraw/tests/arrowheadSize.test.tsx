import React from "react";

import {
  ARROWHEAD_SIZES,
  CaptureUpdateAction,
  DEFAULT_ARROWHEAD_SIZE,
  newElementWith,
} from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawArrowElement,
  FractionalIndex,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { actionChangeArrowheadSize } from "../actions/actionProperties";
import { actionCopyStyles, actionPasteStyles } from "../actions/actionStyles";
import { getDefaultAppState } from "../appState";
import { reconcileElements } from "../data/reconcile";
import { restoreElements } from "../data/restore";
import { Excalidraw } from "../index";
import { exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard, UI } from "./helpers/ui";
import { act, fireEvent, render, screen } from "./test-utils";

import type { RemoteExcalidrawElement } from "../data/reconcile";

const { h } = window;

const getPathBoundingSpan = (d: string): number => {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < numbers.length - 1; i += 2) {
    xs.push(numbers[i]);
    ys.push(numbers[i + 1]);
  }
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return Math.hypot(width, height);
};

describe("arrowheadSize", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it("restores an arrow with smaller arrowheadSize and exports a smaller SVG head than default while keeping legacy arrows unchanged", async () => {
    const baseOpts = {
      type: "arrow" as const,
      id: "arrow-test",
      x: 0,
      y: 0,
      width: 200,
      height: 0,
      points: [
        [0, 0],
        [200, 0],
      ] as LocalPoint[],
      startArrowhead: null,
      endArrowhead: "arrow" as const,
      roughness: 0,
      seed: 42,
      index: "a0" as FractionalIndex,
    };

    const legacyArrow = API.createElement(baseOpts);
    delete (legacyArrow as { arrowheadSize?: number }).arrowheadSize;

    const smallArrow = {
      ...API.createElement(baseOpts),
      arrowheadSize: ARROWHEAD_SIZES.small,
    };

    const [restoredLegacy] = restoreElements([legacyArrow], null);
    const [restoredSmall] = restoreElements([smallArrow], null);

    expect("arrowheadSize" in restoredLegacy).toBe(false);
    expect((restoredSmall as ExcalidrawArrowElement).arrowheadSize).toBe(0.5);

    const legacySvg = await exportScene({
      type: "svg",
      data: {
        elements: [restoredLegacy as NonDeletedExcalidrawElement],
        appState: getDefaultAppState(),
        files: {},
      },
    });
    const unretouchedLegacySvg = await exportScene({
      type: "svg",
      data: {
        elements: [legacyArrow as NonDeletedExcalidrawElement],
        appState: getDefaultAppState(),
        files: {},
      },
    });
    const smallSvg = await exportScene({
      type: "svg",
      data: {
        elements: [restoredSmall as NonDeletedExcalidrawElement],
        appState: getDefaultAppState(),
        files: {},
      },
    });

    const legacyPaths = Array.from(legacySvg.querySelectorAll("path")).map(
      (p) => p.getAttribute("d") ?? "",
    );
    const unretouchedLegacyPaths = Array.from(
      unretouchedLegacySvg.querySelectorAll("path"),
    ).map((p) => p.getAttribute("d") ?? "");
    const smallPaths = Array.from(smallSvg.querySelectorAll("path")).map(
      (p) => p.getAttribute("d") ?? "",
    );

    expect(legacyPaths).toEqual(unretouchedLegacyPaths);
    expect(legacyPaths.length).toBeGreaterThanOrEqual(2);
    expect(smallPaths.length).toBe(legacyPaths.length);

    const legacyHeadSpan = getPathBoundingSpan(
      legacyPaths[legacyPaths.length - 1],
    );
    const smallHeadSpan = getPathBoundingSpan(
      smallPaths[smallPaths.length - 1],
    );

    expect(smallHeadSpan).toBeLessThan(legacyHeadSpan);
  });

  it("updates selected arrows and currentItemArrowheadSize from the properties panel and omits the key at Medium", () => {
    expect(h.state.currentItemArrowheadSize).toBe(DEFAULT_ARROWHEAD_SIZE);

    UI.clickTool("arrow");
    fireEvent.click(screen.getByTestId("arrowheadSize-small"));
    expect(h.state.currentItemArrowheadSize).toBe(0.5);

    UI.createElement("arrow", { x: 10, y: 10, width: 100, height: 0 });
    expect((h.elements[0] as ExcalidrawArrowElement).arrowheadSize).toBe(0.5);

    API.setSelectedElements([h.elements[0] as NonDeletedExcalidrawElement]);
    fireEvent.click(screen.getByTestId("arrowheadSize-large"));
    expect((h.elements[0] as ExcalidrawArrowElement).arrowheadSize).toBe(1.5);
    expect(h.state.currentItemArrowheadSize).toBe(1.5);

    fireEvent.click(screen.getByTestId("arrowheadSize-medium"));
    expect("arrowheadSize" in h.elements[0]).toBe(false);
    expect(h.state.currentItemArrowheadSize).toBe(1);
  });

  it("undoes and redoes arrowheadSize changes through history deltas", () => {
    UI.createElement("arrow", { x: 10, y: 10, width: 100, height: 0 });
    expect("arrowheadSize" in h.elements[0]).toBe(false);

    API.setSelectedElements([h.elements[0] as NonDeletedExcalidrawElement]);
    fireEvent.click(screen.getByTestId("arrowheadSize-small"));
    expect((h.elements[0] as ExcalidrawArrowElement).arrowheadSize).toBe(0.5);

    fireEvent.click(screen.getByTestId("arrowheadSize-large"));
    expect((h.elements[0] as ExcalidrawArrowElement).arrowheadSize).toBe(1.5);

    Keyboard.undo();
    expect((h.elements[0] as ExcalidrawArrowElement).arrowheadSize).toBe(0.5);

    Keyboard.undo();
    expect(
      (h.elements[0] as ExcalidrawArrowElement).arrowheadSize,
    ).toBeUndefined();

    Keyboard.redo();
    expect((h.elements[0] as ExcalidrawArrowElement).arrowheadSize).toBe(0.5);

    Keyboard.redo();
    expect((h.elements[0] as ExcalidrawArrowElement).arrowheadSize).toBe(1.5);

    Keyboard.undo();
    Keyboard.undo();
    expect("arrowheadSize" in h.elements[0]).toBe(true);
    expect(
      (h.elements[0] as ExcalidrawArrowElement).arrowheadSize,
    ).toBeUndefined();

    const before = h.elements[0];
    API.setSelectedElements([before as NonDeletedExcalidrawElement]);
    // Pre-change to small or invoke actionChangeArrowheadSize directly since RadioSelection's input for Medium is already checked when arrowheadSize is undefined
    act(() => {
      h.app.actionManager.executeAction(
        actionChangeArrowheadSize,
        "ui",
        ARROWHEAD_SIZES.medium,
      );
    });
    expect("arrowheadSize" in h.elements[0]).toBe(false);
    expect(h.elements[0]).not.toBe(before);
    expect(h.elements[0].version).toBeGreaterThan(before.version);
  });

  it("copies and pastes arrowheadSize between arrows and clears it when pasting from a default-sized arrow", () => {
    const smallArrow = {
      ...API.createElement({
        type: "arrow",
        x: 0,
        y: 0,
        width: 100,
        height: 0,
      }),
      arrowheadSize: ARROWHEAD_SIZES.small,
    };
    const defaultArrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 50,
      width: 100,
      height: 0,
    });
    const secondDefaultArrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 100,
      width: 100,
      height: 0,
    });

    API.setElements([smallArrow, defaultArrow, secondDefaultArrow]);

    API.setSelectedElements([h.elements[0] as NonDeletedExcalidrawElement]);
    act(() => {
      h.app.actionManager.executeAction(actionCopyStyles);
    });

    API.setSelectedElements([h.elements[1] as NonDeletedExcalidrawElement]);
    act(() => {
      h.app.actionManager.executeAction(actionPasteStyles);
    });

    expect((h.elements[1] as ExcalidrawArrowElement).arrowheadSize).toBe(0.5);

    API.setSelectedElements([h.elements[2] as NonDeletedExcalidrawElement]);
    act(() => {
      h.app.actionManager.executeAction(actionCopyStyles);
    });

    API.setSelectedElements([h.elements[1] as NonDeletedExcalidrawElement]);
    act(() => {
      h.app.actionManager.executeAction(actionPasteStyles);
    });

    expect("arrowheadSize" in h.elements[1]).toBe(false);

    const undefinedKeyArrow = {
      ...API.createElement({
        type: "arrow",
        x: 0,
        y: 150,
        width: 100,
        height: 0,
      }),
      arrowheadSize: undefined,
    };
    API.setElements([defaultArrow, undefinedKeyArrow]);

    API.setSelectedElements([h.elements[0] as NonDeletedExcalidrawElement]);
    act(() => {
      h.app.actionManager.executeAction(actionCopyStyles);
    });

    const beforePaste = h.elements[1];
    expect("arrowheadSize" in beforePaste).toBe(true);
    API.setSelectedElements([beforePaste as NonDeletedExcalidrawElement]);
    act(() => {
      h.app.actionManager.executeAction(actionPasteStyles);
    });

    expect("arrowheadSize" in h.elements[1]).toBe(false);
    expect(h.elements[1]).not.toBe(beforePaste);
    expect(h.elements[1].version).toBeGreaterThan(beforePaste.version);
  });

  it("preserves arrowheadSize during collaboration reconciliation", () => {
    const localArrow = API.createElement({
      type: "arrow",
      x: 10,
      y: 10,
      width: 100,
      height: 0,
    });
    API.updateScene({
      elements: [localArrow],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    const remoteArrow = newElementWith(
      h.elements[0] as ExcalidrawArrowElement,
      {
        arrowheadSize: 1.5,
      },
    );

    const reconciled = reconcileElements(
      h.app.scene.getElementsIncludingDeleted(),
      [remoteArrow as RemoteExcalidrawElement],
      h.state,
    );

    API.updateScene({
      elements: reconciled,
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    expect((h.elements[0] as ExcalidrawArrowElement).arrowheadSize).toBe(1.5);
    expect(h.elements[0].version).toBe(remoteArrow.version);
  });
});
