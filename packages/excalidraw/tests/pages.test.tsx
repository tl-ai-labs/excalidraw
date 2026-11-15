import React from "react";
import { vi } from "vitest";

import { KEYS } from "@excalidraw/common";

import { Excalidraw, exportScene, serializeAsJSON } from "../index";
import * as StaticScene from "../renderer/staticScene";
import { DEFAULT_PAGE_ID } from "../appState";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  screen,
  unmountComponent,
} from "./test-utils";

unmountComponent();

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

const { h } = window;

describe("pages", () => {
  beforeEach(() => {
    localStorage.clear();
    renderStaticScene.mockClear();
    mockBoundingClientRect();
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("creates, switches, renames, reorders, and deletes pages via tab bar UI", async () => {
    await render(<Excalidraw />);

    expect(h.state.pages).toHaveLength(1);
    expect(h.state.pages[0].name).toBe("Page 1");
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

    // Delete button should not be shown when only one page exists
    expect(screen.queryByLabelText("Delete Page 1")).toBeNull();

    // Create a second page via the "+" button
    const addBtn = screen.getByTestId("add-page-button");
    fireEvent.click(addBtn);

    expect(h.state.pages).toHaveLength(2);
    expect(h.state.pages[1].name).toBe("Page 2");
    const page2Id = h.state.pages[1].id;
    expect(h.state.activePageId).toBe(page2Id);

    // Rename Page 2 via double-click
    const page2Tab = screen.getByTestId(`page-tab-${page2Id}`);
    fireEvent.doubleClick(page2Tab);

    const renameInput = screen.getByLabelText("Rename page");
    fireEvent.change(renameInput, { target: { value: "SDK flow" } });
    fireEvent.keyDown(renameInput, { key: KEYS.ENTER });

    expect(h.state.pages[1].name).toBe("SDK flow");
    expect(screen.getByText("SDK flow")).toBeTruthy();

    // Switch back to Page 1 by clicking its tab
    const page1Tab = screen.getByTestId(`page-tab-${DEFAULT_PAGE_ID}`);
    fireEvent.click(page1Tab);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

    // Reorder pages
    act(() => {
      h.app.reorderPages(0, 1);
    });
    expect(h.state.pages.map((p) => p.name)).toEqual(["SDK flow", "Page 1"]);

    // Delete "SDK flow" via delete button
    const deleteBtn = screen.getByLabelText("Delete SDK flow");
    fireEvent.click(deleteBtn);

    expect(h.state.pages).toHaveLength(1);
    expect(h.state.pages[0].id).toBe(DEFAULT_PAGE_ID);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
  });

  it("renders and selects only the active page's elements", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    // Create rectangle on Page 1
    const rect = UI.createElement("rectangle", {
      x: -20,
      y: -20,
      width: 40,
      height: 40,
    });
    expect(h.elements).toHaveLength(1);
    expect(rect.pageId ?? DEFAULT_PAGE_ID).toBe(DEFAULT_PAGE_ID);

    // Create Page 2 and draw an ellipse on Page 2
    fireEvent.click(screen.getByTestId("add-page-button"));
    const page2Id = h.state.activePageId;
    expect(page2Id).not.toBe(DEFAULT_PAGE_ID);

    const ellipse = UI.createElement("ellipse", {
      x: 0,
      y: 0,
      width: 40,
      height: 40,
    });
    expect(ellipse.pageId).toBe(page2Id);

    // Active scene should only expose Page 2's element
    expect(h.app.scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      ellipse.id,
    ]);
    // All elements including Page 1 are still in the document
    expect(h.app.scene.getElementsIncludingDeleted()).toHaveLength(2);

    // Only Page 2's element is visible/renderable on the canvas
    expect(h.state.newElement).toBeNull();
    expect(h.app.visibleElements.map((el) => el.id)).toEqual([ellipse.id]);
    expect(renderStaticScene).toHaveBeenCalled();

    // Clicking where Page 1's rect is should NOT select anything on Page 2
    const mouse = new Pointer("mouse");
    mouse.clickAt(-10, -10);
    expect(Object.keys(h.state.selectedElementIds)).toHaveLength(0);

    // Ctrl+A on Page 2 should only select Page 2's ellipse
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.A);
    });
    expect(Object.keys(h.state.selectedElementIds)).toEqual([ellipse.id]);

    // Switch back to Page 1 -> only Page 1's rect renders and is selectable
    fireEvent.click(screen.getByTestId(`page-tab-${DEFAULT_PAGE_ID}`));
    expect(h.app.scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      rect.id,
    ]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.A);
    });
    expect(Object.keys(h.state.selectedElementIds)).toEqual([rect.id]);
  });

  it("preserves per-page viewport (scrollX, scrollY, zoom)", async () => {
    await render(<Excalidraw />);

    act(() => {
      h.app.updateScene({
        appState: { scrollX: 120, scrollY: 80 },
      });
    });

    fireEvent.click(screen.getByTestId("add-page-button"));
    const page2Id = h.state.activePageId;
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);

    act(() => {
      h.app.updateScene({
        appState: { scrollX: -50, scrollY: 40 },
      });
    });

    // Switch back to Page 1 -> restores Page 1's viewport
    fireEvent.click(screen.getByTestId(`page-tab-${DEFAULT_PAGE_ID}`));
    expect(h.state.scrollX).toBe(120);
    expect(h.state.scrollY).toBe(80);

    // Switch to Page 2 -> restores Page 2's viewport
    fireEvent.click(screen.getByTestId(`page-tab-${page2Id}`));
    expect(h.state.scrollX).toBe(-50);
    expect(h.state.scrollY).toBe(40);
  });

  it("scopes undo/redo history to each page", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    // Draw rectangle on Page 1
    const rect = UI.createElement("rectangle", {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(1);

    // Create Page 2 and draw ellipse on Page 2
    fireEvent.click(screen.getByTestId("add-page-button"));
    const page2Id = h.state.activePageId;
    UI.createElement("ellipse", {
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(1);

    // Undo on Page 2 -> removes ellipse on Page 2
    Keyboard.undo();
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);
    expect(h.state.activePageId).toBe(page2Id);

    // Undo again on Page 2 -> does NOT undo Page 1's rectangle
    Keyboard.undo();
    expect(h.state.activePageId).toBe(page2Id);

    // Switch to Page 1 -> rectangle is still present
    fireEvent.click(screen.getByTestId(`page-tab-${DEFAULT_PAGE_ID}`));
    expect(h.app.scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      rect.id,
    ]);

    // Undo on Page 1 -> removes Page 1's rectangle
    Keyboard.undo();
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);
  });

  it("exports only the active page's elements", async () => {
    await render(<Excalidraw />);

    const page1Text = API.createElement({
      type: "text",
      text: "PageOneOnlyText",
      x: 0,
      y: 0,
      pageId: DEFAULT_PAGE_ID,
    });

    const page2Id = "page-2";
    const page2Text = API.createElement({
      type: "text",
      text: "PageTwoOnlyText",
      x: 0,
      y: 0,
      pageId: page2Id,
    });

    act(() => {
      h.app.updateScene({
        elements: [page1Text, page2Text],
        appState: {
          pages: [
            { id: DEFAULT_PAGE_ID, name: "Page 1" },
            { id: page2Id, name: "Page 2" },
          ],
          activePageId: page2Id,
        },
      });
    });

    const svgPage2 = await exportScene({
      type: "svg",
      data: {
        elements: h.app.scene.getAllNonDeletedElements(),
        appState: h.state,
        files: h.app.files,
      },
    });
    expect(svgPage2.outerHTML).toContain("PageTwoOnlyText");
    expect(svgPage2.outerHTML).not.toContain("PageOneOnlyText");

    // Switch to Page 1 and export
    fireEvent.click(screen.getByTestId(`page-tab-${DEFAULT_PAGE_ID}`));
    const svgPage1 = await exportScene({
      type: "svg",
      data: {
        elements: h.app.scene.getAllNonDeletedElements(),
        appState: h.state,
        files: h.app.files,
      },
    });
    expect(svgPage1.outerHTML).toContain("PageOneOnlyText");
    expect(svgPage1.outerHTML).not.toContain("PageTwoOnlyText");

    // JSON serialization includes all pages and elements
    const json = JSON.parse(
      serializeAsJSON(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        h.app.files,
        "local",
      ),
    );
    expect(json.elements).toHaveLength(2);
    expect(json.appState.pages).toHaveLength(2);
  });

  it("restores a legacy file onto one default page", async () => {
    const legacyRect = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
      width: 80,
      height: 60,
    });
    // Ensure no pageId on legacy element
    delete (legacyRect as any).pageId;

    await render(
      <Excalidraw
        initialData={{
          elements: [legacyRect],
          appState: {},
        }}
      />,
    );

    expect(h.state.pages).toHaveLength(1);
    expect(h.state.pages[0].id).toBe(DEFAULT_PAGE_ID);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

    const activeElements = h.app.scene.getNonDeletedElements();
    expect(activeElements).toHaveLength(1);
    expect(activeElements[0].id).toBe(legacyRect.id);
    expect(activeElements[0].pageId ?? DEFAULT_PAGE_ID).toBe(DEFAULT_PAGE_ID);

    // Ensure GlobalTestState container is valid
    expect(GlobalTestState.canvas).toBeTruthy();
  });
});
