import React from "react";

import { applyDarkModeFilter, THEME } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { Keyboard } from "./helpers/ui";
import { fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

const { h } = window;

const parseHex = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const expectHexWithin = (actual: string, expected: string, tolerance = 2) => {
  const a = parseHex(actual);
  const e = parseHex(expected);
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(a[i] - e[i])).toBeLessThanOrEqual(tolerance);
  }
};

const hexToPixel = (hex: string) => {
  const [r, g, b] = parseHex(hex);
  return new Uint8ClampedArray([r, g, b, 255]);
};

const openEyeDropperWithPixel = async (pixel: Uint8ClampedArray) => {
  Keyboard.keyPress("i");

  const preview = await waitFor(() => {
    const element =
      GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
        ".excalidraw-eye-dropper-preview",
      );
    expect(element).not.toBeNull();
    return element!;
  });

  vi.spyOn(h.app.canvas.getContext("2d")!, "getImageData").mockReturnValue({
    data: pixel,
  } as unknown as ImageData);

  const backdrop =
    GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
      ".excalidraw-eye-dropper-backdrop",
    )!;

  return { preview, backdrop };
};

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

  it("picks the real element colour in dark theme", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        theme={THEME.DARK}
      />,
    );

    const darkHex = applyDarkModeFilter("#1971c2");
    const pixel = hexToPixel(darkHex);
    const { preview, backdrop } = await openEyeDropperWithPixel(pixel);

    fireEvent.pointerDown(backdrop);
    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });

    expectHexWithin(h.state.currentItemBackgroundColor, "#1971c2");
    expect([darkHex, `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`]).toContain(
      preview.style.background,
    );

    fireEvent.pointerUp(backdrop, { clientX: 10, clientY: 10 });

    expectHexWithin(h.state.currentItemBackgroundColor, "#1971c2");
  });

  it("picks the sampled colour unchanged in light theme", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);

    const { backdrop } = await openEyeDropperWithPixel(hexToPixel("#1971c2"));

    fireEvent.pointerDown(backdrop);
    fireEvent.pointerUp(backdrop, { clientX: 10, clientY: 10 });

    expect(h.state.currentItemBackgroundColor).toBe("#1971c2");
  });
});
