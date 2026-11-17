import { fireEvent } from "@testing-library/react";

import { COLOR_PALETTE } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  isTextElement,
  newElementWith,
} from "@excalidraw/element";

import type {
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { actionChangeStrokeColor, actionChangeTextHighlight } from "../actions";
import { Excalidraw, exportScene } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { render, unmountComponent, act } from "./test-utils";

const mouse = new Pointer("mouse");

unmountComponent();

describe("per-range text color and highlight", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setElements([]);
  });

  const openEditorForText = async (initialText: string) => {
    const textEl = API.createElement({
      type: "text",
      x: 100,
      y: 100,
      text: initialText,
    });
    API.setElements([textEl]);
    API.setSelectedElements([textEl]);

    mouse.doubleClickAt(textEl.x + 10, textEl.y + 10);
    const editor = await getTextEditor({ waitForEditor: true });
    expect(editor).not.toBeNull();
    return { textEl, editor: editor! };
  };

  it("applies stroke color and highlight to selected range while editing and renders mirror backdrop", async () => {
    const initial = "Bid request timeout 120ms";
    const { textEl, editor } = await openEditorForText(initial);

    const start = initial.indexOf("120ms");
    const end = start + "120ms".length;
    editor.setSelectionRange(start, end);
    fireEvent.select(editor);

    const red = COLOR_PALETTE.red[4];
    const yellow = COLOR_PALETTE.yellow[1];

    window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
      color: red,
    });
    window.h.app.actionManager.executeAction(actionChangeTextHighlight, "ui", {
      color: yellow,
    });

    const current = window.h.app.scene.getElement(
      textEl.id,
    ) as NonDeleted<ExcalidrawTextElement>;
    expect(current.styleRanges).toEqual([
      { start, end, color: red, highlight: yellow },
    ]);

    const backdrop = editor.parentElement?.querySelector(
      '[data-type="wysiwyg-backdrop"]',
    ) as HTMLDivElement | null;
    expect(backdrop).not.toBeNull();
    expect(editor.style.color).toBe("transparent");
    expect(backdrop!.querySelectorAll("span").length).toBe(2);
  });

  it("applies stroke color to the whole element when selection covers all of originalText", async () => {
    const initial = "Bid request timeout 120ms";
    const { textEl, editor } = await openEditorForText(initial);

    editor.setSelectionRange(0, initial.length);
    fireEvent.select(editor);

    const red = COLOR_PALETTE.red[4];
    window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
      color: red,
    });

    const current = window.h.app.scene.getElement(
      textEl.id,
    ) as NonDeleted<ExcalidrawTextElement>;
    expect(current.strokeColor).toBe(red);
    expect(current.styleRanges).toBeUndefined();
  });

  it("shifts and expands style ranges when typing before or inside a range", async () => {
    const initial = "Bid request timeout 120ms";
    const { textEl, editor } = await openEditorForText(initial);

    const start = initial.indexOf("120ms");
    const end = start + "120ms".length;
    editor.setSelectionRange(start, end);
    fireEvent.select(editor);

    const red = COLOR_PALETTE.red[4];
    window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
      color: red,
    });

    updateTextEditor(editor, `API ${initial}`);
    let current = window.h.app.scene.getElement(
      textEl.id,
    ) as NonDeleted<ExcalidrawTextElement>;
    expect(current.styleRanges).toEqual([
      { start: start + 4, end: end + 4, color: red },
    ]);

    updateTextEditor(editor, `API Bid request timeout 1200ms`);
    current = window.h.app.scene.getElement(
      textEl.id,
    ) as NonDeleted<ExcalidrawTextElement>;
    expect(current.styleRanges).toEqual([
      { start: start + 4, end: end + 5, color: red },
    ]);
  });

  it("clears per-range color overrides when recoloring outside editing while keeping highlight", async () => {
    const initial = "Bid request timeout 120ms";
    const { textEl, editor } = await openEditorForText(initial);

    const start = initial.indexOf("120ms");
    const end = start + "120ms".length;
    editor.setSelectionRange(start, end);
    fireEvent.select(editor);

    const red = COLOR_PALETTE.red[4];
    const yellow = COLOR_PALETTE.yellow[1];
    window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
      color: red,
    });
    window.h.app.actionManager.executeAction(actionChangeTextHighlight, "ui", {
      color: yellow,
    });

    Keyboard.exitTextEditor(editor);
    expect(window.h.state.editingTextElement).toBeNull();

    let current = window.h.app.scene.getElement(
      textEl.id,
    ) as NonDeleted<ExcalidrawTextElement>;
    API.setSelectedElements([current]);

    const blue = COLOR_PALETTE.blue[4];
    window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
      color: blue,
    });
    current = window.h.app.scene.getElement(
      textEl.id,
    ) as NonDeleted<ExcalidrawTextElement>;
    expect(current.strokeColor).toBe(blue);
    expect(current.styleRanges).toEqual([{ start, end, highlight: yellow }]);
  });

  it("restores previous styleRanges on undo", async () => {
    const initial = "Bid request timeout 120ms";
    const { textEl, editor } = await openEditorForText(initial);

    const start = initial.indexOf("120ms");
    const end = start + "120ms".length;
    editor.setSelectionRange(start, end);
    fireEvent.select(editor);

    const red = COLOR_PALETTE.red[4];
    const yellow = COLOR_PALETTE.yellow[1];
    window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
      color: red,
    });
    window.h.app.actionManager.executeAction(actionChangeTextHighlight, "ui", {
      color: yellow,
    });

    Keyboard.exitTextEditor(editor);

    const current = window.h.app.scene.getElement(
      textEl.id,
    ) as NonDeleted<ExcalidrawTextElement>;
    window.h.app.updateScene({
      elements: [current],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([current]);

    act(() => {
      window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: COLOR_PALETTE.blue[4],
      });
    });
    expect(
      (
        window.h.app.scene.getElement(
          textEl.id,
        ) as NonDeleted<ExcalidrawTextElement>
      ).styleRanges,
    ).toEqual([{ start, end, highlight: yellow }]);

    act(() => {
      window.h.app.actionManager.executeAction(
        window.h.app.actionManager.actions.undo,
      );
    });
    const undone = window.h.app.scene.getElement(
      textEl.id,
    ) as NonDeleted<ExcalidrawTextElement>;
    expect(undone.styleRanges).toEqual([
      { start, end, color: red, highlight: yellow },
    ]);
  });

  it("exports styled text ranges as tspans with fill and highlight rects in SVG", async () => {
    const text = "Bid request timeout 120ms";
    const red = COLOR_PALETTE.red[4];
    const yellow = COLOR_PALETTE.yellow[1];
    const start = text.indexOf("120ms");
    const end = start + "120ms".length;

    const textEl = newElementWith(
      API.createElement({
        type: "text",
        x: 50,
        y: 50,
        text,
      }),
      {
        styleRanges: [{ start, end, color: red, highlight: yellow }],
      },
    );
    expect(isTextElement(textEl)).toBe(true);

    const svg = await exportScene({
      type: "svg",
      data: {
        elements: [textEl],
      },
    });

    const tspans = Array.from(svg.querySelectorAll("tspan"));
    expect(tspans.length).toBe(2);
    expect(tspans[0].textContent).toBe("Bid request timeout ");
    expect(tspans[1].textContent).toBe("120ms");
    expect(tspans[1].getAttribute("fill")).toBe(red);

    const rects = Array.from(svg.querySelectorAll("rect")).filter(
      (r) => r.getAttribute("fill") === yellow,
    );
    expect(rects.length).toBe(1);
  });
});
