import { fireEvent, screen } from "@testing-library/react";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { render } from "./test-utils";

const { h } = window;

describe("arrowheadSize", () => {
  it("shows arrowhead size control in properties panel, updates arrow, and supports undo/redo", async () => {
    await render(<Excalidraw />);

    const arrow = UI.createElement("arrow", {
      x: 0,
      y: 0,
      width: 100,
      height: 0,
    });

    const smallRadio = screen.getByTestId("arrowheadSize-small");
    const mediumRadio = screen.getByTestId("arrowheadSize-medium");
    const largeRadio = screen.getByTestId("arrowheadSize-large");

    expect(mediumRadio).toBeChecked();
    expect(API.getElement(arrow).arrowheadSize).toBeUndefined();

    fireEvent.click(smallRadio);

    expect(API.getElement(arrow).arrowheadSize).toBe("small");
    expect(h.state.currentItemArrowheadSize).toBe("small");
    expect(smallRadio).toBeChecked();
    expect(API.getUndoStack().length).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: /undo/i }));
    expect(API.getUndoStack().length).toBe(1);
    expect(API.getElement(arrow).arrowheadSize).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: /redo/i }));
    expect(API.getElement(arrow).arrowheadSize).toBe("small");

    fireEvent.click(largeRadio);
    expect(API.getElement(arrow).arrowheadSize).toBe("large");
    expect(h.state.currentItemArrowheadSize).toBe("large");
  });

  it("creates new arrows with the selected currentItemArrowheadSize", async () => {
    await render(<Excalidraw />);

    UI.clickTool("arrow");
    fireEvent.click(screen.getByTestId("arrowheadSize-small"));
    expect(h.state.currentItemArrowheadSize).toBe("small");

    const arrow = UI.createElement("arrow", {
      x: 0,
      y: 0,
      width: 100,
      height: 0,
    });
    expect(API.getElement(arrow).arrowheadSize).toBe("small");
  });
});
