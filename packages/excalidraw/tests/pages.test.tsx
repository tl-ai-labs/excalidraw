import React from "react";
import { vi } from "vitest";

import {
  CANVAS_SEARCH_TAB,
  CLASSES,
  DEFAULT_SIDEBAR,
  KEYS,
  MIME_TYPES,
} from "@excalidraw/common";

import {
  CaptureUpdateAction,
  DEFAULT_PAGE_ID,
  getElementPageId,
  getVisiblePages,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { loadFromBlob } from "../data/blob";
import { serializeAsJSON } from "../data/json";
import { restoreAppState, restoreElements } from "../data/restore";
import * as StaticScene from "../renderer/staticScene";
import { decodeSvgBase64Payload, exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { act, fireEvent, render, screen, waitFor } from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

const getVisiblePageIds = () => getVisiblePages(h.state.pages).map((p) => p.id);

/** ids of the elements passed to the last static scene render */
const getRenderedElementIds = () => {
  const lastCall = renderStaticScene.mock.calls.at(-1)![0];
  return {
    visible: lastCall.visibleElements.map((element) => element.id),
    all: Array.from(lastCall.allElementsMap.keys()),
  };
};

const getAllPagesElements = () =>
  h.app.scene.getAllPagesElementsIncludingDeleted();

const clickTab = (pageId: string) => {
  fireEvent.click(screen.getByTestId(`page-tab-${pageId}`));
};

const addPage = () => {
  UI.clickOnTestId("page-tab-add");
  return h.state.activePageId;
};

/** draws a rectangle (undoable, through the UI) on the active page */
const drawRectangle = (x: number, y: number, size = 100) => {
  return UI.createElement("rectangle", { x, y, size }).get();
};

describe("pages", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderStaticScene.mockClear();
    await render(<Excalidraw handleKeyboardGlobally />);
  });

  it("starts with a single default page in the tab bar", () => {
    expect(getVisiblePageIds()).toEqual([DEFAULT_PAGE_ID]);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

    const tab = screen.getByTestId(`page-tab-${DEFAULT_PAGE_ID}`);
    expect(tab.textContent).toBe("Page 1");
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });

  it("creates, switches, renames, reorders and deletes pages", async () => {
    const rect1 = drawRectangle(0, 0);
    // elements of the default page don't carry a pageId (backward compat)
    expect(rect1.pageId).toBeUndefined();

    const page2Id = addPage();
    expect(page2Id).not.toBe(DEFAULT_PAGE_ID);
    expect(getVisiblePageIds()).toEqual([DEFAULT_PAGE_ID, page2Id]);
    expect(screen.getByTestId(`page-tab-${page2Id}`).textContent).toBe(
      "Page 2",
    );
    // the new page is empty
    expect(h.elements).toEqual([]);

    const rect2 = drawRectangle(0, 0);
    expect(rect2.pageId).toBe(page2Id);
    expect(h.elements.map((el) => el.id)).toEqual([rect2.id]);

    // the document holds both pages' elements
    expect(getAllPagesElements().map((el) => el.id)).toEqual([
      rect1.id,
      rect2.id,
    ]);

    // switch
    clickTab(DEFAULT_PAGE_ID);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(h.elements.map((el) => el.id)).toEqual([rect1.id]);

    // rename (double-click the tab)
    fireEvent.doubleClick(screen.getByTestId(`page-tab-${page2Id}`));
    const input = screen.getByTestId(
      "page-tab-rename-input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  SDK flow  " } });
    fireEvent.keyDown(input, { key: KEYS.ENTER });
    expect(h.state.pages.find((p) => p.id === page2Id)!.name).toBe("SDK flow");
    expect(screen.getByTestId(`page-tab-${page2Id}`).textContent).toBe(
      "SDK flow",
    );

    // escape cancels renaming
    fireEvent.doubleClick(screen.getByTestId(`page-tab-${page2Id}`));
    const input2 = screen.getByTestId(
      "page-tab-rename-input",
    ) as HTMLInputElement;
    fireEvent.change(input2, { target: { value: "nope" } });
    fireEvent.keyDown(input2, { key: KEYS.ESCAPE });
    expect(h.state.pages.find((p) => p.id === page2Id)!.name).toBe("SDK flow");

    act(() => {
      h.app.pages.rename(DEFAULT_PAGE_ID, "Data pipeline");
    });
    expect(screen.getByTestId(`page-tab-${DEFAULT_PAGE_ID}`).textContent).toBe(
      "Data pipeline",
    );

    // reorder
    act(() => {
      h.app.pages.move(page2Id, 0);
    });
    expect(getVisiblePageIds()).toEqual([page2Id, DEFAULT_PAGE_ID]);
    const tabs = screen
      .getAllByRole("tab")
      .map((tab) => tab.getAttribute("data-testid"));
    expect(tabs).toEqual([
      `page-tab-${page2Id}`,
      `page-tab-${DEFAULT_PAGE_ID}`,
    ]);

    // delete the active page through the tab menu
    clickTab(page2Id);
    UI.clickOnTestId("page-tab-menu");
    await waitFor(() =>
      expect(screen.queryByTestId("page-tab-menu-delete")).not.toBeNull(),
    );
    UI.clickOnTestId("page-tab-menu-delete");
    UI.clickLabeledElement("Confirm");

    expect(getVisiblePageIds()).toEqual([DEFAULT_PAGE_ID]);
    // switched to the remaining page
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(h.elements.map((el) => el.id)).toEqual([rect1.id]);
    // the deleted page's elements are deleted (not removed, so that the
    // deletion syncs), and the page is kept as a tombstone
    expect(
      getAllPagesElements().find((el) => el.id === rect2.id)?.isDeleted,
    ).toBe(true);
    expect(h.state.pages.find((p) => p.id === page2Id)?.isDeleted).toBe(true);
    expect(screen.queryByTestId(`page-tab-${page2Id}`)).toBeNull();

    // the last page can't be deleted
    let deleted = true;
    act(() => {
      deleted = h.app.pages.delete(DEFAULT_PAGE_ID);
    });
    expect(deleted).toBe(false);
    expect(getVisiblePageIds()).toEqual([DEFAULT_PAGE_ID]);
  });

  it("renders, hit-tests and selects only the active page's elements", () => {
    const rect1 = drawRectangle(0, 0);
    const page2Id = addPage();
    // same position as rect1
    const rect2 = drawRectangle(0, 0);

    expect(h.state.activePageId).toBe(page2Id);
    expect(getRenderedElementIds().visible).toEqual([rect2.id]);
    expect(getRenderedElementIds().all).toEqual([rect2.id]);

    // clicking where both rectangles are (on the edge, as they have no fill)
    // selects the active page's
    API.clearSelection();
    mouse.reset();
    mouse.clickAt(0, 50);
    expect(Object.keys(h.state.selectedElementIds)).toEqual([rect2.id]);

    // select all selects the page's elements only
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.A);
    });
    expect(Object.keys(h.state.selectedElementIds)).toEqual([rect2.id]);

    // deleting the selection doesn't touch other pages
    Keyboard.keyPress(KEYS.DELETE);
    expect(
      getAllPagesElements().find((el) => el.id === rect1.id)!.isDeleted,
    ).toBe(false);

    clickTab(DEFAULT_PAGE_ID);
    expect(getRenderedElementIds().visible).toEqual([rect1.id]);
    expect(getRenderedElementIds().all).toEqual([rect1.id]);
    // switching pages clears the selection
    expect(h.state.selectedElementIds).toEqual({});

    mouse.reset();
    mouse.clickAt(0, 50);
    expect(Object.keys(h.state.selectedElementIds)).toEqual([rect1.id]);
  });

  it("keeps undo / redo on their page", () => {
    const rect1 = drawRectangle(0, 0);
    const page2Id = addPage();
    const rect2 = drawRectangle(200, 200);
    const rect3 = drawRectangle(400, 400);

    const isDeleted = (element: ExcalidrawElement) =>
      getAllPagesElements().find((el) => el.id === element.id)!.isDeleted;

    // page 2's history
    Keyboard.undo();
    expect(isDeleted(rect3)).toBe(true);
    expect(isDeleted(rect2)).toBe(false);
    expect(isDeleted(rect1)).toBe(false);

    clickTab(DEFAULT_PAGE_ID);

    // page 1's history only has rect1's creation, never page 2's changes
    Keyboard.undo();
    expect(isDeleted(rect1)).toBe(true);
    expect(isDeleted(rect2)).toBe(false);

    Keyboard.undo();
    Keyboard.undo();
    expect(isDeleted(rect2)).toBe(false);
    expect(h.history.isUndoStackEmpty).toBe(true);

    Keyboard.redo();
    expect(isDeleted(rect1)).toBe(false);

    // page 2's redo stack is kept while away
    clickTab(page2Id);
    expect(h.history.isRedoStackEmpty).toBe(false);
    Keyboard.redo();
    expect(isDeleted(rect3)).toBe(false);
    Keyboard.undo();
    Keyboard.undo();
    expect(isDeleted(rect3)).toBe(true);
    expect(isDeleted(rect2)).toBe(true);
    expect(isDeleted(rect1)).toBe(false);

    // switching pages isn't an undoable change of the page itself
    expect(h.history.isUndoStackEmpty).toBe(true);
  });

  it("keeps a viewport per page", () => {
    drawRectangle(0, 0);
    API.setAppState({ scrollX: 120, scrollY: -40, zoom: { value: 2 as any } });

    const page2Id = addPage();
    API.setAppState({ scrollX: -300, scrollY: 10 });

    clickTab(DEFAULT_PAGE_ID);
    expect(h.state.scrollX).toBe(120);
    expect(h.state.scrollY).toBe(-40);
    expect(h.state.zoom.value).toBe(2);

    clickTab(page2Id);
    expect(h.state.scrollX).toBe(-300);
    expect(h.state.scrollY).toBe(10);
  });

  it("exports an image of the active page only", async () => {
    drawRectangle(0, 0);
    const page2Id = addPage();
    const rect2 = drawRectangle(0, 0);
    expect(h.state.activePageId).toBe(page2Id);

    const onExportImage = vi
      .spyOn(h.app, "onExportImage")
      .mockImplementation(async () => {});

    API.setAppState({ openDialog: { name: "imageExport" } });
    UI.clickLabeledElement("Export to SVG");

    expect(onExportImage).toHaveBeenCalledTimes(1);
    const exportedElements = onExportImage.mock.calls[0][1];
    expect(exportedElements.map((el) => el.id)).toEqual([rect2.id]);
  });

  it("embeds only the exported page into an image", async () => {
    const page2Id = addPage();
    act(() => {
      h.app.pages.rename(page2Id, "SDK flow");
    });
    const rect2 = drawRectangle(0, 0);

    const svg = await exportScene({
      type: "svg",
      data: {
        elements: h.app.scene.getNonDeletedElements(),
        appState: h.state,
        files: {},
      },
      config: { embedScene: true },
    });
    const embedded = JSON.parse(decodeSvgBase64Payload({ svg: svg.outerHTML }));
    expect(embedded.elements.map((el: ExcalidrawElement) => el.id)).toEqual([
      rect2.id,
    ]);
    expect(embedded.appState.pages.map((p: any) => p.name)).toEqual([
      "SDK flow",
    ]);
  });

  it("commits the text being edited when switching pages", async () => {
    const page2Id = addPage();
    UI.clickTool("text");
    mouse.clickAt(100, 100);
    const editor = await getTextEditor();
    updateTextEditor(editor, "on page 2");

    act(() => {
      h.app.pages.setActive(DEFAULT_PAGE_ID);
    });

    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(h.state.editingTextElement).toBe(null);
    expect(
      document.querySelector(".excalidraw-textEditorContainer textarea"),
    ).toBe(null);
    const text = getAllPagesElements().find((el) => el.type === "text")!;
    expect(text.isDeleted).toBe(false);
    expect((text as any).originalText).toBe("on page 2");
    expect(text.pageId).toBe(page2Id);
    expect(h.elements).toEqual([]);
  });

  it("saves all pages in one file and restores them", async () => {
    const rect1 = drawRectangle(0, 0);
    act(() => {
      h.app.pages.rename(DEFAULT_PAGE_ID, "Data pipeline");
    });
    const page2Id = addPage();
    act(() => {
      h.app.pages.rename(page2Id, "SDK flow");
    });
    const rect2 = drawRectangle(0, 0);

    // what the save actions serialize (the whole document)
    const json = serializeAsJSON(
      h.app.api.getSceneElementsIncludingDeleted(),
      h.state,
      {},
      "local",
    );
    const parsed = JSON.parse(json);
    expect(parsed.elements.map((el: ExcalidrawElement) => el.id)).toEqual([
      rect1.id,
      rect2.id,
    ]);
    expect(parsed.appState.pages.map((p: any) => p.name)).toEqual([
      "Data pipeline",
      "SDK flow",
    ]);

    // load it into a fresh scene
    act(() => {
      h.app.api.resetScene();
    });
    expect(getVisiblePageIds()).toEqual([DEFAULT_PAGE_ID]);
    expect(getAllPagesElements()).toEqual([]);

    const data = await loadFromBlob(
      new Blob([json], { type: MIME_TYPES.excalidraw }),
      h.state,
      null,
    );
    API.updateScene({
      elements: data.elements,
      appState: data.appState,
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    expect(getVisiblePages(h.state.pages).map((p) => p.name)).toEqual([
      "Data pipeline",
      "SDK flow",
    ]);
    expect(h.state.activePageId).toBe(page2Id);
    expect(h.elements.map((el) => el.id)).toEqual([rect2.id]);
    clickTab(DEFAULT_PAGE_ID);
    expect(h.elements.map((el) => el.id)).toEqual([rect1.id]);
  });

  it("restores a legacy file onto one default page", async () => {
    // a file saved before pages existed
    const legacyElements = [
      API.createElement({ type: "rectangle", id: "legacy-1" }),
      API.createElement({ type: "ellipse", id: "legacy-2" }),
    ].map(({ pageId, ...element }) => element);
    const legacyFile = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: legacyElements,
      appState: { viewBackgroundColor: "#ffffff", gridSize: 20 },
      files: {},
    });

    // while another multi-page document is open
    addPage();
    drawRectangle(0, 0);

    const data = await loadFromBlob(
      new Blob([legacyFile], { type: MIME_TYPES.excalidraw }),
      h.state,
      h.app.api.getSceneElementsIncludingDeleted(),
    );

    // pages don't leak from the open document
    expect(data.appState.pages.map((p) => p.id)).toEqual([DEFAULT_PAGE_ID]);
    expect(data.appState.activePageId).toBe(DEFAULT_PAGE_ID);

    API.updateScene({
      elements: data.elements,
      appState: data.appState,
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    expect(getVisiblePageIds()).toEqual([DEFAULT_PAGE_ID]);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(h.elements.map((el) => el.id)).toEqual(["legacy-1", "legacy-2"]);
    // the previous document's pages are gone
    expect(getAllPagesElements().map((el) => el.id)).toEqual([
      "legacy-1",
      "legacy-2",
    ]);
    expect(
      getAllPagesElements().every(
        (el) => getElementPageId(el) === DEFAULT_PAGE_ID,
      ),
    ).toBe(true);

    // also through the restore functions directly
    const appState = restoreAppState({}, null);
    expect(appState.pages.map((p) => p.id)).toEqual([DEFAULT_PAGE_ID]);
    expect(appState.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(
      restoreElements(legacyElements, null).map((el) => getElementPageId(el)),
    ).toEqual([DEFAULT_PAGE_ID, DEFAULT_PAGE_ID]);
  });

  it("pastes and inserts library items onto the active page", () => {
    const rect1 = drawRectangle(0, 0);
    const page2Id = addPage();

    act(() => {
      h.app.addElementsFromPasteOrLibrary({
        elements: [rect1],
        files: null,
        position: "center",
      });
    });

    expect(h.elements.length).toBe(1);
    expect(h.elements[0].id).not.toBe(rect1.id);
    expect(h.elements[0].pageId).toBe(page2Id);

    // and back onto the default page
    const pasted = h.elements[0];
    clickTab(DEFAULT_PAGE_ID);
    act(() => {
      h.app.addElementsFromPasteOrLibrary({
        elements: [pasted],
        files: null,
        position: "center",
      });
    });
    expect(h.elements.length).toBe(2);
    expect(h.elements[1].pageId).toBeUndefined();
  });

  it("keeps other pages when the host updates the active page's elements", () => {
    const rect1 = drawRectangle(0, 0);
    addPage();
    const rect2 = drawRectangle(0, 0);

    const rect3 = API.createElement({ type: "rectangle", id: "host-added" });
    API.updateScene({ elements: [...h.elements, rect3] });

    expect(h.elements.map((el) => el.id)).toEqual([rect2.id, rect3.id]);
    expect(getAllPagesElements().map((el) => el.id)).toEqual([
      rect1.id,
      rect2.id,
      rect3.id,
    ]);
    // onChange / API getters return the whole document
    expect(h.app.api.getSceneElements().map((el) => el.id)).toEqual([
      rect1.id,
      rect2.id,
      rect3.id,
    ]);
  });

  it("searches across pages and switches to the page of a match", async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    API.setElements([
      API.createElement({ type: "text", text: "hello page one" }),
    ]);
    const page2Id = addPage();
    API.setElements([
      API.createElement({ type: "text", text: "hello page two" }),
    ]);
    clickTab(DEFAULT_PAGE_ID);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
    expect(h.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

    const searchInput =
      h.app.excalidrawContainerValue.container!.querySelector<HTMLInputElement>(
        `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
      )!;
    updateTextEditor(searchInput, "hello");

    await waitFor(() => {
      expect(h.state.searchMatches?.matches.length).toBe(2);
    });
    // matches show the page they're on
    expect(
      Array.from(
        document.querySelectorAll(".layer-ui__result-item .page-name"),
      ).map((node) => node.textContent),
    ).toEqual(["Page 1", "Page 2"]);

    // the 1st match (page 1) is focused, go to the 2nd one (page 2)
    await waitFor(() => {
      expect(h.state.searchMatches?.matches[0].focus).toBe(true);
    });
    Keyboard.keyPress(KEYS.ENTER, searchInput);
    await waitFor(() => {
      expect(h.state.activePageId).toBe(page2Id);
    });
    // the matches don't change order when the page changes
    await waitFor(() => {
      expect(h.state.searchMatches?.matches[1].focus).toBe(true);
    });

    // and back to page 1
    Keyboard.keyPress(KEYS.ENTER, searchInput);
    await waitFor(() => {
      expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
    });
  });
});
