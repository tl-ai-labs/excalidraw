import { act, fireEvent, waitFor } from "@testing-library/react";

import {
  CaptureUpdateAction,
  createDefaultPages,
  getNonDeletedPages,
  newPage,
} from "@excalidraw/element";

import { DEFAULT_PAGE_ID, KEYS } from "@excalidraw/common";

import { actionDeletePage, actionSwitchPage } from "../actions/actionPages";
import { cleanAppStateForExport } from "../appState";
import { exportScene } from "../scene/export";
import { loadFromBlob } from "../data/blob";
import { serializeAsJSON } from "../data/json";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { render, screen } from "./test-utils";

import type { NormalizedZoomValue } from "../types";

const { h } = window;

describe("pages", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("create page switches to an empty page", async () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 100,
      height: 100,
    });
    API.setElements([rect]);

    expect(getNonDeletedPages(h.state.pages).length).toBe(1);
    expect(h.app.scene.getNonDeletedElements().length).toBe(1);

    const createBtn = screen.queryByTestId("page-create");
    expect(createBtn).not.toBeNull();
    fireEvent.click(createBtn!);

    expect(getNonDeletedPages(h.state.pages).length).toBe(2);
    expect(h.state.activePageId).toBe(getNonDeletedPages(h.state.pages)[1].id);
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);
  });

  it("only the active page is rendered and selectable", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 100,
      height: 100,
    });
    API.setElements([rect1]);

    fireEvent.click(screen.queryByTestId("page-create")!);
    const page2Id = h.state.activePageId;

    const rect2 = {
      ...API.createElement({
        type: "rectangle",
        x: 200,
        y: 200,
        width: 100,
        height: 100,
      }),
      pageId: page2Id,
    };
    API.setElements([rect1, rect2]);

    act(() => {
      h.app.actionManager.executeAction(actionSwitchPage, "ui", page2Id);
    });

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.A);
    });

    const selected = API.getSelectedElements();
    expect(selected.length).toBe(1);
    expect(selected[0].id).toBe(rect2.id);

    // Clicking where page 1's rectangle is selects nothing
    new Pointer("mouse").click(50, 50);
    expect(API.getSelectedElements().length).toBe(0);

    // Switch back to page 1
    const defaultPage = getNonDeletedPages(h.state.pages)[0];
    act(() => {
      h.app.actionManager.executeAction(actionSwitchPage, "ui", defaultPage.id);
    });
    expect(h.state.activePageId).toBe(defaultPage.id);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.A);
    });
    expect(API.getSelectedElements().map((el) => el.id)).toEqual([rect1.id]);

    expect(page2Id).not.toBe(defaultPage.id);
  });

  it("new elements land on the active page", async () => {
    fireEvent.click(screen.queryByTestId("page-create")!);
    const page2Id = h.state.activePageId;

    UI.clickTool("rectangle");
    new Pointer("mouse").down(10, 10);
    new Pointer("mouse").up(40, 40);

    const drawn = h.app.scene.getNonDeletedElements();
    expect(drawn.length).toBe(1);
    expect(drawn[0].pageId).toBe(page2Id);

    const pasteRect = API.createElement({
      type: "rectangle",
      x: 300,
      y: 300,
      width: 80,
      height: 80,
    });
    act(() => {
      h.app.addElementsFromPasteOrLibrary({
        elements: [pasteRect],
        files: null,
        position: "center",
      });
    });

    const activeElements = h.app.scene.getNonDeletedElements();
    expect(activeElements.length).toBe(2);
    for (const el of activeElements) {
      expect(el.pageId).toBe(page2Id);
    }
  });

  it("rename keeps the previous name on whitespace", async () => {
    const initialPages = getNonDeletedPages(h.state.pages);
    const activeTab = screen.queryByTestId(`page-tab-${initialPages[0].id}`);
    expect(activeTab).not.toBeNull();

    fireEvent.doubleClick(activeTab!);
    let input = screen.queryByTestId("page-rename-input") as HTMLInputElement;
    expect(input).not.toBeNull();

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: KEYS.ENTER });

    expect(h.state.pages[0].name).toBe("");

    const tabAfter = screen.queryByTestId(`page-tab-${initialPages[0].id}`);
    fireEvent.doubleClick(tabAfter!);
    input = screen.queryByTestId("page-rename-input") as HTMLInputElement;
    expect(input).not.toBeNull();

    fireEvent.change(input, { target: { value: "Data" } });
    fireEvent.keyDown(input, { key: KEYS.ENTER });

    expect(h.state.pages[0].name).toBe("Data");
  });

  it("cancelling a rename with Escape leaves the name unchanged", async () => {
    const initialPages = getNonDeletedPages(h.state.pages);
    const activeTab = screen.queryByTestId(`page-tab-${initialPages[0].id}`);
    expect(activeTab).not.toBeNull();

    fireEvent.doubleClick(activeTab!);
    const input = screen.queryByTestId("page-rename-input") as HTMLInputElement;
    expect(input).not.toBeNull();

    fireEvent.change(input, { target: { value: "CancelledName" } });
    fireEvent.keyDown(input, { key: KEYS.ESCAPE });

    expect(screen.queryByTestId("page-rename-input")).toBeNull();
    expect(h.state.pages[0].name).toBe("");
  });

  it("reorder from the tab bar persists", async () => {
    fireEvent.click(screen.queryByTestId("page-create")!);
    fireEvent.click(screen.queryByTestId("page-create")!);

    const pages = getNonDeletedPages(h.state.pages);
    expect(pages.length).toBe(3);
    const firstId = pages[0].id;
    const secondId = pages[1].id;

    const firstTab = screen.queryByTestId(`page-tab-${firstId}`);
    expect(firstTab).not.toBeNull();
    fireEvent.focus(firstTab!);
    fireEvent.keyDown(firstTab!, { key: KEYS.ARROW_RIGHT, altKey: true });

    const reordered = getNonDeletedPages(h.state.pages);
    expect(reordered[0].id).toBe(secondId);
    expect(reordered[1].id).toBe(firstId);

    const serialized = serializeAsJSON(
      h.app.scene.getElementsIncludingDeleted(),
      h.state,
      h.app.files,
      "local",
    );
    const blob = new Blob([serialized], { type: "application/json" });
    const loaded = await loadFromBlob(blob, null, null);

    expect(loaded.appState?.pages).toBeDefined();
    const loadedPages = getNonDeletedPages(loaded.appState!.pages!);
    expect(loadedPages[0].id).toBe(secondId);
    expect(loadedPages[1].id).toBe(firstId);
  });

  it("reorder via drag-and-drop between tabs", async () => {
    fireEvent.click(screen.queryByTestId("page-create")!);
    fireEvent.click(screen.queryByTestId("page-create")!);

    const pages = getNonDeletedPages(h.state.pages);
    expect(pages.length).toBe(3);
    const firstId = pages[0].id;
    const secondId = pages[1].id;
    const thirdId = pages[2].id;

    const firstTab = screen.queryByTestId(`page-tab-${firstId}`);
    const thirdTab = screen.queryByTestId(`page-tab-${thirdId}`);
    expect(firstTab).not.toBeNull();
    expect(thirdTab).not.toBeNull();

    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(format: string, data: string) {
        this.data[format] = data;
      },
      getData(format: string) {
        return this.data[format];
      },
    };

    fireEvent.dragStart(firstTab!, { dataTransfer });
    fireEvent.dragOver(thirdTab!, { dataTransfer });
    fireEvent.drop(thirdTab!, { dataTransfer });

    const reordered = getNonDeletedPages(h.state.pages);
    expect(reordered.map((p) => p.id)).toEqual([secondId, thirdId, firstId]);
  });

  it("viewport is restored per page", async () => {
    const page1Id = h.state.activePageId;

    API.setAppState({
      scrollX: 120,
      scrollY: -240,
      zoom: { value: 2 as NormalizedZoomValue },
    });

    fireEvent.click(screen.queryByTestId("page-create")!);
    const page2Id = h.state.activePageId;
    expect(page2Id).not.toBe(page1Id);

    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);
    expect(h.state.zoom.value).toBe(1);

    act(() => {
      h.app.actionManager.executeAction(actionSwitchPage, "ui", page1Id);
    });
    expect(h.state.activePageId).toBe(page1Id);
    expect(h.state.scrollX).toBe(120);
    expect(h.state.scrollY).toBe(-240);
    expect(h.state.zoom.value).toBe(2);
  });

  it("undo stays on its page", async () => {
    UI.clickTool("rectangle");
    new Pointer("mouse").down(10, 10);
    new Pointer("mouse").up(50, 50);
    expect(h.app.scene.getNonDeletedElements().length).toBe(1);

    fireEvent.click(screen.queryByTestId("page-create")!);
    expect(h.app.scene.getNonDeletedElements().length).toBe(0);

    UI.clickTool("rectangle");
    new Pointer("mouse").down(20, 20);
    new Pointer("mouse").up(60, 60);
    expect(h.app.scene.getNonDeletedElements().length).toBe(1);

    Keyboard.undo();
    Keyboard.undo();

    expect(h.app.scene.getNonDeletedElements().length).toBe(0);

    const page1Id = getNonDeletedPages(h.state.pages)[0].id;
    act(() => {
      h.app.actionManager.executeAction(actionSwitchPage, "ui", page1Id);
    });
    expect(h.app.scene.getNonDeletedElements().length).toBe(1);
  });

  it("last page cannot be deleted", async () => {
    expect(getNonDeletedPages(h.state.pages).length).toBe(1);
    expect(screen.queryByTestId("page-delete")).toBeNull();

    const pagesBefore = h.state.pages;
    act(() => {
      h.app.actionManager.executeAction(
        actionDeletePage,
        "ui",
        h.state.activePageId,
      );
    });
    expect(h.state.pages).toBe(pagesBefore);
    expect(getNonDeletedPages(h.state.pages).length).toBe(1);
  });

  it("deleting the active page activates a neighbour and undo restores it", async () => {
    fireEvent.click(screen.queryByTestId("page-create")!);
    fireEvent.click(screen.queryByTestId("page-create")!);

    const pages = getNonDeletedPages(h.state.pages);
    expect(pages.length).toBe(3);
    const middlePage = pages[1];
    const thirdPage = pages[2];

    act(() => {
      h.app.actionManager.executeAction(actionSwitchPage, "ui", middlePage.id);
    });
    expect(h.state.activePageId).toBe(middlePage.id);

    UI.clickTool("rectangle");
    new Pointer("mouse").down(10, 10);
    new Pointer("mouse").up(40, 40);
    const middleElements = h.app.scene.getNonDeletedElements();
    expect(middleElements.length).toBe(1);
    const middleElementId = middleElements[0].id;

    const deleteBtn = screen.queryByTestId("page-delete");
    expect(deleteBtn).not.toBeNull();
    fireEvent.click(deleteBtn!);

    expect(h.state.activePageId).toBe(thirdPage.id);
    const afterDeletePages = getNonDeletedPages(h.state.pages);
    expect(afterDeletePages.length).toBe(2);
    expect(afterDeletePages.some((p) => p.id === middlePage.id)).toBe(false);

    const deletedEl = h.app.scene
      .getElementsMapIncludingDeleted()
      .get(middleElementId);
    expect(deletedEl?.isDeleted).toBe(true);

    Keyboard.undo();

    expect(h.state.activePageId).toBe(middlePage.id);
    const afterUndoPages = getNonDeletedPages(h.state.pages);
    expect(afterUndoPages.length).toBe(3);
    expect(afterUndoPages[1].id).toBe(middlePage.id);

    const restoredElements = h.app.scene.getNonDeletedElements();
    expect(restoredElements.length).toBe(1);
    expect(restoredElements[0].id).toBe(middleElementId);
    expect(restoredElements[0].isDeleted).toBe(false);

    Keyboard.redo();

    expect(h.state.activePageId).toBe(thirdPage.id);
    expect(getNonDeletedPages(h.state.pages).length).toBe(2);
    expect(
      h.app.scene.getElementsMapIncludingDeleted().get(middleElementId)
        ?.isDeleted,
    ).toBe(true);
  });

  it("image export contains only the active page", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 100,
      height: 100,
    });
    API.setElements([rect1]);

    fireEvent.click(screen.queryByTestId("page-create")!);

    const rect2 = {
      ...API.createElement({
        type: "rectangle",
        x: 200,
        y: 200,
        width: 100,
        height: 100,
      }),
      pageId: h.state.activePageId,
    };
    API.setElements([...h.app.scene.getElementsIncludingDeleted(), rect2]);

    const activeElements = h.app.scene.getNonDeletedElements();
    expect(activeElements.length).toBe(1);
    expect(activeElements[0].id).toBe(rect2.id);

    const svg = await exportScene({
      type: "svg",
      data: {
        elements: activeElements,
        appState: cleanAppStateForExport(h.state),
        files: h.app.files,
      },
    });

    const serializedSvg = new XMLSerializer().serializeToString(svg);
    const elementRects = Array.from(svg.querySelectorAll("rect")).filter(
      (node) => !node.classList.contains("background"),
    );
    expect(activeElements.map((el) => el.id)).toEqual([rect2.id]);
    expect(elementRects.length).toBeGreaterThanOrEqual(1);
    expect(serializedSvg).not.toContain(
      'width="100" height="100" x="10" y="10"',
    );
  });

  it("multi-page file round-trips", async () => {
    const pages = createDefaultPages();
    const p2 = newPage({ name: "Second Page", pages });
    const rect1 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 50,
      height: 50,
    });
    const rect2 = {
      ...API.createElement({
        type: "rectangle",
        x: 60,
        y: 60,
        width: 50,
        height: 50,
      }),
      pageId: p2.id,
    };

    API.updateScene({
      elements: [rect1, rect2],
      appState: { pages: [pages[0], p2], activePageId: pages[0].id },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    const serialized = serializeAsJSON(
      h.app.scene.getElementsIncludingDeleted(),
      h.state,
      h.app.files,
      "local",
    );
    const blob = new Blob([serialized], { type: "application/json" });
    const loaded = await loadFromBlob(blob, null, null);

    expect(loaded.appState?.pages).toBeDefined();
    const loadedPages = getNonDeletedPages(loaded.appState!.pages!);
    expect(loadedPages.length).toBe(2);
    expect(loadedPages[0].id).toBe(pages[0].id);
    expect(loadedPages[1].id).toBe(p2.id);
    expect(loadedPages[1].name).toBe("Second Page");

    const loadedElements = loaded.elements!;
    expect(loadedElements.length).toBe(2);
    const loadedRect1 = loadedElements.find((e) => e.id === rect1.id);
    const loadedRect2 = loadedElements.find((e) => e.id === rect2.id);
    expect(loadedRect1?.pageId).toBeUndefined();
    expect(loadedRect2?.pageId).toBe(p2.id);
  });

  it("legacy file restores onto one default page", async () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 100,
      height: 100,
    });
    const legacyJSON = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [rect],
      appState: {},
    });

    const blob = new Blob([legacyJSON], { type: "application/json" });
    const loaded = await loadFromBlob(blob, null, null);

    expect(loaded.appState?.pages).toBeDefined();
    expect(loaded.appState!.pages!.length).toBe(1);
    expect(loaded.appState!.pages![0].id).toBe(DEFAULT_PAGE_ID);

    API.updateScene({
      elements: loaded.elements!,
      appState: loaded.appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    expect(h.app.scene.getNonDeletedElements().length).toBe(1);
    expect(h.app.scene.getNonDeletedElements()[0].id).toBe(rect.id);
  });

  it("search switches to the page of a result", async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    const textElement = API.createElement({
      type: "text",
      text: "needle",
      x: 10,
      y: 10,
      width: 50,
      height: 20,
    });
    API.setElements([textElement]);

    const page1Id = h.state.activePageId;
    fireEvent.click(screen.queryByTestId("page-create")!);
    expect(h.state.activePageId).not.toBe(page1Id);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    const searchInput = await waitFor(() => {
      const el = document.querySelector<HTMLInputElement>(
        ".layer-ui__search input",
      );
      expect(el).not.toBeNull();
      return el!;
    });

    fireEvent.change(searchInput, { target: { value: "needle" } });

    const resultItem = await waitFor(() => {
      const item = document.querySelector<HTMLElement>(
        ".layer-ui__result-item",
      );
      expect(item).not.toBeNull();
      return item!;
    });

    fireEvent.click(resultItem);

    await waitFor(() => {
      expect(h.state.activePageId).toBe(page1Id);
    });
  });

  it("a whole-scene load through updateScene keeps every pageId", async () => {
    const pages = createDefaultPages();
    const p2 = newPage({ name: "Page 2", pages });
    const rect1 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 50,
      height: 50,
    });
    const rect2 = {
      ...API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
      }),
      pageId: p2.id,
    };

    API.updateScene({
      elements: [rect1, rect2],
      appState: { pages: [pages[0], p2], activePageId: pages[0].id },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    const all = h.app.scene.getElementsIncludingDeleted();
    expect(all.find((el) => el.id === rect1.id)?.pageId).toBeUndefined();
    expect(all.find((el) => el.id === rect2.id)?.pageId).toBe(p2.id);

    expect(h.app.scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      rect1.id,
    ]);

    act(() => {
      h.app.actionManager.executeAction(actionSwitchPage, "ui", p2.id);
    });
    expect(h.app.scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      rect2.id,
    ]);
  });

  it("updateScene adding an element puts it on the active page", async () => {
    fireEvent.click(screen.queryByTestId("page-create")!);
    const page2Id = h.state.activePageId;

    const newRect = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 60,
      height: 60,
    });
    expect(newRect.pageId).toBeUndefined();

    API.updateScene({
      elements: [...h.app.scene.getElementsIncludingDeleted(), newRect],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    const activeElements = h.app.scene.getNonDeletedElements();
    const added = activeElements.find((el) => el.id === newRect.id);
    expect(added).toBeDefined();
    expect(added?.pageId).toBe(page2Id);
  });

  it("in view mode only switching is offered", async () => {
    fireEvent.click(screen.queryByTestId("page-create")!);
    const pages = getNonDeletedPages(h.state.pages);
    expect(pages.length).toBe(2);

    API.setAppState({ viewModeEnabled: true });

    expect(screen.queryByTestId("page-create")).toBeNull();
    expect(screen.queryByTestId("page-delete")).toBeNull();

    const firstTab = screen.queryByTestId(`page-tab-${pages[0].id}`);
    expect(firstTab).not.toBeNull();

    fireEvent.doubleClick(firstTab!);
    expect(screen.queryByTestId("page-rename-input")).toBeNull();

    fireEvent.click(firstTab!);
    expect(h.state.activePageId).toBe(pages[0].id);
  });
});
