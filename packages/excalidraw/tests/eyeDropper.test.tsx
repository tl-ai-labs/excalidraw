import React from "react";
import { vi } from "vitest";

import { applyDarkModeFilter, COLOR_PALETTE, THEME } from "@excalidraw/common";
import { ShapeCache } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { activeEyeDropperAtom } from "../components/EyeDropper";
import { editorJotaiStore } from "../editor-jotai";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  togglePopover,
  waitFor,
} from "./test-utils";

import type { Drawable } from "roughjs/bin/core";

const darkFill = (element: ExcalidrawElement) =>
  (ShapeCache.get(element, THEME.DARK) as Drawable | undefined)?.options.fill;

describe("eye dropper", () => {
  beforeEach(() => {
    // the eyedropper state lives in a shared store, so a test that leaves it
    // open would make the next test's trigger click close it
    editorJotaiStore.set(activeEyeDropperAtom, null);
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("keeps the color preview within the editor container", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);

    Keyboard.keyPress("i");

    const preview = await waitFor(() => {
      const element =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-preview",
        );
      expect(element).not.toBeNull();
      return element!;
    });

    const eyeDropperContainer =
      GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
        ".excalidraw-eye-dropper-backdrop",
      )!;

    eyeDropperContainer.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      right: 500,
      bottom: 350,
      width: 400,
      height: 300,
      x: 100,
      y: 50,
      toJSON: () => {},
    });
    Object.defineProperties(preview, {
      offsetWidth: { configurable: true, value: 48 },
      offsetHeight: { configurable: true, value: 48 },
    });

    // This position fits within the viewport, but not within the editor.
    fireEvent.pointerMove(window, { clientX: 480, clientY: 330 });

    expect(preview.style.left).toBe("312px");
    expect(preview.style.top).toBe("212px");
  });

  it("inverts dark-mode canvas pixel when picking color in dark theme", async () => {
    // jsdom gives the editor a 0×0 viewport, which leaves the target
    // rectangle unrendered and its shape cache empty
    mockBoundingClientRect({ width: 1000, height: 1000 });
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{ appState: { theme: THEME.DARK } }}
      />,
    );

    const sourceRect = API.createElement({
      type: "rectangle",
      backgroundColor: COLOR_PALETTE.black,
      fillStyle: "solid",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const targetRect = API.createElement({
      type: "rectangle",
      backgroundColor: COLOR_PALETTE.white,
      fillStyle: "solid",
      x: 120,
      y: 0,
      width: 100,
      height: 100,
    });

    API.setElements([sourceRect, targetRect]);
    API.setSelectedElements([targetRect]);

    await waitFor(() => {
      expect(darkFill(sourceRect)).toBe(
        applyDarkModeFilter(COLOR_PALETTE.black),
      );
    });

    vi.spyOn(
      GlobalTestState.canvas.getContext("2d")!,
      "getImageData",
    ).mockReturnValue({
      data: new Uint8ClampedArray([211, 211, 211, 255]),
      width: 1,
      height: 1,
      colorSpace: "srgb",
    } as ImageData);

    togglePopover("Background");

    const trigger = await waitFor(() => {
      const el =
        GlobalTestState.renderResult.container.querySelector<HTMLButtonElement>(
          ".excalidraw-eye-dropper-trigger",
        );
      expect(el).not.toBeNull();
      return el!;
    });
    fireEvent.click(trigger);

    const eyeDropperContainer = await waitFor(() => {
      const el =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-backdrop",
        );
      expect(el).not.toBeNull();
      return el!;
    });

    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
    fireEvent.pointerDown(eyeDropperContainer, { clientX: 50, clientY: 50 });
    fireEvent.pointerUp(eyeDropperContainer, { clientX: 50, clientY: 50 });

    expect(window.h.elements[1].backgroundColor).toBe(COLOR_PALETTE.black);
    await waitFor(() => {
      expect(darkFill(window.h.elements[1])).toBe(
        darkFill(window.h.elements[0]),
      );
    });
    expect(
      (
        GlobalTestState.renderResult.container.querySelector(
          ".color-picker-input",
        ) as HTMLInputElement
      ).value,
    ).toBe("1e1e1e");
  });

  it("keeps sampled canvas pixel unchanged in light theme", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{ appState: { theme: THEME.LIGHT } }}
      />,
    );

    const targetRect = API.createElement({
      type: "rectangle",
      backgroundColor: COLOR_PALETTE.white,
      fillStyle: "solid",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });

    API.setElements([targetRect]);
    API.setSelectedElements([targetRect]);

    vi.spyOn(
      GlobalTestState.canvas.getContext("2d")!,
      "getImageData",
    ).mockReturnValue({
      data: new Uint8ClampedArray([30, 30, 30, 255]),
      width: 1,
      height: 1,
      colorSpace: "srgb",
    } as ImageData);

    togglePopover("Background");

    const trigger = await waitFor(() => {
      const el =
        GlobalTestState.renderResult.container.querySelector<HTMLButtonElement>(
          ".excalidraw-eye-dropper-trigger",
        );
      expect(el).not.toBeNull();
      return el!;
    });
    fireEvent.click(trigger);

    const eyeDropperContainer = await waitFor(() => {
      const el =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-backdrop",
        );
      expect(el).not.toBeNull();
      return el!;
    });

    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
    fireEvent.pointerDown(eyeDropperContainer, { clientX: 50, clientY: 50 });
    fireEvent.pointerUp(eyeDropperContainer, { clientX: 50, clientY: 50 });

    expect(window.h.elements[0].backgroundColor).toBe(COLOR_PALETTE.black);
  });

  it("draws bucket-fill cursor droplet with dark-mode-filtered color in dark theme", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{
          appState: {
            theme: THEME.DARK,
            currentItemBackgroundColor: COLOR_PALETTE.black,
          },
        }}
      />,
    );

    act(() => {
      window.h.app.setActiveTool({ type: "bucketfill" });
    });

    expect(
      decodeURIComponent(GlobalTestState.interactiveCanvas.style.cursor),
    ).toContain(`fill="${applyDarkModeFilter(COLOR_PALETTE.black)}"`);
  });

  it("draws bucket-fill cursor droplet with untransformed color in light theme", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{
          appState: {
            theme: THEME.LIGHT,
            currentItemBackgroundColor: COLOR_PALETTE.black,
          },
        }}
      />,
    );

    act(() => {
      window.h.app.setActiveTool({ type: "bucketfill" });
    });

    expect(
      decodeURIComponent(GlobalTestState.interactiveCanvas.style.cursor),
    ).toContain(`fill="${COLOR_PALETTE.black}"`);
  });
});
