import React from "react";
import { vi } from "vitest";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { FractionalIndex } from "@excalidraw/element/types";

import { actionClearCanvas } from "../actions/actionCanvas";
import { actionDeleteSelected } from "../actions/actionDeleteSelected";
import { actionSelectAll } from "../actions/actionSelectAll";
import { createPasteEvent, serializeAsClipboardJSON } from "../clipboard";
import { serializeAsJSON } from "../data/json";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  render,
  screen,
  waitFor,
} from "./test-utils";

import type { NormalizedZoomValue } from "../types";

const { h } = window;

const api = () => h.app.api;

const tabBar = () => screen.getByTestId("page-tabs");

const tabs = () =>
  Array.from(tabBar().querySelectorAll<HTMLElement>('[role="tab"]'));

const tabIds = () =>
  tabs().map((tab) => tab.dataset.testid!.replace("page-tab-", ""));

const tab = (pageId: string) => screen.getByTestId(`page-tab-${pageId}`);

const pageNames = () => h.state.pages.map((page) => page.name);

const livePageIds = () =>
  h.state.pages.filter((page) => !page.isDeleted).map((page) => page.id);

const renameInput = () => tabBar().querySelector("input");

const createPage = (opts?: { name?: string; activate?: boolean }) => {
  let id = "";
  act(() => {
    id = h.app.pages.createPage(opts).id;
  });
  return id;
};

const switchTo = (pageId: string) => {
  act(() => {
    h.app.pages.setActivePage(pageId);
  });
};

const commitElement = (
  element: ReturnType<typeof API.createElement>,
  rest: readonly ReturnType<typeof API.createElement>[] = [],
) => {
  API.updateScene({
    elements: [...rest, element],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
};

const openRename = (pageId: string) => {
  fireEvent.doubleClick(tab(pageId));
  return renameInput() as HTMLInputElement;
};

const openMenu = (pageId: string) => {
  const trigger = tabBar().querySelector<HTMLElement>(
    `[data-testid="page-tab-menu-${pageId}"]`,
  );
  if (trigger) {
    fireEvent.click(trigger);
  } else {
    fireEvent.contextMenu(tab(pageId));
  }
};

const menuItem = (pageId: string, item: string) => {
  const open = screen.queryByRole("menu");
  if (open) {
    fireEvent.keyDown(open, { key: "Escape" });
  }
  openMenu(pageId);
  return screen.getByTestId(item) as HTMLButtonElement;
};

const savedPageOrder = () => {
  const { appState } = JSON.parse(
    serializeAsJSON(
      api().getAllPagesElementsIncludingDeleted(),
      h.state,
      {},
      "local",
    ),
  );
  return [...appState.pages]
    .sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0))
    .map((page) => page.id);
};

const pageRecord = (id: string, name: string, index: string) => ({
  id,
  name,
  index: index as FractionalIndex,
  version: 1,
  versionNonce: 0,
  isDeleted: false,
  updated: 1,
});

const pagesData = () => {
  const pages = [
    pageRecord("default", "Page 1", "a0"),
    pageRecord("pg2", "Two", "a1"),
  ];
  const elements = [
    API.createElement({ id: "A" }),
    { ...API.createElement({ id: "B" }), pageId: "pg2" },
  ];
  return { pages, elements };
};

const twoPagesWithElements = () => {
  const first = API.createElement({ id: "A", x: 0, y: 0 });
  API.setElements([first]);
  const second = createPage({ activate: true });
  const other = API.createElement({ id: "B", x: 500, y: 500 });
  API.setElements([other]);
  return { second };
};

describe("pages (tab bar)", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("starts with one tab", () => {
    expect(tabIds()).toEqual(["default"]);
    expect(tab("default").getAttribute("aria-selected")).toBe("true");
  });

  it("create", () => {
    fireEvent.click(screen.getByTestId("page-tab-add"));

    expect(tabIds().length).toBe(2);
    expect(tabIds()[0]).toBe("default");
    expect(tabs()[1].textContent).toContain("Page 2");
    expect(h.state.activePageId).toBe(tabIds()[1]);
    expect(tabs()[1].getAttribute("aria-selected")).toBe("true");
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);
    expect(h.state.zoom.value).toBe(1);
  });

  it("switch", () => {
    const { second } = twoPagesWithElements();

    fireEvent.click(tab("default"));
    expect(h.state.activePageId).toBe("default");
    expect(h.elements.map((el) => el.id)).toEqual(["A"]);

    fireEvent.click(tab(second));
    expect(h.state.activePageId).toBe(second);
    expect(h.elements.map((el) => el.id)).toEqual(["B"]);
  });

  it("rename commits", () => {
    let input = openRename("default");
    fireEvent.change(input, { target: { value: "Intro" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(pageNames()).toEqual(["Intro"]);

    input = openRename("default");
    fireEvent.change(input, { target: { value: "Outro" } });
    fireEvent.blur(input);
    expect(pageNames()).toEqual(["Outro"]);
  });

  it("rename cancels", () => {
    const input = openRename("default");
    fireEvent.change(input, { target: { value: "Nope" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);

    expect(renameInput()).toBe(null);
    expect(pageNames()).toEqual(["Page 1"]);
  });

  it("empty name keeps the old name", () => {
    const input = openRename("default");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(pageNames()).toEqual(["Page 1"]);
  });

  it("delete an empty page", () => {
    const second = createPage({ activate: true });

    fireEvent.click(menuItem(second, "page-menu-delete"));

    expect(document.querySelector(".confirm-dialog")).toBe(null);
    expect(livePageIds()).toEqual(["default"]);
    expect(h.state.activePageId).toBe("default");
  });

  it("delete asks with elements", () => {
    const { second } = twoPagesWithElements();

    fireEvent.click(menuItem(second, "page-menu-delete"));
    expect(document.querySelector(".confirm-dialog")).not.toBe(null);

    const buttons = () =>
      document.querySelectorAll<HTMLElement>(".confirm-dialog-buttons button");
    fireEvent.click(buttons()[0]);
    expect(document.querySelector(".confirm-dialog")).toBe(null);
    expect(livePageIds()).toEqual(["default", second]);

    fireEvent.click(menuItem(second, "page-menu-delete"));
    fireEvent.click(buttons()[1]);

    expect(livePageIds()).toEqual(["default"]);
    const deleted = api()
      .getAllPagesElementsIncludingDeleted()
      .find((el) => el.id === "B");
    expect(deleted?.isDeleted).toBe(true);
  });

  it("last page stays", () => {
    expect(menuItem("default", "page-menu-delete").disabled).toBe(true);

    let result = true;
    act(() => {
      result = h.app.pages.deletePage("default");
    });
    expect(result).toBe(false);
    expect(livePageIds()).toEqual(["default"]);
  });

  it("reorder by drag", () => {
    const second = createPage();
    const third = createPage();
    const store = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      types: [] as string[],
      setData: (type: string, value: string) => store.set(type, value),
      getData: (type: string) => store.get(type) ?? "",
    };

    fireEvent.dragStart(tab(third), { dataTransfer });
    fireEvent.dragOver(tab("default"), { dataTransfer });
    fireEvent.drop(tab("default"), { dataTransfer });

    expect(tabIds()).toEqual([third, "default", second]);
    expect(savedPageOrder()).toEqual([third, "default", second]);
  });

  it("reorder by menu", () => {
    const second = createPage();

    expect(menuItem("default", "page-menu-move-left").disabled).toBe(true);
    fireEvent.click(menuItem("default", "page-menu-move-right"));
    expect(tabIds()).toEqual([second, "default"]);

    expect(menuItem("default", "page-menu-move-right").disabled).toBe(true);
    fireEvent.click(menuItem("default", "page-menu-move-left"));
    expect(tabIds()).toEqual(["default", second]);
  });

  it("keyboard", () => {
    const second = createPage();

    act(() => {
      tab("default").focus();
    });
    fireEvent.keyDown(tab("default"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab(second));

    fireEvent.keyDown(tab(second), { key: "Enter" });
    expect(h.state.activePageId).toBe(second);

    fireEvent.keyDown(tab(second), { key: "F2" });
    expect(renameInput()).not.toBe(null);
  });

  it.each([[" "], ["Enter"]])(
    "%j keydown on a tab is not prevented and stays off the canvas",
    (key) => {
      const reached = vi.fn();
      document.addEventListener("keydown", reached);

      act(() => {
        tab("default").focus();
      });
      const notPrevented = fireEvent.keyDown(tab("default"), { key });

      document.removeEventListener("keydown", reached);
      expect(notPrevented).toBe(true);
      expect(reached).not.toHaveBeenCalled();
    },
  );
});

describe("pages (scene scope)", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("only the active page is selectable", () => {
    twoPagesWithElements();

    act(() => {
      h.app.actionManager.executeAction(actionSelectAll);
    });

    expect(Object.keys(h.state.selectedElementIds)).toEqual(["B"]);
  });

  it("hit test", () => {
    const { second } = twoPagesWithElements();
    switchTo(second);
    API.setElements([]);

    new Pointer("mouse").clickAt(50, 50);
    expect(Object.keys(h.state.selectedElementIds)).toEqual([]);
  });

  it("render scope", async () => {
    API.setAppState({ width: 1000, height: 800 });
    twoPagesWithElements();

    await waitFor(() => {
      expect(h.app.visibleElements.map((el) => el.id)).toEqual(["B"]);
    });
  });

  it("selection clears on switch", () => {
    const element = API.createElement({ id: "A" });
    API.setElements([element]);
    API.setSelectedElements([element]);
    const second = createPage();
    const undoEntries = API.getUndoStack().length;

    switchTo(second);
    expect(h.state.selectedElementIds).toEqual({});

    switchTo("default");
    expect(API.getUndoStack().length).toBe(undoEntries);
  });

  it("text edit commits on switch", async () => {
    const second = createPage({ activate: false });

    UI.clickTool("text");
    new Pointer("mouse").clickAt(100, 100);
    const editor = await waitFor(() => {
      const textarea = document.querySelector("textarea");
      expect(textarea).not.toBe(null);
      return textarea as HTMLTextAreaElement;
    });
    fireEvent.input(editor, { target: { value: "hello" } });

    switchTo(second);

    expect(h.elements.filter((el) => !el.isDeleted)).toEqual([]);
    const onLeaving = api()
      .getAllPagesElementsIncludingDeleted()
      .filter((el) => el.type === "text" && !el.isDeleted);
    expect(onLeaving.length).toBe(1);
    expect(onLeaving[0].pageId).toBe(undefined);
  });

  it("undo stays on its page", () => {
    commitElement(API.createElement({ id: "A" }));
    const second = createPage({ activate: true });
    commitElement(API.createElement({ id: "B" }));

    Keyboard.undo();
    expect(h.elements.find((el) => el.id === "B")?.isDeleted).toBe(true);

    Keyboard.redo();
    expect(h.elements.find((el) => el.id === "B")?.isDeleted).toBe(false);

    switchTo("default");
    expect(h.elements.find((el) => el.id === "A")?.isDeleted).toBe(false);
    expect(h.state.activePageId).not.toBe(second);
  });

  it("stack survives a switch", () => {
    commitElement(API.createElement({ id: "A" }));
    const undoEntries = API.getUndoStack().length;
    const second = createPage();

    switchTo(second);
    expect(API.getUndoStack().length).toBe(0);
    switchTo("default");
    expect(API.getUndoStack().length).toBe(undoEntries);

    Keyboard.undo();
    expect(h.elements.find((el) => el.id === "A")?.isDeleted).toBe(true);
  });

  it("deleting a page discards its stack", () => {
    commitElement(API.createElement({ id: "A" }));
    const undoEntries = API.getUndoStack().length;
    const second = createPage({ activate: true });
    commitElement(API.createElement({ id: "B" }));

    act(() => {
      h.app.pages.deletePage(second);
    });

    expect(h.state.activePageId).toBe("default");
    expect(API.getUndoStack().length).toBe(undoEntries);

    Keyboard.undo();
    expect(h.elements.find((el) => el.id === "A")?.isDeleted).toBe(true);
    const parked = api()
      .getAllPagesElementsIncludingDeleted()
      .find((el) => el.id === "B");
    expect(parked === undefined || parked.isDeleted).toBe(true);
  });

  it("viewport per page", () => {
    API.setAppState({
      scrollX: 10,
      scrollY: 20,
      zoom: { value: 2 as NormalizedZoomValue },
    });
    const second = createPage({ activate: true });
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);
    expect(h.state.zoom.value).toBe(1);

    API.setAppState({
      scrollX: 30,
      scrollY: 40,
      zoom: { value: 0.5 as NormalizedZoomValue },
    });

    switchTo("default");
    expect(h.state.scrollX).toBe(10);
    expect(h.state.scrollY).toBe(20);
    expect(h.state.zoom.value).toBe(2);

    switchTo(second);
    expect(h.state.scrollX).toBe(30);
    expect(h.state.scrollY).toBe(40);
    expect(h.state.zoom.value).toBe(0.5);
  });

  it("updateScene goes to the active page", () => {
    const first = API.createElement({ id: "A" });
    API.setElements([first]);
    const second = createPage({ activate: true });

    API.updateScene({ elements: [API.createElement({ id: "N" })] });

    expect(h.elements.map((el) => el.id)).toEqual(["N"]);
    expect(h.elements[0].pageId).toBe(second);
    expect(h.app.scene.getPageElements("default").map((el) => el.id)).toEqual([
      "A",
    ]);
  });

  it("clear canvas keeps pages", () => {
    twoPagesWithElements();
    const pages = h.state.pages;

    act(() => {
      h.app.actionManager.executeAction(actionClearCanvas);
    });

    expect(h.state.pages).toEqual(pages);
    const first = h.app.scene.getPageElements("default");
    expect(first.map((el) => [el.id, el.isDeleted])).toEqual([["A", false]]);
  });

  it("load replaces the drawing", async () => {
    const { pages, elements } = pagesData();
    commitElement(API.createElement({ id: "old" }));
    const file = new File(
      [
        JSON.stringify({
          type: "excalidraw",
          version: 2,
          source: "test",
          elements,
          appState: { pages, activePageId: "pg2" },
          files: {},
        }),
      ],
      "pages.excalidraw",
      { type: "application/json" },
    );

    await act(async () => {
      await (h.app as any).loadFileToCanvas(file, null);
    });

    await waitFor(() => expect(h.state.activePageId).toBe("pg2"));
    expect(h.state.pages.map((page) => page.id)).toEqual(["default", "pg2"]);
    expect(API.getUndoStack().length).toBe(0);
    expect(API.getRedoStack().length).toBe(0);
  });
});

describe("pages (paste)", () => {
  it("paste lands on the active page", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });

    const element = API.createElement({ id: "A" });
    API.setElements([element]);
    API.setSelectedElements([element]);
    const json = await serializeAsClipboardJSON({
      elements: [element],
      files: null,
    });
    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });
    const second = createPage({ activate: true });

    act(() => {
      document.dispatchEvent(
        createPasteEvent({ types: { "text/plain": json } }),
      );
    });

    await waitFor(() => {
      expect(h.elements.filter((el) => !el.isDeleted).length).toBe(1);
    });
    expect(h.elements[0].pageId).toBe(second);
    expect(
      h.app.scene.getPageElements("default").filter((el) => !el.isDeleted)
        .length,
    ).toBe(0);
  });
});

describe("pages (modes)", () => {
  it("view mode", async () => {
    const { pages, elements } = pagesData();
    await render(
      <Excalidraw
        viewModeEnabled={true}
        initialData={{ elements, appState: { pages, activePageId: "default" } }}
      />,
    );

    fireEvent.click(tab("pg2"));
    expect(h.state.activePageId).toBe("pg2");

    expect(screen.queryByTestId("page-tab-add")).toBe(null);
    expect(tabBar().querySelector("[aria-haspopup]")).toBe(null);
    fireEvent.doubleClick(tab("pg2"));
    expect(renameInput()).toBe(null);
    expect(tab("pg2").getAttribute("draggable")).not.toBe("true");
  });

  it("hidden tab bar with UIOptions", async () => {
    await render(<Excalidraw UIOptions={{ pageTabs: false }} />);

    expect(screen.queryByTestId("page-tabs")).toBe(null);
  });

  it("hidden tab bar in zen mode", async () => {
    await render(<Excalidraw />);
    expect(screen.queryByTestId("page-tabs")).not.toBe(null);

    API.setAppState({ zenModeEnabled: true });

    expect(screen.queryByTestId("page-tabs")).toBe(null);
  });
});

describe("pages (host API)", () => {
  it("initialData and API", async () => {
    const { pages, elements } = pagesData();
    await render(
      <Excalidraw
        initialData={{ elements, appState: { pages, activePageId: "pg2" } }}
      />,
    );

    expect(
      api()
        .getPages()
        .map((page) => page.id),
    ).toEqual(["default", "pg2"]);
    expect(api().getActivePageId()).toBe("pg2");
    expect(
      api()
        .getAllPagesElementsIncludingDeleted()
        .map((el) => el.id)
        .sort(),
    ).toEqual(["A", "B"]);

    act(() => {
      api().setActivePage("default");
      expect(api().getActivePageId()).toBe("default");

      const created = api().createPage({ name: "Three" });
      expect(api().getPages().length).toBe(3);

      api().renamePage(created.id, "Renamed");
      expect(api().getPages()[2].name).toBe("Renamed");

      api().movePage(created.id, 0);
      expect(api().getPages()[0].id).toBe(created.id);

      expect(api().deletePage(created.id)).toBe(true);
      expect(
        api()
          .getPages()
          .map((page) => page.id),
      ).toEqual(["default", "pg2"]);
    });
  });

  it("onChange carries all pages", async () => {
    const onChange = vi.fn();
    await render(<Excalidraw onChange={onChange} />);
    twoPagesWithElements();

    await waitFor(() => {
      const [elements, appState] =
        onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(elements.map((el: { id: string }) => el.id).sort()).toEqual([
        "A",
        "B",
      ]);
      expect(appState.pages.length).toBe(2);
    });
  });

  it("updateScene routes known elements", async () => {
    const onChange = vi.fn();
    await render(<Excalidraw onChange={onChange} />);
    const { second } = twoPagesWithElements();

    await waitFor(() => {
      const [latest] = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(latest.length).toBe(2);
    });
    const [elements] = onChange.mock.calls[onChange.mock.calls.length - 1];

    API.updateScene({
      elements: elements.map((el: { id: string; version: number }) =>
        el.id === "A"
          ? { ...el, strokeColor: "#ff0000", version: el.version + 1 }
          : el,
      ),
    });

    const first = h.app.scene.getPageElements("default");
    expect(first.map((el) => el.id)).toEqual(["A"]);
    expect(first[0].strokeColor).toBe("#ff0000");
    expect(h.app.scene.getPageElements(second).map((el) => el.id)).toEqual([
      "B",
    ]);
  });

  it("host that ignores pages", async () => {
    const onChange = vi.fn();
    await render(
      <Excalidraw
        onChange={onChange}
        initialData={{ elements: [API.createElement({ id: "A" })] }}
      />,
    );

    API.updateScene({
      elements: [...h.elements, API.createElement({ id: "B" })],
    });

    expect(api().getPages().length).toBe(1);
    expect(api().getActivePageId()).toBe("default");
    const all = api().getAllPagesElementsIncludingDeleted();
    expect(all.map((el) => el.id).sort()).toEqual(["A", "B"]);
    expect(all.every((el) => !("pageId" in el) || !el.pageId)).toBe(true);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });
});
