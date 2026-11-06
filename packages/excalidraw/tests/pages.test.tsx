import React from "react";
import { vi } from "vitest";
import {
  CLASSES,
  DEFAULT_PAGE_ID,
  DEFAULT_PAGE_NAME,
  EXPORT_DATA_TYPES,
  KEYS,
  DEFAULT_SIDEBAR,
  CANVAS_SEARCH_TAB,
} from "@excalidraw/common";
import { getElementPageId, newElementWith } from "@excalidraw/element";
import "@excalidraw/utils/test-utils";

import {
  actionCreatePage,
  actionDeletePage,
  actionRenamePage,
  actionReorderPages,
  actionSwitchPage,
} from "../actions";
import { createRedoAction, createUndoAction } from "../actions/actionHistory";
import { loadFromBlob } from "../data/blob";
import { serializeAsJSON } from "../data/json";
import { restore, restoreAppState, restoreElements } from "../data/restore";
import { Excalidraw, exportScene } from "../index";
import * as StaticScene from "../renderer/staticScene";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { act, fireEvent, render, waitFor } from "./test-utils";

import type { NormalizedZoomValue } from "../types";

const { h } = window;
const mouse = new Pointer("mouse");
const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

describe("Multi-page support", () => {
  it("initializes with a single default Page 1 and disables deleting the only page (AC-1)", async () => {
    const { getByTestId } = await render(<Excalidraw />);

    expect(h.state.pages).toEqual([
      {
        id: DEFAULT_PAGE_ID,
        name: DEFAULT_PAGE_NAME,
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 },
      },
    ]);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

    const tabBar = getByTestId("page-tab-bar");
    expect(tabBar).toBeTruthy();

    const defaultTab = getByTestId(`page-tab-${DEFAULT_PAGE_ID}`);
    expect(defaultTab.textContent).toBe("Page 1");
    expect(defaultTab.getAttribute("aria-selected")).toBe("true");

    const deleteBtn = getByTestId(
      `page-delete-${DEFAULT_PAGE_ID}`,
    ) as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);

    // Attempting actionDeletePage directly when only 1 page exists is prevented
    act(() => {
      h.app.actionManager.executeAction(
        actionDeletePage,
        "api",
        DEFAULT_PAGE_ID,
      );
    });
    expect(h.state.pages).toHaveLength(1);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
  });

  it("creates, renames, reorders, and tombstone-deletes pages via PageTabBar and actions (AC-2, AC-3)", async () => {
    const { getByTestId, queryByTestId } = await render(<Excalidraw />);

    // Create a rectangle on Page 1
    const rect1 = API.createElement({
      type: "rectangle",
      id: "rect-page-1",
      x: 10,
      y: 10,
      width: 100,
      height: 100,
    });
    act(() => {
      h.scene.replaceAllElements([rect1]);
    });

    // Click add-page button -> creates Page 2 and activates it
    const addBtn = getByTestId("page-add-button");
    fireEvent.click(addBtn);

    expect(h.state.pages).toHaveLength(2);
    const page2Id = h.state.pages[1].id;
    expect(h.state.pages[1].name).toBe("Page 2");
    expect(h.state.activePageId).toBe(page2Id);

    // Add element on Page 2
    const rect2 = newElementWith(
      API.createElement({
        type: "rectangle",
        id: "rect-page-2",
        x: 50,
        y: 50,
        width: 80,
        height: 80,
      }),
      { pageId: page2Id },
    );
    const rect2InitialVersion = rect2.version;
    act(() => {
      h.scene.replaceAllElements([rect1, rect2], { replaceAllPages: true });
    });

    // Click add-page button again -> creates Page 3 and activates it
    fireEvent.click(addBtn);
    expect(h.state.pages).toHaveLength(3);
    const page3Id = h.state.pages[2].id;
    expect(h.state.pages[2].name).toBe("Page 3");
    expect(h.state.activePageId).toBe(page3Id);

    // Inline rename Page 3 via double-click / rename button
    const renameBtn = getByTestId(`page-rename-${page3Id}`);
    fireEvent.click(renameBtn);

    const renameInput = getByTestId("page-rename-input") as HTMLInputElement;
    expect(renameInput.value).toBe("Page 3");

    // Empty whitespace should be ignored and keep previous name
    fireEvent.change(renameInput, { target: { value: "   " } });
    fireEvent.keyDown(renameInput, { key: KEYS.ENTER });
    expect(h.state.pages[2].name).toBe("Page 3");

    // Escape cancels rename
    fireEvent.click(getByTestId(`page-rename-${page3Id}`));
    const renameInputEsc = getByTestId("page-rename-input") as HTMLInputElement;
    fireEvent.change(renameInputEsc, { target: { value: "Discarded Name" } });
    fireEvent.keyDown(renameInputEsc, { key: KEYS.ESCAPE });
    expect(queryByTestId("page-rename-input")).toBeNull();
    expect(h.state.pages[2].name).toBe("Page 3");

    // Valid rename on Enter updates the tab name
    fireEvent.click(getByTestId(`page-rename-${page3Id}`));
    const renameInputValid = getByTestId(
      "page-rename-input",
    ) as HTMLInputElement;
    fireEvent.change(renameInputValid, { target: { value: " Wireframes " } });
    fireEvent.keyDown(renameInputValid, { key: KEYS.ENTER });
    expect(h.state.pages[2].name).toBe("Wireframes");

    // Direct actionRenamePage execution also trims and updates name
    act(() => {
      h.app.actionManager.executeAction(actionRenamePage, "api", {
        id: page3Id,
        name: "Final Specs",
      });
    });
    expect(h.state.pages[2].name).toBe("Final Specs");

    // Reorder Page 3 left (index 2 -> index 1), keeping activePageId unchanged
    const moveLeftBtn = getByTestId(`page-move-left-${page3Id}`);
    fireEvent.click(moveLeftBtn);
    expect(h.state.pages.map((p) => p.id)).toEqual([
      DEFAULT_PAGE_ID,
      page3Id,
      page2Id,
    ]);
    expect(h.state.activePageId).toBe(page3Id);

    // Reorder via actionReorderPages back to [DEFAULT_PAGE_ID, page2Id, page3Id]
    act(() => {
      h.app.actionManager.executeAction(actionReorderPages, "api", {
        fromIndex: 1,
        toIndex: 2,
      });
    });
    expect(h.state.pages.map((p) => p.id)).toEqual([
      DEFAULT_PAGE_ID,
      page2Id,
      page3Id,
    ]);

    // Switch to Page 2 and delete it
    fireEvent.click(getByTestId(`page-tab-${page2Id}`));
    expect(h.state.activePageId).toBe(page2Id);

    fireEvent.click(getByTestId(`page-delete-${page2Id}`));
    expect(h.state.pages.map((p) => p.id)).toEqual([DEFAULT_PAGE_ID, page3Id]);
    // Nearest neighbor is selected
    expect([DEFAULT_PAGE_ID, page3Id]).toContain(h.state.activePageId);

    // Deleted page's element is retained as a tombstone with isDeleted: true and bumped version
    const allElements = h.scene.getAllElementsIncludingDeleted();
    const deletedRect2 = allElements.find((el) => el.id === "rect-page-2");
    expect(deletedRect2).toBeDefined();
    expect(deletedRect2?.isDeleted).toBe(true);
    expect(deletedRect2!.version).toBeGreaterThan(rect2InitialVersion);
  });

  it("isolates elements and preserves per-page viewport and undo/redo history across page switches (AC-4, AC-5)", async () => {
    await render(<Excalidraw />);

    // Draw rectangle on Page 1 using pointer
    API.setSelectedElements([]);
    mouse.reset();
    UI_drawRectangleOnCanvas();
    expect(h.scene.getNonDeletedElements()).toHaveLength(1);
    const page1El = h.scene.getNonDeletedElements()[0];
    expect(getElementPageId(page1El)).toBe(DEFAULT_PAGE_ID);

    // Change viewport on Page 1
    act(() => {
      h.setState({
        scrollX: 120,
        scrollY: -45,
        zoom: { value: 1.5 as NormalizedZoomValue },
      });
    });

    // Create Page 2 (switches to Page 2 with fresh viewport)
    act(() => {
      h.app.actionManager.executeAction(actionCreatePage, "ui");
    });
    const page2Id = h.state.activePageId;
    expect(page2Id).not.toBe(DEFAULT_PAGE_ID);

    // Page 1's outgoing viewport was saved into appState.pages[0]
    expect(h.state.pages[0]).toMatchObject({
      id: DEFAULT_PAGE_ID,
      scrollX: 120,
      scrollY: -45,
      zoom: { value: 1.5 },
    });
    // Page 2 has fresh default viewport and 0 active elements
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);
    expect(h.state.zoom.value).toBe(1);
    expect(h.scene.getNonDeletedElements()).toHaveLength(0);

    // Draw an ellipse on Page 2
    UI_drawEllipseOnCanvas();
    expect(h.scene.getNonDeletedElements()).toHaveLength(1);
    const page2El = h.scene.getNonDeletedElements()[0];
    expect(page2El.type).toBe("ellipse");
    expect(page2El.pageId).toBe(page2Id);

    // Set custom viewport on Page 2
    act(() => {
      h.setState({
        scrollX: -300,
        scrollY: 250,
        zoom: { value: 2 as NormalizedZoomValue },
      });
    });

    // Undo on Page 2 removes Page 2's ellipse without affecting Page 1's rectangle
    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);

    act(() => {
      h.app.actionManager.executeAction(undoAction);
    });
    expect(h.scene.getNonDeletedElements()).toHaveLength(0);
    expect(
      h.scene
        .getAllNonDeletedElements()
        .filter((el) => getElementPageId(el) === DEFAULT_PAGE_ID),
    ).toHaveLength(1);

    // Extra undo on Page 2 does nothing to Page 1
    act(() => {
      h.app.actionManager.executeAction(undoAction);
    });
    expect(
      h.scene
        .getAllNonDeletedElements()
        .filter((el) => getElementPageId(el) === DEFAULT_PAGE_ID),
    ).toHaveLength(1);

    // Redo on Page 2 restores Page 2's ellipse
    act(() => {
      h.app.actionManager.executeAction(redoAction);
    });
    expect(h.scene.getNonDeletedElements()).toHaveLength(1);
    expect(h.scene.getNonDeletedElements()[0].id).toBe(page2El.id);

    // Switch back to Page 1 -> restores Page 1's viewport and elements, saves Page 2's viewport
    act(() => {
      h.app.actionManager.executeAction(
        actionSwitchPage,
        "ui",
        DEFAULT_PAGE_ID,
      );
    });
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(h.state.scrollX).toBe(120);
    expect(h.state.scrollY).toBe(-45);
    expect(h.state.zoom.value).toBe(1.5);
    expect(h.scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      page1El.id,
    ]);
    expect(h.state.pages.find((p) => p.id === page2Id)).toMatchObject({
      scrollX: -300,
      scrollY: 250,
      zoom: { value: 2 },
    });
  });

  it("files undo entries by the edited element's page when switching from page A to page B straight away (AC-5)", async () => {
    await render(<Excalidraw />);

    // Draw element on Page 1 (Page A)
    UI_drawRectangleOnCanvas();
    expect(h.scene.getNonDeletedElements()).toHaveLength(1);
    const rectPageA = h.scene.getNonDeletedElements()[0];

    // Create Page 2 (Page B) and switch back to Page 1
    act(() => {
      h.app.actionManager.executeAction(actionCreatePage, "ui");
    });
    const pageBId = h.state.activePageId;
    act(() => {
      h.app.actionManager.executeAction(
        actionSwitchPage,
        "ui",
        DEFAULT_PAGE_ID,
      );
    });
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

    // Edit element on Page A and switch to Page B in the same synchronous turn
    // before Store commits in componentDidUpdate
    const undoAction = createUndoAction(h.history);
    act(() => {
      const updatedRect = newElementWith(rectPageA, { x: rectPageA.x + 200 });
      h.scene.replaceAllElements([updatedRect]);
      h.store.scheduleCapture();
      h.app.actionManager.executeAction(actionSwitchPage, "ui", pageBId);
    });

    expect(h.state.activePageId).toBe(pageBId);

    // Undo on Page B should NOT undo Page A's element move
    act(() => {
      h.app.actionManager.executeAction(undoAction);
    });
    const rectAfterPageBUndo = h.scene
      .getAllNonDeletedElements()
      .find((el) => el.id === rectPageA.id)!;
    expect(rectAfterPageBUndo.x).toBe(rectPageA.x + 200);

    // Switch back to Page A and undo -> undoes the move on Page A
    act(() => {
      h.app.actionManager.executeAction(
        actionSwitchPage,
        "ui",
        DEFAULT_PAGE_ID,
      );
    });
    act(() => {
      h.app.actionManager.executeAction(undoAction);
    });
    const rectAfterPageAUndo = h.scene.getNonDeletedElements()[0];
    expect(rectAfterPageAUndo.x).toBe(rectPageA.x);
  });

  it("exports only the active page in visual exports and omits page list and pageId from embedded scenes (AC-6)", async () => {
    await render(<Excalidraw />);

    const rect1 = API.createElement({
      type: "rectangle",
      id: "page1-rect",
      x: 10,
      y: 10,
      width: 100,
      height: 50,
    });
    act(() => {
      h.scene.replaceAllElements([rect1]);
      h.app.actionManager.executeAction(actionCreatePage, "ui");
    });
    const page2Id = h.state.activePageId;

    const ellipse2 = newElementWith(
      API.createElement({
        type: "ellipse",
        id: "page2-ellipse",
        x: 20,
        y: 20,
        width: 80,
        height: 80,
      }),
      { pageId: page2Id },
    );
    act(() => {
      h.scene.replaceAllElements([rect1, ellipse2], { replaceAllPages: true });
    });

    // Active page is Page 2 -> only ellipse2 is on the active page
    expect(h.scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      "page2-ellipse",
    ]);

    const allElements = h.scene.getAllNonDeletedElements();

    // exportScene svg with embedScene: true
    const svg = await exportScene({
      type: "svg",
      data: {
        elements: allElements,
        appState: h.state,
        files: null,
      },
      config: {
        embedScene: true,
      },
    });
    const svgText = svg.outerHTML;

    // Decode embedded scene from SVG metadata
    const match = svgText.match(
      /<!-- payload-type:application\/vnd\.excalidraw\+json -->\s*<!-- payload-version:\d+ -->\s*<!-- payload-start -->\s*([A-Za-z0-9+/=]+)\s*<!-- payload-end -->/,
    );
    expect(match).toBeTruthy();

    const loadedFromSvg = await loadFromBlob(
      new Blob([svgText], { type: "image/svg+xml" }),
      null,
      null,
    );
    expect(loadedFromSvg.elements.map((el) => el.id)).toEqual([
      "page2-ellipse",
    ]);
    expect(loadedFromSvg.elements[0].pageId).toBeUndefined();
    expect(loadedFromSvg.appState.pages).toHaveLength(1);
    expect(loadedFromSvg.appState.pages[0].id).toBe(DEFAULT_PAGE_ID);

    // exportScene canvas and png succeed for active page only
    const canvas = await exportScene({
      type: "canvas",
      data: {
        elements: allElements,
        appState: h.state,
        files: null,
      },
    });
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);

    const basePng = await API.loadFile("./fixtures/smiley.png");
    const toBlobSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback) => {
        callback(basePng);
      });
    try {
      const pngBlob = await exportScene({
        type: "png",
        data: {
          elements: allElements,
          appState: h.state,
          files: null,
        },
        config: {
          embedScene: true,
        },
      });
      expect(pngBlob.type).toBe("image/png");
    } finally {
      toBlobSpy.mockRestore();
    }
  });

  it("searches across all pages and switches to the matched element's page on selection (AC-7)", async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const { container, findAllByTestId } = await render(<Excalidraw />);

    const textPage1 = API.createElement({
      type: "text",
      id: "text-alpha",
      text: "Alpha heading",
      x: 10,
      y: 10,
    });
    act(() => {
      h.scene.replaceAllElements([textPage1]);
      h.app.actionManager.executeAction(actionCreatePage, "ui");
    });
    const page2Id = h.state.activePageId;

    const textPage2 = newElementWith(
      API.createElement({
        type: "text",
        id: "text-beta",
        text: "Beta Architecture",
        x: 40,
        y: 40,
      }),
      { pageId: page2Id },
    );
    act(() => {
      h.scene.replaceAllElements([textPage1, textPage2], {
        replaceAllPages: true,
      });
    });
    act(() => {
      // Switch back to Page 1 so Page 2's element is on an inactive page
      h.app.actionManager.executeAction(
        actionSwitchPage,
        "ui",
        DEFAULT_PAGE_ID,
      );
    });
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

    // Open search menu
    act(() => {
      h.setState({
        openSidebar: { name: DEFAULT_SIDEBAR.name, tab: CANVAS_SEARCH_TAB },
      });
    });

    const searchInput = container.querySelector(
      `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
    ) as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    fireEvent.change(searchInput, { target: { value: "Beta" } });

    const badges = await findAllByTestId("search-result-page-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe("Page 2");

    // Selecting/focusing the search match switches activePageId to Page 2
    await waitFor(() => {
      expect(h.state.activePageId).toBe(page2Id);
    });
  });

  it("round-trips multi-page JSON and restores legacy and orphaned-pageId payloads cleanly (AC-8, AC-9)", async () => {
    await render(<Excalidraw />);

    const rect1 = API.createElement({
      type: "rectangle",
      id: "r1",
      x: 10,
      y: 20,
    });
    act(() => {
      h.scene.replaceAllElements([rect1]);
      h.setState({
        scrollX: 55,
        scrollY: 65,
        zoom: { value: 1.25 as NormalizedZoomValue },
      });
    });
    act(() => {
      h.app.actionManager.executeAction(actionCreatePage, "ui");
    });
    const page2Id = h.state.activePageId;

    const rect2 = newElementWith(
      API.createElement({
        type: "rectangle",
        id: "r2",
        x: 100,
        y: 200,
      }),
      { pageId: page2Id },
    );
    act(() => {
      h.scene.replaceAllElements([rect1, rect2], { replaceAllPages: true });
      h.setState({
        scrollX: -90,
        scrollY: 140,
        zoom: { value: 2 as NormalizedZoomValue },
      });
    });

    // Serialize all pages to .excalidraw JSON
    const serialized = serializeAsJSON(
      h.scene.getAllElementsIncludingDeleted(),
      h.state,
      {},
      "local",
    );
    const parsed = JSON.parse(serialized);
    expect(parsed.appState.pages).toHaveLength(2);
    expect(parsed.appState.activePageId).toBe(page2Id);
    expect(parsed.appState.pages[0]).toMatchObject({
      id: DEFAULT_PAGE_ID,
      scrollX: 55,
      scrollY: 65,
      zoom: { value: 1.25 },
    });
    expect(parsed.appState.pages[1]).toMatchObject({
      id: page2Id,
      scrollX: -90,
      scrollY: 140,
      zoom: { value: 2 },
    });

    // Restore from serialized JSON
    const restored = restore(parsed, null, null);
    expect(restored.appState.pages).toHaveLength(2);
    expect(restored.appState.activePageId).toBe(page2Id);
    expect(restored.appState.scrollX).toBe(-90);
    expect(restored.appState.scrollY).toBe(140);
    expect(restored.appState.zoom.value).toBe(2);
    expect(
      restored.elements.find((el) => el.id === "r1")?.pageId,
    ).toBeUndefined();
    expect(restored.elements.find((el) => el.id === "r2")?.pageId).toBe(
      page2Id,
    );

    // Legacy single-page payload without pages or activePageId
    const legacyPayload = {
      type: EXPORT_DATA_TYPES.excalidraw,
      version: 2,
      elements: [API.createElement({ type: "rectangle", id: "legacy-el" })],
      appState: {
        scrollX: 33,
        scrollY: -44,
        zoom: { value: 1.5 as NormalizedZoomValue },
      },
    };
    const restoredLegacy = restore(legacyPayload, h.state, null);
    expect(restoredLegacy.appState.pages).toEqual([
      {
        id: DEFAULT_PAGE_ID,
        name: DEFAULT_PAGE_NAME,
        scrollX: 33,
        scrollY: -44,
        zoom: { value: 1.5 },
      },
    ]);
    expect(restoredLegacy.appState.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(restoredLegacy.elements[0].pageId).toBeUndefined();

    // Orphaned pageIds reassign to pages[0].id and cross-page bindings are stripped
    const customPageA = "page-a";
    const customPageB = "page-b";
    const containerOnA = newElementWith(
      API.createElement({
        type: "rectangle",
        id: "container-a",
        boundElements: [{ id: "arrow-b", type: "arrow" }],
      }),
      { pageId: customPageA },
    );
    const arrowOnB = newElementWith(
      API.createElement({
        type: "arrow",
        id: "arrow-b",
        startBinding: {
          elementId: "container-a",
          fixedPoint: [0.5, 0.5],
          mode: "inside",
        },
      }),
      { pageId: customPageB },
    );
    const orphanElement = newElementWith(
      API.createElement({
        type: "ellipse",
        id: "orphan-el",
      }),
      { pageId: "non-existent-page" },
    );

    const restoredOrphanAndBindings = restore(
      {
        elements: [containerOnA, arrowOnB, orphanElement],
        appState: {
          pages: [
            {
              id: customPageA,
              name: "Custom A",
              scrollX: 0,
              scrollY: 0,
              zoom: { value: 1 as NormalizedZoomValue },
            },
            {
              id: customPageB,
              name: "Custom B",
              scrollX: 0,
              scrollY: 0,
              zoom: { value: 1 as NormalizedZoomValue },
            },
          ],
          activePageId: "missing-active-page",
        },
      },
      null,
      null,
    );

    expect(restoredOrphanAndBindings.appState.activePageId).toBe(customPageA);
    const restoredOrphan = restoredOrphanAndBindings.elements.find(
      (el) => el.id === "orphan-el",
    )!;
    expect(restoredOrphan.pageId).toBe(customPageA);

    const restoredContainer = restoredOrphanAndBindings.elements.find(
      (el) => el.id === "container-a",
    )!;
    const restoredArrow = restoredOrphanAndBindings.elements.find(
      (el) => el.id === "arrow-b",
    )!;
    expect(restoredContainer.boundElements ?? []).toEqual([]);
    expect(
      restoredArrow.type === "arrow" ? restoredArrow.startBinding : null,
    ).toBeNull();

    // Direct restoreAppState and restoreElements helpers also normalize pages
    const directState = restoreAppState({ pages: [] }, null);
    expect(directState.pages).toHaveLength(1);
    expect(directState.pages[0].id).toBe(DEFAULT_PAGE_ID);
    const directElements = restoreElements([orphanElement], null, {
      validPageIds: [DEFAULT_PAGE_ID],
      defaultPageId: DEFAULT_PAGE_ID,
    });
    expect(directElements[0].pageId).toBeUndefined();
  });

  it("renders only the active page's elements in renderStaticScene (AC-2)", async () => {
    await render(<Excalidraw />);
    API.setAppState({ width: 800, height: 600 });

    const rectPageA = API.createElement({
      type: "rectangle",
      id: "render-rect-page-a",
      x: 10,
      y: 10,
      width: 100,
      height: 100,
    });
    act(() => {
      h.scene.replaceAllElements([rectPageA]);
      h.app.actionManager.executeAction(actionCreatePage, "ui");
    });
    const pageBId = h.state.activePageId;
    expect(pageBId).not.toBe(DEFAULT_PAGE_ID);

    const rectPageB = newElementWith(
      API.createElement({
        type: "rectangle",
        id: "render-rect-page-b",
        x: 30,
        y: 30,
        width: 100,
        height: 100,
      }),
      { pageId: pageBId },
    );

    renderStaticScene.mockClear();
    act(() => {
      h.scene.replaceAllElements([rectPageA, rectPageB], {
        replaceAllPages: true,
      });
      h.app.refresh();
    });

    await waitFor(() => {
      const visibleIds =
        renderStaticScene.mock.lastCall?.[0].visibleElements.map(
          (el) => el.id,
        ) ?? [];
      expect(visibleIds).toContain(rectPageB.id);
    });

    const lastRenderConfig = renderStaticScene.mock.lastCall![0];
    const visibleIds = lastRenderConfig.visibleElements.map((el) => el.id);
    const elementsMapKeys = Array.from(lastRenderConfig.elementsMap.keys());

    expect(visibleIds).toContain(rectPageB.id);
    expect(visibleIds).not.toContain(rectPageA.id);
    expect(elementsMapKeys).toContain(rectPageB.id);
    expect(elementsMapKeys).not.toContain(rectPageA.id);
  });

  it("does not hit-test elements from another page when clicking their coordinates (AC-2)", async () => {
    await render(<Excalidraw />);

    const rectPageA = API.createElement({
      type: "rectangle",
      id: "hittest-rect-page-a",
      x: 20,
      y: 20,
      width: 100,
      height: 100,
      backgroundColor: "#ff0000",
      fillStyle: "solid",
    });
    act(() => {
      h.scene.replaceAllElements([rectPageA]);
      h.app.actionManager.executeAction(actionCreatePage, "ui");
    });
    expect(h.state.activePageId).not.toBe(DEFAULT_PAGE_ID);

    mouse.reset();
    mouse.click(70, 70);

    expect(Object.keys(h.state.selectedElementIds)).toEqual([]);
  });

  it("preserves reordered page order and element pageIds across serializeAsJSON and restore (AC-7)", async () => {
    await render(<Excalidraw />);

    const page1Id = DEFAULT_PAGE_ID;
    act(() => {
      h.app.actionManager.executeAction(actionCreatePage, "ui");
    });
    const page2Id = h.state.activePageId;
    act(() => {
      h.app.actionManager.executeAction(actionCreatePage, "ui");
    });
    const page3Id = h.state.activePageId;

    expect(h.state.pages.map((p) => p.id)).toEqual([page1Id, page2Id, page3Id]);

    act(() => {
      h.app.actionManager.executeAction(actionReorderPages, "ui", {
        fromIndex: 2,
        toIndex: 0,
      });
    });
    const reorderedPageIds = [page3Id, page1Id, page2Id];
    expect(h.state.pages.map((p) => p.id)).toEqual(reorderedPageIds);

    const elPage1 = API.createElement({
      type: "rectangle",
      id: "reorder-el-p1",
      x: 10,
      y: 10,
    });
    const elPage2 = newElementWith(
      API.createElement({
        type: "ellipse",
        id: "reorder-el-p2",
        x: 50,
        y: 50,
      }),
      { pageId: page2Id },
    );
    const elPage3 = newElementWith(
      API.createElement({
        type: "diamond",
        id: "reorder-el-p3",
        x: 90,
        y: 90,
      }),
      { pageId: page3Id },
    );
    const originalElements = [elPage1, elPage2, elPage3];

    act(() => {
      h.scene.replaceAllElements(originalElements, { replaceAllPages: true });
    });

    const serialized = serializeAsJSON(
      h.scene.getAllElementsIncludingDeleted(),
      h.state,
      h.app.files,
      "local",
    );
    const parsed = JSON.parse(serialized);
    const restored = restore(parsed, null, null);

    expect(restored.appState.pages.map((p) => p.id)).toEqual(reorderedPageIds);
    expect(restored.elements).toHaveLength(originalElements.length);
    for (const origEl of originalElements) {
      const restoredEl = restored.elements.find((el) => el.id === origEl.id)!;
      expect(restoredEl).toBeDefined();
      expect(getElementPageId(restoredEl)).toBe(getElementPageId(origEl));
    }
  });
});

function UI_drawRectangleOnCanvas() {
  UI.clickTool("rectangle");
  mouse.down(10, 10);
  mouse.move(60, 60);
  mouse.up();
}

function UI_drawEllipseOnCanvas() {
  UI.clickTool("ellipse");
  mouse.down(20, 20);
  mouse.move(70, 70);
  mouse.up();
}
