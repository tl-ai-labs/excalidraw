import React from "react";
import { vi } from "vitest";

import { THEME, applyDarkModeFilter } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

describe("eye dropper", () => {
  beforeAll(() => {
    (global as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
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

  it("reverts dark mode color transform when picking a color in dark theme", async () => {
    const targetRect = API.createElement({
      type: "rectangle",
      backgroundColor: "#ff0000",
    });

    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        theme={THEME.DARK}
        initialData={{
          elements: [targetRect],
          appState: {
            selectedElementIds: { [targetRect.id]: true },
          },
        }}
      />,
    );

    // #1e1e1e in dark mode renders on canvas as #d3d3d3 (rgb(211, 211, 211))
    expect(applyDarkModeFilter("#1e1e1e")).toBe("#d3d3d3");
    expect(GlobalTestState.canvas).toBe(window.h.app.canvas);
    const ctx = GlobalTestState.canvas.getContext("2d")!;
    const getImageDataSpy = vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([211, 211, 211, 255]),
      width: 1,
      height: 1,
      colorSpace: "srgb",
    });

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

    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
    expect(preview.style.background).toBe("rgb(30, 30, 30)");

    fireEvent.pointerDown(eyeDropperContainer, { clientX: 50, clientY: 50 });
    fireEvent.pointerUp(eyeDropperContainer, { clientX: 50, clientY: 50 });

    expect(window.h.elements[0].backgroundColor).toBe("#1e1e1e");

    // color picker hex input should also reflect the real color, not #d3d3d3
    const bgTrigger =
      GlobalTestState.renderResult.container.querySelector<HTMLButtonElement>(
        '[data-openpopup="elementBackground"]',
      )!;
    fireEvent.click(bgTrigger);
    const hexInput = document.querySelector<HTMLInputElement>(
      ".color-picker-input",
    );
    expect(hexInput?.value).toBe("1e1e1e");

    getImageDataSpy.mockRestore();
  });

  it("reverts dark mode color transform for chromatic colors in dark theme", async () => {
    const targetRect = API.createElement({
      type: "rectangle",
      strokeColor: "#000000",
    });

    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        theme={THEME.DARK}
        initialData={{
          elements: [targetRect],
          appState: {
            selectedElementIds: { [targetRect.id]: true },
          },
        }}
      />,
    );

    // #1971c2 in dark mode renders on canvas as #56a2e8 (rgb(86, 162, 232))
    expect(applyDarkModeFilter("#1971c2")).toBe("#56a2e8");
    const ctx = GlobalTestState.canvas.getContext("2d")!;
    const getImageDataSpy = vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([86, 162, 232, 255]),
      width: 1,
      height: 1,
      colorSpace: "srgb",
    });

    Keyboard.keyPress("i");

    await waitFor(() => {
      expect(
        GlobalTestState.renderResult.container.querySelector(
          ".excalidraw-eye-dropper-preview",
        ),
      ).not.toBeNull();
    });

    const eyeDropperContainer =
      GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
        ".excalidraw-eye-dropper-backdrop",
      )!;

    fireEvent.pointerDown(eyeDropperContainer, { clientX: 50, clientY: 50 });
    fireEvent.pointerUp(eyeDropperContainer, { clientX: 50, clientY: 50 });

    expect(window.h.elements[0].backgroundColor).toBe("#1971c2");

    getImageDataSpy.mockRestore();
  });

  it("does not alter picked color in light theme", async () => {
    const targetRect = API.createElement({
      type: "rectangle",
      backgroundColor: "#ff0000",
    });

    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        theme={THEME.LIGHT}
        initialData={{
          elements: [targetRect],
          appState: {
            selectedElementIds: { [targetRect.id]: true },
          },
        }}
      />,
    );

    const ctx = GlobalTestState.canvas.getContext("2d")!;
    const getImageDataSpy = vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([30, 30, 30, 255]),
      width: 1,
      height: 1,
      colorSpace: "srgb",
    });

    Keyboard.keyPress("i");

    await waitFor(() => {
      expect(
        GlobalTestState.renderResult.container.querySelector(
          ".excalidraw-eye-dropper-preview",
        ),
      ).not.toBeNull();
    });

    const eyeDropperContainer =
      GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
        ".excalidraw-eye-dropper-backdrop",
      )!;

    fireEvent.pointerDown(eyeDropperContainer, { clientX: 50, clientY: 50 });
    fireEvent.pointerUp(eyeDropperContainer, { clientX: 50, clientY: 50 });

    expect(window.h.elements[0].backgroundColor).toBe("#1e1e1e");

    // color picker hex input should also reflect the real color, not #d3d3d3
    const bgTrigger =
      GlobalTestState.renderResult.container.querySelector<HTMLButtonElement>(
        '[data-openpopup="elementBackground"]',
      )!;
    fireEvent.click(bgTrigger);
    const hexInput = document.querySelector<HTMLInputElement>(
      ".color-picker-input",
    );
    expect(hexInput?.value).toBe("1e1e1e");

    getImageDataSpy.mockRestore();
  });
});
