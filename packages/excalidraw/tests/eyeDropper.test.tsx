import React from "react";
import tinycolor from "tinycolor2";

import { applyDarkModeFilter, COLOR_PALETTE, THEME } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { activeEyeDropperAtom } from "../components/EyeDropper";
import { editorJotaiStore } from "../editor-jotai";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

const { h } = window;

const maxChannelDiff = (a: string, b: string) => {
  const rgbA = tinycolor(a).toRgb();
  const rgbB = tinycolor(b).toRgb();
  return Math.max(
    Math.abs(rgbA.r - rgbB.r),
    Math.abs(rgbA.g - rgbB.g),
    Math.abs(rgbA.b - rgbB.b),
  );
};

const mockCanvasPixel = (hexColor: string) => {
  const { r, g, b } = tinycolor(hexColor).toRgb();
  const ctx = GlobalTestState.canvas.getContext("2d")!;
  return vi.spyOn(ctx, "getImageData").mockReturnValue({
    data: new Uint8ClampedArray([r, g, b, 255]),
    width: 1,
    height: 1,
    colorSpace: "srgb",
  } as ImageData);
};

describe("eye dropper", () => {
  afterEach(() => {
    act(() => {
      editorJotaiStore.set(activeEyeDropperAtom, null);
    });
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

  it("saves the real element color when picking in dark theme", async () => {
    const sourceColor = COLOR_PALETTE.black; // #1e1e1e
    const sourceRect = API.createElement({
      type: "rectangle",
      backgroundColor: sourceColor,
    });
    const targetRect = API.createElement({
      type: "rectangle",
      backgroundColor: COLOR_PALETTE.red[1],
    });

    await render(
      <Excalidraw
        theme={THEME.DARK}
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{
          elements: [sourceRect, targetRect],
          appState: {
            selectedElementIds: { [targetRect.id]: true },
          },
        }}
      />,
    );

    // In dark theme, the static canvas renders sourceColor through applyDarkModeFilter
    const onScreenDarkColor = applyDarkModeFilter(sourceColor);
    const getImageDataSpy = mockCanvasPixel(onScreenDarkColor);

    try {
      Keyboard.keyPress("i");

      const preview = await waitFor(() => {
        const element =
          GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
            ".excalidraw-eye-dropper-preview",
          );
        expect(element).not.toBeNull();
        return element!;
      });

      const backdrop =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-backdrop",
        )!;

      // Preview element uses CSS `filter: var(--theme-filter)`, so its inline
      // background must be the untransformed (real) color.
      expect(tinycolor(preview.style.backgroundColor).toHexString()).toBe(
        sourceColor,
      );

      // Dragging with pointer down updates the target element live with the real color
      fireEvent.pointerDown(backdrop, { clientX: 50, clientY: 50 });
      fireEvent.pointerMove(window, { clientX: 55, clientY: 55 });
      expect(h.elements[1].backgroundColor).toBe(sourceColor);

      // Releasing selects and commits the real color
      fireEvent.pointerUp(backdrop, { clientX: 55, clientY: 55 });
      expect(h.elements[1].backgroundColor).toBe(sourceColor);
    } finally {
      getImageDataSpy.mockRestore();
    }
  });

  it("round-trips chromatic colors picked in dark theme", async () => {
    const sourceColor = COLOR_PALETTE.blue[4]; // #1971c2
    const targetRect = API.createElement({
      type: "rectangle",
      backgroundColor: COLOR_PALETTE.red[1],
    });

    await render(
      <Excalidraw
        theme={THEME.DARK}
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{
          elements: [targetRect],
          appState: {
            selectedElementIds: { [targetRect.id]: true },
          },
        }}
      />,
    );

    const onScreenDarkColor = applyDarkModeFilter(sourceColor);
    const getImageDataSpy = mockCanvasPixel(onScreenDarkColor);

    try {
      Keyboard.keyPress("i");

      await waitFor(() => {
        expect(
          GlobalTestState.renderResult.container.querySelector(
            ".excalidraw-eye-dropper-preview",
          ),
        ).not.toBeNull();
      });

      const backdrop =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-backdrop",
        )!;

      fireEvent.pointerDown(backdrop, { clientX: 50, clientY: 50 });
      fireEvent.pointerUp(backdrop, { clientX: 50, clientY: 50 });

      const pickedColor = h.elements[0].backgroundColor;
      // Rendered in dark mode, the picked color must match what was on screen
      expect(
        maxChannelDiff(applyDarkModeFilter(pickedColor), onScreenDarkColor),
      ).toBeLessThanOrEqual(1);
      // And its RGB channels must closely match the original color
      expect(maxChannelDiff(pickedColor, sourceColor)).toBeLessThanOrEqual(2);
    } finally {
      getImageDataSpy.mockRestore();
    }
  });

  it("saves the raw pixel color without inverting in light theme", async () => {
    const sourceColor = COLOR_PALETTE.black; // #1e1e1e
    const targetRect = API.createElement({
      type: "rectangle",
      backgroundColor: COLOR_PALETTE.red[1],
    });

    await render(
      <Excalidraw
        theme={THEME.LIGHT}
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{
          elements: [targetRect],
          appState: {
            selectedElementIds: { [targetRect.id]: true },
          },
        }}
      />,
    );

    const getImageDataSpy = mockCanvasPixel(sourceColor);

    try {
      Keyboard.keyPress("i");

      await waitFor(() => {
        expect(
          GlobalTestState.renderResult.container.querySelector(
            ".excalidraw-eye-dropper-preview",
          ),
        ).not.toBeNull();
      });

      const backdrop =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-backdrop",
        )!;

      fireEvent.pointerDown(backdrop, { clientX: 50, clientY: 50 });
      fireEvent.pointerUp(backdrop, { clientX: 50, clientY: 50 });

      expect(h.elements[0].backgroundColor).toBe(sourceColor);
    } finally {
      getImageDataSpy.mockRestore();
    }
  });
});
