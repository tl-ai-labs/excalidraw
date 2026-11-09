import React from "react";
import { vi } from "vitest";

import { applyDarkModeFilter, KEYS, THEME } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  render,
  togglePopover,
  waitFor,
} from "./test-utils";

const { h } = window;

describe("eye dropper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const stubPixel = (color: string) => {
    const hex = color.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    vi.spyOn(h.app.canvas.getContext("2d")!, "getImageData").mockImplementation(
      () =>
        ({
          data: Uint8ClampedArray.from([r, g, b, 255]),
        } as unknown as ImageData),
    );
  };

  const getBackdrop = async () => {
    return await waitFor(() => {
      const backdrop =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-backdrop",
        );
      expect(backdrop).not.toBeNull();
      return backdrop!;
    });
  };

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

  it("keeps the picked pixel colour unchanged in light theme", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);

    const rect = API.createElement({
      type: "rectangle",
      backgroundColor: "#ffc9c9",
      strokeColor: "#1971c2",
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    stubPixel("#d3d3d3");

    Keyboard.keyPress("i");

    const backdrop = await getBackdrop();
    fireEvent.pointerDown(backdrop);
    fireEvent.pointerMove(window, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(backdrop);

    expect(h.elements[0].backgroundColor).toBe("#d3d3d3");
  });

  describe("in dark theme", () => {
    it("saves the original colour on pointer up", async () => {
      await render(
        <Excalidraw
          autoFocus={true}
          handleKeyboardGlobally={true}
          theme={THEME.DARK}
        />,
      );

      const rect = API.createElement({
        type: "rectangle",
        backgroundColor: "#ffc9c9",
        strokeColor: "#1971c2",
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      stubPixel(applyDarkModeFilter("#1e1e1e"));

      Keyboard.keyPress("i");

      const backdrop = await getBackdrop();
      fireEvent.pointerDown(backdrop);
      fireEvent.pointerMove(window, { clientX: 100, clientY: 100 });
      fireEvent.pointerUp(backdrop);

      expect(h.elements[0].backgroundColor).toBe("#1e1e1e");
      expect(h.elements[0].strokeColor).toBe("#1971c2");
    });

    it("previews the original colour while the pointer is held", async () => {
      await render(
        <Excalidraw
          autoFocus={true}
          handleKeyboardGlobally={true}
          theme={THEME.DARK}
        />,
      );

      const rect = API.createElement({
        type: "rectangle",
        backgroundColor: "#ffc9c9",
        strokeColor: "#1971c2",
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      stubPixel(applyDarkModeFilter("#1e1e1e"));

      Keyboard.keyPress("i");

      const backdrop = await getBackdrop();
      fireEvent.pointerDown(backdrop);
      fireEvent.pointerMove(window, { clientX: 100, clientY: 100 });

      expect(h.elements[0].backgroundColor).toBe("#1e1e1e");
    });

    it("shows the original colour in the colour picker", async () => {
      await render(
        <Excalidraw
          autoFocus={true}
          handleKeyboardGlobally={true}
          theme={THEME.DARK}
        />,
      );

      const rect = API.createElement({
        type: "rectangle",
        backgroundColor: "#ffc9c9",
        strokeColor: "#1971c2",
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      stubPixel(applyDarkModeFilter("#1e1e1e"));

      Keyboard.keyPress("i");

      const backdrop = await getBackdrop();
      fireEvent.pointerDown(backdrop);
      fireEvent.pointerMove(window, { clientX: 100, clientY: 100 });
      fireEvent.pointerUp(backdrop);

      togglePopover("Background");

      const input = await waitFor(() => {
        const el =
          GlobalTestState.renderResult.container.querySelector<HTMLInputElement>(
            ".color-picker-input",
          );
        expect(el).not.toBeNull();
        return el!;
      });

      expect(input.value).toBe("1e1e1e");
    });

    it("fills and shows the original colour with the bucket-fill eyedropper", async () => {
      await render(
        <Excalidraw
          autoFocus={true}
          handleKeyboardGlobally={true}
          theme={THEME.DARK}
        />,
      );

      act(() => {
        h.app.setActiveTool({ type: "bucketfill" });
      });

      stubPixel(applyDarkModeFilter("#ffc9c9"));

      Keyboard.withModifierKeys({ alt: true }, () => {
        Keyboard.keyDown(KEYS.ALT);
      });

      const backdrop = await getBackdrop();
      fireEvent.pointerDown(backdrop, { altKey: true });
      fireEvent.pointerMove(window, {
        clientX: 100,
        clientY: 100,
        altKey: true,
      });
      fireEvent.pointerUp(backdrop, { altKey: true });

      Keyboard.keyUp(KEYS.ALT);

      expect(h.state.currentItemBackgroundColor).toBe("#ffc9c9");
      expect(
        decodeURIComponent(GlobalTestState.interactiveCanvas.style.cursor),
      ).toContain('fill="#ffc9c9"');
    });

    it("saves a clamped palette colour exactly when picked from a yellow rectangle", async () => {
      await render(
        <Excalidraw
          autoFocus={true}
          handleKeyboardGlobally={true}
          theme={THEME.DARK}
        />,
      );

      const rect = API.createElement({
        type: "rectangle",
        backgroundColor: "#ffc9c9",
        strokeColor: "#1971c2",
      });
      const source = API.createElement({
        type: "rectangle",
        x: 200,
        backgroundColor: "#ffd43b",
      });
      API.setElements([rect, source]);
      API.setSelectedElements([rect]);

      stubPixel(applyDarkModeFilter("#ffd43b"));

      Keyboard.keyPress("i");

      const backdrop = await getBackdrop();
      fireEvent.pointerDown(backdrop);
      fireEvent.pointerMove(window, { clientX: 100, clientY: 100 });
      fireEvent.pointerUp(backdrop);

      const updatedRect = h.elements.find((el) => el.id === rect.id);
      expect(updatedRect?.backgroundColor).toBe("#ffd43b");
      const updatedSource = h.elements.find((el) => el.id === source.id);
      expect(updatedSource?.backgroundColor).toBe("#ffd43b");
    });
  });
});
