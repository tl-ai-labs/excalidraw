import React from "react";

import {
  CANVAS_SEARCH_TAB,
  CLASSES,
  DEFAULT_SIDEBAR,
} from "@excalidraw/common";
import { DEFAULT_PAGE_ID, newTextElement } from "@excalidraw/element";

import { Excalidraw, serializeAsJSON } from "../index";
import { exportScene } from "../scene/export";
import { prepareElementsForExport } from "../data";
import { restoreAppState, restoreElements } from "../data/restore";
import { actionSelectAll } from "../actions";
import { createUndoAction, createRedoAction } from "../actions/actionHistory";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { act, fireEvent, queryByTestId, render, waitFor } from "./test-utils";

import type { NormalizedZoomValue } from "../types";

const { h } = window;
const mouse = new Pointer("mouse");

describe("Pages (tabs)", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("creates, renames, switches, reorders, and deletes pages via the tab bar", () => {
    const { container } = { container: document.body };

    // Starts with one default page and no delete button
    expect(h.state.pages).toHaveLength(1);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(
      queryByTestId(container, `page-tab-${DEFAULT_PAGE_ID}`),
    ).not.toBeNull();
    expect(
      queryByTestId(container, `delete-page-${DEFAULT_PAGE_ID}`),
    ).toBeNull();

    // Create Page 2 via "+" button
    const addBtn = queryByTestId(container, "add-page-button")!;
    expect(addBtn).not.toBeNull();
    fireEvent.click(addBtn);

    expect(h.state.pages).toHaveLength(2);
    const page2Id = h.state.pages[1].id;
    expect(h.state.activePageId).toBe(page2Id);
    expect(h.state.pages[1].name).toBe("Page 2");

    // Rename Page 1 to "SDK flow" via double-click + Enter
    const page1Tab = queryByTestId(container, `page-tab-${DEFAULT_PAGE_ID}`)!;
    fireEvent.doubleClick(page1Tab);
    const page1Input = queryByTestId(
      container,
      `page-tab-input-${DEFAULT_PAGE_ID}`,
    ) as HTMLInputElement;
    expect(page1Input).not.toBeNull();
    fireEvent.change(page1Input, { target: { value: "SDK flow" } });
    fireEvent.keyDown(page1Input, { key: "Enter" });
    expect(h.state.pages[0].name).toBe("SDK flow");

    // Rename Page 2 to "Data pipeline" via API
    act(() => {
      h.app.renamePage(page2Id, "Data pipeline");
    });
    expect(h.state.pages[1].name).toBe("Data pipeline");

    // Switch back to Page 1 by clicking its tab
    fireEvent.click(queryByTestId(container, `page-tab-${DEFAULT_PAGE_ID}`)!);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

    // Reorder: drag Page 2 (index 1) onto Page 1 (index 0)
    const tab1 = queryByTestId(container, `page-tab-${DEFAULT_PAGE_ID}`)!;
    const tab2 = queryByTestId(container, `page-tab-${page2Id}`)!;
    fireEvent.dragStart(tab2);
    fireEvent.dragOver(tab1);
    fireEvent.drop(tab1);
    expect(h.state.pages.map((p) => p.id)).toEqual([page2Id, DEFAULT_PAGE_ID]);

    // Delete Page 2 via delete button
    const deletePage2Btn = queryByTestId(container, `delete-page-${page2Id}`)!;
    expect(deletePage2Btn).not.toBeNull();
    fireEvent.click(deletePage2Btn);

    expect(h.state.pages).toHaveLength(1);
    expect(h.state.pages[0].id).toBe(DEFAULT_PAGE_ID);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

    // Deleting the last remaining page is a no-op
    act(() => {
      h.app.deletePage(DEFAULT_PAGE_ID);
    });
    expect(h.state.pages).toHaveLength(1);
  });

  it("saves and restores per-page viewport (scrollX, scrollY, zoom) when switching pages", () => {
    // Set custom viewport on Page 1
    API.setAppState({
      scrollX: 120,
      scrollY: -45,
      zoom: { value: 1.5 as NormalizedZoomValue },
    });

    // Create Page 2 -> starts with fresh default viewport
    let page2Id = "";
    act(() => {
      const page2 = h.app.createPage("Page 2");
      page2Id = page2.id;
    });
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);
    expect(h.state.zoom.value).toBe(1);

    // Set different viewport on Page 2
    API.setAppState({
      scrollX: -300,
      scrollY: 250,
      zoom: { value: 2 as NormalizedZoomValue },
    });

    // Switch back to Page 1 -> restores Page 1's viewport
    act(() => {
      h.app.switchPage(DEFAULT_PAGE_ID);
    });
    expect(h.state.scrollX).toBe(120);
    expect(h.state.scrollY).toBe(-45);
    expect(h.state.zoom.value).toBe(1.5);

    // Switch back to Page 2 -> restores Page 2's viewport
    act(() => {
      h.app.switchPage(page2Id);
    });
    expect(h.state.scrollX).toBe(-300);
    expect(h.state.scrollY).toBe(250);
    expect(h.state.zoom.value).toBe(2);
  });

  it("only renders, hit-tests, and selects elements belonging to the active page", () => {
    // Draw rectangle on Page 1 at (10, 10) -> (110, 110)
    const rect1 = UI.createElement("rectangle", {
      x: 10,
      y: 10,
      width: 100,
      height: 100,
    });

    // Create Page 2 and draw rectangle at (200, 200) -> (300, 300)
    act(() => {
      h.app.createPage("Page 2");
    });
    const rect2 = UI.createElement("rectangle", {
      x: 200,
      y: 200,
      width: 100,
      height: 100,
    });

    // On Page 2, only rect2 is in scene's non-deleted elements
    expect(h.app.scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      rect2.id,
    ]);
    expect(h.app.api.getSceneElements().map((el) => el.id)).toEqual([rect2.id]);
    expect(h.app.scene.getAllNonDeletedElements().map((el) => el.id)).toEqual([
      rect1.id,
      rect2.id,
    ]);

    // Clicking at rect1's coordinates while on Page 2 does NOT select rect1
    mouse.clickAt(50, 50);
    expect(API.getSelectedElements()).toHaveLength(0);

    // Select All on Page 2 selects ONLY rect2
    act(() => {
      h.app.actionManager.executeAction(actionSelectAll);
    });
    expect(API.getSelectedElements().map((el) => el.id)).toEqual([rect2.id]);

    // Switch back to Page 1
    act(() => {
      h.app.switchPage(DEFAULT_PAGE_ID);
    });
    expect(h.app.scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      rect1.id,
    ]);

    // Clicking at rect2's coordinates while on Page 1 does NOT select rect2
    mouse.clickAt(250, 250);
    expect(API.getSelectedElements()).toHaveLength(0);

    // Clicking at rect1's coordinates on Page 1 selects rect1
    mouse.clickAt(10, 50);
    expect(API.getSelectedElements().map((el) => el.id)).toEqual([rect1.id]);

    // Select All on Page 1 selects ONLY rect1
    act(() => {
      h.app.actionManager.executeAction(actionSelectAll);
    });
    expect(API.getSelectedElements().map((el) => el.id)).toEqual([rect1.id]);
  });

  it("scopes undo and redo to the active page", () => {
    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);

    // Draw rect1 on Page 1
    const rect1 = UI.createElement("rectangle", {
      x: 10,
      y: 10,
      width: 80,
      height: 80,
    });
    expect(h.app.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      rect1.id,
    ]);

    // Create Page 2 and draw rect2 on Page 2
    let page2Id = "";
    act(() => {
      page2Id = h.app.createPage("Page 2").id;
    });
    const rect2 = UI.createElement("rectangle", {
      x: 50,
      y: 50,
      width: 80,
      height: 80,
    });
    expect(h.app.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      rect2.id,
    ]);

    // Undo on Page 2 removes rect2
    act(() => {
      h.app.actionManager.executeAction(undoAction);
    });
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);

    // Second Undo on Page 2 does NOT touch Page 1's rect1
    act(() => {
      h.app.actionManager.executeAction(undoAction);
    });
    expect(h.app.scene.getAllNonDeletedElements().map((e) => e.id)).toEqual([
      rect1.id,
    ]);

    // Redo on Page 2 restores rect2
    act(() => {
      h.app.actionManager.executeAction(redoAction);
    });
    expect(h.app.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      rect2.id,
    ]);

    // Switch back to Page 1 -> Undo removes rect1 while leaving rect2 intact
    act(() => {
      h.app.switchPage(DEFAULT_PAGE_ID);
    });
    expect(h.app.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      rect1.id,
    ]);

    act(() => {
      h.app.actionManager.executeAction(undoAction);
    });
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);

    // Page 2 still has rect2
    act(() => {
      h.app.switchPage(page2Id);
    });
    expect(h.app.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      rect2.id,
    ]);
  });

  it("exports only the active page's elements", async () => {
    const text1 = newTextElement({
      x: 10,
      y: 10,
      text: "PageOneLabel",
    });
    act(() => {
      h.app.insertNewElement(text1);
    });

    let page2Id = "";
    act(() => {
      page2Id = h.app.createPage("Page 2").id;
    });
    const text2 = newTextElement({
      x: 10,
      y: 10,
      text: "PageTwoLabel",
    });
    act(() => {
      h.app.insertNewElement(text2);
    });

    const allElements = h.app.scene.getAllNonDeletedElements();

    // Active page is Page 2 -> prepareElementsForExport returns only text2
    const page2Prepared = prepareElementsForExport(allElements, h.state, false);
    expect(page2Prepared.exportedElements.map((el) => el.id)).toEqual([
      text2.id,
    ]);

    // exportScene("svg") on Page 2 contains PageTwoLabel and not PageOneLabel
    const svgPage2 = await exportScene({
      type: "svg",
      data: {
        elements: allElements,
        appState: h.state,
        files: {},
      },
    });
    expect(svgPage2.outerHTML).toContain("PageTwoLabel");
    expect(svgPage2.outerHTML).not.toContain("PageOneLabel");

    // Switch to Page 1 -> export contains only text1
    act(() => {
      h.app.switchPage(DEFAULT_PAGE_ID);
    });
    const page1Prepared = prepareElementsForExport(allElements, h.state, false);
    expect(page1Prepared.exportedElements.map((el) => el.id)).toEqual([
      text1.id,
    ]);

    const svgPage1 = await exportScene({
      type: "svg",
      data: {
        elements: allElements,
        appState: h.state,
        files: {},
      },
    });
    expect(svgPage1.outerHTML).toContain("PageOneLabel");
    expect(svgPage1.outerHTML).not.toContain("PageTwoLabel");
    expect(page2Id).toBeTruthy();
  });

  it("places new frames and library inserts onto the active page", () => {
    let page2Id = "";
    act(() => {
      page2Id = h.app.createPage("Page 2").id;
    });

    // Create a frame on Page 2
    act(() => {
      h.app.setActiveTool({ type: "frame" });
    });
    mouse.downAt(10, 10);
    mouse.moveTo(210, 160);
    mouse.up();
    const frame = h.app.scene.getNonDeletedFramesLikes()[0];
    expect(frame).toBeDefined();
    expect(frame.pageId).toBe(page2Id);

    // Insert a library element while on Page 2
    const libraryRect = API.createElement({
      type: "rectangle",
      id: "lib-rect-1",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
    act(() => {
      h.app.onInsertElements([libraryRect]);
    });

    // Both frame and library insert are on Page 2
    const page2Elements = h.app.scene.getNonDeletedElements();
    expect(page2Elements).toHaveLength(2);
    expect(page2Elements.every((el) => el.pageId === page2Id)).toBe(true);

    // Page 1 remains empty
    act(() => {
      h.app.switchPage(DEFAULT_PAGE_ID);
    });
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);
  });

  it("serializes all pages to JSON and restores legacy files onto one default page", () => {
    // Create multi-page scene
    const rect1 = UI.createElement("rectangle", {
      x: 10,
      y: 10,
      width: 50,
      height: 50,
    });
    let page2Id = "";
    act(() => {
      page2Id = h.app.createPage("Data pipeline").id;
    });
    const rect2 = UI.createElement("rectangle", {
      x: 20,
      y: 20,
      width: 60,
      height: 60,
    });

    // Serialize whole drawing to JSON
    const serialized = serializeAsJSON(
      h.app.scene.getElementsIncludingDeleted(),
      h.state,
      {},
      "local",
    );
    const parsed = JSON.parse(serialized);
    expect(parsed.appState.pages).toHaveLength(2);
    expect(parsed.appState.pages[1].name).toBe("Data pipeline");
    expect(parsed.appState.activePageId).toBe(page2Id);
    expect(parsed.elements.map((e: any) => e.id)).toEqual([rect1.id, rect2.id]);
    expect(parsed.elements[1].pageId).toBe(page2Id);

    // Restore serialized multi-page file
    const restoredMultiAppState = restoreAppState(parsed.appState, null);
    const restoredMultiElements = restoreElements(parsed.elements, null);
    expect(restoredMultiAppState.pages).toHaveLength(2);
    expect(restoredMultiAppState.activePageId).toBe(page2Id);
    expect(restoredMultiElements[1].pageId).toBe(page2Id);

    // Restore a legacy file (no pages, no activePageId, no pageId on elements)
    // even when localAppState currently has 2 pages
    const legacyElement = API.createElement({
      type: "rectangle",
      id: "legacy-rect",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const legacyAppState = restoreAppState(
      { viewBackgroundColor: "#ffffff" },
      h.state,
    );
    const legacyElements = restoreElements([legacyElement], null);

    expect(legacyAppState.pages).toHaveLength(1);
    expect(legacyAppState.pages[0].id).toBe(DEFAULT_PAGE_ID);
    expect(legacyAppState.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(legacyElements).toHaveLength(1);
    expect(legacyElements[0].pageId).toBeUndefined();

    // Load legacy file into scene and verify it appears on the single default page
    API.updateScene({
      elements: legacyElements,
      appState: legacyAppState,
    });
    expect(h.state.pages).toHaveLength(1);
    expect(h.app.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      "legacy-rect",
    ]);
  });

  it("searches across all pages and switches to the matching result's page", async () => {
    // Add text on Page 1
    act(() => {
      h.app.insertNewElement(
        newTextElement({
          x: 10,
          y: 10,
          text: "AlphaOnPageOne",
        }),
      );
    });

    // Create Page 2 and add text on Page 2
    let page2Id = "";
    act(() => {
      page2Id = h.app.createPage("Data pipeline").id;
    });
    act(() => {
      h.app.insertNewElement(
        newTextElement({
          x: 50,
          y: 50,
          text: "BetaOnPageTwo",
        }),
      );
    });

    // Switch back to Page 1
    act(() => {
      h.app.switchPage(DEFAULT_PAGE_ID);
    });
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

    // Open Search sidebar
    act(() => {
      h.app.toggleSidebar({
        name: DEFAULT_SIDEBAR.name,
        tab: CANVAS_SEARCH_TAB,
      });
    });

    const searchInput = await waitFor(() => {
      const input = document.querySelector(
        `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
      ) as HTMLInputElement | null;
      expect(input).not.toBeNull();
      return input!;
    });

    // Search for text on Page 2
    fireEvent.change(searchInput, { target: { value: "BetaOnPageTwo" } });

    const resultItem = await waitFor(() => {
      const item = document.querySelector(
        ".layer-ui__result-item",
      ) as HTMLElement | null;
      expect(item).not.toBeNull();
      return item!;
    });

    expect(resultItem.textContent).toContain("BetaOnPageTwo");
    expect(resultItem.textContent).toContain("Data pipeline");

    // Click the result -> switches active page to Page 2
    fireEvent.click(resultItem);
    expect(h.state.activePageId).toBe(page2Id);
  });
});
