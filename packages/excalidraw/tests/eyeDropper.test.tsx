import React from "react";

import { applyDarkModeFilter, THEME } from "@excalidraw/common";

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

/** make the canvas report `pixel` for any getImageData() call */
const mockCanvasPixel = (pixel: number[]) => {
  const ctx = h.app.canvas.getContext("2d") as any;
  ctx.getImageData = () => ({ data: [...pixel, 255] });
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

  describe("dark theme", () => {
    const REAL_COLOR = "#1e1e1e"; // near-black

    beforeAll(() => {
      (global as any).ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    });

    const pickFromCanvas = async (
      keyOpts: { shiftKey: boolean; key: string },
      { altKey = false } = {},
    ) => {
      // canvas pixel as drawn in dark theme: the filtered color
      const screen = applyDarkModeFilter(REAL_COLOR);
      const pixel = [1, 3, 5].map((i) => parseInt(screen.slice(i, i + 2), 16));
      mockCanvasPixel(pixel);

      Keyboard.withModifierKeys({ shift: keyOpts.shiftKey }, () => {
        Keyboard.keyPress(keyOpts.key);
      });
      const backdrop = await waitFor(() => {
        const el = GlobalTestState.renderResult.container.querySelector(
          ".excalidraw-eye-dropper-backdrop",
        );
        expect(el).not.toBeNull();
        return el!;
      });
      fireEvent.pointerDown(backdrop, { clientX: 10, clientY: 10 });
      fireEvent.pointerUp(backdrop, { clientX: 10, clientY: 10, altKey });
    };

    const setup = async () => {
      await render(
        <Excalidraw
          theme={THEME.DARK}
          autoFocus={true}
          handleKeyboardGlobally={true}
        />,
      );
      const target = API.createElement({
        type: "rectangle",
        x: 200,
        y: 200,
        width: 50,
        height: 50,
        strokeColor: "#e03131",
        backgroundColor: "#a5d8ff",
      });
      API.setElements([target]);
      API.setSelectedElements([target]);
      return target;
    };

    it("saves the element's real color as stroke", async () => {
      const target = await setup();
      await pickFromCanvas({ key: "S", shiftKey: true });

      const updated = h.elements[0];
      expect(updated.strokeColor).toBe(REAL_COLOR);
      expect(updated.backgroundColor).toBe("#a5d8ff");
      expect(h.state.theme).toBe(THEME.DARK);

      togglePopover("Stroke");
      const input = document.querySelector<HTMLInputElement>(
        ".color-picker-input",
      )!;
      expect(input.value.replace("#", "").toLowerCase()).toBe(
        REAL_COLOR.slice(1),
      );
      expect(target.id).toBe(updated.id);
    });

    it("saves the element's real color as background", async () => {
      await setup();
      await pickFromCanvas({ key: "i", shiftKey: false });

      const updated = h.elements[0];
      expect(updated.backgroundColor).toBe(REAL_COLOR);
      expect(updated.strokeColor).toBe("#e03131");

      togglePopover("Background");
      const input = document.querySelector<HTMLInputElement>(
        ".color-picker-input",
      )!;
      expect(input.value.replace("#", "").toLowerCase()).toBe(
        REAL_COLOR.slice(1),
      );
    });

    it("keeps the preview showing the on-screen color", async () => {
      await setup();
      mockCanvasPixel([237, 237, 237]);
      Keyboard.keyPress("i");
      const preview = await waitFor(() => {
        const el =
          GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
            ".excalidraw-eye-dropper-preview",
          );
        expect(el).not.toBeNull();
        return el!;
      });
      expect(preview.style.background).toBe("rgb(237, 237, 237)");
    });
  });
});
