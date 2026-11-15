import { act } from "@testing-library/react";

import { FONT_FAMILY, THEME, applyDarkModeFilter } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  getTextStyleRunsByLine,
  isTextElement,
  newElementWith,
} from "@excalidraw/element";

import type {
  ExcalidrawTextElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { actionChangeFontFamily } from "../actions/actionProperties";
import { actionChangeTextHighlight } from "../actions/actionTextStyle";
import { getDefaultAppState } from "../appState";
import { restoreElements } from "../data/restore";
import { reconcileElements } from "../data/reconcile";
import { exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor } from "./queries/dom";
import { fireEvent, render, unmountComponent } from "./test-utils";

import type { RemoteExcalidrawElement } from "../data/reconcile";
import type { Action } from "../actions/types";
import type { AppState } from "../types";

const { h } = window;

unmountComponent();

const mouse = new Pointer("mouse");

const RED = "#e03131";
const BLUE = "#1971c2";
const YELLOW = "#ffec99";

const TEXT = "Bid request timeout 120ms";
const WORD_START = TEXT.indexOf("120ms");
const WORD_END = TEXT.length;

const getText = (id?: string) =>
  (id
    ? h.elements.find((element) => element.id === id)
    : h.elements.find(isTextElement)) as NonDeleted<ExcalidrawTextElement>;

/** types into the editor, leaving the caret at `caret` (else at the end) */
const typeIntoEditor = (
  editor: HTMLTextAreaElement,
  value: string,
  caret = value.length,
) => {
  act(() => {
    editor.value = value;
    editor.setSelectionRange(caret, caret);
    fireEvent.input(editor);
  });
};

const executeAction = (action: Action, value: unknown) => {
  act(() => {
    h.app.actionManager.executeAction(action, "ui", value);
  });
};

const selectInEditor = (
  editor: HTMLTextAreaElement,
  start: number,
  end: number,
) => {
  act(() => {
    editor.setSelectionRange(start, end);
  });
};

/** the text each range covers, with its style */
const describeRanges = (element: ExcalidrawTextElement) =>
  element.styleRanges.map(({ start, end, ...style }) => ({
    text: element.originalText.slice(start, end),
    ...style,
  }));

describe("styling parts of a text", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const createText = async () => {
    UI.clickTool("text");
    mouse.clickAt(100, 100);
    const editor = await getTextEditor();
    typeIntoEditor(editor, TEXT);
    return editor;
  };

  it("colors the selected part of the text being edited", async () => {
    const editor = await createText();

    selectInEditor(editor, WORD_START, WORD_END);
    UI.clickOnTestId(`color-top-pick-${RED}`);

    const text = getText();
    expect(text.strokeColor).not.toBe(RED);
    expect(describeRanges(text)).toEqual([{ text: "120ms", strokeColor: RED }]);
    // the color applies to the text, not to what's drawn next
    expect(h.state.currentItemStrokeColor).not.toBe(RED);
    // still editing
    expect(h.state.editingTextElement?.id).toBe(text.id);

    Keyboard.exitTextEditor(editor);
    expect(describeRanges(getText())).toEqual([
      { text: "120ms", strokeColor: RED },
    ]);
  });

  it("highlights the selected part of the text being edited", async () => {
    const editor = await createText();

    selectInEditor(editor, WORD_START, WORD_END);
    UI.clickOnTestId(`text-highlight-${YELLOW}`);

    expect(describeRanges(getText())).toEqual([
      { text: "120ms", backgroundColor: YELLOW },
    ]);

    // colored on top of the highlight, over a different range
    selectInEditor(editor, 12, 22);
    UI.clickOnTestId(`color-top-pick-${RED}`);

    expect(describeRanges(getText())).toEqual([
      { text: "timeout ", strokeColor: RED },
      { text: "12", strokeColor: RED, backgroundColor: YELLOW },
      { text: "0ms", backgroundColor: YELLOW },
    ]);

    // unhighlighted
    selectInEditor(editor, 0, TEXT.length);
    UI.clickOnTestId("text-highlight-none");
    expect(describeRanges(getText())).toEqual([
      { text: "timeout 12", strokeColor: RED },
    ]);
  });

  it("colors the whole text with nothing selected in the editor", async () => {
    const editor = await createText();

    selectInEditor(editor, WORD_START, WORD_END);
    UI.clickOnTestId(`color-top-pick-${RED}`);
    selectInEditor(editor, 0, 3);
    UI.clickOnTestId(`text-highlight-${YELLOW}`);

    // just the caret: the whole text, and the parts colored on their own
    // take the color (highlights stay)
    selectInEditor(editor, 2, 2);
    UI.clickOnTestId(`color-top-pick-${BLUE}`);

    const text = getText();
    expect(text.strokeColor).toBe(BLUE);
    expect(describeRanges(text)).toEqual([
      { text: "Bid", backgroundColor: YELLOW },
    ]);
  });

  it("colors the whole text with all of it selected", async () => {
    const editor = await createText();
    selectInEditor(editor, WORD_START, WORD_END);
    UI.clickOnTestId(`color-top-pick-${RED}`);

    // as the editor opens on an existing text, selecting all of it
    selectInEditor(editor, 0, TEXT.length);
    UI.clickOnTestId(`color-top-pick-${BLUE}`);

    const text = getText();
    expect(text.strokeColor).toBe(BLUE);
    expect(text.styleRanges).toEqual([]);
    expect(h.state.currentItemStrokeColor).toBe(BLUE);
  });

  it("clears a part's own color by coloring it with the text's color", async () => {
    const editor = await createText();

    selectInEditor(editor, WORD_START, WORD_END);
    UI.clickOnTestId(`color-top-pick-${RED}`);
    expect(getText().styleRanges).toHaveLength(1);

    UI.clickOnTestId(`color-top-pick-${getText().strokeColor}`);
    expect(getText().styleRanges).toEqual([]);
  });

  it("moves the styling along with text typed and deleted", async () => {
    const editor = await createText();

    selectInEditor(editor, WORD_START, WORD_END);
    UI.clickOnTestId(`color-top-pick-${RED}`);

    // typed in front
    typeIntoEditor(editor, `Bid request socket timeout 120ms`, 19);
    expect(describeRanges(getText())).toEqual([
      { text: "120ms", strokeColor: RED },
    ]);

    // typed on at the end of the colored word
    typeIntoEditor(editor, `Bid request socket timeout 120ms!`);
    expect(describeRanges(getText())).toEqual([
      { text: "120ms!", strokeColor: RED },
    ]);

    // deleted from the front
    typeIntoEditor(editor, `timeout 120ms!`, 0);
    expect(describeRanges(getText())).toEqual([
      { text: "120ms!", strokeColor: RED },
    ]);

    // the colored part deleted
    typeIntoEditor(editor, `timeout `);
    expect(getText().styleRanges).toEqual([]);
  });

  it("shows the styling in the editor", async () => {
    const editor = await createText();
    expect(document.querySelector(".excalidraw-wysiwyg-styles")).toBe(null);

    selectInEditor(editor, WORD_START, WORD_END);
    UI.clickOnTestId(`color-top-pick-${RED}`);

    const mirror = document.querySelector<HTMLDivElement>(
      ".excalidraw-wysiwyg-styles",
    )!;
    expect(mirror).not.toBe(null);
    const span = mirror.querySelector("span")!;
    expect(span.textContent).toBe("120ms");
    expect(span.style.color).toBe("rgb(224, 49, 49)");
    // the editor's own text gives way to the mirror's
    expect(editor.style.color).toBe("transparent");

    Keyboard.exitTextEditor(editor);
    expect(document.querySelector(".excalidraw-wysiwyg-styles")).toBe(null);
  });

  it("highlights selected texts as a whole", async () => {
    const text = API.createElement({ type: "text", text: TEXT });
    API.setElements([text]);
    API.setSelectedElements([text]);

    executeAction(actionChangeTextHighlight, YELLOW);
    expect(describeRanges(getText())).toEqual([
      { text: TEXT, backgroundColor: YELLOW },
    ]);

    executeAction(actionChangeTextHighlight, null);
    expect(getText().styleRanges).toEqual([]);
  });

  it("undoes and redoes styling", async () => {
    const text = API.createElement({ type: "text", text: TEXT });
    API.updateScene({
      elements: [text],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([text]);
    Keyboard.keyPress("Enter");

    const editor = await getTextEditor();
    selectInEditor(editor, WORD_START, WORD_END);
    UI.clickOnTestId(`color-top-pick-${RED}`);
    Keyboard.exitTextEditor(editor);

    expect(describeRanges(getText())).toEqual([
      { text: "120ms", strokeColor: RED },
    ]);

    // the styling is an entry of its own (after it, the editor's exit,
    // which leaves the text selected)
    Keyboard.undo();
    Keyboard.undo();
    expect(getText().isDeleted).toBe(false);
    expect(getText().originalText).toBe(TEXT);
    expect(getText().styleRanges).toEqual([]);

    Keyboard.redo();
    expect(describeRanges(getText())).toEqual([
      { text: "120ms", strokeColor: RED },
    ]);
  });

  it("keeps styling aligned on a label as its container wraps it", async () => {
    const container = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 400,
      height: 100,
    });
    API.setElements([container]);
    API.setSelectedElements([container]);
    Keyboard.keyPress("Enter");

    const editor = await getTextEditor();
    typeIntoEditor(editor, TEXT);
    selectInEditor(editor, WORD_START, WORD_END);
    UI.clickOnTestId(`text-highlight-${YELLOW}`);
    Keyboard.exitTextEditor(editor);

    const label = getText();
    expect(label.containerId).toBe(container.id);
    expect(describeRanges(label)).toEqual([
      { text: "120ms", backgroundColor: YELLOW },
    ]);

    // narrow the container: the label wraps into more lines
    const latestContainer = h.elements.find((el) => el.id === container.id)!;
    UI.resize(latestContainer, "e", [-300, 0]);

    const wrapped = getText(label.id);
    expect(wrapped.text.split("\n").length).toBeGreaterThan(1);
    // the ranges are of `originalText`, and stay as they are
    expect(wrapped.styleRanges).toEqual(label.styleRanges);
    // the highlighted runs are still just "120ms"
    const highlighted = getTextStyleRunsByLine(wrapped)!
      .flat()
      .filter((run) => run.backgroundColor)
      .map((run) => run.text)
      .join("");
    expect(highlighted).toBe("120ms");
  });

  it("keeps styling as the font changes", async () => {
    const editor = await createText();
    selectInEditor(editor, WORD_START, WORD_END);
    UI.clickOnTestId(`color-top-pick-${RED}`);
    Keyboard.exitTextEditor(editor);

    const text = getText();
    API.setSelectedElements([text]);
    executeAction(actionChangeFontFamily, {
      currentItemFontFamily: FONT_FAMILY.Nunito,
      currentHoveredFontFamily: null,
    });

    const updated = getText();
    expect(updated.fontFamily).toBe(FONT_FAMILY.Nunito);
    expect(updated.styleRanges).toEqual(text.styleRanges);
  });
});

describe("restoring styled text", () => {
  it("restores legacy text without ranges", () => {
    const legacy = API.createElement({ type: "text", text: TEXT });
    delete (legacy as any).styleRanges;
    const [restored] = restoreElements([legacy], null);
    expect((restored as ExcalidrawTextElement).styleRanges).toEqual([]);
  });

  it("normalizes malformed or stale ranges", () => {
    const [restored] = restoreElements(
      [
        {
          ...API.createElement({ type: "text", text: TEXT }),
          styleRanges: [
            { start: 20, end: 99, strokeColor: RED },
            { start: 4, end: 2, strokeColor: RED },
            { start: 0, end: 3 },
            "junk",
          ] as any,
        },
      ],
      null,
    );
    expect((restored as ExcalidrawTextElement).styleRanges).toEqual([
      { start: 20, end: TEXT.length, strokeColor: RED },
    ]);
  });

  it("keeps valid ranges", () => {
    const styleRanges = [
      { start: 0, end: 3, backgroundColor: YELLOW },
      { start: 20, end: 25, strokeColor: RED },
    ];
    const [restored] = restoreElements(
      [{ ...API.createElement({ type: "text", text: TEXT }), styleRanges }],
      null,
    );
    expect((restored as ExcalidrawTextElement).styleRanges).toEqual(
      styleRanges,
    );
  });
});

describe("collaborating on styled text", () => {
  const appState = getDefaultAppState() as AppState;

  const createText = (props: Partial<ExcalidrawTextElement> = {}) =>
    ({
      ...API.createElement({ type: "text", text: TEXT, id: "text" }),
      index: "a0",
      ...props,
    } as OrderedExcalidrawElement & ExcalidrawTextElement);

  it("takes the text and its styling from the same side", () => {
    const local = createText({ version: 2 });
    // a peer edited the text and colored the new word
    const remote = newElementWith(local, {
      originalText: "Bid timeout 250ms",
      text: "Bid timeout 250ms",
      styleRanges: [{ start: 12, end: 17, strokeColor: RED }],
      version: 3,
    }) as unknown as RemoteExcalidrawElement;

    const [reconciled] = reconcileElements([local], [remote], appState);
    expect(reconciled).toBe(remote);
    expect(describeRanges(reconciled as ExcalidrawTextElement)).toEqual([
      { text: "250ms", strokeColor: RED },
    ]);

    // the older side's styling never lands on the newer text
    const [kept] = reconcileElements(
      [remote as unknown as OrderedExcalidrawElement],
      [local as unknown as RemoteExcalidrawElement],
      appState,
    );
    expect(kept).toBe(remote);
  });

  it("keeps the local styling of the text being edited", () => {
    const local = createText({
      version: 2,
      styleRanges: [{ start: 20, end: 25, strokeColor: RED }],
    });
    const remote = newElementWith(local, {
      styleRanges: [{ start: 0, end: 3, strokeColor: BLUE }],
      version: 5,
    }) as unknown as RemoteExcalidrawElement;

    const [reconciled] = reconcileElements([local], [remote], {
      ...appState,
      editingTextElement: local,
    });
    expect(reconciled).toBe(local);
  });

  it("normalizes ranges from a peer as it restores them", () => {
    // e.g. a peer on a version that edits text without moving the ranges
    const remote = createText({
      originalText: "Bid",
      text: "Bid",
      styleRanges: [{ start: 0, end: 25, strokeColor: RED }],
    });
    const [restored] = restoreElements([remote], null);
    expect((restored as ExcalidrawTextElement).styleRanges).toEqual([
      { start: 0, end: 3, strokeColor: RED },
    ]);
  });
});

describe("exporting styled text to SVG", () => {
  const exportText = async (
    props: Partial<ExcalidrawTextElement>,
    exportWithDarkMode = false,
  ) => {
    const text = {
      ...API.createElement({
        type: "text",
        text: TEXT,
        strokeColor: "#1e1e1e",
      }),
      index: "a0",
      ...props,
    } as unknown as NonDeletedExcalidrawElement;
    const svg = (await exportScene({
      type: "svg",
      data: {
        elements: [text],
        appState: { viewBackgroundColor: "#ffffff" },
        files: {},
      },
      config: {
        canvasBackgroundColor: false,
        ...(exportWithDarkMode ? { theme: THEME.DARK } : {}),
      },
    })) as SVGSVGElement;
    return svg;
  };

  it("exports parts colored on their own as tspans", async () => {
    const svg = await exportText({
      styleRanges: [{ start: WORD_START, end: WORD_END, strokeColor: RED }],
    });

    const texts = svg.querySelectorAll("text");
    expect(texts).toHaveLength(1);
    expect(texts[0].getAttribute("fill")).toBe("#1e1e1e");
    expect(texts[0].textContent).toBe(TEXT);

    const tspans = [...texts[0].querySelectorAll("tspan")];
    expect(
      tspans.map((tspan) => [tspan.textContent, tspan.getAttribute("fill")]),
    ).toEqual([
      ["Bid request timeout ", null],
      ["120ms", RED],
    ]);
  });

  it("exports highlights as rects behind the text", async () => {
    const svg = await exportText({
      styleRanges: [{ start: 0, end: 3, backgroundColor: YELLOW }],
    });

    const rects = [...svg.querySelectorAll("rect")].filter(
      (rect) => rect.getAttribute("fill") === YELLOW,
    );
    expect(rects).toHaveLength(1);
    // measured text is 10px per char in tests: "Bid"
    expect(rects[0].getAttribute("x")).toBe("0");
    expect(rects[0].getAttribute("width")).toBe("30");
    // behind the text
    const text = svg.querySelector("text")!;
    expect(
      rects[0].compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // highlighted only: no tspans needed
    expect(text.querySelectorAll("tspan")).toHaveLength(0);
  });

  it("exports each wrapped line's runs", async () => {
    const svg = await exportText({
      text: "Bid request\ntimeout 120ms",
      autoResize: false,
      styleRanges: [{ start: 12, end: 25, strokeColor: RED }],
    });
    const texts = [...svg.querySelectorAll("text")];
    expect(texts.map((text) => text.textContent)).toEqual([
      "Bid request",
      "timeout 120ms",
    ]);
    expect(texts[0].querySelectorAll("tspan")).toHaveLength(0);
    expect(
      [...texts[1].querySelectorAll("tspan")].map((tspan) => [
        tspan.textContent,
        tspan.getAttribute("fill"),
      ]),
    ).toEqual([["timeout 120ms", RED]]);
  });

  it("exports colors for dark mode", async () => {
    const svg = await exportText(
      {
        styleRanges: [
          {
            start: WORD_START,
            end: WORD_END,
            strokeColor: RED,
            backgroundColor: YELLOW,
          },
        ],
      },
      true,
    );
    const tspan = [...svg.querySelectorAll("tspan")].find(
      (tspan) => tspan.textContent === "120ms",
    )!;
    expect(tspan.getAttribute("fill")).toBe(applyDarkModeFilter(RED, true));
    expect(
      [...svg.querySelectorAll("rect")].some(
        (rect) =>
          rect.getAttribute("fill") === applyDarkModeFilter(YELLOW, true),
      ),
    ).toBe(true);
  });

  it("exports unstyled text as before", async () => {
    const svg = await exportText({});
    const text = svg.querySelector("text")!;
    expect(text.querySelectorAll("tspan")).toHaveLength(0);
    expect(text.textContent).toBe(TEXT);
  });
});
