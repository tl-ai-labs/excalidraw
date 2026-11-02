import { act, fireEvent } from "@testing-library/react";

import { FONT_FAMILY, KEYS } from "@excalidraw/common";
import {
  advanceDuplicatedListMarkers,
  applyListMarkerAdvances,
  applyTextRangeStyle,
  getTextLineRuns,
  getTextStyleRuns,
  handleBindTextResize,
  newElementWith,
  redrawTextBoundingBox,
  sanitizeTextRanges,
  shiftTextRanges,
  CaptureUpdateAction,
} from "@excalidraw/element";

import type {
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import {
  actionBindText,
  actionChangeFontSize,
  actionChangeStrokeColor,
  actionResetTextStyle,
} from "../actions";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { render } from "./test-utils";

const { h } = window;
const RED = "#e03131";
const BLUE = "#1971c2";
const T = "Bid request timeout 120ms";
const W = `Urgent: ${T}`;

function noStale(
  element: ExcalidrawTextElement,
  expectedWord?: string,
): boolean {
  const sanitized = sanitizeTextRanges(
    element.textRanges,
    element.originalText,
  );
  if (element.textRanges && !sanitized) {
    return false;
  }
  const runs = getTextStyleRuns(element);
  if (expectedWord !== undefined) {
    for (const run of runs) {
      if (element.originalText.slice(run.start, run.end) !== expectedWord) {
        return false;
      }
    }
  }
  return true;
}

describe("textRanges elements and integration", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("a container resize re-wraps and keeps the range", async () => {
    const [container, textElement] = API.createTextContainer({
      label: { text: "hello brave new world" },
    });
    API.setElements([container, textElement]);

    let text = h.app.scene.getElement<ExcalidrawTextElement>(textElement.id)!;

    const styledRanges = applyTextRangeStyle(
      text,
      { start: 6, end: 11 },
      { color: RED },
    );
    text = newElementWith(text, { textRanges: styledRanges });
    API.setElements([container, text]);

    const initialRanges = text.textRanges;

    // Resize container width to 300
    API.setElements([newElementWith(container, { width: 300 }), text]);
    handleBindTextResize(
      h.app.scene.getElement(container.id)!,
      h.app.scene,
      "e",
    );
    text = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(text.textRanges).toBe(initialRanges);

    let lineRuns = getTextLineRuns(text);
    const flatRuns300 = lineRuns?.flat().filter(Boolean);
    const red300 = flatRuns300?.find((r) => r?.color === RED);
    expect(red300?.text).toBe("brave");

    // Resize container width to 100
    API.setElements([newElementWith(container, { width: 100 }), text]);
    handleBindTextResize(
      h.app.scene.getElement(container.id)!,
      h.app.scene,
      "e",
    );
    text = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(text.textRanges).toBe(initialRanges);

    lineRuns = getTextLineRuns(text);
    const flatRuns100 = lineRuns?.flat().filter(Boolean);
    const red100 = flatRuns100?.find((r) => r?.color === RED);
    expect(red100?.text).toBe("brave");
  });

  it("a text rewrite keeps the range", async () => {
    const [container, textElement] = API.createTextContainer({
      label: { text: "hello brave new world" },
    });
    API.setElements([container, textElement]);

    let text = h.app.scene.getElement<ExcalidrawTextElement>(textElement.id)!;

    const styledRanges = applyTextRangeStyle(
      text,
      { start: 6, end: 11 },
      { color: RED },
    );
    text = newElementWith(text, { textRanges: styledRanges });
    API.setElements([container, text]);

    redrawTextBoundingBox(text, container, h.app.scene);
    text = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;

    const lineRuns = getTextLineRuns(text);
    const flatRuns = lineRuns?.flat().filter(Boolean);
    const redRun = flatRuns?.find((r) => r?.color === RED);
    expect(redRun?.text).toBe("brave");
  });

  it("binding keeps the range", async () => {
    let text = API.createElement({
      type: "text",
      text: "hello brave new world",
    }) as NonDeleted<ExcalidrawTextElement>;
    text = newElementWith(text, {
      textRanges: applyTextRangeStyle(
        text,
        { start: 6, end: 11 },
        { color: RED },
      ),
    });
    const rect = API.createElement({
      type: "rectangle",
      width: 200,
      height: 200,
    });
    API.setElements([text, rect]);
    API.setSelectedElements([text, rect]);

    act(() => {
      h.app.actionManager.executeAction(actionBindText, "ui");
    });

    text = h.app.scene.getElement<NonDeleted<ExcalidrawTextElement>>(text.id)!;
    const runs = getTextStyleRuns(text);
    expect(runs.length).toBe(1);
    expect(text.originalText.slice(runs[0].start, runs[0].end)).toBe("brave");
  });

  it("a font size change keeps the range", async () => {
    let text = API.createElement({
      type: "text",
      text: "hello brave new world",
    }) as NonDeleted<ExcalidrawTextElement>;
    const seed = applyTextRangeStyle(
      text,
      { start: 6, end: 11 },
      { color: RED },
    );
    text = newElementWith(text, { textRanges: seed });
    API.setElements([text]);
    API.setSelectedElements([text]);

    act(() => {
      h.app.actionManager.executeAction(actionChangeFontSize, "ui", 36);
    });

    text = h.app.scene.getElement<NonDeleted<ExcalidrawTextElement>>(text.id)!;
    expect(text.fontSize).toBe(36);
    expect(text.textRanges).toEqual(seed);
    const runs = getTextStyleRuns(text);
    expect(runs.length).toBe(1);
    expect(text.originalText.slice(runs[0].start, runs[0].end)).toBe("brave");
  });

  it("a font family change keeps the range", async () => {
    const [container, textElement] = API.createTextContainer({
      label: { text: "hello brave new world" },
    });
    API.setElements([container, textElement]);

    let text = h.app.scene.getElement<ExcalidrawTextElement>(textElement.id)!;
    const seed = applyTextRangeStyle(
      text,
      { start: 6, end: 11 },
      { color: RED },
    );
    text = newElementWith(text, { textRanges: seed });
    API.setElements([container, text]);

    text = newElementWith(text, { fontFamily: FONT_FAMILY.Nunito });
    API.setElements([container, text]);
    redrawTextBoundingBox(text, container, h.app.scene);

    text = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(text.textRanges).toEqual(seed);
    const runs = getTextStyleRuns(text);
    expect(runs.length).toBe(1);
    expect(text.originalText.slice(runs[0].start, runs[0].end)).toBe("brave");
  });

  it("duplicating a list item shifts its range", async () => {
    let element = API.createElement({
      type: "text",
      text: "9. foo bar",
    }) as NonDeleted<ExcalidrawTextElement>;
    element = newElementWith(element, {
      textRanges: applyTextRangeStyle(
        element,
        { start: 3, end: 6 },
        { color: RED },
      ),
    });
    API.setElements([element]);

    const advances = advanceDuplicatedListMarkers([element], h.app.scene);
    element = h.app.scene.getElement<NonDeleted<ExcalidrawTextElement>>(
      element.id,
    )!;

    expect(element.originalText).toBe("10. foo bar");
    const runs = getTextStyleRuns(element);
    expect(runs).toEqual([{ start: 4, end: 7, color: RED, highlight: null }]);
    expect(element.originalText.slice(runs[0].start, runs[0].end)).toBe("foo");

    // Going back on a list marker shifts it back
    applyListMarkerAdvances(advances, "prev", h.app.scene);
    element = h.app.scene.getElement<NonDeleted<ExcalidrawTextElement>>(
      element.id,
    )!;
    const prevRuns = getTextStyleRuns(element);
    expect(prevRuns).toEqual([
      { start: 3, end: 6, color: RED, highlight: null },
    ]);
  });

  it("undo and redo of a range edit", async () => {
    const text = API.createElement({
      type: "text",
      text: T,
    }) as NonDeleted<ExcalidrawTextElement>;
    API.updateScene({
      elements: [text],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.setSelectedElements([text]);
    Keyboard.keyPress(KEYS.ENTER);
    const editor = await getTextEditor();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });
    fireEvent.blur(editor);

    let current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(getTextStyleRuns(current).length).toBe(1);

    Keyboard.undo();
    current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(current.originalText).toBe(T);
    expect(getTextStyleRuns(current)).toEqual([]);

    Keyboard.redo();
    current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(current.originalText).toBe(T);
    const runs = getTextStyleRuns(current);
    expect(runs).toEqual([{ start: 20, end: 25, color: RED, highlight: null }]);
  });

  it("undo and redo of a text edit on an element with ranges", async () => {
    let text = API.createElement({
      type: "text",
      text: T,
    }) as NonDeleted<ExcalidrawTextElement>;
    text = newElementWith(text, {
      textRanges: applyTextRangeStyle(
        text,
        { start: 20, end: 25 },
        { color: RED },
      ),
    });
    API.updateScene({
      elements: [text],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.setSelectedElements([text]);
    Keyboard.keyPress(KEYS.ENTER);
    const editor = await getTextEditor();
    updateTextEditor(editor, `Urgent: ${T}`);
    fireEvent.blur(editor);

    let current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(current.originalText).toBe(W);
    let runs = getTextStyleRuns(current);
    expect(runs).toEqual([{ start: 28, end: 33, color: RED, highlight: null }]);
    expect(noStale(current, "120ms")).toBe(true);

    Keyboard.undo();
    current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(current.originalText).toBe(T);
    runs = getTextStyleRuns(current);
    expect(runs).toEqual([{ start: 20, end: 25, color: RED, highlight: null }]);
    expect(noStale(current, "120ms")).toBe(true);

    Keyboard.redo();
    current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(current.originalText).toBe(W);
    runs = getTextStyleRuns(current);
    expect(runs).toEqual([{ start: 28, end: 33, color: RED, highlight: null }]);
    expect(noStale(current, "120ms")).toBe(true);
  });

  it("undo brings back a range whose text was deleted", async () => {
    let text = API.createElement({
      type: "text",
      text: T,
    }) as NonDeleted<ExcalidrawTextElement>;
    text = newElementWith(text, {
      textRanges: applyTextRangeStyle(
        text,
        { start: 20, end: 25 },
        { color: RED },
      ),
    });
    API.updateScene({
      elements: [text],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.setSelectedElements([text]);
    Keyboard.keyPress(KEYS.ENTER);
    const editor = await getTextEditor();
    // delete "120ms"
    updateTextEditor(editor, "Bid request timeout ");
    fireEvent.blur(editor);

    let current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(getTextStyleRuns(current)).toEqual([]);

    Keyboard.undo();
    current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(current.originalText).toBe(T);
    const runs = getTextStyleRuns(current);
    expect(runs).toEqual([{ start: 20, end: 25, color: RED, highlight: null }]);
    expect(noStale(current, "120ms")).toBe(true);
  });

  it("undoing a range edit after a remote text edit keeps offsets on the current text", async () => {
    const text = API.createElement({
      type: "text",
      text: T,
    }) as NonDeleted<ExcalidrawTextElement>;
    API.updateScene({
      elements: [text],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.setSelectedElements([text]);
    Keyboard.keyPress(KEYS.ENTER);
    const editor = await getTextEditor();
    editor.setSelectionRange(20, 25);
    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });
    fireEvent.blur(editor);

    let current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;

    // Remote edit: prepend "Urgent: " and shift ranges
    const remoteRanges = shiftTextRanges(T, W, current.textRanges);
    const remoteText = newElementWith(current, {
      text: W,
      originalText: W,
      textRanges: remoteRanges,
      version: current.version + 1,
    });
    API.updateScene({
      elements: [remoteText],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    Keyboard.undo();
    current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(current.originalText).toBe(W);
    expect(getTextStyleRuns(current)).toEqual([]);
    expect(noStale(current)).toBe(true);

    Keyboard.redo();
    current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(current.originalText).toBe(W);
    const runs = getTextStyleRuns(current);
    expect(runs.length).toBe(1);
    expect(current.originalText.slice(runs[0].start, runs[0].end)).toBe(
      "120ms",
    );
    expect(noStale(current, "120ms")).toBe(true);
  });

  it("undo brings back a deleted word's range after a remote text edit", async () => {
    let text = API.createElement({
      type: "text",
      text: T,
    }) as NonDeleted<ExcalidrawTextElement>;
    text = newElementWith(text, {
      textRanges: applyTextRangeStyle(
        text,
        { start: 20, end: 25 },
        { color: RED },
      ),
    });
    API.updateScene({
      elements: [text],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.setSelectedElements([text]);
    Keyboard.keyPress(KEYS.ENTER);
    const editor = await getTextEditor();
    updateTextEditor(editor, "Bid request timeout ");
    fireEvent.blur(editor);

    let current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;

    // Remote edit: append "!"
    const nextText = "Bid request timeout !";
    const remoteRanges = shiftTextRanges(
      current.originalText,
      nextText,
      current.textRanges,
    );
    const remoteElement = newElementWith(current, {
      text: nextText,
      originalText: nextText,
      textRanges: remoteRanges,
      version: current.version + 1,
    });
    API.updateScene({
      elements: [remoteElement],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    Keyboard.undo();
    current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(current.originalText).toBe(T);
    const runs = getTextStyleRuns(current);
    expect(runs).toEqual([{ start: 20, end: 25, color: RED, highlight: null }]);
    expect(noStale(current, "120ms")).toBe(true);
  });

  it("undoing a removal shows the range again", async () => {
    let text = API.createElement({
      type: "text",
      text: T,
    }) as NonDeleted<ExcalidrawTextElement>;
    text = newElementWith(text, {
      textRanges: applyTextRangeStyle(
        text,
        { start: 20, end: 25 },
        { color: RED },
      ),
    });
    API.updateScene({
      elements: [text],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.setSelectedElements([text]);
    Keyboard.keyPress(KEYS.ENTER);
    const editor = await getTextEditor();
    editor.setSelectionRange(20, 25);
    act(() => {
      h.app.actionManager.executeAction(actionResetTextStyle, "ui");
    });
    fireEvent.blur(editor);

    let current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    expect(getTextStyleRuns(current)).toEqual([]);

    Keyboard.undo();
    current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    const runs = getTextStyleRuns(current);
    expect(runs).toEqual([{ start: 20, end: 25, color: RED, highlight: null }]);
    expect(noStale(current, "120ms")).toBe(true);
  });

  it("undoing a partial removal keeps the layer order", async () => {
    let text = API.createElement({
      type: "text",
      text: T,
    }) as NonDeleted<ExcalidrawTextElement>;
    let ranges = applyTextRangeStyle(
      text,
      { start: 20, end: 25 },
      { color: RED },
    );
    ranges = applyTextRangeStyle(
      { originalText: text.originalText, textRanges: ranges },
      { start: 24, end: 25 },
      { color: BLUE },
    );
    text = newElementWith(text, { textRanges: ranges });
    API.updateScene({
      elements: [text],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.setSelectedElements([text]);
    Keyboard.keyPress(KEYS.ENTER);
    const editor = await getTextEditor();
    editor.setSelectionRange(20, 22);
    act(() => {
      h.app.actionManager.executeAction(actionResetTextStyle, "ui");
    });
    fireEvent.blur(editor);

    let current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    const runsAfterReset = getTextStyleRuns(current);
    expect(runsAfterReset).toEqual([
      { start: 22, end: 24, color: RED, highlight: null },
      { start: 24, end: 25, color: BLUE, highlight: null },
    ]);

    Keyboard.undo();
    current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    const runsAfterUndo = getTextStyleRuns(current);
    expect(runsAfterUndo).toEqual([
      { start: 20, end: 24, color: RED, highlight: null },
      { start: 24, end: 25, color: BLUE, highlight: null },
    ]);

    Keyboard.redo();
    current = h.app.scene.getElement<ExcalidrawTextElement>(text.id)!;
    const runsAfterRedo = getTextStyleRuns(current);
    expect(runsAfterRedo).toEqual(runsAfterReset);
  });

  it("an unchanged range makes no history noise", async () => {
    let text = API.createElement({
      type: "text",
      text: T,
    }) as NonDeleted<ExcalidrawTextElement>;
    text = newElementWith(text, {
      textRanges: applyTextRangeStyle(
        text,
        { start: 20, end: 25 },
        { color: RED },
      ),
    });
    API.updateScene({
      elements: [text],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    // Move element
    const moved = newElementWith(text, { x: text.x + 50 });
    API.updateScene({
      elements: [moved],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    const lastEntry = (h.history as any).undoStack.at(-1);
    const deltaEntry = lastEntry?.elements?.updated?.[text.id];
    expect(deltaEntry).toBeDefined();
    expect(deltaEntry.inserted?.textRanges).toBeUndefined();
    expect(deltaEntry.deleted?.textRanges).toBeUndefined();
  });
});
