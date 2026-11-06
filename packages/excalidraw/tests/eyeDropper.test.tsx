import React from "react";

import { COLOR_PALETTE, THEME } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

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

  const renderWithTheme = async (
    elements: ExcalidrawElement[],
    theme: typeof THEME[keyof typeof THEME],
  ) => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        initialData={{ elements, appState: { theme } }}
      />,
    );
  };

  const pick = async (
    rgb: [number, number, number],
    clientX: number,
    clientY: number,
  ) => {
    const spy = vi
      .spyOn(window.h.app.canvas!.getContext("2d")!, "getImageData")
      .mockReturnValue({
        data: new Uint8ClampedArray([rgb[0], rgb[1], rgb[2], 255]),
      } as unknown as ImageData);

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

    await act(async () => {
      fireEvent.pointerMove(window, { clientX, clientY });
      fireEvent.pointerDown(eyeDropperContainer, { clientX, clientY });
      fireEvent.pointerUp(eyeDropperContainer, { clientX, clientY });
    });

    spy.mockRestore();

    return window.h.state.currentItemBackgroundColor;
  };

  it("picks exact stored palette color in dark theme", async () => {
    await renderWithTheme(
      [
        API.createElement({
          type: "rectangle",
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          backgroundColor: COLOR_PALETTE.black,
          fillStyle: "solid",
        }),
      ],
      THEME.DARK,
    );

    expect(await pick([211, 211, 211], 50, 50)).toBe("#1e1e1e");
  });

  it("picks exact stored clamped saturated color in dark theme", async () => {
    await renderWithTheme(
      [
        API.createElement({
          type: "rectangle",
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          backgroundColor: "#ff00ff",
          fillStyle: "solid",
        }),
      ],
      THEME.DARK,
    );

    expect(await pick([255, 112, 255], 50, 50)).toBe("#ff00ff");
  });

  it("resolves colliding colors in favor of the shape under the cursor", async () => {
    await renderWithTheme(
      [
        API.createElement({
          type: "rectangle",
          x: 10,
          y: 10,
          width: 80,
          height: 80,
          backgroundColor: "#ff00ff",
          fillStyle: "solid",
        }),
        API.createElement({
          type: "rectangle",
          x: 200,
          y: 10,
          width: 80,
          height: 80,
          backgroundColor: "#d832d8",
          fillStyle: "solid",
        }),
      ],
      THEME.DARK,
    );

    expect(await pick([255, 112, 255], 40, 40)).toBe("#ff00ff");
    expect(await pick([255, 112, 255], 240, 40)).toBe("#d832d8");
  });

  it("resolves overlapping shapes in z-order under the cursor", async () => {
    await renderWithTheme(
      [
        API.createElement({
          type: "rectangle",
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          backgroundColor: "#ff00ff",
          fillStyle: "solid",
        }),
        API.createElement({
          type: "rectangle",
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          backgroundColor: "#12b886",
          strokeColor: "#1e1e1e",
          fillStyle: "hachure",
        }),
        API.createElement({
          type: "rectangle",
          x: 300,
          y: 300,
          width: 80,
          height: 80,
          backgroundColor: "#d832d8",
          fillStyle: "solid",
        }),
      ],
      THEME.DARK,
    );

    expect(await pick([255, 112, 255], 50, 50)).toBe("#ff00ff");
  });

  it("disambiguates stroke vs background color on a single shape", async () => {
    await renderWithTheme(
      [
        API.createElement({
          type: "rectangle",
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          strokeColor: "#ff00ff",
          backgroundColor: "#1e1e1e",
          fillStyle: "solid",
        }),
      ],
      THEME.DARK,
    );

    expect(await pick([255, 112, 255], 50, 50)).toBe("#ff00ff");
    expect(await pick([211, 211, 211], 50, 50)).toBe("#1e1e1e");
  });

  it("falls back to the general inverse in dark theme", async () => {
    await renderWithTheme([], THEME.DARK);

    expect(await pick([77, 120, 163], 400, 400)).toBe("#6496c8");
  });

  it("preserves the raw pixel in light theme", async () => {
    await renderWithTheme([], THEME.LIGHT);

    expect(await pick([211, 211, 211], 400, 400)).toBe("#d3d3d3");
  });
});
