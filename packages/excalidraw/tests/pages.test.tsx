import React from "react";
import { vi } from "vitest";

import {
  CANVAS_SEARCH_TAB,
  CLASSES,
  DEFAULT_PAGE_ID,
  DEFAULT_SIDEBAR,
  KEYS,
} from "@excalidraw/common";
import {
  CaptureUpdateAction,
  getLivePages,
  reconcilePages,
} from "@excalidraw/element";

import type { ExcalidrawElement, Page } from "@excalidraw/element/types";

import {
  actionCreatePage,
  actionDeletePage,
  actionMovePage,
  actionMovePageLeft,
  actionMovePageRight,
  actionRenamePage,
  actionSelectAll,
  actionSwitchPage,
} from "../actions";
import { loadFromBlob } from "../data/blob";
import { restoreAppState } from "../data/restore";
import { serializeAsJSON } from "../data/json";
import { prepareElementsForExport } from "../data";
import { Excalidraw } from "../index";
import * as StaticScene from "../renderer/staticScene";
import { decodeSvgBase64Payload, exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { updateTextEditor } from "./queries/dom";
import { act, fireEvent, render, waitFor } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

const run = <T,>(
  action: Parameters<typeof h.app.actionManager.executeAction>[0],
  value?: T,
) => {
  act(() => {
    h.app.actionManager.executeAction(action, "api", value);
  });
};

const pagesOf = () => getLivePages(h.state.pages);

/** restores a file the way opening it does */
const restoreFile = (data: Record<string, unknown>) =>
  loadFromBlob(
    new Blob([JSON.stringify({ type: "excalidraw", version: 2, ...data })], {
      type: "application/json",
    }),
    null,
    null,
  );

const makeRect = (id: string, x: number, pageId?: string) => ({
  ...API.createElement({
    type: "rectangle",
    id,
    x,
    y: x,
    width: 100,
    height: 100,
    backgroundColor: "red",
    fillStyle: "solid",
  }),
  ...(pageId ? { pageId } : {}),
});

const visibleIds = () =>
  renderStaticScene.mock.lastCall![0].visibleElements.map((el) => el.id);

/** ids of the elements handed to the static canvas renderer */
const renderedIds = () => [
  ...renderStaticScene.mock.lastCall![0].elementsMap.keys(),
];

const nonDeletedIds = () =>
  h.app.scene.getNonDeletedElements().map((el) => el.id);

const isDeleted = (id: string) =>
  h.elements.find((el) => el.id === id)!.isDeleted;

describe("pages", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderStaticScene.mockClear();
    await render(<Excalidraw handleKeyboardGlobally />);
  });

  describe("create / switch / rename / reorder / delete", () => {
    it("starts with a single default page", () => {
      expect(pagesOf()).toHaveLength(1);
      expect(pagesOf()[0]).toEqual(
        expect.objectContaining({ id: DEFAULT_PAGE_ID, name: "Page 1" }),
      );
      expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
      expect(
        document.querySelector('[data-testid="page-tabs"]'),
      ).not.toBeNull();
    });

    it("creates a page via the tab bar and switches to it", () => {
      fireEvent.click(document.querySelector('[data-testid="page-tabs-add"]')!);
      expect(pagesOf().map((p) => p.name)).toEqual(["Page 1", "Page 2"]);
      expect(h.state.activePageId).toBe(pagesOf()[1].id);
      expect(h.app.getActivePageId()).toBe(pagesOf()[1].id);
      expect(h.app.scene.getActivePageId()).toBe(pagesOf()[1].id);
    });

    it("switches pages by clicking the tabs and keeps per-page viewports", () => {
      API.setAppState({ scrollX: 50, scrollY: 60, zoom: { value: 2 as any } });
      run(actionCreatePage);
      const pageB = h.state.activePageId;

      // never visited page gets a default viewport
      expect(h.state.scrollX).toBe(0);
      expect(h.state.zoom.value).toBe(1);

      API.setAppState({ scrollX: -10, scrollY: -20 });

      fireEvent.click(
        document.querySelector(`[data-testid="page-tab-${DEFAULT_PAGE_ID}"]`)!,
      );
      expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
      expect(h.state.scrollX).toBe(50);
      expect(h.state.scrollY).toBe(60);
      expect(h.state.zoom.value).toBe(2);

      act(() => h.app.setActivePage(pageB));
      expect(h.state.activePageId).toBe(pageB);
      expect(h.state.scrollX).toBe(-10);
      expect(h.state.scrollY).toBe(-20);
      expect(h.state.zoom.value).toBe(1);
    });

    it("renames a page with a double click", () => {
      fireEvent.doubleClick(
        document.querySelector(`[data-testid="page-tab-${DEFAULT_PAGE_ID}"]`)!,
      );
      const input = document.querySelector<HTMLInputElement>(
        `[data-testid="page-tab-input-${DEFAULT_PAGE_ID}"]`,
      )!;
      expect(input).not.toBeNull();
      fireEvent.change(input, { target: { value: "SDK flow" } });
      fireEvent.keyDown(input, { key: "Enter" });

      const page = pagesOf()[0];
      expect(page.name).toBe("SDK flow");
      expect(page.version).toBe(2);
      expect(
        document.querySelector(`[data-testid="page-tab-${DEFAULT_PAGE_ID}"]`)
          ?.textContent,
      ).toBe("SDK flow");
    });

    it("bumps version and versionNonce on every metadata edit", () => {
      run(actionCreatePage);
      const id = h.state.activePageId;
      const before = h.state.pages.find((p) => p.id === id)!;
      run(actionRenamePage, { id, name: "Data pipeline" });
      const after = h.state.pages.find((p) => p.id === id)!;
      expect(after.name).toBe("Data pipeline");
      expect(after.version).toBe(before.version + 1);
      expect(after.versionNonce).not.toBe(before.versionNonce);
    });

    it("reorders pages with the move actions, the menu and drag & drop", () => {
      run(actionCreatePage);
      run(actionCreatePage);
      const [a, b, c] = pagesOf().map((p) => p.id);

      run(actionMovePageLeft, { id: c });
      expect(pagesOf().map((p) => p.id)).toEqual([a, c, b]);

      run(actionMovePageRight, { id: a });
      expect(pagesOf().map((p) => p.id)).toEqual([c, a, b]);

      run(actionMovePage, { id: b, to: 0 });
      expect(pagesOf().map((p) => p.id)).toEqual([b, c, a]);

      // first page can't move further left
      run(actionMovePageLeft, { id: b });
      expect(pagesOf().map((p) => p.id)).toEqual([b, c, a]);

      // per-tab menu
      fireEvent.click(
        document.querySelector(`[data-testid="page-tab-menu-${a}"]`)!,
      );
      fireEvent.click(
        [...document.querySelectorAll('[role="menuitem"]')].find(
          (el) => el.textContent === "Move left",
        )!,
      );
      expect(pagesOf().map((p) => p.id)).toEqual([b, a, c]);

      // drag & drop
      const tabOf = (id: string) =>
        document.querySelector(`[data-testid="page-tab-${id}"]`)!
          .parentElement!;
      fireEvent.dragStart(tabOf(c));
      fireEvent.dragOver(tabOf(b));
      fireEvent.drop(tabOf(b));
      expect(pagesOf().map((p) => p.id)).toEqual([c, b, a]);
    });

    it("deletes a page: elements are deleted, page tombstoned, not undoable", () => {
      API.updateScene({
        elements: [makeRect("a1", 0)],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      run(actionCreatePage);
      const pageB = h.state.activePageId;
      API.updateScene({
        elements: [...h.elements, makeRect("b1", 300, pageB)],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      run(actionDeletePage, { id: pageB });
      // declined
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(pagesOf()).toHaveLength(2);
      expect(isDeleted("b1")).toBe(false);

      confirm.mockReturnValue(true);
      const versionBefore = h.state.pages.find((p) => p.id === pageB)!.version;
      run(actionDeletePage, { id: pageB });
      expect(pagesOf()).toHaveLength(1);
      const tombstone = h.state.pages.find((p) => p.id === pageB)!;
      expect(tombstone.isDeleted).toBe(true);
      expect(tombstone.version).toBe(versionBefore + 1);
      confirm.mockRestore();
      expect(isDeleted("b1")).toBe(true);
      expect(isDeleted("a1")).toBe(false);
      // falls back to the remaining page
      expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

      // undo can't bring the deleted page's elements back
      Keyboard.undo();
      expect(isDeleted("b1")).toBe(true);
      expect(pagesOf()).toHaveLength(1);
    });

    it("doesn't ask for confirmation for an empty page and keeps the last page", () => {
      const confirm = vi.spyOn(window, "confirm");
      run(actionCreatePage);
      const pageB = h.state.activePageId;
      run(actionDeletePage, { id: pageB });
      expect(confirm).not.toHaveBeenCalled();
      confirm.mockRestore();
      expect(pagesOf()).toHaveLength(1);

      // the last remaining page can't be deleted
      run(actionDeletePage, { id: DEFAULT_PAGE_ID });
      expect(pagesOf()).toHaveLength(1);
      expect(
        h.state.pages.find((p) => p.id === DEFAULT_PAGE_ID)!.isDeleted,
      ).toBe(false);
    });

    it("exposes pages on the imperative API and via updateScene", () => {
      const api = h.app.api;
      expect(api.getPages().map((p) => p.name)).toEqual(["Page 1"]);
      run(actionCreatePage);
      const pageB = api.getActivePageId();
      expect(api.getPages()).toHaveLength(2);

      act(() => api.setActivePage(DEFAULT_PAGE_ID));
      expect(api.getActivePageId()).toBe(DEFAULT_PAGE_ID);

      act(() => {
        api.updateScene({
          appState: {
            pages: h.state.pages.map((p) =>
              p.id === pageB
                ? { ...p, name: "From API", version: p.version + 1 }
                : p,
            ),
          },
        });
      });
      expect(api.getPages().find((p) => p.id === pageB)!.name).toBe("From API");
    });

    it("hides the tab bar in zen mode and disables editing in view mode", () => {
      API.setAppState({ viewModeEnabled: true });
      expect(
        document.querySelector('[data-testid="page-tabs-add"]'),
      ).toBeNull();
      expect(
        document.querySelector(`[data-testid="page-tab-${DEFAULT_PAGE_ID}"]`),
      ).not.toBeNull();
      API.setAppState({ viewModeEnabled: false, zenModeEnabled: true });
      expect(document.querySelector('[data-testid="page-tabs"]')).toBeNull();
    });
  });

  describe("scene filtering", () => {
    let pageB: string;

    beforeEach(() => {
      run(actionCreatePage);
      pageB = h.state.activePageId;
      run(actionSwitchPage, { id: DEFAULT_PAGE_ID });
      API.setElements([
        makeRect("a1", 0),
        makeRect("a2", 150),
        makeRect("b1", 20, pageB),
      ]);
    });

    it("only renders the active page's elements", () => {
      expect(nonDeletedIds()).toEqual(["a1", "a2"]);
      expect(renderedIds()).toEqual(["a1", "a2"]);
      expect(visibleIds()).toContain("a1");
      expect(visibleIds()).not.toContain("b1");
      // all pages are still in the scene for sync & serialization
      expect(h.elements.map((el) => el.id)).toEqual(["a1", "a2", "b1"]);

      run(actionSwitchPage, { id: pageB });
      expect(nonDeletedIds()).toEqual(["b1"]);
      expect(renderedIds()).toEqual(["b1"]);
      expect(visibleIds()).not.toContain("a1");
      expect(h.app.getSceneElements().map((el) => el.id)).toEqual(["b1"]);
      expect(h.app.getSceneElementsIncludingDeleted()).toHaveLength(3);
    });

    it("treats elements of unknown pages as belonging to the first page", () => {
      API.setElements([...h.elements, makeRect("orphan", 300, "gone")]);
      expect(nonDeletedIds()).toContain("orphan");
      run(actionSwitchPage, { id: pageB });
      expect(nonDeletedIds()).not.toContain("orphan");
    });

    it("only hit-tests and selects elements of the active page", () => {
      // a2 is at 150,150 .. 250,250 on the default page
      mouse.reset();
      mouse.clickAt(200, 200);
      expect(Object.keys(h.state.selectedElementIds)).toEqual(["a2"]);

      run(actionSwitchPage, { id: pageB });
      // switching clears the selection
      expect(h.state.selectedElementIds).toEqual({});

      // the same spot hits nothing on page B...
      mouse.clickAt(200, 200);
      expect(h.state.selectedElementIds).toEqual({});
      // ...b1 is selectable
      mouse.clickAt(70, 70);
      expect(Object.keys(h.state.selectedElementIds)).toEqual(["b1"]);
    });

    it("select-all only selects the active page's elements", () => {
      run(actionSelectAll);
      expect(Object.keys(h.state.selectedElementIds).sort()).toEqual([
        "a1",
        "a2",
      ]);
      run(actionSwitchPage, { id: pageB });
      run(actionSelectAll);
      expect(Object.keys(h.state.selectedElementIds)).toEqual(["b1"]);
    });

    it("deleting the selection leaves other pages untouched", () => {
      run(actionSelectAll);
      Keyboard.keyPress(KEYS.DELETE);
      expect(isDeleted("a1")).toBe(true);
      expect(isDeleted("a2")).toBe(true);
      expect(isDeleted("b1")).toBe(false);
      expect(h.elements.map((el) => el.id)).toEqual(["a1", "a2", "b1"]);
    });

    it("stamps new elements with the active page", () => {
      run(actionSwitchPage, { id: pageB });
      // draw a rectangle on page B
      UI.clickTool("rectangle");
      mouse.reset();
      mouse.down(600, 100);
      mouse.up(50, 50);
      const created = h.elements.find(
        (el) => !["a1", "a2", "b1"].includes(el.id),
      )!;
      expect(created.pageId).toBe(pageB);
      expect(nonDeletedIds()).toContain(created.id);

      run(actionSwitchPage, { id: DEFAULT_PAGE_ID });
      expect(nonDeletedIds()).not.toContain(created.id);
    });
  });

  describe("history", () => {
    it("keeps undo / redo on the page the change was made on", () => {
      API.updateScene({
        elements: [makeRect("a1", 0)],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      run(actionCreatePage);
      const pageB = h.state.activePageId;
      // switching pages isn't captured
      expect(h.history.isUndoStackEmpty).toBe(true);

      API.updateScene({
        elements: [...h.elements, makeRect("b1", 0, pageB)],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      API.updateScene({
        elements: [...h.elements, makeRect("b2", 200, pageB)],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      Keyboard.undo();
      expect(isDeleted("b2")).toBe(true);
      expect(isDeleted("b1")).toBe(false);
      expect(isDeleted("a1")).toBe(false);

      // page A's stack only holds A's change
      run(actionSwitchPage, { id: DEFAULT_PAGE_ID });
      Keyboard.undo();
      expect(isDeleted("a1")).toBe(true);
      expect(isDeleted("b1")).toBe(false);
      // nothing left to undo on A, B isn't touched
      Keyboard.undo();
      expect(isDeleted("b1")).toBe(false);

      Keyboard.redo();
      expect(isDeleted("a1")).toBe(false);
      expect(isDeleted("b2")).toBe(true);

      // B's own stacks were preserved while away
      run(actionSwitchPage, { id: pageB });
      Keyboard.redo();
      expect(isDeleted("b2")).toBe(false);
      Keyboard.undo();
      Keyboard.undo();
      expect(isDeleted("b1")).toBe(true);
      expect(isDeleted("a1")).toBe(false);
    });
  });

  describe("export", () => {
    it("exports only the active page's elements", async () => {
      run(actionCreatePage);
      const pageB = h.state.activePageId;
      API.setElements([makeRect("a1", 0), makeRect("b1", 300, pageB)]);

      const exportedIdsOfActivePage = async () => {
        const { exportedElements } = prepareElementsForExport(
          h.app.scene.getNonDeletedElements(),
          h.state,
          false,
        );
        const svg = await exportScene({
          type: "svg",
          data: { elements: exportedElements, appState: h.state, files: {} },
          config: { embedScene: true },
        });
        const metadata = svg.querySelector("metadata")!;
        const payload = JSON.parse(
          decodeSvgBase64Payload({ svg: metadata.innerHTML }),
        );
        return (payload.elements as ExcalidrawElement[]).map((el) => el.id);
      };

      expect(await exportedIdsOfActivePage()).toEqual(["b1"]);
      run(actionSwitchPage, { id: DEFAULT_PAGE_ID });
      expect(await exportedIdsOfActivePage()).toEqual(["a1"]);
    });

    it("saves all pages into a single file and round-trips them", async () => {
      run(actionRenamePage, { id: DEFAULT_PAGE_ID, name: "SDK flow" });
      run(actionCreatePage);
      const pageB = h.state.activePageId;
      run(actionRenamePage, { id: pageB, name: "Data pipeline" });
      API.setElements([makeRect("a1", 0), makeRect("b1", 300, pageB)]);

      const json = serializeAsJSON(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        {},
        "local",
      );
      const parsed = JSON.parse(json);
      expect(parsed.elements.map((el: ExcalidrawElement) => el.id)).toEqual([
        "a1",
        "b1",
      ]);
      expect(parsed.appState.pages.map((p: Page) => p.name)).toEqual([
        "SDK flow",
        "Data pipeline",
      ]);
      expect(parsed.appState.activePageId).toBe(pageB);

      const restored = await restoreFile(parsed);
      expect(getLivePages(restored.appState.pages).map((p) => p.name)).toEqual([
        "SDK flow",
        "Data pipeline",
      ]);
      expect(restored.appState.activePageId).toBe(pageB);
      expect(restored.elements.find((el) => el.id === "b1")!.pageId).toBe(
        pageB,
      );
      expect(restored.elements.find((el) => el.id === "a1")!.pageId).toBe(
        undefined,
      );
    });
  });

  describe("restore", () => {
    it("puts legacy files (no pages, no pageId) onto exactly one page", async () => {
      const legacy = await restoreFile({
        elements: [
          API.createElement({ id: "l1" }),
          API.createElement({ id: "l2", x: 300 }),
        ],
        appState: { viewBackgroundColor: "#fff" },
      });
      expect(legacy.appState.pages).toHaveLength(1);
      expect(legacy.appState.pages[0]).toEqual(
        expect.objectContaining({
          id: DEFAULT_PAGE_ID,
          name: "Page 1",
          isDeleted: false,
        }),
      );
      expect(legacy.appState.activePageId).toBe(DEFAULT_PAGE_ID);
      expect(legacy.elements.every((el) => el.pageId === undefined)).toBe(true);
    });

    it("renders a legacy file on its single page", async () => {
      const legacy = await restoreFile({
        elements: [API.createElement({ id: "l1" })],
        appState: {},
      });
      API.updateScene({
        elements: legacy.elements,
        appState: legacy.appState,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      expect(pagesOf()).toHaveLength(1);
      expect(nonDeletedIds()).toEqual(["l1"]);
    });

    it("falls back to the first page for an invalid activePageId", () => {
      const state = restoreAppState(
        {
          pages: [
            {
              id: "p1",
              name: "One",
              index: "a0",
              version: 1,
              versionNonce: 1,
              isDeleted: false,
            },
            {
              id: "p2",
              name: "Two",
              index: "a1",
              version: 1,
              versionNonce: 1,
              isDeleted: false,
            },
          ],
          activePageId: "nope",
        } as any,
        null,
      );
      expect(state.activePageId).toBe("p1");
      expect(state.pages).toHaveLength(2);
    });

    it("loads initialData with pages", async () => {
      const { unmount } = await render(
        <Excalidraw
          initialData={{
            elements: [
              makeRect("x1", 0) as any,
              makeRect("x2", 0, "p2") as any,
            ],
            appState: {
              pages: [
                {
                  id: "p1",
                  name: "One",
                  index: "a0",
                  version: 1,
                  versionNonce: 1,
                  isDeleted: false,
                },
                {
                  id: "p2",
                  name: "Two",
                  index: "a1",
                  version: 1,
                  versionNonce: 1,
                  isDeleted: false,
                },
              ],
              activePageId: "p2",
            } as any,
          }}
        />,
      );
      await waitFor(() => expect(h.state.activePageId).toBe("p2"));
      expect(nonDeletedIds()).toEqual(["x2"]);
      unmount?.();
    });
  });

  describe("search", () => {
    it("finds text on other pages and switches to the page on selection", async () => {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
      run(actionCreatePage);
      const pageB = h.state.activePageId;
      run(actionRenamePage, { id: pageB, name: "Data pipeline" });
      run(actionSwitchPage, { id: DEFAULT_PAGE_ID });
      API.setElements([
        API.createElement({ type: "text", id: "t-a", text: "needle on A" }),
        {
          ...API.createElement({
            type: "text",
            id: "t-b",
            text: "needle on B",
            x: 500,
          }),
          pageId: pageB,
        },
      ]);

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.F);
      });
      expect(h.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
      expect(h.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

      const input =
        h.app.excalidrawContainerValue.container!.querySelector<HTMLInputElement>(
          `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
        )!;
      updateTextEditor(input, "needle");

      await waitFor(() => {
        expect(h.state.searchMatches?.matches.map((m) => m.id).sort()).toEqual([
          "t-a",
          "t-b",
        ]);
      });
      // only the match on another page shows the page name
      await waitFor(() => {
        const names = [
          ...document.querySelectorAll('[data-testid="search-result-page"]'),
        ].map((el) => el.textContent);
        expect(names).toEqual(["Data pipeline"]);
      });
      expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

      // selecting the result on the other page switches to it
      const items = document.querySelectorAll(".layer-ui__result-item");
      expect(items).toHaveLength(2);
      fireEvent.click(items[1]);
      await waitFor(() => expect(h.state.activePageId).toBe(pageB));
      expect(nonDeletedIds()).toEqual(["t-b"]);
    });
  });

  describe("reconcilePages", () => {
    const page = (
      id: string,
      version: number,
      versionNonce: number,
      extra: Partial<Page> = {},
    ): Page => ({
      id,
      name: id,
      index: "a0" as Page["index"],
      version,
      versionNonce,
      isDeleted: false,
      ...extra,
    });

    it("keeps the higher version, breaking ties by the lower versionNonce", () => {
      const result = reconcilePages(
        [
          page("a", 2, 5, { name: "local-a" }),
          page("b", 1, 9, { name: "local-b" }),
          page("c", 1, 1),
        ],
        [
          page("a", 3, 1, { name: "remote-a" }),
          page("b", 1, 3, { name: "remote-b" }),
          page("d", 1, 1),
        ],
      );
      const byId = Object.fromEntries(result.map((p) => [p.id, p]));
      expect(byId.a.name).toBe("remote-a");
      expect(byId.b.name).toBe("remote-b");
      expect(byId.c).toBeDefined();
      expect(byId.d).toBeDefined();

      // local wins with the higher version
      const local = reconcilePages(
        [page("a", 4, 5, { name: "local-a" })],
        [page("a", 3, 1, { name: "remote-a" })],
      );
      expect(local[0].name).toBe("local-a");
    });

    it("keeps tombstones and is commutative", () => {
      const local = [page("a", 2, 1, { isDeleted: true })];
      const remote = [page("a", 1, 1)];
      const ab = reconcilePages(local, remote);
      const ba = reconcilePages(remote, local);
      expect(ab).toEqual(ba);
      expect(ab[0].isDeleted).toBe(true);
    });
  });
});
