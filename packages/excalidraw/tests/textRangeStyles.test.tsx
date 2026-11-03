import { vi } from "vitest";

import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction, withStyleRanges } from "@excalidraw/element";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import {
  actionChangeTextRangeColor,
  actionChangeTextRangeHighlight,
} from "../actions";
import {
  cleanAppStateForExport,
  clearAppStateForDatabase,
  clearAppStateForLocalStorage,
} from "../appState";
import { serializeAsJSON } from "../data/json";
import { exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { act, fireEvent, render, unmountComponent } from "./test-utils";

const { h } = window;

unmountComponent();

const TEXT = "Bid request timeout 120ms";
const red = "#e03131";
const yellow = "#ffec99";

const getText = () => h.elements[0] as ExcalidrawTextElement;

const openEditor = async (text = TEXT) => {
  const el = API.createElement({ type: "text", text });
  API.setElements([el]);
  API.setSelectedElements([el]);
  Keyboard.keyPress(KEYS.ENTER);
  const editor = await getTextEditor();
  return { el, editor };
};

const select = (editor: HTMLTextAreaElement, start: number, end: number) => {
  editor.setSelectionRange(start, end);
  fireEvent.select(editor);
};

const applyColor = (color: string) =>
  act(() => {
    h.app.actionManager.executeAction(actionChangeTextRangeColor, "ui", {
      color,
    });
  });

const applyHighlight = (color: string) =>
  act(() => {
    h.app.actionManager.executeAction(actionChangeTextRangeHighlight, "ui", {
      color,
    });
  });

const byLabel = (label: string) =>
  document.querySelector(`[aria-label="${label}"]`);

describe("text range styles", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setElements([]);
  });

  it("tracks the editor selection in appState", async () => {
    const { el, editor } = await openEditor();
    select(editor, 20, 25);
    expect(h.state.textEditorSelection).toEqual({
      elementId: el.id,
      start: 20,
      end: 25,
    });
  });

  it("applies a colour and merges an overlapping highlight", async () => {
    const { editor } = await openEditor();
    select(editor, 20, 25);
    applyColor(red);
    expect(getText().styleRanges).toEqual([{ start: 20, end: 25, color: red }]);

    select(editor, 12, 22);
    applyHighlight(yellow);
    expect(getText().styleRanges).toEqual([
      { start: 12, end: 20, highlight: yellow },
      { start: 20, end: 22, color: red, highlight: yellow },
      { start: 22, end: 25, color: red },
    ]);
  });

  it("transparent clears the colour on the selection", async () => {
    const { editor } = await openEditor();
    select(editor, 20, 25);
    applyColor(red);
    applyColor("transparent");
    expect("styleRanges" in getText()).toBe(false);
  });

  it("does nothing without an editor or with an empty selection", async () => {
    const el = API.createElement({ type: "text", text: TEXT });
    API.setElements([el]);
    API.setSelectedElements([el]);
    const version = getText().version;
    applyColor(red);
    expect(getText().version).toBe(version);
    expect(getText().styleRanges).toBeUndefined();

    Keyboard.keyPress(KEYS.ENTER);
    const editor = await getTextEditor();
    select(editor, 5, 5);
    const v2 = getText().version;
    applyColor(red);
    expect(getText().version).toBe(v2);
    expect(getText().styleRanges).toBeUndefined();
  });

  it("shifts ranges while typing and clears the selection on exit", async () => {
    const { editor } = await openEditor();
    select(editor, 20, 25);
    applyColor(red);
    updateTextEditor(editor, `XX${TEXT}`);
    Keyboard.exitTextEditor(editor);
    expect(h.state.editingTextElement).toBeNull();
    expect(getText().originalText).toBe(`XX${TEXT}`);
    expect(getText().styleRanges).toEqual([{ start: 22, end: 27, color: red }]);
    expect(h.state.textEditorSelection).toBeNull();
  });

  it("shows the selection pickers only while editing", async () => {
    const el = API.createElement({ type: "text", text: TEXT });
    API.setElements([el]);
    API.setSelectedElements([el]);
    expect(byLabel("Selection color")).toBeNull();
    expect(byLabel("Selection highlight")).toBeNull();

    Keyboard.keyPress(KEYS.ENTER);
    const editor = await getTextEditor();
    expect(byLabel("Selection color")).not.toBeNull();
    expect(byLabel("Selection highlight")).not.toBeNull();

    Keyboard.exitTextEditor(editor);
    expect(byLabel("Selection color")).toBeNull();
  });

  it("draws styled runs on canvas", async () => {
    const proto = CanvasRenderingContext2D.prototype;
    const texts: { text: string; fill: string }[] = [];
    const rects: string[] = [];
    const fillText = vi
      .spyOn(proto, "fillText")
      .mockImplementation(function (this: CanvasRenderingContext2D, t) {
        texts.push({ text: t, fill: String(this.fillStyle).toLowerCase() });
      });
    const fillRect = vi
      .spyOn(proto, "fillRect")
      .mockImplementation(function (this: CanvasRenderingContext2D) {
        rects.push(String(this.fillStyle).toLowerCase());
      });
    try {
      const base = API.createElement({ type: "text", text: "ab cd" });
      const styled = withStyleRanges(base, [
        { start: 0, end: 2, highlight: yellow },
        { start: 3, end: 5, color: "#ff0000" },
      ]);
      await exportScene({
        type: "canvas",
        data: { elements: [styled], files: {} },
      } as any);
      expect(texts.map((c) => c.text)).toEqual(["ab", " ", "cd"]);
      expect(texts[2].fill).toBe("#ff0000");
      expect(rects).toContain(yellow);

      texts.length = 0;
      const plain = API.createElement({ type: "text", text: "ab cd" });
      await exportScene({
        type: "canvas",
        data: { elements: [plain], files: {} },
      } as any);
      expect(texts.map((c) => c.text)).toEqual(["ab cd"]);
    } finally {
      fillText.mockRestore();
      fillRect.mockRestore();
    }
  });

  it("never persists the editor selection", () => {
    const appState = {
      ...h.state,
      textEditorSelection: { elementId: "x", start: 1, end: 2 },
    };
    expect(
      "textEditorSelection" in clearAppStateForLocalStorage(appState),
    ).toBe(false);
    expect("textEditorSelection" in cleanAppStateForExport(appState)).toBe(
      false,
    );
    expect("textEditorSelection" in clearAppStateForDatabase(appState)).toBe(
      false,
    );
    const json = serializeAsJSON(h.elements, appState, {}, "local");
    expect(json).not.toContain("textEditorSelection");
  });

  it("undo restores the earlier ranges", async () => {
    const el = API.createElement({ type: "text", text: TEXT });
    act(() => {
      h.app.updateScene({
        elements: [el],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
    API.setSelectedElements([el]);
    Keyboard.keyPress(KEYS.ENTER);
    const editor = await getTextEditor();
    select(editor, 20, 25);
    applyColor(red);
    Keyboard.exitTextEditor(editor);
    expect(getText().styleRanges).toEqual([{ start: 20, end: 25, color: red }]);

    // the element was added with a captured update, so history holds an
    // uncoloured version; undo until the colour entry is reverted (other
    // entries such as selection changes may come first)
    for (let i = 0; i < 4 && getText().styleRanges !== undefined; i++) {
      Keyboard.undo();
    }
    expect(getText().styleRanges).toBeUndefined();
    expect(getText().isDeleted).toBe(false);
    const json = serializeAsJSON(h.elements, h.state, {}, "local");
    expect(json).not.toContain("styleRanges");
  });
});
