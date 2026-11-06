import React from "react";
import { applyDarkModeFilter, THEME } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

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

describe("eye dropper picked color", () => {
  const { h } = window;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const pickAt = async (stored: string) => {
    const rect = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
      width: 120,
      height: 100,
      backgroundColor: stored,
      fillStyle: "solid",
      strokeColor: "#1e1e1e",
      roundness: null,
    });
    act(() => {
      h.app.updateScene({
        elements: [rect],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });

    const filtered = applyDarkModeFilter(stored);
    const hex = filtered.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    const ctx = h.app.canvas.getContext("2d")!;
    vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: Uint8ClampedArray.of(r, g, b, 255),
    } as ImageData);
    vi.spyOn(h.app.canvas, "getContext").mockReturnValue(ctx);

    Keyboard.keyPress("i");

    await waitFor(() => {
      const backdrop =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-backdrop",
        );
      expect(backdrop).not.toBeNull();
    });

    const backdrop =
      GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
        ".excalidraw-eye-dropper-backdrop",
      )!;

    fireEvent.pointerDown(backdrop, { clientX: 80, clientY: 70 });
    fireEvent.pointerUp(backdrop, { clientX: 80, clientY: 70 });
  };

  it("returns the stored scene color in dark theme", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        theme={THEME.DARK}
      />,
    );

    await pickAt("#ff00ff");

    await waitFor(() => {
      expect(h.state.currentItemBackgroundColor).toBe("#ff00ff");
    });
  });

  it("returns the on-screen pixel as-is in light theme", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);

    await pickAt("#ff00ff");

    await waitFor(() => {
      expect(h.state.currentItemBackgroundColor).toBe(
        applyDarkModeFilter("#ff00ff"),
      );
    });
  });
});
