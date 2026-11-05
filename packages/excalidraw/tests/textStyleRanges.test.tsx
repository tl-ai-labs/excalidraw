import React from "react";

import { THEME } from "@excalidraw/common";
import {
  convertToExcalidrawElements,
  deepCopyElement,
  getTextElementLineRuns,
  newElementWith,
  newTextElement,
} from "@excalidraw/element";

import type { ElementUpdate } from "@excalidraw/element/mutateElement";
import type {
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import {
  createPasteEvent,
  parseClipboard,
  parseDataTransferEvent,
  serializeAsClipboardJSON,
} from "../clipboard";
import {
  actionChangeFontSize,
  actionChangeStrokeColor,
  actionChangeBackgroundColor,
} from "../actions";
import { Excalidraw, reconcileElements } from "../index";
import { exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { act, render, unmountComponent } from "./test-utils";

const { h } = window;

const RANGES = [
  { start: 0, end: 3, strokeColor: "#e03131" },
  { start: 4, end: 7, backgroundColor: "#ffec99" },
] as const;

const createStyledText = (
  overrides: ElementUpdate<NonDeleted<ExcalidrawTextElement>> = {},
): NonDeleted<ExcalidrawTextElement> => {
  const text = API.createElement({
    type: "text",
    text: "abc def ghi",
    strokeColor: "#1e1e1e",
  });
  return newElementWith(text, {
    textStyleRanges: RANGES.map((r) => ({ ...r })),
    ...overrides,
  });
};

describe("textStyleRanges integration", () => {
  beforeEach(async () => {
    unmountComponent();
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setElements([]);
  });

  it("applies, splits, merges, and clears inline strokeColor and backgroundColor ranges in WYSIWYG editor", async () => {
    const text = API.createElement({
      type: "text",
      text: "hello world",
      strokeColor: "#1e1e1e",
    });
    API.setElements([text]);
    API.setSelectedElements([text]);
    Keyboard.keyPress("Enter");
    const editor = await getTextEditor();

    editor.setSelectionRange(0, 5);
    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#e03131",
      });
    });
    let current = h.app.scene.getElement(text.id) as ExcalidrawTextElement;
    expect(current.textStyleRanges).toEqual([
      { start: 0, end: 5, strokeColor: "#e03131" },
    ]);

    editor.setSelectionRange(2, 8);
    act(() => {
      h.app.actionManager.executeAction(actionChangeBackgroundColor, "ui", {
        color: "#ffec99",
      });
    });
    current = h.app.scene.getElement(text.id) as ExcalidrawTextElement;
    expect(current.textStyleRanges).toEqual([
      { start: 0, end: 2, strokeColor: "#e03131" },
      { start: 2, end: 5, strokeColor: "#e03131", backgroundColor: "#ffec99" },
      { start: 5, end: 8, backgroundColor: "#ffec99" },
    ]);

    editor.setSelectionRange(0, 8);
    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#1e1e1e",
      });
    });
    act(() => {
      h.app.actionManager.executeAction(actionChangeBackgroundColor, "ui", {
        color: "transparent",
      });
    });
    current = h.app.scene.getElement(text.id) as ExcalidrawTextElement;
    expect(current.textStyleRanges).toEqual([]);
    expect(h.state.editingTextElement?.id).toBe(text.id);
    Keyboard.exitTextEditor(editor);
  });

  it("shifts textStyleRanges when inserting, deleting, and replacing text in WYSIWYG editor", async () => {
    const text = createStyledText();
    API.setElements([text]);
    API.setSelectedElements([text]);
    Keyboard.keyPress("Enter");
    const editor = await getTextEditor();

    // insertion before all ranges
    updateTextEditor(editor, "XXabc def ghi");
    let el = h.app.scene.getElement(text.id) as ExcalidrawTextElement;
    expect(el.textStyleRanges).toEqual([
      { start: 2, end: 5, strokeColor: "#e03131" },
      { start: 6, end: 9, backgroundColor: "#ffec99" },
    ]);
    expect(
      (h.state.editingTextElement as ExcalidrawTextElement).textStyleRanges,
    ).toEqual(el.textStyleRanges);

    // deletion across the first range
    updateTextEditor(editor, "def ghi");
    el = h.app.scene.getElement(text.id) as ExcalidrawTextElement;
    expect(el.textStyleRanges?.length ?? 0).toBeLessThanOrEqual(1);
    Keyboard.exitTextEditor(editor);
  });

  it("preserves textStyleRanges across font size, font family, text align, and container resize reflow", () => {
    const text = createStyledText();
    API.setElements([text]);
    API.setSelectedElements([text]);

    act(() => {
      h.app.actionManager.executeAction(actionChangeFontSize, "ui", 28);
    });
    const el = h.app.scene.getElement(text.id) as ExcalidrawTextElement;
    expect(el.originalText).toBe("abc def ghi");
    expect(el.textStyleRanges).toEqual(RANGES.map((r) => ({ ...r })));

    const runs = getTextElementLineRuns(el, undefined, undefined);
    const joined = runs
      .flat()
      .map((r) => r.text)
      .join("");
    expect(joined.replace(/\s/g, "")).toBe("abcdefghi");
    expect(runs.flat().some((r) => r.strokeColor === "#e03131")).toBe(true);
    expect(runs.flat().some((r) => r.backgroundColor === "#ffec99")).toBe(true);
  });

  it("renders styled runs and highlight rects on Canvas 2D and exports <rect> and <tspan> in SVG for light and dark themes", async () => {
    const text = createStyledText();
    const plain = API.createElement({
      type: "text",
      text: "plain",
    });

    for (const theme of [THEME.LIGHT, THEME.DARK]) {
      const svg = await exportScene({
        type: "svg",
        data: {
          elements: [text],
          appState: { viewBackgroundColor: "#ffffff" },
          files: null,
        },
        config: {
          canvasBackgroundColor: false,
          theme,
        },
      });
      expect(svg.querySelectorAll("rect").length).toBeGreaterThan(0);
      const tspans = svg.querySelectorAll("text tspan");
      expect(tspans.length).toBeGreaterThan(0);
      expect(
        Array.from(tspans).some((t) => Boolean(t.getAttribute("fill"))),
      ).toBe(true);

      const canvas = await exportScene({
        type: "canvas",
        data: {
          elements: [text],
          appState: { viewBackgroundColor: "#ffffff" },
          files: null,
        },
        config: {
          canvasBackgroundColor: false,
          theme,
        },
      });
      const events = (canvas.getContext("2d") as any).__getEvents();
      expect(events.some((event: any) => event.type === "fillRect")).toBe(true);
      expect(events.some((event: any) => event.type === "fillText")).toBe(true);
    }

    const plainSvg = await exportScene({
      type: "svg",
      data: {
        elements: [plain],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: {
        canvasBackgroundColor: false,
      },
    });
    expect(plainSvg.querySelectorAll("text tspan").length).toBe(0);
    expect(plainSvg.querySelector("text")?.textContent).toBe("plain");
  });

  it("preserves and normalizes textStyleRanges across clipboard copy and paste", async () => {
    const styled = createStyledText();
    const legacy = API.createElement({
      type: "text",
      text: "legacy",
    });
    delete (legacy as any).textStyleRanges;

    const json = await serializeAsClipboardJSON({
      elements: [styled, legacy],
      files: null,
    });
    const pasteEvent = createPasteEvent({
      types: { "text/plain": json },
    });
    const dataTransferList = await parseDataTransferEvent(pasteEvent);
    const parsed = await parseClipboard(dataTransferList, false);
    const elements = (parsed.elements ?? []) as ExcalidrawTextElement[];
    expect(elements.length).toBe(2);
    const pastedStyled = elements.find((e) => e.id === styled.id)!;
    const pastedLegacy = elements.find((e) => e.id === legacy.id)!;
    expect(pastedStyled.textStyleRanges).toEqual(RANGES.map((r) => ({ ...r })));
    expect(pastedStyled.textStyleRanges).not.toBe(styled.textStyleRanges);
    expect(pastedLegacy.textStyleRanges).toEqual([]);
  });

  it("preserves textStyleRanges across undo/redo, duplication, reconcileElements, and convertToExcalidrawElements", () => {
    // undo/redo
    const base = API.createElement({
      type: "text",
      text: "abc def ghi",
    });
    API.setElements([base]);
    API.setSelectedElements([base]);
    act(() => {
      h.app.scene.mutateElement(base, {
        textStyleRanges: RANGES.map((r) => ({ ...r })),
      });
    });
    expect(base.textStyleRanges).toEqual(RANGES.map((r) => ({ ...r })));

    Keyboard.undo();
    Keyboard.redo();
    expect(
      (h.app.scene.getElement(base.id) as ExcalidrawTextElement)
        .textStyleRanges,
    ).toEqual(RANGES.map((r) => ({ ...r })));

    // duplication
    const styled = createStyledText();
    const copy = deepCopyElement(styled) as ExcalidrawTextElement;
    expect(copy.textStyleRanges).toEqual(styled.textStyleRanges);
    expect(copy.textStyleRanges).not.toBe(styled.textStyleRanges);
    expect(copy.textStyleRanges![0]).not.toBe(styled.textStyleRanges![0]);

    // reconcile
    const remote = newElementWith(styled, {
      textStyleRanges: [{ start: 0, end: 2, strokeColor: "#2f9e44" }],
    });
    const reconciled = reconcileElements([], [remote as any], h.state as any);
    expect((reconciled[0] as ExcalidrawTextElement).textStyleRanges).toEqual([
      { start: 0, end: 2, strokeColor: "#2f9e44" },
    ]);

    // new text element normalization
    const created = newTextElement({
      x: 0,
      y: 0,
      text: "abcdef",
      textStyleRanges: [{ start: 2, end: 99, strokeColor: "#2f9e44" }],
    });
    expect(created.textStyleRanges).toEqual([
      { start: 2, end: 6, strokeColor: "#2f9e44" },
    ]);

    // skeleton conversion
    const converted = convertToExcalidrawElements([
      {
        type: "rectangle",
        x: 0,
        y: 0,
        label: {
          text: "hello",
          textStyleRanges: [{ start: 0, end: 2, strokeColor: "#e03131" }],
        },
      },
    ]);
    const label = converted.find(
      (e) => e.type === "text",
    ) as ExcalidrawTextElement;
    expect(label.textStyleRanges).toEqual([
      { start: 0, end: 2, strokeColor: "#e03131" },
    ]);
  });
});
