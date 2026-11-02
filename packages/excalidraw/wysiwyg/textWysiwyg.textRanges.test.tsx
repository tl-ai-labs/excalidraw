import { fireEvent, queryByTestId } from "@testing-library/react";

import { colorToHex, KEYS } from "@excalidraw/common";
import { getTextStyleRuns, isTextElement } from "@excalidraw/element";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import {
  actionChangeStrokeColor,
  actionChangeTextHighlight,
  actionResetTextStyle,
} from "../actions";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { getTextEditor, updateTextEditor } from "../tests/queries/dom";
import { act, render, unmountComponent } from "../tests/test-utils";

import { PREVIEW_CLASS_NAME } from "./textPreview";

const { h } = window;

unmountComponent();

const T = "Bid request timeout 120ms";
const RED = "#e03131";
const YELLOW = "#ffec99";

const PROSE =
  "Bid request timeout 120ms applies to every exchange in the primary region. When the auction server misses that window the request is dropped and the slot is sold through the fallback path. Review the latency dashboard before changing this value, and tell the on-call engineer about any change that touches the pricing service.";
const ADDED =
  "Before the next release the team agreed to review every setting that controls how long a request may wait, and to write down who owns each one. The list below is the current state of that work, and it will change as the review goes on through the rest of the quarter, so please read it again before you rely on any of these numbers. ";
const DIGITS = Array.from({ length: 2500 }, (_, i) =>
  String(i).padStart(4, "0"),
).join("");
const repeatTo = (text: string, length: number) => {
  let out = "";
  while (out.length < length) {
    out += `${text} `;
  }
  return out.slice(0, length);
};
const proseNote = (lineCount: number) => {
  const lines: string[] = [];
  let at = 0;
  while (lines.length < lineCount) {
    lines.push(PROSE.slice(at, at + 58).trim());
    at = (at + 58) % (PROSE.length - 60);
  }
  return lines.join("\n");
};
const digitNote = (lineCount: number) =>
  Array.from({ length: lineCount }, (_, i) =>
    DIGITS.slice(i * 60, i * 60 + 58),
  ).join("\n");
const indentAll = (text: string) =>
  text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
const colour = (editor: HTMLTextAreaElement, start: number, end: number) => {
  editor.setSelectionRange(start, end);
  act(() => {
    h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
      color: RED,
    });
  });
};

const startEditing = async (text: string = T): Promise<HTMLTextAreaElement> => {
  const element = API.createElement({ type: "text", text });
  API.setElements([element]);
  API.setSelectedElements([element]);
  Keyboard.keyPress(KEYS.ENTER);
  return await getTextEditor();
};

describe("text wysiwyg text ranges", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("a colour on a selection styles that range alone", async () => {
    const editor = await startEditing();
    const prevStroke = (h.elements[0] as ExcalidrawTextElement).strokeColor;
    const prevCurrentStroke = h.state.currentItemStrokeColor;

    editor.setSelectionRange(20, 25);
    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(getTextStyleRuns(element)).toEqual([
      { start: 20, end: 25, color: RED, highlight: null },
    ]);
    expect(element.strokeColor).toBe(prevStroke);
    expect(h.state.currentItemStrokeColor).toBe(prevCurrentStroke);
  });

  it("the selection stays", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    expect(editor.selectionStart).toBe(20);
    expect(editor.selectionEnd).toBe(25);
    expect(h.state.editingTextElement).not.toBeNull();
  });

  it("offsets map across lines", async () => {
    const editor = await startEditing("line one\nline two");
    editor.setSelectionRange(9, 13);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(getTextStyleRuns(element)).toEqual([
      { start: 9, end: 13, color: RED, highlight: null },
    ]);
  });

  it("offsets map in bound text", async () => {
    const [container, text] = API.createTextContainer({
      label: { text: "sample-text" },
    });
    API.setElements([container, text]);
    API.setSelectedElements([container]);
    Keyboard.keyPress(KEYS.ENTER);

    const editor = await getTextEditor();
    editor.setSelectionRange(0, 6);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    const textElement = h.elements.find(isTextElement)!;
    const containerElement = h.elements.find((el) => el.id === container.id)!;

    expect(getTextStyleRuns(textElement)).toEqual([
      { start: 0, end: 6, color: RED, highlight: null },
    ]);
    expect("textRanges" in containerElement).toBe(false);
  });

  it("a highlight on a selection", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeTextHighlight, "ui", {
        color: YELLOW,
      });
    });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(getTextStyleRuns(element)).toEqual([
      { start: 20, end: 25, color: null, highlight: YELLOW },
    ]);
  });

  it("the transparent swatch removes a highlight", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeTextHighlight, "ui", {
        color: YELLOW,
      });
    });

    act(() => {
      h.app.actionManager.executeAction(actionChangeTextHighlight, "ui", {
        color: "transparent",
      });
    });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(getTextStyleRuns(element)).toEqual([]);
  });

  it("reset removes colour and highlight from a selection", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    act(() => {
      h.app.actionManager.executeAction(actionChangeTextHighlight, "ui", {
        color: YELLOW,
      });
    });

    act(() => {
      h.app.actionManager.executeAction(actionResetTextStyle, "ui", null);
    });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(getTextStyleRuns(element)).toEqual([]);
    expect(element.textRanges).toBeDefined();
  });

  it("reset on part of a range splits it", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    editor.setSelectionRange(21, 23);
    act(() => {
      h.app.actionManager.executeAction(actionResetTextStyle, "ui", null);
    });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(getTextStyleRuns(element)).toEqual([
      { start: 20, end: 21, color: RED, highlight: null },
      { start: 23, end: 25, color: RED, highlight: null },
    ]);
  });

  it("reset with no selection does nothing", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    const rangesBefore = (h.elements[0] as ExcalidrawTextElement).textRanges;

    editor.setSelectionRange(22, 22);
    act(() => {
      h.app.actionManager.executeAction(actionResetTextStyle, "ui", null);
    });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.textRanges).toBe(rangesBefore);
  });

  it("reset on plain text adds no key", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(3, 10);

    act(() => {
      h.app.actionManager.executeAction(actionResetTextStyle, "ui", null);
    });

    Keyboard.exitTextEditor(editor);

    const element = h.elements[0] as ExcalidrawTextElement;
    expect("textRanges" in element).toBe(false);
  });

  it("an empty selection sets strokeColor", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    editor.setSelectionRange(3, 3);
    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#1971c2",
      });
    });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.strokeColor).toBe("#1971c2");
    expect(getTextStyleRuns(element)).toEqual([
      { start: 20, end: 25, color: RED, highlight: null },
    ]);
  });

  it("a selected element not being edited sets strokeColor", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    Keyboard.exitTextEditor(editor);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#1971c2",
      });
    });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.strokeColor).toBe("#1971c2");
    expect(getTextStyleRuns(element)).toEqual([
      { start: 20, end: 25, color: RED, highlight: null },
    ]);
  });

  it("ranges follow typing", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    updateTextEditor(editor, `Urgent: ${T}`);

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(getTextStyleRuns(element)).toEqual([
      { start: 28, end: 33, color: RED, highlight: null },
    ]);
    expect(element.originalText.slice(28, 33)).toBe("120ms");
  });

  it("the preview shows colour and highlight", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    act(() => {
      h.app.actionManager.executeAction(actionChangeTextHighlight, "ui", {
        color: YELLOW,
      });
    });

    const preview = document.querySelector(
      `.${PREVIEW_CLASS_NAME}`,
    ) as HTMLElement | null;
    expect(preview).not.toBeNull();

    const span = preview?.querySelector("span");
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe("120ms");
    expect(colorToHex(span?.style.color || "")).toBe(RED);
    expect(colorToHex(span?.style.backgroundColor || "")).toBe(YELLOW);
    expect(preview?.textContent).toBe(editor.value);
    expect(editor.style.color).toBe("transparent");
  });

  it("the preview stays aligned after typing", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    updateTextEditor(editor, `Urgent: ${T}`);

    const preview = document.querySelector(
      `.${PREVIEW_CLASS_NAME}`,
    ) as HTMLElement | null;
    expect(preview).not.toBeNull();

    const span = preview?.querySelector("span");
    expect(span?.textContent).toBe("120ms");
    expect(preview?.textContent).toBe(editor.value);
  });

  it("the preview mirrors the editor's box", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    const preview = document.querySelector(
      `.${PREVIEW_CLASS_NAME}`,
    ) as HTMLElement | null;
    expect(preview).not.toBeNull();

    expect(preview?.style.width).toBe(editor.style.width);
    expect(preview?.style.height).toBe(editor.style.height);
    expect(preview?.style.left).toBe(editor.style.left);
    expect(preview?.style.top).toBe(editor.style.top);
    expect(preview?.style.transform).toBe(editor.style.transform);
    expect(preview?.getAttribute("aria-hidden")).toBe("true");

    expect(preview?.nextSibling).toBe(editor);
  });

  it("there is no preview with no visible runs", async () => {
    const editor = await startEditing();
    expect(document.querySelector(`.${PREVIEW_CLASS_NAME}`)).toBeNull();
    expect(editor.style.color).not.toBe("transparent");
  });

  it("removing the last run removes the preview", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    expect(document.querySelector(`.${PREVIEW_CLASS_NAME}`)).not.toBeNull();

    act(() => {
      h.app.actionManager.executeAction(actionResetTextStyle, "ui", null);
    });

    expect(document.querySelector(`.${PREVIEW_CLASS_NAME}`)).toBeNull();
    expect(editor.style.color).not.toBe("transparent");
  });

  it("the preview goes when editing ends", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(20, 25);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    expect(document.querySelector(`.${PREVIEW_CLASS_NAME}`)).not.toBeNull();

    Keyboard.exitTextEditor(editor);

    expect(document.querySelector(`.${PREVIEW_CLASS_NAME}`)).toBeNull();
    const element = h.elements[0] as ExcalidrawTextElement;
    expect(getTextStyleRuns(element)).toEqual([
      { start: 20, end: 25, color: RED, highlight: null },
    ]);
  });

  it("the controls show only while editing", async () => {
    expect(
      document.querySelector('[data-openpopup="textHighlight"]'),
    ).toBeNull();
    expect(queryByTestId(document.body, "reset-text-style")).toBeNull();

    const editor = await startEditing();

    expect(
      document.querySelector('[data-openpopup="textHighlight"]'),
    ).not.toBeNull();
    expect(queryByTestId(document.body, "reset-text-style")).not.toBeNull();

    Keyboard.exitTextEditor(editor);

    expect(
      document.querySelector('[data-openpopup="textHighlight"]'),
    ).toBeNull();
    expect(queryByTestId(document.body, "reset-text-style")).toBeNull();
  });

  it("a style change makes a new element object", async () => {
    const editor = await startEditing();
    const elementBefore = h.elements[0];

    editor.setSelectionRange(20, 25);
    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    const elementAfter = h.elements[0];
    expect(elementAfter).not.toBe(elementBefore);
  });

  it("a whole-text selection on plain text sets strokeColor", async () => {
    const editor = await startEditing();
    editor.setSelectionRange(0, T.length);
    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.strokeColor).toBe(RED);
    expect("textRanges" in element).toBe(false);
  });

  it("a whole-text selection over a coloured run takes the range path", async () => {
    const editor = await startEditing();
    const prevStroke = (h.elements[0] as ExcalidrawTextElement).strokeColor;

    editor.setSelectionRange(20, 25);
    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: RED,
      });
    });

    editor.setSelectionRange(0, T.length);
    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#1971c2",
      });
    });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.strokeColor).toBe(prevStroke);
    expect(getTextStyleRuns(element)).toEqual([
      { start: 0, end: 25, color: "#1971c2", highlight: null },
    ]);
  });

  it("Tab on all lines keeps a word on a long prose note", async () => {
    const text = proseNote(18);
    const at = text.indexOf("dropped");
    const lineCount = text.slice(0, at).split("\n").length;
    const editor = await startEditing(text);
    colour(editor, at, at + 7);
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: KEYS.TAB });

    const element = h.elements[0] as ExcalidrawTextElement;
    const trueStart = at + 4 * lineCount;
    expect(element.originalText).toBe(indentAll(text));
    expect(getTextStyleRuns(element)).toEqual([
      { start: trueStart, end: trueStart + 7, color: RED, highlight: null },
    ]);
    expect(element.originalText.slice(trueStart, trueStart + 7)).toBe(
      "dropped",
    );
  });

  it("Tab on all lines keeps a word on a longer prose note", async () => {
    const text = proseNote(24);
    const at = text.lastIndexOf("latency");
    const lineCount = text.slice(0, at).split("\n").length;
    const editor = await startEditing(text);
    colour(editor, at, at + 7);
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: KEYS.TAB });

    const element = h.elements[0] as ExcalidrawTextElement;
    const trueStart = at + 4 * lineCount;
    expect(element.originalText).toBe(indentAll(text));
    expect(getTextStyleRuns(element)).toEqual([
      { start: trueStart, end: trueStart + 7, color: RED, highlight: null },
    ]);
    expect(element.originalText.slice(trueStart, trueStart + 7)).toBe(
      "latency",
    );
  });

  it("Tab on all lines keeps a span of digits", async () => {
    const text = digitNote(18);
    const at = 500;
    const lineCount = text.slice(0, at).split("\n").length;
    const editor = await startEditing(text);
    colour(editor, at, at + 10);
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: KEYS.TAB });

    const element = h.elements[0] as ExcalidrawTextElement;
    const trueStart = at + 4 * lineCount;
    expect(element.originalText).toBe(indentAll(text));
    expect(getTextStyleRuns(element)).toEqual([
      { start: trueStart, end: trueStart + 10, color: RED, highlight: null },
    ]);
    expect(element.originalText.slice(trueStart, trueStart + 10)).toBe(
      text.slice(500, 510),
    );
  });

  it("Tab on all lines keeps a span of digits on a longer note", async () => {
    const text = digitNote(24);
    const at = 1003;
    const lineCount = text.slice(0, at).split("\n").length;
    const editor = await startEditing(text);
    colour(editor, at, at + 10);
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: KEYS.TAB });

    const element = h.elements[0] as ExcalidrawTextElement;
    const trueStart = at + 4 * lineCount;
    expect(element.originalText).toBe(indentAll(text));
    expect(getTextStyleRuns(element)).toEqual([
      { start: trueStart, end: trueStart + 10, color: RED, highlight: null },
    ]);
    expect(element.originalText.slice(trueStart, trueStart + 10)).toBe(
      text.slice(1003, 1013),
    );
  });

  it("Shift+Tab on all lines keeps a word on a long prose note", async () => {
    const text = proseNote(18);
    const at = text.indexOf("dropped");
    const lineCount = text.slice(0, at).split("\n").length;
    const editor = await startEditing(indentAll(text));
    colour(editor, at + 4 * lineCount, at + 4 * lineCount + 7);
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: KEYS.TAB, shiftKey: true });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.originalText).toBe(text);
    expect(getTextStyleRuns(element)).toEqual([
      { start: at, end: at + 7, color: RED, highlight: null },
    ]);
    expect(element.originalText.slice(at, at + 7)).toBe("dropped");
  });

  it("Shift+Tab on all lines keeps a word on a longer prose note", async () => {
    const text = proseNote(24);
    const at = text.lastIndexOf("latency");
    const lineCount = text.slice(0, at).split("\n").length;
    const editor = await startEditing(indentAll(text));
    colour(editor, at + 4 * lineCount, at + 4 * lineCount + 7);
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: KEYS.TAB, shiftKey: true });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.originalText).toBe(text);
    expect(getTextStyleRuns(element)).toEqual([
      { start: at, end: at + 7, color: RED, highlight: null },
    ]);
    expect(element.originalText.slice(at, at + 7)).toBe("latency");
  });

  it("Shift+Tab on all lines keeps a span of digits", async () => {
    const text = digitNote(18);
    const at = 500;
    const lineCount = text.slice(0, at).split("\n").length;
    const editor = await startEditing(indentAll(text));
    colour(editor, at + 4 * lineCount, at + 4 * lineCount + 10);
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: KEYS.TAB, shiftKey: true });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.originalText).toBe(text);
    expect(getTextStyleRuns(element)).toEqual([
      { start: 500, end: 510, color: RED, highlight: null },
    ]);
  });

  it("Shift+Tab on all lines keeps a span of digits on a longer note", async () => {
    const text = digitNote(24);
    const at = 1003;
    const lineCount = text.slice(0, at).split("\n").length;
    const editor = await startEditing(indentAll(text));
    colour(editor, at + 4 * lineCount, at + 4 * lineCount + 10);
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: KEYS.TAB, shiftKey: true });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.originalText).toBe(text);
    expect(getTextStyleRuns(element)).toEqual([
      { start: 1003, end: 1013, color: RED, highlight: null },
    ]);
  });

  it("a change at two far-apart places of prose keeps a word", async () => {
    const text = repeatTo(PROSE, 1100);
    const at = text.indexOf("dropped");
    const lastThe = text.lastIndexOf("the ");
    const next = `Ad${text.slice(3, lastThe)}our${text.slice(lastThe + 3)}`;
    const editor = await startEditing(text);
    colour(editor, at, at + 7);
    updateTextEditor(editor, next);

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(getTextStyleRuns(element)).toEqual([
      { start: at - 1, end: at + 6, color: RED, highlight: null },
    ]);
    expect(next.slice(at - 1, at + 6)).toBe("dropped");
  });

  it("a change at two far-apart places of digits keeps a span", async () => {
    const text = DIGITS.slice(0, 1100);
    const next = `QQ${text.slice(1, 1099)}ZZ`;
    const editor = await startEditing(text);
    colour(editor, 500, 510);
    updateTextEditor(editor, next);

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(getTextStyleRuns(element)).toEqual([
      { start: 501, end: 511, color: RED, highlight: null },
    ]);
    expect(next.slice(501, 511)).toBe(text.slice(500, 510));
  });

  it("100 characters added on each side keep the label's words", async () => {
    const editor = await startEditing(T);
    colour(editor, 20, 25);
    colour(editor, 0, 3);
    updateTextEditor(
      editor,
      `${ADDED.slice(0, 100)}${T} ${ADDED.slice(100, 200)}`,
    );

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(getTextStyleRuns(element)).toEqual([
      { start: 100, end: 103, color: RED, highlight: null },
      { start: 120, end: 125, color: RED, highlight: null },
    ]);
  });

  it("333 characters added on each side keep the label's words", async () => {
    const editor = await startEditing(T);
    colour(editor, 20, 25);
    colour(editor, 0, 3);
    updateTextEditor(editor, `${ADDED}${T} ${ADDED}`);

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(getTextStyleRuns(element)).toEqual([
      {
        start: ADDED.length,
        end: ADDED.length + 3,
        color: RED,
        highlight: null,
      },
      {
        start: ADDED.length + 20,
        end: ADDED.length + 25,
        color: RED,
        highlight: null,
      },
    ]);
  });

  it("digits added on each side keep a span", async () => {
    const text = DIGITS.slice(5000, 5100);
    const editor = await startEditing(text);
    colour(editor, 10, 20);
    updateTextEditor(editor, DIGITS);

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(getTextStyleRuns(element)).toEqual([
      { start: 5010, end: 5020, color: RED, highlight: null },
    ]);
    expect(DIGITS.slice(5010, 5020)).toBe(text.slice(10, 20));
  });

  it("Tab on all lines of a 500-line note of single letters keeps styled character", async () => {
    const lines = Array.from({ length: 500 }, (_, i) =>
      String.fromCharCode(97 + (i % 26)),
    );
    const text = lines.join("\n");
    const targetLine = 250;
    const targetChar = lines[targetLine];
    const at = lines.slice(0, targetLine).join("\n").length + 1;
    const editor = await startEditing(text);
    colour(editor, at, at + 1);
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: KEYS.TAB });

    const element = h.elements[0] as ExcalidrawTextElement;
    const trueStart = at + (targetLine + 1) * 4;
    expect(element.originalText).toBe(indentAll(text));
    expect(getTextStyleRuns(element)).toEqual([
      { start: trueStart, end: trueStart + 1, color: RED, highlight: null },
    ]);
    expect(element.originalText.slice(trueStart, trueStart + 1)).toBe(
      targetChar,
    );
  });

  it("Shift+Tab on all lines of a 500-line note of single letters keeps styled character", async () => {
    const lines = Array.from({ length: 500 }, (_, i) =>
      String.fromCharCode(97 + (i % 26)),
    );
    const text = lines.join("\n");
    const targetLine = 250;
    const targetChar = lines[targetLine];
    const at = lines.slice(0, targetLine).join("\n").length + 1;
    const indented = indentAll(text);
    const indentedAt = at + (targetLine + 1) * 4;
    const editor = await startEditing(indented);
    colour(editor, indentedAt, indentedAt + 1);
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: KEYS.TAB, shiftKey: true });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.originalText).toBe(text);
    expect(getTextStyleRuns(element)).toEqual([
      { start: at, end: at + 1, color: RED, highlight: null },
    ]);
    expect(element.originalText.slice(at, at + 1)).toBe(targetChar);
  });

  it("Tab on all lines of a 200-line note keeps styled x", async () => {
    const lines = Array.from({ length: 200 }, (_, i) =>
      i % 3 === 0 ? "x" : `line number ${i} of the note`,
    );
    const text = lines.join("\n");
    const targetLine = 99;
    const targetChar = lines[targetLine];
    const at = lines.slice(0, targetLine).join("\n").length + 1;
    const editor = await startEditing(text);
    colour(editor, at, at + 1);
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: KEYS.TAB });

    const element = h.elements[0] as ExcalidrawTextElement;
    const trueStart = at + (targetLine + 1) * 4;
    expect(element.originalText).toBe(indentAll(text));
    expect(getTextStyleRuns(element)).toEqual([
      { start: trueStart, end: trueStart + 1, color: RED, highlight: null },
    ]);
    expect(element.originalText.slice(trueStart, trueStart + 1)).toBe(
      targetChar,
    );
  });

  it("Tab on a note of five lines 1 to 5 keeps styled 3", async () => {
    const text = "1\n2\n3\n4\n5";
    const at = 4;
    const editor = await startEditing(text);
    colour(editor, at, at + 1);
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: KEYS.TAB });

    const element = h.elements[0] as ExcalidrawTextElement;
    const trueStart = 4 + 3 * 4;
    expect(element.originalText).toBe(indentAll(text));
    expect(getTextStyleRuns(element)).toEqual([
      { start: trueStart, end: trueStart + 1, color: RED, highlight: null },
    ]);
    expect(element.originalText.slice(trueStart, trueStart + 1)).toBe("3");
  });

  const typeAt = (editor: HTMLTextAreaElement, at: number, typed: string) => {
    let text = editor.value;
    let caret = at;
    for (const character of typed) {
      text = `${text.slice(0, caret)}${character}${text.slice(caret)}`;
      caret++;
      updateTextEditor(editor, text);
    }
  };

  it.each([
    ["foo Bid", "Bid", "Before ", "foo Before Bid"],
    ["foo Bid", "Bid", "Xefore ", "foo Xefore Bid"],
    [
      "the engineer said",
      "engineer",
      "escalation ",
      "the escalation engineer said",
    ],
  ])(
    "typing in front of a coloured word leaves it alone: %s, %s, %s",
    async (text, word, typed, next) => {
      const at = text.indexOf(word);
      const editor = await startEditing(text);
      colour(editor, at, at + word.length);
      typeAt(editor, at, typed);
      const element = h.elements[0] as ExcalidrawTextElement;
      const start = at + typed.length;
      expect(element.originalText).toBe(next);
      expect(getTextStyleRuns(element)).toEqual([
        { start, end: start + word.length, color: RED, highlight: null },
      ]);
    },
  );

  it("typing inside a coloured word extends it", async () => {
    const editor = await startEditing("foo Bid");
    colour(editor, 4, 7);
    typeAt(editor, 6, "xyz");
    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.originalText).toBe("foo Bixyzd");
    expect(getTextStyleRuns(element)).toEqual([
      { start: 4, end: 10, color: RED, highlight: null },
    ]);
  });

  it("typing after a coloured word leaves it alone", async () => {
    const editor = await startEditing("foo Bid");
    colour(editor, 4, 7);
    typeAt(editor, 7, "s ok");
    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.originalText).toBe("foo Bids ok");
    expect(getTextStyleRuns(element)).toEqual([
      { start: 4, end: 7, color: RED, highlight: null },
    ]);
  });
});
