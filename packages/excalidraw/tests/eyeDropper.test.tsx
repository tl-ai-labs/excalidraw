import React from "react";
import { vi } from "vitest";

import { applyDarkModeFilter, THEME } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

describe("eye dropper", () => {
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

  it("picks the real element color in dark theme instead of the dark-mode transformed pixel", async () => {
    (global as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    const pickedColor = "#1e1e1e";
    const darkModePixelHex = applyDarkModeFilter(pickedColor); // "#d3d3d3"
    const pixelRgb = [
      parseInt(darkModePixelHex.slice(1, 3), 16),
      parseInt(darkModePixelHex.slice(3, 5), 16),
      parseInt(darkModePixelHex.slice(5, 7), 16),
      255,
    ];

    const sourceRect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: pickedColor,
      strokeColor: pickedColor,
    });
    const targetRect = API.createElement({
      type: "rectangle",
      x: 200,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "#ffffff",
      strokeColor: "#1e1e1e",
    });

    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{
          elements: [sourceRect, targetRect],
          appState: {
            theme: THEME.DARK,
            selectedElementIds: { [targetRect.id]: true },
          },
        }}
      />,
    );

    const ctx = GlobalTestState.canvas.getContext("2d")!;
    const getImageDataSpy = vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray(pixelRgb),
      width: 1,
      height: 1,
      colorSpace: "srgb",
    });

    try {
      // Open the background color picker
      const bgButton =
        GlobalTestState.renderResult.container.querySelector<HTMLElement>(
          '[aria-label="Background"]',
        );
      expect(bgButton).not.toBeNull();
      fireEvent.click(bgButton!);

      // Activate eyedropper (I)
      Keyboard.keyPress("i");

      const backdrop = await waitFor(() => {
        const el =
          GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
            ".excalidraw-eye-dropper-backdrop",
          );
        expect(el).not.toBeNull();
        return el!;
      });

      const preview =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-preview",
        )!;

      fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
      // Preview background should hold the real color (CSS --theme-filter transforms it on screen)
      expect(preview.style.background).toBe("rgb(30, 30, 30)");

      fireEvent.pointerDown(backdrop, { clientX: 50, clientY: 50 });
      fireEvent.pointerUp(backdrop, { clientX: 50, clientY: 50 });

      const updatedTarget = window.h.elements.find(
        (el) => el.id === targetRect.id,
      )!;
      expect(updatedTarget.backgroundColor).toBe(pickedColor);

      // Color picker hex input should match the real color
      const hexInput =
        GlobalTestState.renderResult.container.querySelector<HTMLInputElement>(
          "input.color-picker-input",
        );
      expect(hexInput).not.toBeNull();
      expect(hexInput!.value).toBe(pickedColor.replace(/^#/, ""));
    } finally {
      getImageDataSpy.mockRestore();
    }
  });

  it("keeps light theme behavior unchanged", async () => {
    const pickedColor = "#1e1e1e";
    const pixelRgb = [30, 30, 30, 255];

    const targetRect = API.createElement({
      type: "rectangle",
      x: 200,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "#ffffff",
      strokeColor: "#1e1e1e",
    });

    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{
          elements: [targetRect],
          appState: {
            theme: THEME.LIGHT,
            selectedElementIds: { [targetRect.id]: true },
          },
        }}
      />,
    );

    const ctx = GlobalTestState.canvas.getContext("2d")!;
    const getImageDataSpy = vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray(pixelRgb),
      width: 1,
      height: 1,
      colorSpace: "srgb",
    });

    try {
      Keyboard.keyPress("i");

      const backdrop = await waitFor(() => {
        const el =
          GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
            ".excalidraw-eye-dropper-backdrop",
          );
        expect(el).not.toBeNull();
        return el!;
      });

      const preview =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-preview",
        )!;

      fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
      expect(preview.style.background).toBe("rgb(30, 30, 30)");

      fireEvent.pointerDown(backdrop, { clientX: 50, clientY: 50 });
      fireEvent.pointerUp(backdrop, { clientX: 50, clientY: 50 });

      const updatedTarget = window.h.elements.find(
        (el) => el.id === targetRect.id,
      )!;
      expect(updatedTarget.backgroundColor).toBe(pickedColor);
    } finally {
      getImageDataSpy.mockRestore();
    }
  });
});
