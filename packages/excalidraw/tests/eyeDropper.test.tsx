import React from "react";

import { applyDarkModeFilter, rgbToHex, THEME } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  fireEvent,
  GlobalTestState,
  render,
  togglePopover,
  waitFor,
} from "./test-utils";

const { h } = window;

/** stubs the canvas so every pixel the eye dropper reads is `color` */
const mockCanvasPixel = (color: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  return vi
    .spyOn(h.app.canvas.getContext("2d")!, "getImageData")
    .mockImplementation(
      () =>
        ({
          data: new Uint8ClampedArray([r, g, b, 255]),
        } as ImageData),
    );
};

const getEyeDropperBackdrop = () =>
  waitFor(() => {
    const backdrop =
      GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
        ".excalidraw-eye-dropper-backdrop",
      );
    expect(backdrop).not.toBeNull();
    return backdrop!;
  });

/** opens the background eye dropper and clicks the canvas */
const pickBackgroundColor = async () => {
  Keyboard.keyPress("i");
  const backdrop = await getEyeDropperBackdrop();
  fireEvent.pointerDown(backdrop, { clientX: 50, clientY: 50 });
  fireEvent.pointerUp(backdrop, { clientX: 50, clientY: 50 });
};

describe("eye dropper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

  describe("dark theme", () => {
    const setup = async (pickedColor: string) => {
      await render(
        <Excalidraw
          autoFocus={true}
          handleKeyboardGlobally={true}
          theme={THEME.DARK}
        />,
      );
      const picked = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        backgroundColor: pickedColor,
        fillStyle: "solid",
      });
      const target = API.createElement({
        type: "rectangle",
        x: 200,
        y: 0,
        backgroundColor: "#ffffff",
        fillStyle: "solid",
      });
      API.setElements([picked, target]);
      API.setSelectedElements([target]);
      // the canvas shows the picked color through the dark mode transform
      mockCanvasPixel(applyDarkModeFilter(pickedColor));
      return { target };
    };

    it("picks the element's actual color, not the rendered one", async () => {
      const { target } = await setup("#1e1e1e");

      await pickBackgroundColor();

      expect(API.getElement(target).backgroundColor).toBe("#1e1e1e");
    });

    it.each(["#e03131", "#ffd43b", "#123456", "#7a3cbe"])(
      "picks the exact color %s used in the scene",
      async (color) => {
        const { target } = await setup(color);

        await pickBackgroundColor();

        expect(API.getElement(target).backgroundColor).toBe(color);
      },
    );

    it("picks a color that renders as the picked pixel", async () => {
      await render(
        <Excalidraw
          autoFocus={true}
          handleKeyboardGlobally={true}
          theme={THEME.DARK}
        />,
      );
      // e.g. an image or anti-aliased edge, not an element's color
      const pixel = "#3a6f9c";
      mockCanvasPixel(pixel);

      await pickBackgroundColor();

      expect(h.state.currentItemBackgroundColor).not.toBe(pixel);
      expect(applyDarkModeFilter(h.state.currentItemBackgroundColor)).toBe(
        pixel,
      );
    });

    it("shows the picked color in the color picker's hex input", async () => {
      const { target } = await setup("#1e1e1e");

      await pickBackgroundColor();
      expect(API.getElement(target).backgroundColor).toBe("#1e1e1e");

      togglePopover("Background");
      const input = document.querySelector<HTMLInputElement>(
        ".color-picker-content .color-picker-input",
      );
      expect(input?.value).toBe("1e1e1e");
    });
  });

  it("picks the rendered color as-is in light theme", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    const pixel = rgbToHex(0x3a, 0x6f, 0x9c);
    mockCanvasPixel(pixel);

    await pickBackgroundColor();

    expect(h.state.currentItemBackgroundColor).toBe(pixel);
  });
});
