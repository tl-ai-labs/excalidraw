import React from "react";

import { applyDarkModeFilter, COLOR_PALETTE, THEME } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

const { h } = window;

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
});

describe("eye dropper in dark theme", () => {
  const pickPixel = async (pixel: string) => {
    Keyboard.keyPress("i");

    const backdrop = await waitFor(() => {
      const element =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-backdrop",
        );
      expect(element).not.toBeNull();
      return element!;
    });

    const r = parseInt(pixel.slice(1, 3), 16);
    const g = parseInt(pixel.slice(3, 5), 16);
    const b = parseInt(pixel.slice(5, 7), 16);

    const spy = vi
      .spyOn(h.app.canvas.getContext("2d")!, "getImageData")
      .mockReturnValue({
        data: new Uint8ClampedArray([r, g, b, 255]),
      } as unknown as ImageData);

    fireEvent.pointerUp(backdrop, { clientX: 10, clientY: 10 });

    spy.mockRestore();
  };

  it("dark theme: stores the palette colour an element was drawn with, not its on-screen colour", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        theme={THEME.DARK}
      />,
    );

    await pickPixel(applyDarkModeFilter(COLOR_PALETTE.red[4]));

    expect(h.state.currentItemBackgroundColor).toBe(COLOR_PALETTE.red[4]);
  });

  it("dark theme: stores an off-palette element colour from the scene, not its numeric inverse", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        theme={THEME.DARK}
        initialData={{
          elements: [
            API.createElement({
              type: "rectangle",
              backgroundColor: "#ff00ff",
              fillStyle: "solid",
            }),
          ],
        }}
      />,
    );

    await pickPixel(applyDarkModeFilter("#ff00ff"));

    expect(h.state.currentItemBackgroundColor).toBe("#ff00ff");
  });

  it("dark theme: stores the canvas background colour from the scene, not its on-screen colour", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        theme={THEME.DARK}
        initialData={{ appState: { viewBackgroundColor: "#00ffff" } }}
      />,
    );

    await pickPixel(applyDarkModeFilter("#00ffff"));

    expect(h.state.currentItemBackgroundColor).toBe("#00ffff");
  });

  it("light theme: stores the raw pixel unchanged", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        theme={THEME.LIGHT}
      />,
    );

    await pickPixel(applyDarkModeFilter(COLOR_PALETTE.red[4]));

    expect(h.state.currentItemBackgroundColor).toBe(
      applyDarkModeFilter(COLOR_PALETTE.red[4]),
    );
  });
});
