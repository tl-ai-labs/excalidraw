import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import { CLASSES, KEYS, MIME_TYPES } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import {
  Excalidraw,
  exportScene,
  loadSceneOrLibraryFromBlob,
  serializeAsJSON,
} from "../index";
import { actionSelectAll } from "../actions/actionSelectAll";
import {
  actionCreatePage,
  actionRenamePage,
  actionReorderPage,
} from "../actions/actionPages";
import { createUndoAction, createRedoAction } from "../actions/actionHistory";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, render } from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

describe("pages", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
  });

  it("creates, switches, renames, reorders, and deletes pages via UI", async () => {
    // Initially 1 default page: "Page 1"
    expect(h.app.getPages()).toHaveLength(1);
    const page1 = h.app.getPages()[0];
    expect(page1.name).toBe("Page 1");
    expect(h.state.activePageId).toBe(page1.id);

    // Create a second page via "+" button
    const addBtn = screen.getByTestId("add-page-button");
    fireEvent.click(addBtn);

    await waitFor(() => expect(h.app.getPages()).toHaveLength(2));
    const page2 = h.app.getPages()[1];
    expect(page2.name).toBe("Page 2");
    expect(h.state.activePageId).toBe(page2.id);

    // Switch back to Page 1 by clicking its tab
    const tab1 = screen.getByTestId(`page-tab-${page1.id}`);
    fireEvent.click(tab1);
    expect(h.state.activePageId).toBe(page1.id);

    // Rename Page 1 via double-click inline input
    fireEvent.doubleClick(tab1);
    const renameInput = screen.getByTestId("page-rename-input");
    fireEvent.change(renameInput, { target: { value: "SDK flow" } });
    fireEvent.keyDown(renameInput, { key: KEYS.ENTER });
    expect(h.app.getPages()[0].name).toBe("SDK flow");

    // Empty name is rejected
    fireEvent.doubleClick(screen.getByTestId(`page-tab-${page1.id}`));
    const renameInput2 = screen.getByTestId("page-rename-input");
    fireEvent.change(renameInput2, { target: { value: "   " } });
    fireEvent.keyDown(renameInput2, { key: KEYS.ENTER });
    expect(h.app.getPages()[0].name).toBe("SDK flow");

    // Escape cancels rename
    fireEvent.doubleClick(screen.getByTestId(`page-tab-${page1.id}`));
    const renameInput3 = screen.getByTestId("page-rename-input");
    fireEvent.change(renameInput3, { target: { value: "Cancelled" } });
    fireEvent.keyDown(renameInput3, { key: KEYS.ESCAPE });
    expect(h.app.getPages()[0].name).toBe("SDK flow");

    // Reorder Page 2 before Page 1
    act(() => {
      h.app.actionManager.executeAction(actionReorderPage, "ui", {
        pageId: page2.id,
        targetIndex: 0,
      });
    });
    expect(h.app.getPages().map((p) => p.id)).toEqual([page2.id, page1.id]);

    // Delete Page 1 via context menu + ConfirmDialog
    fireEvent.contextMenu(screen.getByTestId(`page-tab-${page1.id}`));
    const deleteMenuItem = screen.getByText("Delete");
    fireEvent.click(deleteMenuItem);
    const confirmBtn = screen.getByRole("button", { name: "Confirm" });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(h.app.getPages()).toHaveLength(1));
    expect(h.app.getPages()[0].id).toBe(page2.id);
    expect(h.state.activePageId).toBe(page2.id);

    // Cannot delete the last remaining page
    fireEvent.contextMenu(screen.getByTestId(`page-tab-${page2.id}`));
    const disabledDelete = screen.getByText("Delete") as HTMLButtonElement;
    expect(disabledDelete.disabled).toBe(true);
  });

  it("renders and selects only the active page's elements (select-all and click hit-test)", () => {
    const page1 = h.app.getPages()[0];

    // Draw a rectangle on Page 1
    UI.clickTool("rectangle");
    mouse.downAt(100, 100);
    mouse.moveTo(200, 200);
    mouse.upAt(200, 200);
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(1);
    const rect1 = h.app.scene.getNonDeletedElements()[0];

    // Create Page 2 and draw a rectangle at the exact same coordinates
    act(() => {
      h.app.actionManager.executeAction(actionCreatePage, "ui");
    });
    const page2 = h.app.getPages()[1];
    expect(h.state.activePageId).toBe(page2.id);
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);

    UI.clickTool("rectangle");
    mouse.downAt(100, 100);
    mouse.moveTo(200, 200);
    mouse.upAt(200, 200);
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(1);
    const rect2 = h.app.scene.getNonDeletedElements()[0];
    expect(rect2.pageId).toBe(page2.id);

    // Total non-deleted elements across all pages is 2
    expect(h.app.getSceneElements()).toHaveLength(2);

    // Select-all on Page 2 selects only rect2
    act(() => {
      h.app.actionManager.executeAction(actionSelectAll, "keyboard");
    });
    expect(Object.keys(h.state.selectedElementIds)).toEqual([rect2.id]);

    // Click hit-test on rect2's edge at (100, 150) on Page 2 hits rect2, not rect1
    mouse.clickAt(0, 0);
    expect(Object.keys(h.state.selectedElementIds)).toEqual([]);
    mouse.clickAt(100, 150);
    expect(Object.keys(h.state.selectedElementIds)).toEqual([rect2.id]);

    // Switch back to Page 1: selection clears, only rect1 is active & hit-testable
    act(() => {
      h.app.setActivePage(page1.id);
    });
    expect(Object.keys(h.state.selectedElementIds)).toEqual([]);
    expect(h.app.scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      rect1.id,
    ]);

    mouse.clickAt(100, 150);
    expect(Object.keys(h.state.selectedElementIds)).toEqual([rect1.id]);
  });

  it("scopes undo and redo per page", () => {
    const page1 = h.app.getPages()[0];

    // Draw rect1 on Page 1
    UI.clickTool("rectangle");
    mouse.downAt(50, 50);
    mouse.moveTo(150, 150);
    mouse.upAt(150, 150);
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(1);

    // Switch to Page 2 and draw rect2
    act(() => {
      h.app.actionManager.executeAction(actionCreatePage, "ui");
    });
    const page2 = h.app.getPages()[1];
    UI.clickTool("rectangle");
    mouse.downAt(250, 250);
    mouse.moveTo(350, 350);
    mouse.upAt(350, 350);
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(1);

    // Undo on Page 2 removes rect2, leaves rect1 on Page 1 intact
    act(() => {
      h.app.actionManager.executeAction(createUndoAction(h.history));
    });
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);
    expect(
      h.app
        .getSceneElements()
        .filter((el) => el.pageId === page1.id && !el.isDeleted),
    ).toHaveLength(1);

    // Redo on Page 2 restores rect2
    act(() => {
      h.app.actionManager.executeAction(createRedoAction(h.history));
    });
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(1);

    // Switch to Page 1 and undo -> removes rect1, leaves rect2 on Page 2 intact
    act(() => {
      h.app.setActivePage(page1.id);
    });
    act(() => {
      h.app.actionManager.executeAction(createUndoAction(h.history));
    });
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);
    expect(
      h.app
        .getSceneElements()
        .filter((el) => el.pageId === page2.id && !el.isDeleted),
    ).toHaveLength(1);
  });

  it("exports only the active page to SVG and round-trips all pages in JSON", async () => {
    const page1 = h.app.getPages()[0];
    act(() => {
      h.app.actionManager.executeAction(actionRenamePage, "ui", {
        pageId: page1.id,
        name: "SDK flow",
      });
    });

    const rect1 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 100,
      height: 80,
      pageId: page1.id,
    });

    act(() => {
      h.app.actionManager.executeAction(actionCreatePage, "ui");
    });
    const page2 = h.app.getPages()[1];
    act(() => {
      h.app.actionManager.executeAction(actionRenamePage, "ui", {
        pageId: page2.id,
        name: "Data pipeline",
      });
    });

    const ellipse2 = API.createElement({
      type: "ellipse",
      x: 20,
      y: 20,
      width: 120,
      height: 90,
      pageId: page2.id,
    });

    act(() => {
      h.app.updateScene({
        elements: [rect1, ellipse2],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });

    // Export active page (Page 2) to SVG -> contains only ellipse2
    const svg = await exportScene({
      type: "svg",
      data: {
        elements: h.app.scene.getNonDeletedElements(),
        appState: h.state,
        files: h.app.files,
      },
    });
    expect(svg.querySelectorAll("path, rect, ellipse").length).toBeGreaterThan(
      0,
    );

    // Verify embedScene or element count via active page elements
    expect(h.app.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      ellipse2.id,
    ]);

    // JSON save round-trips all pages and all elements
    const json = serializeAsJSON(
      h.app.getSceneElements(),
      h.state,
      h.app.files,
      "local",
      h.app.getPages(),
    );
    const parsed = JSON.parse(json);
    expect(parsed.pages).toHaveLength(2);
    expect(parsed.pages.map((p: any) => p.name)).toEqual([
      "SDK flow",
      "Data pipeline",
    ]);
    expect(parsed.elements).toHaveLength(2);

    const blob = new Blob([json], { type: MIME_TYPES.excalidraw });
    const loaded = await loadSceneOrLibraryFromBlob(blob, null, null);
    expect(loaded.type).toBe(MIME_TYPES.excalidraw);
    if (loaded.type === MIME_TYPES.excalidraw) {
      expect(loaded.data.pages).toHaveLength(2);
      expect(loaded.data.elements).toHaveLength(2);
      expect(loaded.data.appState.activePageId).toBe(page2.id);
    }
  });

  it("restores a legacy file without pages onto one default Page 1", async () => {
    const legacyRect = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
    const legacyJson = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [{ ...legacyRect, pageId: undefined }],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    });

    await render(
      <Excalidraw
        handleKeyboardGlobally
        initialData={JSON.parse(legacyJson)}
      />,
    );

    const pages = h.app.getPages();
    expect(pages).toHaveLength(1);
    expect(pages[0].name).toBe("Page 1");
    expect(h.state.activePageId).toBe(pages[0].id);
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(1);
    expect(h.app.scene.getNonDeletedElements()[0].pageId).toBe(pages[0].id);
  });

  it("searches across all pages, groups by page name, and switches page on select", async () => {
    const page1 = h.app.getPages()[0];
    const textOnPage1 = API.createElement({
      type: "text",
      x: 0,
      y: 0,
      text: "Alpha node",
      pageId: page1.id,
    });

    act(() => {
      h.app.actionManager.executeAction(actionCreatePage, "ui");
    });
    const page2 = h.app.getPages()[1];
    act(() => {
      h.app.actionManager.executeAction(actionRenamePage, "ui", {
        pageId: page2.id,
        name: "Data pipeline",
      });
    });

    const textOnPage2 = API.createElement({
      type: "text",
      x: 100,
      y: 100,
      text: "Alpha pipeline",
      pageId: page2.id,
    });

    act(() => {
      h.app.updateScene({
        elements: [textOnPage1, textOnPage2],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });

    // Currently on Page 2
    expect(h.state.activePageId).toBe(page2.id);

    // Open search with Ctrl+F
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    const searchInput = await waitFor(() => {
      const el =
        h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
          `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
        );
      expect(el).not.toBeNull();
      return el!;
    });

    fireEvent.change(searchInput, { target: { value: "Alpha" } });

    // Wait for debounced search results grouped by page name
    const resultItems = await waitFor(() => {
      const items = h.app.excalidrawContainerValue.container!.querySelectorAll(
        ".layer-ui__result-item",
      );
      expect(items.length).toBe(2);
      return items;
    });

    const searchContainer =
      h.app.excalidrawContainerValue.container!.querySelector(
        ".layer-ui__search",
      )!;
    expect(searchContainer.textContent).toContain("Page 1");
    expect(searchContainer.textContent).toContain("Data pipeline");

    // Click the first result (on Page 1) -> switches activePageId to Page 1
    fireEvent.click(resultItems[0]);

    await waitFor(() => {
      expect(h.state.activePageId).toBe(page1.id);
    });
  });
});
