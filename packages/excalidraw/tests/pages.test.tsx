import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  CLASSES,
  DEFAULT_PAGE_ID,
  DEFAULT_PAGE_NAME,
  KEYS,
} from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import {
  Excalidraw,
  exportScene,
  exportToClipboard,
  getElementPageId,
  reconcilePages,
  restoreAppState,
  restoreElements,
  serializeAsJSON,
  type ExcalidrawPage,
} from "../index";
import { actionDeleteSelected, actionSelectAll } from "../actions";
import { createUndoAction, createRedoAction } from "../actions/actionHistory";
import * as clipboardModule from "../clipboard";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { updateTextEditor } from "./queries/dom";
import {
  act,
  fireEvent,
  GlobalTestState,
  render,
  unmountComponent,
  waitFor,
} from "./test-utils";

import type { ExcalidrawImperativeAPI, NormalizedZoomValue } from "../types";

const { h } = window;
const mouse = new Pointer("mouse");

describe("Multi-page support in <Excalidraw />", () => {
  beforeEach(() => {
    unmountComponent();
    mouse.reset();
    localStorage.clear();
    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
  });

  it("hides PageBar by default and renders it when UIOptions.canvasActions.pages is true", async () => {
    // 1. Default <Excalidraw /> without UIOptions.canvasActions.pages has PageBar hidden (FR-7, AC-1)
    let api: ExcalidrawImperativeAPI | null = null;
    const { container, unmount } = await render(
      <Excalidraw
        onExcalidrawAPI={(instance) => {
          api = instance;
        }}
      />,
    );

    expect(container.querySelector('[data-testid="page-bar"]')).toBeNull();
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
    expect(api!.getActivePageId()).toBe(DEFAULT_PAGE_ID);
    expect(api!.getPages()).toHaveLength(1);
    unmount();

    // 2. Enabled via UIOptions.canvasActions.pages: true
    const rendered = await render(
      <Excalidraw
        UIOptions={{
          canvasActions: {
            pages: true,
          },
        }}
      />,
    );

    const pageBar = rendered.container.querySelector(
      '[data-testid="page-bar"]',
    );
    expect(pageBar).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="page-bar-add"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        `[data-testid="page-tab-${DEFAULT_PAGE_ID}"]`,
      ),
    ).not.toBeNull();

    // 3. In viewModeEnabled, PageBar allows switching tabs while hiding mutation controls
    let page2Id = "";
    act(() => {
      page2Id = h.app.addPage({ name: "Page 2", switchTo: false }).id;
      h.app.updateScene({
        appState: { viewModeEnabled: true },
      });
    });

    await waitFor(() => {
      expect(
        rendered.container.querySelector('[data-testid="page-bar"]'),
      ).not.toBeNull();
      expect(
        rendered.container.querySelector('[data-testid="page-bar-add"]'),
      ).toBeNull();
    });

    const tab2 = rendered.container.querySelector(
      `[data-testid="page-tab-${page2Id}"]`,
    ) as HTMLElement;
    expect(tab2).not.toBeNull();
    fireEvent.click(tab2);
    expect(h.app.getActivePageId()).toBe(page2Id);
  });

  it("adds, switches, renames, reorders, and deletes pages while preserving per-page viewport and isolating elements", async () => {
    let api: ExcalidrawImperativeAPI | null = null;
    const { container } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        onExcalidrawAPI={(instance) => {
          api = instance;
        }}
        UIOptions={{
          canvasActions: {
            pages: true,
          },
        }}
      />,
    );

    // Draw a rectangle on Page 1 and pan/zoom Page 1
    const rect1 = API.createElement({
      type: "rectangle",
      id: "rect-page-1",
      x: 10,
      y: 20,
      width: 100,
      height: 80,
    });
    act(() => {
      API.setElements([rect1]);
      API.setAppState({
        scrollX: 120,
        scrollY: -60,
        zoom: { value: 2 as NormalizedZoomValue },
      });
    });

    expect(h.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      "rect-page-1",
    ]);
    // Element on default page omits explicit pageId or resolves to page-1
    expect(getElementPageId(h.elements[0], h.state.pages)).toBe(
      DEFAULT_PAGE_ID,
    );

    // Click "+" button to add Page 2 (FR-8, AC-2)
    const addBtn = container.querySelector(
      '[data-testid="page-bar-add"]',
    ) as HTMLElement;
    fireEvent.click(addBtn);

    expect(h.state.pages).toHaveLength(2);
    const page2Id = h.state.pages[1].id;
    expect(h.state.pages[1].name).toBe("Page 2");
    expect(h.state.activePageId).toBe(page2Id);

    // Page 2 starts with clean viewport and empty active-page scene
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);
    expect(h.state.zoom.value).toBe(1);
    expect(h.scene.getNonDeletedElements()).toHaveLength(0);
    expect(h.scene.getAllNonDeletedElements()).toHaveLength(1);

    // Create an ellipse on Page 2 and pan/zoom Page 2
    const ellipse2 = API.createElement({
      type: "ellipse",
      id: "ellipse-page-2",
      x: 50,
      y: 60,
      width: 90,
      height: 90,
    });
    act(() => {
      h.scene.insertElement(ellipse2);
      API.setAppState({
        scrollX: -300,
        scrollY: 450,
        zoom: { value: 0.5 as NormalizedZoomValue },
      });
    });

    expect(h.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      "ellipse-page-2",
    ]);
    expect(h.scene.getNonDeletedElements()[0].pageId).toBe(page2Id);

    // Switch back to Page 1 via PageBar tab and verify Page 1 viewport & elements restored (FR-5, AC-4)
    const tab1 = container.querySelector(
      `[data-testid="page-tab-${DEFAULT_PAGE_ID}"]`,
    ) as HTMLElement;
    fireEvent.click(tab1);

    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(h.state.scrollX).toBe(120);
    expect(h.state.scrollY).toBe(-60);
    expect(h.state.zoom.value).toBe(2);
    expect(h.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      "rect-page-1",
    ]);

    // Select all on Page 1 only selects Page 1 elements (FR-4, AC-3)
    act(() => {
      h.app.actionManager.executeAction(actionSelectAll);
    });
    expect(Object.keys(h.state.selectedElementIds)).toEqual(["rect-page-1"]);

    // Keyboard shortcuts Alt+PageDown / Alt+PageUp switch pages (FR-13)
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.PAGE_DOWN);
    });
    expect(h.app.getActivePageId()).toBe(page2Id);
    expect(h.state.scrollX).toBe(-300);
    expect(h.state.scrollY).toBe(450);
    expect(h.state.zoom.value).toBe(0.5);

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.PAGE_UP);
    });
    expect(h.app.getActivePageId()).toBe(DEFAULT_PAGE_ID);

    // Rename Page 1 via double-click inline input (FR-9, AC-6)
    fireEvent.doubleClick(tab1);
    const renameInput = container.querySelector(
      '[data-testid="page-rename-input"]',
    ) as HTMLInputElement;
    expect(renameInput).not.toBeNull();

    // Whitespace-only name is rejected and keeps previous name
    fireEvent.change(renameInput, { target: { value: "   " } });
    fireEvent.keyDown(renameInput, { key: KEYS.ENTER });
    expect(h.state.pages[0].name).toBe(DEFAULT_PAGE_NAME);

    // Valid rename commits on Enter
    const tab1AfterCancel = container.querySelector(
      `[data-testid="page-tab-${DEFAULT_PAGE_ID}"]`,
    ) as HTMLElement;
    fireEvent.doubleClick(tab1AfterCancel);
    const renameInput2 = container.querySelector(
      '[data-testid="page-rename-input"]',
    ) as HTMLInputElement;
    fireEvent.change(renameInput2, { target: { value: "Overview" } });
    fireEvent.keyDown(renameInput2, { key: KEYS.ENTER });
    expect(h.state.pages[0].name).toBe("Overview");

    // Reorder pages via move button / API (FR-10, AC-6)
    const moveLeftBtn = container.querySelector(
      `[data-testid="page-move-left-${page2Id}"]`,
    ) as HTMLElement;
    expect(moveLeftBtn).not.toBeNull();
    fireEvent.click(moveLeftBtn);
    expect(h.state.pages.map((p) => p.id)).toEqual([page2Id, DEFAULT_PAGE_ID]);

    // Move right restores order
    act(() => {
      api!.reorderPages(0, 1);
    });
    expect(h.state.pages.map((p) => p.id)).toEqual([DEFAULT_PAGE_ID, page2Id]);

    // Delete Page 2 and verify its elements are soft-deleted and activePageId falls back to Page 1 (FR-11, AC-7)
    act(() => {
      api!.setActivePage(page2Id);
    });
    expect(h.app.getActivePageId()).toBe(page2Id);

    act(() => {
      api!.deletePage(page2Id);
    });
    expect(h.state.pages).toHaveLength(1);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(h.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      "rect-page-1",
    ]);
    const deletedPage2El = h.scene
      .getElementsIncludingDeleted()
      .find((e) => e.id === "ellipse-page-2");
    expect(deletedPage2El?.isDeleted).toBe(true);

    // Deleting the last remaining page is prevented (FR-11, AC-7)
    act(() => {
      api!.deletePage(DEFAULT_PAGE_ID);
    });
    expect(h.state.pages).toHaveLength(1);
    expect(h.state.pages[0].id).toBe(DEFAULT_PAGE_ID);

    // updateScene with elements + pages in one call preserves page2 elements
    const p1 = API.createElement({ type: "rectangle", id: "embed-p1" });
    const p2 = {
      ...API.createElement({
        type: "ellipse",
        id: "embed-p2",
      }),
      pageId: "page-2",
    };
    act(() => {
      api!.updateScene({
        elements: [p1, p2],
        appState: {
          pages: [
            {
              id: DEFAULT_PAGE_ID,
              name: "Page 1",
              scrollX: 0,
              scrollY: 0,
              zoom: { value: 1 as NormalizedZoomValue },
            },
            {
              id: "page-2",
              name: "Page 2",
              scrollX: 0,
              scrollY: 0,
              zoom: { value: 1 as NormalizedZoomValue },
            },
          ],
          activePageId: "page-2",
        },
      });
    });
    expect(h.app.getActivePageId()).toBe("page-2");
    expect(h.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      "embed-p2",
    ]);

    // Deleting selected elements on Page 2 does not delete Page 1's elements
    act(() => {
      h.app.actionManager.executeAction(actionSelectAll);
    });
    API.executeAction(actionDeleteSelected);
    expect(h.scene.getNonDeletedElements()).toHaveLength(0);
    act(() => {
      api!.setActivePage(DEFAULT_PAGE_ID);
    });
    expect(h.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      "embed-p1",
    ]);
  });

  it("scopes undo/redo to each page without switching pages or recording page switches", async () => {
    await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        UIOptions={{
          canvasActions: {
            pages: true,
          },
        }}
      />,
    );

    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);

    // Draw a rectangle on Page 1 via pointer interaction (creates history entry on Page 1)
    const rect = UI.createElement("rectangle", {
      x: 10,
      y: 10,
      width: 50,
      height: 50,
    });
    expect(h.scene.getNonDeletedElements()).toHaveLength(1);
    const page1ElId = rect.id;
    expect(h.history.isUndoStackEmpty).toBe(false);

    // Add Page 2 and switch to it
    let page2Id = "";
    act(() => {
      page2Id = h.app.addPage({ name: "Page 2" }).id;
    });
    expect(h.app.getActivePageId()).toBe(page2Id);
    expect(h.scene.getNonDeletedElements()).toHaveLength(0);

    // Switching to Page 2 has an empty undo stack for Page 2 (page switch is not recorded in undo history)
    expect(h.history.isUndoStackEmpty).toBe(true);

    // Executing undo on Page 2 when Page 2 has no edits is a no-op:
    // it must NOT switch back to Page 1 and must NOT undo Page 1's rectangle (FR-6, AC-5)
    API.executeAction(undoAction);
    expect(h.app.getActivePageId()).toBe(page2Id);
    expect(
      h.scene.getElementsIncludingDeleted().find((el) => el.id === page1ElId)
        ?.isDeleted,
    ).toBe(false);

    // Draw an ellipse on Page 2
    const ellipse = UI.createElement("ellipse", {
      x: 20,
      y: 20,
      width: 50,
      height: 50,
    });
    expect(h.scene.getNonDeletedElements()).toHaveLength(1);
    const page2ElId = ellipse.id;

    // Undo on Page 2 reverts Page 2's ellipse while keeping activePageId on Page 2 and leaving Page 1 untouched
    API.executeAction(undoAction);
    expect(h.app.getActivePageId()).toBe(page2Id);
    expect(h.scene.getNonDeletedElements()).toHaveLength(0);
    expect(
      h.scene.getElementsIncludingDeleted().find((el) => el.id === page1ElId)
        ?.isDeleted,
    ).toBe(false);

    // Redo on Page 2 restores Page 2's ellipse
    API.executeAction(redoAction);
    expect(h.app.getActivePageId()).toBe(page2Id);
    expect(h.scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      page2ElId,
    ]);

    // Switch back to Page 1: Page 1's own undo stack is active and undoes Page 1's rectangle without affecting Page 2
    act(() => {
      h.app.setActivePage(DEFAULT_PAGE_ID);
    });
    expect(h.app.getActivePageId()).toBe(DEFAULT_PAGE_ID);
    expect(h.history.isUndoStackEmpty).toBe(false);

    API.executeAction(undoAction);
    expect(h.app.getActivePageId()).toBe(DEFAULT_PAGE_ID);
    expect(h.scene.getNonDeletedElements()).toHaveLength(0);
    expect(
      h.scene.getElementsIncludingDeleted().find((el) => el.id === page2ElId)
        ?.isDeleted,
    ).toBe(false);
  });

  it("restores legacy single-page scenes, serializes all pages to JSON, and scopes visual exports via exportScene to the active page", async () => {
    await render(
      <Excalidraw
        UIOptions={{
          canvasActions: {
            pages: true,
          },
        }}
      />,
    );

    // 1. Legacy single-page scene without `pages`, `activePageId`, or `pageId` (FR-2, FR-15, AC-9)
    const legacyRect = API.createElement({
      type: "rectangle",
      id: "legacy-rect",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const restoredLegacyElements = restoreElements([legacyRect], null);
    const restoredLegacyAppState = restoreAppState({}, null);

    expect(restoredLegacyAppState.pages).toEqual([
      {
        id: DEFAULT_PAGE_ID,
        name: DEFAULT_PAGE_NAME,
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 },
      },
    ]);
    expect(restoredLegacyAppState.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(restoredLegacyElements[0].pageId).toBeUndefined();
    expect(
      getElementPageId(restoredLegacyElements[0], restoredLegacyAppState.pages),
    ).toBe(DEFAULT_PAGE_ID);

    // 2. Multi-page JSON serialization and restoration (FR-14, AC-8)
    const rectPage1 = API.createElement({
      type: "rectangle",
      id: "rect-p1",
      x: 10,
      y: 10,
      width: 60,
      height: 40,
    });
    const rectPage2 = {
      ...API.createElement({
        type: "rectangle",
        id: "rect-p2",
        x: 20,
        y: 20,
        width: 80,
        height: 80,
      }),
      pageId: "page-2",
    };

    const multiPages: ExcalidrawPage[] = [
      {
        id: DEFAULT_PAGE_ID,
        name: "Architecture",
        scrollX: 15,
        scrollY: 25,
        zoom: { value: 1.5 as NormalizedZoomValue },
      },
      {
        id: "page-2",
        name: "Details",
        scrollX: -40,
        scrollY: 80,
        zoom: { value: 2 as NormalizedZoomValue },
      },
    ];

    act(() => {
      h.app.updateScene({
        elements: [rectPage1, rectPage2],
        appState: {
          pages: multiPages,
          activePageId: "page-2",
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });

    const serialized = serializeAsJSON(
      h.scene.getAllNonDeletedElements(),
      h.state,
      {},
      "local",
    );
    const parsed = JSON.parse(serialized);
    expect(parsed.appState.pages).toHaveLength(2);
    expect(parsed.appState.pages[0].name).toBe("Architecture");
    expect(parsed.appState.pages[1].name).toBe("Details");
    expect(parsed.appState.activePageId).toBe("page-2");
    expect(parsed.elements.map((e: { id: string }) => e.id)).toEqual([
      "rect-p1",
      "rect-p2",
    ]);
    expect(parsed.elements[1].pageId).toBe("page-2");

    // Round-trip restore preserves pages, viewports, activePageId, and element pageId
    const roundTripState = restoreAppState(parsed.appState, null);
    const roundTripElements = restoreElements(parsed.elements, null);
    expect(roundTripState.pages).toEqual(multiPages);
    expect(roundTripState.activePageId).toBe("page-2");
    expect(roundTripState.scrollX).toBe(-40);
    expect(roundTripState.scrollY).toBe(80);
    expect(roundTripState.zoom.value).toBe(2);
    expect(roundTripElements.map((e) => e.pageId)).toEqual([
      undefined,
      "page-2",
    ]);

    // 3. Visual export via exportScene and exportToClipboard scopes to the active page
    // while embedded scene metadata preserves all pages (FR-16, AC-13)
    const svgPage2 = await exportScene({
      type: "svg",
      data: {
        elements: [rectPage1, rectPage2],
        appState: {
          ...h.state,
          pages: multiPages,
          activePageId: "page-2",
        },
        files: {},
      },
      config: {
        embedScene: true,
      },
    });
    // SVG contains rect-p2 (80x80) and not rect-p1 (60x40)
    expect(svgPage2.getAttribute("width")).toBe("100");
    expect(svgPage2.getAttribute("height")).toBe("100");
    expect(svgPage2.querySelector("metadata")?.innerHTML).toContain(
      "payload-type:application/vnd.excalidraw+json",
    );

    const canvasPage1 = await exportScene({
      type: "canvas",
      data: {
        elements: [rectPage1, rectPage2],
        appState: {
          ...h.state,
          pages: multiPages,
          activePageId: DEFAULT_PAGE_ID,
        },
        files: {},
      },
      config: {
        padding: 0,
        canvasBackgroundColor: "#ffffff",
      },
    });
    expect(canvasPage1.width).toBe(rectPage1.width);
    expect(canvasPage1.height).toBe(rectPage1.height);

    const copySpy = vi
      .spyOn(clipboardModule, "copyToClipboard")
      .mockResolvedValue();
    try {
      await exportToClipboard({
        type: "json",
        data: {
          elements: [rectPage1, rectPage2],
          appState: {
            ...h.state,
            pages: multiPages,
            activePageId: "page-2",
          },
          files: {},
        },
      });
      expect(copySpy.mock.lastCall![0].map((el) => el.id)).toEqual(["rect-p2"]);
    } finally {
      copySpy.mockRestore();
    }
  });

  it("searches across all pages, reconciles remote pages, and filters remote collaborator cursors by pageId", async () => {
    const textPage1 = API.createElement({
      type: "text",
      id: "text-p1",
      text: "SharedQuery Alpha",
      x: 10,
      y: 10,
    });
    const textPage2 = {
      ...API.createElement({
        type: "text",
        id: "text-p2",
        text: "SharedQuery Beta",
        x: 30,
        y: 30,
      }),
      pageId: "page-2",
    };

    const pages: ExcalidrawPage[] = [
      {
        id: DEFAULT_PAGE_ID,
        name: "First Page",
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 as NormalizedZoomValue },
      },
      {
        id: "page-2",
        name: "Second Page",
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 as NormalizedZoomValue },
      },
    ];

    const { container } = await render(
      <Excalidraw
        handleKeyboardGlobally
        initialData={{
          elements: [textPage1, textPage2],
          appState: {
            pages,
            activePageId: DEFAULT_PAGE_ID,
          },
        }}
        UIOptions={{
          canvasActions: {
            pages: true,
          },
        }}
      />,
    );

    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    // 1. Cross-page search lists matches from all pages with page name badge and switches page on click (FR-12, AC-14)
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    const searchInput = await waitFor(() => {
      const input = container.querySelector<HTMLInputElement>(
        `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
      );
      expect(input).not.toBeNull();
      return input!;
    });

    updateTextEditor(searchInput, "SharedQuery");

    await waitFor(() => {
      const badges = container.querySelectorAll(
        '[data-testid="search-result-page-badge"]',
      );
      expect(badges).toHaveLength(2);
      expect(badges[0].textContent).toBe("First Page");
      expect(badges[1].textContent).toBe("Second Page");
    });

    const resultItems = container.querySelectorAll(".layer-ui__result-item");
    expect(resultItems).toHaveLength(2);
    fireEvent.click(resultItems[1]);

    expect(h.app.getActivePageId()).toBe("page-2");

    // 2. reconcilePages merges local and remote pages while preserving local scroll/zoom (FR-19, AC-12)
    const localPages: ExcalidrawPage[] = [
      {
        id: DEFAULT_PAGE_ID,
        name: "First Page",
        scrollX: 250,
        scrollY: -120,
        zoom: { value: 1.5 as NormalizedZoomValue },
      },
      {
        id: "local-only",
        name: "Local Draft",
        scrollX: 10,
        scrollY: 20,
        zoom: { value: 1 as NormalizedZoomValue },
      },
    ];
    const remotePages: ExcalidrawPage[] = [
      {
        id: DEFAULT_PAGE_ID,
        name: "Renamed Remotely",
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 as NormalizedZoomValue },
      },
      {
        id: "remote-new",
        name: "Remote Spec",
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 as NormalizedZoomValue },
      },
    ];
    const merged = reconcilePages(localPages, remotePages, [
      { ...textPage2, pageId: "local-only" },
    ]);
    expect(merged.map((p) => p.id)).toEqual([
      DEFAULT_PAGE_ID,
      "remote-new",
      "local-only",
    ]);
    expect(merged[0].name).toBe("Renamed Remotely");
    expect(merged[0].scrollX).toBe(250);
    expect(merged[0].scrollY).toBe(-120);
  });

  it("preserves multi-page initialData, activePageId filtering, onChange, and serializeAsJSON when the tab bar is off", async () => {
    const elPage1 = {
      ...API.createElement({
        type: "rectangle",
        id: "tabbar-off-p1",
        x: 10,
        y: 10,
      }),
      pageId: DEFAULT_PAGE_ID,
    };
    const elPage2 = {
      ...API.createElement({
        type: "ellipse",
        id: "tabbar-off-p2",
        x: 30,
        y: 30,
      }),
      pageId: "page-2",
    };

    const pages: ExcalidrawPage[] = [
      {
        id: DEFAULT_PAGE_ID,
        name: "Page 1",
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 as NormalizedZoomValue },
      },
      {
        id: "page-2",
        name: "Page 2",
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 as NormalizedZoomValue },
      },
    ];

    const onChange = vi.fn();

    const { container } = await render(
      <Excalidraw
        initialData={{
          elements: [elPage1, elPage2],
          appState: {
            pages,
            activePageId: "page-2",
          },
        }}
        onChange={onChange}
      />,
    );

    expect(container.querySelector('[data-testid="page-bar"]')).toBeNull();
    expect(h.scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      "tabbar-off-p2",
    ]);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });

    const [lastElements, lastAppState] = onChange.mock.lastCall!;
    expect(lastElements.map((el: { id: string }) => el.id)).toEqual([
      "tabbar-off-p1",
      "tabbar-off-p2",
    ]);
    expect(lastAppState.pages.map((p: ExcalidrawPage) => p.id)).toEqual([
      DEFAULT_PAGE_ID,
      "page-2",
    ]);

    const serialized = serializeAsJSON(
      h.scene.getAllNonDeletedElements(),
      h.state,
      {},
      "local",
    );
    const parsed = JSON.parse(serialized);
    expect(
      parsed.elements.map((el: { pageId?: string }) =>
        getElementPageId(el, parsed.appState.pages),
      ),
    ).toEqual([DEFAULT_PAGE_ID, "page-2"]);
    expect(parsed.appState.pages.map((p: ExcalidrawPage) => p.id)).toEqual([
      DEFAULT_PAGE_ID,
      "page-2",
    ]);
  });

  it("draws a rectangle with non-zero width and height on a second page", async () => {
    await render(
      <Excalidraw
        handleKeyboardGlobally
        UIOptions={{
          canvasActions: {
            pages: true,
          },
        }}
      />,
    );

    let page2Id = "";
    act(() => {
      page2Id = h.app.addPage({ name: "Page 2" }).id;
    });
    expect(h.app.getActivePageId()).toBe(page2Id);

    UI.clickTool("rectangle");
    mouse.down(30, 20);
    mouse.up(60, 70);

    expect(h.elements).toHaveLength(1);
    const rect = h.elements[0];
    expect(rect.type).toBe("rectangle");
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
    expect(rect.pageId).toBe(page2Id);
  });
});
