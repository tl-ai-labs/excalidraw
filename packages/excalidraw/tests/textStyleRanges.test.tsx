import { COLOR_PALETTE, KEYS } from "@excalidraw/common";
import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";

import type {
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import {
  actionChangeBackgroundColor,
  actionChangeStrokeColor,
} from "../actions/actionProperties";
import { actionCopyStyles, actionPasteStyles } from "../actions/actionStyles";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { act, fireEvent, render, unmountComponent } from "./test-utils";

const { h } = window;

unmountComponent();

const red = COLOR_PALETTE.red[4];
const yellow = COLOR_PALETTE.yellow[1];

const getText = (id: string) =>
  h.app.scene.getElement(id) as ExcalidrawTextElement;

const editText = async (text: ExcalidrawTextElement) => {
  API.setSelectedElements([text as NonDeletedExcalidrawElement]);
  Keyboard.keyPress(KEYS.ENTER);
  return getTextEditor();
};

const selectRange = (
  editor: HTMLTextAreaElement,
  start: number,
  end: number,
) => {
  editor.setSelectionRange(start, end);
  fireEvent.select(editor);
};

const pickStroke = (color: string) =>
  act(() => {
    h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
      color,
    });
  });

const pickBackground = (color: string) =>
  act(() => {
    h.app.actionManager.executeAction(actionChangeBackgroundColor, "ui", {
      color,
    });
  });

describe("textStyleRanges", () => {
  let text: ExcalidrawTextElement;

  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    text = API.createElement({
      type: "text",
      text: "Bid request timeout",
    });
    API.updateScene({
      elements: [text],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  });

  it("a stroke pick on a selected range sets its text colour only", async () => {
    const editor = await editText(text);
    const { currentItemStrokeColor } = h.state;
    selectRange(editor, 12, 19);
    pickStroke(red);

    const current = getText(text.id);
    expect(current.styleRanges).toEqual([{ start: 12, end: 19, color: red }]);
    expect(current.strokeColor).toBe(text.strokeColor);
    expect(current.backgroundColor).toBe(text.backgroundColor);
    expect(h.state.currentItemStrokeColor).toBe(currentItemStrokeColor);
  });

  it("a background pick on a selected range sets its highlight only", async () => {
    const editor = await editText(text);
    const { currentItemBackgroundColor } = h.state;
    selectRange(editor, 4, 11);
    pickBackground(yellow);

    const current = getText(text.id);
    expect(current.styleRanges).toEqual([
      { start: 4, end: 11, highlight: yellow },
    ]);
    expect(current.backgroundColor).toBe(text.backgroundColor);
    expect(h.state.currentItemBackgroundColor).toBe(currentItemBackgroundColor);
  });

  it("picking the element's stroke colour clears a range's text colour", async () => {
    const editor = await editText(text);
    selectRange(editor, 12, 19);
    pickStroke(red);
    selectRange(editor, 12, 19);
    pickStroke(text.strokeColor);

    const current = getText(text.id);
    expect((current.styleRanges ?? []).some((range) => range.color)).toBe(
      false,
    );
  });

  it("a bound label's highlight does not change its container", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 300,
      height: 100,
      boundElements: [],
    });
    const label = API.createElement({
      type: "text",
      text: "Bid request timeout",
      containerId: rectangle.id,
    });
    API.setElements([rectangle, label]);
    API.updateElement(rectangle, {
      boundElements: [{ type: "text", id: label.id }],
    });
    API.setSelectedElements([rectangle]);
    Keyboard.keyPress(KEYS.ENTER);
    const editor = await getTextEditor();
    expect(h.state.editingTextElement?.id).toBe(label.id);

    selectRange(editor, 4, 11);
    pickBackground(yellow);

    expect(getText(label.id).styleRanges).toEqual([
      { start: 4, end: 11, highlight: yellow },
    ]);
    expect(h.app.scene.getElement(rectangle.id)?.backgroundColor).toBe(
      rectangle.backgroundColor,
    );
  });

  it("typing before a range shifts it", async () => {
    const editor = await editText(text);
    selectRange(editor, 12, 19);
    pickStroke(red);
    updateTextEditor(editor, "A Bid request timeout");

    expect(getText(text.id).styleRanges).toEqual([
      { start: 14, end: 21, color: red },
    ]);
  });

  it("with no selection the stroke pick changes strokeColor", async () => {
    const editor = await editText(text);
    selectRange(editor, 3, 3);
    pickStroke(red);

    const current = getText(text.id);
    expect(current.strokeColor).toBe(red);
    expect(current.styleRanges).toBeUndefined();
  });

  it("undo restores the previous ranges and redo re-applies them", async () => {
    const editor = await editText(text);
    selectRange(editor, 12, 19);
    pickStroke(red);
    Keyboard.exitTextEditor(editor);

    expect(getText(text.id).styleRanges).toEqual([
      { start: 12, end: 19, color: red },
    ]);

    // Undo #1 reverts the selection-only appState entry that
    // Keyboard.exitTextEditor pushes; undo #2 reverts the styleRanges update.
    Keyboard.undo();
    Keyboard.undo();
    expect(getText(text.id).isDeleted).toBe(false);
    expect(
      (getText(text.id).styleRanges ?? []).some((range) => range.color === red),
    ).toBe(false);

    Keyboard.redo();
    expect(getText(text.id).styleRanges).toEqual([
      { start: 12, end: 19, color: red },
    ]);
  });

  it("paste styles does not copy ranges", () => {
    const styled = newElementWith(text, {
      styleRanges: [{ start: 12, end: 19, color: red }],
    });
    const plain = API.createElement({ type: "text", text: "Plain text" });
    API.setElements([styled, plain]);

    API.setSelectedElements([styled as NonDeletedExcalidrawElement]);
    act(() => {
      h.app.actionManager.executeAction(actionCopyStyles);
    });
    API.setSelectedElements([plain]);
    act(() => {
      h.app.actionManager.executeAction(actionPasteStyles);
    });

    expect(getText(plain.id).styleRanges?.length ?? 0).toBe(0);
    expect(getText(styled.id).styleRanges).toEqual([
      { start: 12, end: 19, color: red },
    ]);
  });
});
