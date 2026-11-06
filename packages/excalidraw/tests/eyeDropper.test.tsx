import React from "react";

import { applyDarkModeFilter, COLOR_PALETTE, THEME } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { activeEyeDropperAtom } from "../components/EyeDropper";
import { editorJotaiStore } from "../editor-jotai";

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

describe("eye dropper", () => {
  beforeEach(() => {
    editorJotaiStore.set(activeEyeDropperAtom, null);
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

  it("inverts dark-mode canvas pixel when picking a color in dark theme", async () => {
    const sourceRect = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      backgroundColor: COLOR_PALETTE.black,
    });
    const targetRect = API.createElement({
      type: "rectangle",
      x: 100,
      y: 10,
      width: 50,
      height: 50,
      backgroundColor: COLOR_PALETTE.white,
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

    const darkFilteredHex = applyDarkModeFilter(COLOR_PALETTE.black);
    expect(darkFilteredHex).toBe("#d3d3d3");

    const ctx = GlobalTestState.canvas.getContext("2d")!;
    const getImageDataSpy = vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([0xd3, 0xd3, 0xd3, 255]),
    } as unknown as ImageData);

    try {
      togglePopover("Background");

      const trigger =
        GlobalTestState.renderResult.container.querySelector<HTMLElement>(
          ".excalidraw-eye-dropper-trigger",
        )!;
      fireEvent.click(trigger);

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

      fireEvent.pointerDown(backdrop, { clientX: 20, clientY: 20 });
      fireEvent.pointerMove(window, { clientX: 25, clientY: 25 });

      expect(preview.style.background).toBe("rgb(30, 30, 30)");
      expect(
        window.h.elements.find((el) => el.id === targetRect.id)
          ?.backgroundColor,
      ).toBe(COLOR_PALETTE.black);

      fireEvent.pointerUp(backdrop, { clientX: 25, clientY: 25 });

      expect(
        window.h.elements.find((el) => el.id === targetRect.id)
          ?.backgroundColor,
      ).toBe(COLOR_PALETTE.black);
      expect(window.h.state.currentItemBackgroundColor).toBe(
        COLOR_PALETTE.black,
      );

      const colorInput =
        GlobalTestState.renderResult.container.querySelector<HTMLInputElement>(
          ".color-picker-input",
        )!;
      expect(colorInput.value).toBe("1e1e1e");
    } finally {
      getImageDataSpy.mockRestore();
    }
  });

  it("inverts dark-mode canvas pixel for bucket fill temporary eye dropper", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{
          appState: {
            theme: THEME.DARK,
          },
        }}
      />,
    );

    const darkFilteredHex = applyDarkModeFilter(COLOR_PALETTE.black);
    expect(darkFilteredHex).toBe("#d3d3d3");

    const ctx = GlobalTestState.canvas.getContext("2d")!;
    const getImageDataSpy = vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([0xd3, 0xd3, 0xd3, 255]),
    } as unknown as ImageData);

    try {
      act(() => {
        window.h.app.setActiveTool({ type: "bucketfill" });
        window.h.app.bucketFill.openTemporaryEyeDropper();
      });

      const backdrop = await waitFor(() => {
        const element =
          GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
            ".excalidraw-eye-dropper-backdrop",
          );
        expect(element).not.toBeNull();
        return element!;
      });

      fireEvent.pointerUp(backdrop, { clientX: 25, clientY: 25 });

      expect(window.h.state.currentItemBackgroundColor).toBe(
        COLOR_PALETTE.black,
      );
    } finally {
      getImageDataSpy.mockRestore();
    }
  });

  it("saves raw canvas pixel unchanged in light theme", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{
          appState: {
            theme: THEME.LIGHT,
          },
        }}
      />,
    );

    const ctx = GlobalTestState.canvas.getContext("2d")!;
    const getImageDataSpy = vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([0xd3, 0xd3, 0xd3, 255]),
    } as unknown as ImageData);

    try {
      Keyboard.keyPress("i");

      const backdrop = await waitFor(() => {
        const element =
          GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
            ".excalidraw-eye-dropper-backdrop",
          );
        expect(element).not.toBeNull();
        return element!;
      });

      fireEvent.pointerUp(backdrop, { clientX: 25, clientY: 25 });

      expect(window.h.state.currentItemBackgroundColor).toBe("#d3d3d3");
    } finally {
      getImageDataSpy.mockRestore();
    }
  });
});
