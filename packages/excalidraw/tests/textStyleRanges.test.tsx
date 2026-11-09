import { FONT_FAMILY, KEYS } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  getTextStyleLineRuns,
  isTextElement,
  newElementWith,
  newTextElement,
} from "@excalidraw/element";

import type {
  ExcalidrawTextElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { getDefaultAppState } from "../appState";
import {
  actionChangeFontFamily,
  actionChangeStrokeColor,
  actionChangeTextHighlight,
} from "../actions/actionProperties";
import { actionCopyStyles, actionPasteStyles } from "../actions/actionStyles";
import * as restore from "../data/restore";
import { reconcileElements } from "../data/reconcile";
import { exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { act, fireEvent, render, screen, unmountComponent } from "./test-utils";

import type { RemoteExcalidrawElement } from "../data/reconcile";
import type { AppState } from "../types";

const { h } = window;

unmountComponent();

const mouse = new Pointer("mouse");

const openEditorWithSelection = async (
  text: string,
  start: number,
  end: number,
) => {
  UI.clickTool("text");
  mouse.clickAt(20, 30);
  const editor = await getTextEditor();
  updateTextEditor(editor, text);
  editor.setSelectionRange(start, end);
  fireEvent.select(editor);
  return editor;
};

describe("textStyleRanges in editor", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setElements([]);
  });

  it("stroke colour applies to the selected range only", async () => {
    await openEditorWithSelection("hello world", 6, 11);

    const initialStrokeColor = h.elements.find(isTextElement)!.strokeColor;
    const initialCurrentItemStrokeColor = h.state.currentItemStrokeColor;

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#e03131",
      });
    });

    const text = h.elements.find(isTextElement)!;
    expect(text.styleRanges).toEqual([{ start: 6, end: 11, color: "#e03131" }]);
    expect(text.strokeColor).toBe(initialStrokeColor);
    expect(h.state.currentItemStrokeColor).toBe(initialCurrentItemStrokeColor);
  });

  it("highlight sets and clears backgroundColor on the range", async () => {
    await openEditorWithSelection("hello world", 6, 11);

    act(() => {
      h.app.actionManager.executeAction(actionChangeTextHighlight, "ui", {
        color: "#ffec99",
      });
    });

    let text = h.elements.find(isTextElement)!;
    expect(text.styleRanges).toEqual([
      { start: 6, end: 11, backgroundColor: "#ffec99" },
    ]);

    act(() => {
      h.app.actionManager.executeAction(actionChangeTextHighlight, "ui", {
        color: "transparent",
      });
    });

    text = h.elements.find(isTextElement)!;
    expect(text).not.toHaveProperty("styleRanges");
  });

  it("highlight picker shows only with a selection", async () => {
    const editor = await openEditorWithSelection("hello world", 6, 11);
    expect(screen.queryByTestId("text-highlight-#ffec99")).not.toBeNull();

    editor.setSelectionRange(3, 3);
    fireEvent.select(editor);
    expect(screen.queryByTestId("text-highlight-#ffec99")).toBeNull();

    Keyboard.exitTextEditor(editor);
    expect(screen.queryByTestId("text-highlight-#ffec99")).toBeNull();
  });

  it("highlight swatch click sets backgroundColor on the selected range", async () => {
    await openEditorWithSelection("hello world", 6, 11);

    fireEvent.click(screen.getByTestId("text-highlight-#ffec99"));

    const text = h.elements.find(isTextElement)!;
    expect(text.styleRanges).toEqual([
      { start: 6, end: 11, backgroundColor: "#ffec99" },
    ]);
  });

  it("whole-text selection takes element-wide colour and clears range colour", async () => {
    const editor = await openEditorWithSelection("hello world", 6, 11);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#e03131",
      });
    });

    editor.setSelectionRange(0, 11);
    fireEvent.select(editor);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#1971c2",
      });
    });

    const text = h.elements.find(isTextElement)!;
    expect(text.strokeColor).toBe("#1971c2");
    expect(text).not.toHaveProperty("styleRanges");
  });

  it("typing before a styled range shifts it and submit keeps it", async () => {
    const editor = await openEditorWithSelection("hello world", 6, 11);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#e03131",
      });
    });

    updateTextEditor(editor, "XXhello world");
    let text = h.elements.find(isTextElement)!;
    expect(text.styleRanges).toEqual([{ start: 8, end: 13, color: "#e03131" }]);

    Keyboard.exitTextEditor(editor);
    text = h.elements.find(isTextElement)!;
    expect(text.styleRanges).toEqual([{ start: 8, end: 13, color: "#e03131" }]);
  });

  it("no selection keeps element-wide stroke colour", async () => {
    await openEditorWithSelection("hello world", 3, 3);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#e03131",
      });
    });

    const text = h.elements.find(isTextElement)!;
    expect(text.strokeColor).toBe("#e03131");
    expect(text).not.toHaveProperty("styleRanges");
  });

  it("new and restored legacy text have no styleRanges key", () => {
    const created = API.createElement({ type: "text" });
    const emptyRanges = newTextElement({
      x: 0,
      y: 0,
      text: "hello",
      styleRanges: [],
    });
    const outOfBounds = newTextElement({
      x: 0,
      y: 0,
      text: "hello",
      styleRanges: [{ start: 20, end: 30, color: "#e03131" }],
    });

    const rawLegacy = {
      ...API.createElement({ type: "text", text: "legacy text" }),
      originalText: "legacy text",
    };
    const [restored] = restore.restoreElements([rawLegacy], null);

    expect(created).not.toHaveProperty("styleRanges");
    expect(emptyRanges).not.toHaveProperty("styleRanges");
    expect(outOfBounds).not.toHaveProperty("styleRanges");
    expect(restored).not.toHaveProperty("styleRanges");
  });

  it("deleting every styled character removes the key", async () => {
    const editor = await openEditorWithSelection("hello world", 6, 11);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#e03131",
      });
    });

    updateTextEditor(editor, "hello ");
    const text = h.elements.find(isTextElement)!;
    expect(text).not.toHaveProperty("styleRanges");
  });

  it("restore sanitises corrupt ranges", () => {
    const base = {
      ...API.createElement({
        type: "text",
        text: "hello",
      }),
      originalText: "hello",
    };

    const [restoredBad] = restore.restoreElements(
      [{ ...base, styleRanges: "bad" as any }],
      null,
    );
    expect(restoredBad).not.toHaveProperty("styleRanges");

    const [restoredEmpty] = restore.restoreElements(
      [{ ...base, styleRanges: [] }],
      null,
    );
    expect(restoredEmpty).not.toHaveProperty("styleRanges");

    const [restoredAllInvalid] = restore.restoreElements(
      [
        {
          ...base,
          styleRanges: [
            { start: "1" as any, end: 2, color: "red" },
            { start: 1, end: 2, color: 7 as any },
            { start: 2, end: 1, color: "red" },
          ],
        },
      ],
      null,
    );
    expect(restoredAllInvalid).not.toHaveProperty("styleRanges");

    const [restoredMixed] = restore.restoreElements(
      [
        {
          ...base,
          styleRanges: [
            { start: 0, end: 2, color: "red" },
            { start: 3, end: 99, backgroundColor: "#ffec99" },
            { start: "1" as any, end: 2, color: "red" },
            { start: 1, end: 2, color: 7 as any },
          ],
        },
      ],
      null,
    );
    expect(isTextElement(restoredMixed) && restoredMixed.styleRanges).toEqual([
      { start: 0, end: 2, color: "red" },
      { start: 3, end: 5, backgroundColor: "#ffec99" },
    ]);
  });

  it("svg export writes tspans and highlight rects", async () => {
    const text = newTextElement({
      x: 0,
      y: 0,
      text: "hello world",
      strokeColor: "#1e1e1e",
      styleRanges: [
        {
          start: 6,
          end: 11,
          color: "#e03131",
          backgroundColor: "#ffec99",
        },
      ],
    });

    const svg = await exportScene({
      type: "svg",
      data: {
        elements: [text],
        appState: { viewBackgroundColor: "#ffffff" },
        files: {},
      },
      config: { canvasBackgroundColor: false },
    });

    const textNodes = svg.querySelectorAll("text");
    expect(textNodes.length).toBe(1);

    const tspans = textNodes[0].querySelectorAll("tspan");
    expect(tspans.length).toBe(2);
    expect(tspans[0].textContent).toBe("hello ");
    expect(tspans[0].getAttribute("fill")).toBe(text.strokeColor);
    expect(tspans[1].textContent).toBe("world");
    expect(tspans[1].getAttribute("fill")).toBe("#e03131");

    const rects = svg.querySelectorAll("rect");
    expect(rects.length).toBe(1);
    expect(rects[0].getAttribute("fill")).toBe("#ffec99");
    const rectWidth = parseFloat(rects[0].getAttribute("width") || "0");
    expect(rectWidth).toBeGreaterThan(0);

    const textParent = textNodes[0].parentElement!;
    const children = Array.from(textParent.children);
    const rectIndex = children.indexOf(rects[0]);
    const textIndex = children.indexOf(textNodes[0]);
    expect(rectIndex).toBeLessThan(textIndex);
  });

  it("unstyled text exports as before", async () => {
    const text = newTextElement({
      x: 0,
      y: 0,
      text: "hello world",
    });

    const svg = await exportScene({
      type: "svg",
      data: {
        elements: [text],
        appState: { viewBackgroundColor: "#ffffff" },
        files: {},
      },
      config: { canvasBackgroundColor: false },
    });

    const textNodes = svg.querySelectorAll("text");
    expect(textNodes.length).toBe(1);
    expect(textNodes[0].querySelectorAll("tspan").length).toBe(0);
    expect(textNodes[0].textContent).toBe("hello world");

    const textGroup = textNodes[0].parentElement!;
    expect(textGroup.querySelectorAll("rect").length).toBe(0);
  });

  it("ranges survive a bound container's wrapping", async () => {
    UI.clickTool("rectangle");
    mouse.downAt(100, 100);
    mouse.moveTo(190, 175);
    mouse.upAt(190, 175);

    Keyboard.keyPress(KEYS.ENTER);
    const editor = await getTextEditor();
    updateTextEditor(editor, "Bid request timeout 120ms");

    editor.setSelectionRange(20, 25);
    fireEvent.select(editor);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#e03131",
      });
    });

    Keyboard.exitTextEditor(editor);

    const label = h.elements.find(isTextElement)!;
    expect(label.text).toContain("\n");
    expect(label.styleRanges).toEqual([
      { start: 20, end: 25, color: "#e03131" },
    ]);

    const lineRuns = getTextStyleLineRuns(
      label.text,
      label.originalText,
      label.styleRanges,
    );
    expect(lineRuns).not.toBeNull();
    const styledRunsText = (lineRuns ?? [])
      .flat()
      .filter((run) => run.color !== null || run.backgroundColor !== null)
      .map((run) => run.text)
      .join("");
    expect(styledRunsText).toBe("120ms");
  });

  it("ranges survive a font family change", () => {
    const text = newTextElement({
      x: 0,
      y: 0,
      text: "hello world",
      fontFamily: FONT_FAMILY.Excalifont,
      styleRanges: [{ start: 6, end: 11, color: "#e03131" }],
    });
    API.setElements([text]);
    API.setSelectedElements([text]);

    const initialRanges = text.styleRanges;

    act(() => {
      h.app.actionManager.executeAction(actionChangeFontFamily, "ui", {
        currentItemFontFamily: FONT_FAMILY.Nunito,
        currentHoveredFontFamily: null,
      });
    });

    const updated = h.elements.find(isTextElement)!;
    expect(updated.fontFamily).toBe(FONT_FAMILY.Nunito);
    expect(updated.styleRanges).toEqual(initialRanges);
  });

  it("undo and redo restore ranges", () => {
    const text = newTextElement({
      x: 0,
      y: 0,
      text: "hello world",
    });

    API.updateScene({
      elements: [text],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    API.updateScene({
      elements: [
        newElementWith(text, {
          styleRanges: [{ start: 0, end: 5, color: "#e03131" }],
        }),
      ],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    Keyboard.undo();
    let current = h.elements.find(isTextElement)!;
    expect(current.styleRanges).toBeUndefined();

    Keyboard.redo();
    current = h.elements.find(isTextElement)!;
    expect(current.styleRanges).toEqual([
      { start: 0, end: 5, color: "#e03131" },
    ]);
  });

  it("reconcile keeps the winning element's ranges intact", () => {
    const base = newTextElement({
      x: 0,
      y: 0,
      text: "hello world",
    });

    const rangesA = [{ start: 0, end: 5, color: "#e03131" }];
    const rangesB = [{ start: 6, end: 11, color: "#1971c2" }];

    const appState = {
      ...getDefaultAppState(),
      width: 0,
      height: 0,
      offsetTop: 0,
      offsetLeft: 0,
    } as AppState;

    // Remote has higher version -> remote wins
    const localLower = {
      ...base,
      id: "text-reconcile",
      version: 3,
      versionNonce: 1,
      styleRanges: rangesA,
    } as ExcalidrawTextElement as unknown as OrderedExcalidrawElement;
    const remoteHigher = {
      ...base,
      id: "text-reconcile",
      version: 4,
      versionNonce: 2,
      styleRanges: rangesB,
    } as ExcalidrawTextElement as unknown as RemoteExcalidrawElement;

    const reconciled1 = reconcileElements(
      [localLower],
      [remoteHigher],
      appState,
    );
    expect(isTextElement(reconciled1[0]) && reconciled1[0].styleRanges).toEqual(
      rangesB,
    );

    // Local has higher version -> local wins
    const localHigher = {
      ...base,
      id: "text-reconcile",
      version: 5,
      versionNonce: 1,
      styleRanges: rangesA,
    } as ExcalidrawTextElement as unknown as OrderedExcalidrawElement;
    const remoteLower = {
      ...base,
      id: "text-reconcile",
      version: 4,
      versionNonce: 2,
      styleRanges: rangesB,
    } as ExcalidrawTextElement as unknown as RemoteExcalidrawElement;

    const reconciled2 = reconcileElements(
      [localHigher],
      [remoteLower],
      appState,
    );
    expect(isTextElement(reconciled2[0]) && reconciled2[0].styleRanges).toEqual(
      rangesA,
    );
  });

  it("paste styles does not copy ranges onto another text", () => {
    const textA = newTextElement({
      x: 0,
      y: 0,
      text: "hello world",
      strokeColor: "#e03131",
      styleRanges: [{ start: 0, end: 5, color: "#2f9e44" }],
    });
    const textB = newTextElement({
      x: 0,
      y: 0,
      text: "plain text",
      strokeColor: "#1e1e1e",
    });

    API.setElements([textA, textB]);

    API.setSelectedElements([textA]);
    act(() => {
      h.app.actionManager.executeAction(actionCopyStyles, "ui");
    });

    API.setSelectedElements([textB]);
    act(() => {
      h.app.actionManager.executeAction(actionPasteStyles, "ui");
    });

    const target = h.elements.find((el) => el.id === textB.id)!;
    expect(target).not.toHaveProperty("styleRanges");
    expect(target.strokeColor).toBe(textA.strokeColor);
  });

  it("duplicate carries ranges", () => {
    const text = newTextElement({
      x: 0,
      y: 0,
      text: "hello world",
      styleRanges: [{ start: 0, end: 5, color: "#e03131" }],
    });

    API.setElements([text]);
    API.setSelectedElements([text]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.D);
    });

    const duplicate = h.elements.find(
      (el) => isTextElement(el) && el.id !== text.id,
    );
    expect(duplicate).toBeDefined();
    expect(isTextElement(duplicate!) && duplicate!.styleRanges).toEqual(
      text.styleRanges,
    );
  });
});
