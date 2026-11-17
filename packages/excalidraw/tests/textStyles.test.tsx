import { KEYS } from "@excalidraw/common";
import { advanceDuplicatedListMarkers } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { restoreElements } from "../data/restore";
import { Excalidraw } from "../index";
import {
  actionChangeBackgroundColor,
  actionChangeStrokeColor,
} from "../actions/actionProperties";
import { exportScene } from "../scene/export";

import { getTextEditor, updateTextEditor } from "./queries/dom";
import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, fireEvent, render, unmountComponent } from "./test-utils";

const { h } = window;

unmountComponent();

const TEXT = "Bid request timeout 120ms";
const WORD_START = TEXT.indexOf("120ms");
const WORD_END = TEXT.length;

const getText = (id: string) =>
  h.elements.find((el) => el.id === id) as ExcalidrawTextElement;

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

/** types at `pos` the way the browser does: the caret ends after the text */
const typeAt = (editor: HTMLTextAreaElement, pos: number, typed: string) => {
  const value = editor.value.slice(0, pos) + typed + editor.value.slice(pos);
  fireEvent.change(editor, { target: { value } });
  editor.setSelectionRange(pos + typed.length, pos + typed.length);
  fireEvent.input(editor);
};

const startEditing = async (text: NonDeleted<ExcalidrawTextElement>) => {
  API.setSelectedElements([text]);
  Keyboard.keyPress(KEYS.ENTER);
  const editor = await getTextEditor();
  expect(h.state.editingTextElement?.id).toBe(text.id);
  return editor;
};

const exportSvg = async (elements: readonly ExcalidrawElement[]) =>
  exportScene({
    type: "svg",
    data: { elements: elements as any, files: {} },
    config: { canvasBackgroundColor: "#ffffff" },
  });

describe("text styles", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("applies stroke colour and background to the editor's selection", async () => {
    const text = API.createElement({ type: "text", text: TEXT, x: 10, y: 10 });
    API.setElements([text]);
    const editor = await startEditing(text);

    editor.setSelectionRange(WORD_START, WORD_END);
    pickStroke("#ff0000");

    expect(getText(text.id).textStyles).toEqual([
      { start: WORD_START, end: WORD_END, color: "#ff0000" },
    ]);
    // the element's own colours are left alone
    expect(getText(text.id).strokeColor).toBe(text.strokeColor);
    expect(getText(text.id).backgroundColor).toBe(text.backgroundColor);
    // and the selection survives, so picking again works
    expect(editor.selectionStart).toBe(WORD_START);
    expect(editor.selectionEnd).toBe(WORD_END);

    pickBackground("#ffff00");
    expect(getText(text.id).textStyles).toEqual([
      {
        start: WORD_START,
        end: WORD_END,
        color: "#ff0000",
        highlight: "#ffff00",
      },
    ]);
    expect(getText(text.id).backgroundColor).toBe(text.backgroundColor);

    // clearing the highlight
    pickBackground("transparent");
    expect(getText(text.id).textStyles).toEqual([
      { start: WORD_START, end: WORD_END, color: "#ff0000" },
    ]);
  });

  it("styles the whole element when the selection is collapsed", async () => {
    const text = API.createElement({ type: "text", text: TEXT, x: 10, y: 10 });
    API.setElements([text]);
    const editor = await startEditing(text);

    editor.setSelectionRange(4, 4);
    pickStroke("#ff0000");

    expect(getText(text.id).strokeColor).toBe("#ff0000");
    expect(getText(text.id).textStyles).toBeUndefined();
  });

  it("treats a selection of all the text as the whole element", async () => {
    const text = API.createElement({ type: "text", text: TEXT, x: 10, y: 10 });
    API.setElements([text]);
    const editor = await startEditing(text);

    editor.setSelectionRange(0, TEXT.length);
    pickStroke("#ff0000");

    expect(getText(text.id).strokeColor).toBe("#ff0000");
    expect(getText(text.id).textStyles).toBeUndefined();
  });

  it("shows the styled ranges in a mirror while editing", async () => {
    const text = API.createElement({ type: "text", text: TEXT, x: 10, y: 10 });
    API.setElements([text]);
    const editor = await startEditing(text);
    expect(document.querySelector(".excalidraw-wysiwyg-mirror")).toBeNull();

    editor.setSelectionRange(WORD_START, WORD_END);
    pickStroke("#ff0000");

    const mirror = document.querySelector(".excalidraw-wysiwyg-mirror")!;
    expect(mirror.textContent).toBe(TEXT);
    expect(mirror.querySelectorAll("span")).toHaveLength(2);
    expect(editor.style.color).toBe("transparent");
  });

  it("keeps the ranges aligned while typing", async () => {
    const text = API.createElement({ type: "text", text: TEXT, x: 10, y: 10 });
    API.setElements([text]);
    const editor = await startEditing(text);

    editor.setSelectionRange(WORD_START, WORD_END);
    pickStroke("#ff0000");

    // before the range: shifts it
    typeAt(editor, 0, "XY");
    expect(getText(text.id).originalText).toBe(`XY${TEXT}`);
    expect(getText(text.id).textStyles).toEqual([
      { start: WORD_START + 2, end: WORD_END + 2, color: "#ff0000" },
    ]);

    // inside the range: extends it
    typeAt(editor, WORD_START + 2 + 3, "00");
    expect(getText(text.id).textStyles).toEqual([
      { start: WORD_START + 2, end: WORD_END + 4, color: "#ff0000" },
    ]);

    // at the end of the range: extends it
    typeAt(editor, WORD_END + 4, "!");
    expect(getText(text.id).textStyles).toEqual([
      { start: WORD_START + 2, end: WORD_END + 5, color: "#ff0000" },
    ]);

    // at the start of the range: does not
    typeAt(editor, WORD_START + 2, "_");
    expect(getText(text.id).textStyles).toEqual([
      { start: WORD_START + 3, end: WORD_END + 6, color: "#ff0000" },
    ]);

    // deleting the text of the range removes it
    updateTextEditor(editor, "Bid");
    expect(getText(text.id).textStyles).toBeUndefined();
  });

  it("keeps the ranges through submit", async () => {
    const text = API.createElement({ type: "text", text: TEXT, x: 10, y: 10 });
    API.setElements([text]);
    const editor = await startEditing(text);

    editor.setSelectionRange(WORD_START, WORD_END);
    pickStroke("#ff0000");
    Keyboard.exitTextEditor(editor);

    expect(h.state.editingTextElement).toBeNull();
    expect(getText(text.id).textStyles).toEqual([
      { start: WORD_START, end: WORD_END, color: "#ff0000" },
    ]);
  });

  describe("SVG export", () => {
    it("is unchanged for text without ranges", async () => {
      const text = API.createElement({ type: "text", text: TEXT });
      const svg = await exportSvg([text]);
      const node = svg.querySelector("text")!;
      expect(node.querySelector("tspan")).toBeNull();
      expect(node.textContent).toBe(TEXT);
    });

    it("emits tspans with the right fill and highlight rects", async () => {
      const text = {
        ...API.createElement({
          type: "text",
          text: TEXT,
          strokeColor: "#1e1e1e",
        }),
        textStyles: [
          { start: WORD_START, end: WORD_END, color: "#ff0000" },
          { start: 0, end: 3, highlight: "#ffff00" },
        ],
      };
      const svg = await exportSvg([text]);
      const node = svg.querySelector("text")!;
      const tspans = [...node.querySelectorAll("tspan")];

      expect(node.textContent).toBe(TEXT);
      expect(tspans.map((tspan) => tspan.textContent)).toEqual([
        "Bid",
        " request timeout ",
        "120ms",
      ]);
      expect(tspans.map((tspan) => tspan.getAttribute("fill"))).toEqual([
        "#1e1e1e",
        "#1e1e1e",
        "#ff0000",
      ]);

      const highlights = [...svg.querySelectorAll("rect")].filter(
        (rect) => rect.getAttribute("fill") === "#ffff00",
      );
      expect(highlights).toHaveLength(1);
      // behind the text
      const group = node.parentElement!;
      expect(
        [...group.children].indexOf(highlights[0]) <
          [...group.children].indexOf(node),
      ).toBe(true);
    });

    it("splits styled runs over wrapped lines", async () => {
      const text = {
        ...API.createElement({ type: "text", text: "aaa\nbbb\nccc" }),
        originalText: "aaa bbb ccc",
        textStyles: [{ start: 2, end: 9, color: "#ff0000" }],
      };
      const svg = await exportSvg([text]);
      const lines = [...svg.querySelectorAll("text")].map((node) =>
        [...node.querySelectorAll("tspan")].map(
          (tspan) => `${tspan.textContent}:${tspan.getAttribute("fill")}`,
        ),
      );
      expect(lines).toEqual([
        ["aa:#1e1e1e", "a:#ff0000"],
        ["bbb:#ff0000"],
        ["c:#ff0000", "cc:#1e1e1e"],
      ]);
    });

    it("does not crash on out-of-range ranges", async () => {
      const text = {
        ...API.createElement({ type: "text", text: "abc" }),
        textStyles: [{ start: 1, end: 500, color: "#ff0000" }],
      };
      const svg = await exportSvg([text]);
      expect(svg.querySelector("text")!.textContent).toBe("abc");
    });
  });

  describe("bound text", () => {
    it("styles wrapped text inside a rectangle", async () => {
      const container = API.createElement({
        type: "rectangle",
        x: 10,
        y: 10,
        width: 120,
        height: 200,
      });
      API.setElements([container]);
      API.setSelectedElements([container]);
      Keyboard.keyPress(KEYS.ENTER);
      const editor = await getTextEditor();

      const value = "alpha beta gamma delta epsilon zeta";
      updateTextEditor(editor, value);
      const start = value.indexOf("gamma");
      const end = start + "gamma delta".length;
      editor.setSelectionRange(start, end);
      pickStroke("#00aa00");
      pickBackground("#ffee00");

      const bound = h.elements.find(
        (el) => el.type === "text" && el.containerId === container.id,
      ) as ExcalidrawTextElement;
      expect(bound.originalText).toBe(value);
      expect(bound.text).toContain("\n");
      expect(bound.textStyles).toEqual([
        { start, end, color: "#00aa00", highlight: "#ffee00" },
      ]);

      Keyboard.exitTextEditor(editor);

      const svg = await exportSvg(h.elements);
      const tspans = [...svg.querySelectorAll("text tspan")];
      expect(
        tspans
          .filter((tspan) => tspan.getAttribute("fill") === "#00aa00")
          .map((tspan) => tspan.textContent)
          .join(" "),
      ).toBe("gamma delta");
      expect(
        [...svg.querySelectorAll("rect")].some(
          (rect) => rect.getAttribute("fill") === "#ffee00",
        ),
      ).toBe(true);
    });
  });
});

describe("restore", () => {
  const restoreText = (element: Record<string, unknown>) =>
    restoreElements([element as any], null)[0] as ExcalidrawTextElement;

  it("loads legacy text without the field unchanged", () => {
    const text = API.createElement({ type: "text", text: "legacy" });
    const restored = restoreText({ ...text });
    expect("textStyles" in restored).toBe(false);
    expect(restored.originalText).toBe("legacy");
  });

  it("keeps valid ranges, normalized against the restored text", () => {
    const text = API.createElement({ type: "text", text: "hello world" });
    const restored = restoreText({
      ...text,
      textStyles: [
        { start: 6, end: 99, color: "red" },
        { start: 0, end: 5, highlight: "yellow" },
        { start: 3, end: 3, color: "blue" },
        { start: "x", end: 3, color: "blue" },
        7,
      ],
    });
    expect(restored.textStyles).toEqual([
      { start: 0, end: 5, highlight: "yellow" },
      { start: 6, end: 11, color: "red" },
    ]);
  });

  it("drops the field when no valid range is left", () => {
    const text = API.createElement({ type: "text", text: "hello" });
    for (const textStyles of [[], [{ start: 9, end: 12, color: "red" }], "x"]) {
      const restored = restoreText({ ...text, textStyles });
      expect("textStyles" in restored).toBe(false);
    }
  });
});

describe("list markers", () => {
  it("shifts the ranges of a duplicated list item", async () => {
    await render(<Excalidraw />);
    const text = {
      ...API.createElement({ type: "text", text: "1. foo" }),
      textStyles: [{ start: 3, end: 6, color: "#ff0000" }],
    };
    API.setElements([text]);

    advanceDuplicatedListMarkers([text], h.app.scene);
    expect(getText(text.id).originalText).toBe("2. foo");
    expect(getText(text.id).textStyles).toEqual([
      { start: 3, end: 6, color: "#ff0000" },
    ]);

    // a longer marker pushes the range along
    const longer = {
      ...API.createElement({ type: "text", text: "9. foo" }),
      textStyles: [{ start: 3, end: 6, color: "#ff0000" }],
    };
    API.setElements([longer]);
    advanceDuplicatedListMarkers([longer], h.app.scene);
    expect(getText(longer.id).originalText).toBe("10. foo");
    expect(getText(longer.id).textStyles).toEqual([
      { start: 4, end: 7, color: "#ff0000" },
    ]);
  });
});
