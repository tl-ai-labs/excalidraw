import React from "react";
import { vi } from "vitest";

import { KEYS } from "@excalidraw/common";

import { DEFAULT_PAGE_ID, getVisiblePages } from "@excalidraw/element";

import { CLASSES } from "@excalidraw/common";

import { Excalidraw } from "../index";
import {
  actionAddPage,
  actionMovePageRight,
  actionSwitchPage,
} from "../actions/actionPages";
import * as StaticScene from "../renderer/staticScene";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { updateTextEditor } from "./queries/dom";
import {
  act,
  fireEvent,
  render,
  GlobalTestState,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const queryContainer = (selector: string) =>
  GlobalTestState.renderResult.container.querySelector<HTMLElement>(selector);

const getTabs = () =>
  Array.from(
    GlobalTestState.renderResult.container.querySelectorAll<HTMLElement>(
      "[data-testid='pages-tab-bar'] [role='tab']",
    ),
  );

const visiblePages = () => getVisiblePages(h.state.pages);

const visibleNames = () => visiblePages().map((page) => page.name);

const addPage = () => {
  act(() => {
    h.app.actionManager.executeAction(actionAddPage, "api");
  });
  return h.state.activePageId;
};

const switchPage = (pageId: string) => {
  act(() => {
    h.app.actionManager.executeAction(actionSwitchPage, "api", pageId);
  });
};

const undo = () => {
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    Keyboard.keyPress(KEYS.Z);
  });
};

const openTabMenu = () => {
  const trigger = queryContainer("[data-testid='pages-tab-menu-trigger']");
  expect(trigger).not.toBe(null);
  fireEvent.click(trigger!);
};

const getLastVisibleElementIds = (
  spy: ReturnType<typeof vi.spyOn>,
): string[] => {
  const calls = spy.mock.calls;
  const config = calls[calls.length - 1][0] as {
    visibleElements: readonly { id: string }[];
  };
  return config.visibleElements.map((element) => element.id);
};

describe("pages", () => {
  beforeEach(async () => {
    mockBoundingClientRect();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
    vi.restoreAllMocks();
  });

  it("starts with one default page", () => {
    expect(visiblePages().length).toBe(1);
    expect(visiblePages()[0]).toMatchObject({
      id: DEFAULT_PAGE_ID,
      name: "Page 1",
    });
    const tabs = getTabs();
    expect(tabs.length).toBe(1);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("adds a page via the + button", () => {
    const addButton = queryContainer("[data-testid='pages-add-button']");
    expect(addButton).not.toBe(null);
    fireEvent.click(addButton!);

    expect(visiblePages().length).toBe(2);
    const active = visiblePages().find(
      (page) => page.id === h.state.activePageId,
    );
    expect(active?.name).toBe("Page 2");
    const tabs = getTabs();
    expect(tabs.length).toBe(2);
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(tabs[0].getAttribute("aria-selected")).toBe("false");
  });

  it("switches page via a tab click and clears selection", () => {
    addPage();
    const rect = API.createElement({ type: "rectangle" });
    API.setElements([rect]);
    API.setAppState({ selectedElementIds: { [rect.id]: true } });

    fireEvent.click(getTabs()[0]);

    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("renames a page inline", async () => {
    const pageId = h.state.activePageId;
    const getName = () =>
      h.state.pages.find((page) => page.id === pageId)?.name;
    const startEdit = async () => {
      fireEvent.doubleClick(getTabs()[0]);
      return waitFor(() => {
        const input = queryContainer(
          "[data-testid='pages-tab-bar'] input",
        ) as HTMLInputElement | null;
        expect(input).not.toBe(null);
        return input!;
      });
    };

    let input = await startEdit();
    fireEvent.change(input, { target: { value: "SDK flow" } });
    fireEvent.keyDown(input, { key: KEYS.ENTER });
    await waitFor(() => expect(getName()).toBe("SDK flow"));

    input = await startEdit();
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: KEYS.ENTER });
    await waitFor(() =>
      expect(queryContainer("[data-testid='pages-tab-bar'] input")).toBe(null),
    );
    expect(getName()).toBe("SDK flow");

    input = await startEdit();
    fireEvent.change(input, { target: { value: "Other" } });
    fireEvent.keyDown(input, { key: KEYS.ESCAPE });
    await waitFor(() =>
      expect(queryContainer("[data-testid='pages-tab-bar'] input")).toBe(null),
    );
    expect(getName()).toBe("SDK flow");
  });

  it("deletes a page via the menu", async () => {
    openTabMenu();
    const disabledDelete = await waitFor(() => {
      const item = queryContainer("[data-testid='pages-menu-delete']");
      expect(item).not.toBe(null);
      return item!;
    });
    expect(
      disabledDelete.hasAttribute("disabled") ||
        disabledDelete.getAttribute("aria-disabled") === "true",
    ).toBe(true);
    Keyboard.keyPress(KEYS.ESCAPE);

    const p2Id = addPage();
    const rect = API.createElement({ type: "rectangle", pageId: p2Id });
    API.setElements([rect]);

    openTabMenu();
    const deleteItem = await waitFor(() => {
      const item = queryContainer("[data-testid='pages-menu-delete']");
      expect(item).not.toBe(null);
      return item!;
    });
    fireEvent.click(deleteItem);

    await waitFor(() => expect(visiblePages().length).toBe(1));
    expect(API.getElement(rect).isDeleted).toBe(true);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
  });

  it("reorders via move right and via drag", async () => {
    act(() => {
      h.app.actionManager.executeAction(
        actionSwitchPage,
        "api",
        DEFAULT_PAGE_ID,
      );
    });
    addPage();
    addPage();
    act(() => {
      h.app.actionManager.executeAction(
        actionSwitchPage,
        "api",
        visiblePages()[0].id,
      );
    });
    // names by visible position: Page 1, Page 2, Page 3 are not guaranteed,
    // so capture the current order as A, B, C
    const [a, b, c] = visiblePages().map((page) => page.name);

    act(() => {
      h.app.actionManager.executeAction(actionMovePageRight, "api", null);
    });
    expect(visibleNames()).toEqual([b, a, c]);

    const tabs = getTabs();
    fireEvent.dragStart(tabs[2]);
    fireEvent.dragOver(tabs[0]);
    fireEvent.drop(tabs[0]);
    await waitFor(() => expect(visibleNames()).toEqual([c, b, a]));
  });

  it("renders only the active page", () => {
    const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");
    const p2Id = addPage();
    switchPage(DEFAULT_PAGE_ID);

    const r1 = API.createElement({ type: "rectangle", id: "r1" });
    const r2 = API.createElement({ type: "rectangle", id: "r2", pageId: p2Id });
    API.setElements([r1, r2]);

    expect(getLastVisibleElementIds(renderStaticScene)).toEqual(["r1"]);

    switchPage(p2Id);
    expect(getLastVisibleElementIds(renderStaticScene)).toEqual(["r2"]);
  });

  it("select-all and click selection ignore other pages", () => {
    const p2Id = addPage();
    switchPage(DEFAULT_PAGE_ID);

    const r1 = API.createElement({ type: "rectangle", x: 0, y: 0 });
    const r2 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      pageId: p2Id,
    });
    const r3 = API.createElement({
      type: "rectangle",
      x: 300,
      y: 300,
      width: 50,
      pageId: p2Id,
    });
    API.setElements([r1, r2, r3]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.A);
    });
    expect(API.getSelectedElements().map((element) => element.id)).toEqual([
      r1.id,
    ]);

    API.clearSelection();
    mouse.reset();
    mouse.clickAt(325, 325);
    expect(API.getSelectedElements().length).toBe(0);
  });

  it("puts new elements on the active page", () => {
    const p2Id = addPage();
    const rect = UI.createElement("rectangle", { size: 100 });
    expect(API.getElement(rect.get()).pageId).toBe(p2Id);
  });

  it("restores the viewport per page", () => {
    API.setAppState({ scrollX: 50, scrollY: 60, zoom: { value: 2 as any } });
    const p2Id = addPage();
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);
    expect(h.state.zoom.value).toBe(1);

    API.setAppState({
      scrollX: -10,
      scrollY: -20,
      zoom: { value: 0.5 as any },
    });

    switchPage(DEFAULT_PAGE_ID);
    expect(h.state.scrollX).toBe(50);
    expect(h.state.scrollY).toBe(60);
    expect(h.state.zoom.value).toBe(2);

    switchPage(p2Id);
    expect(h.state.scrollX).toBe(-10);
    expect(h.state.scrollY).toBe(-20);
    expect(h.state.zoom.value).toBe(0.5);
  });

  it("keeps undo on its page", () => {
    const p2Id = addPage();
    switchPage(DEFAULT_PAGE_ID);

    const r1 = API.createElement({ type: "rectangle", x: 0, y: 0 });
    const r2 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      pageId: p2Id,
    });
    API.setElements([r1, r2]);

    API.setSelectedElements([r1]);
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    expect(API.getElement(r1).x).toBe(1);

    switchPage(p2Id);
    API.setSelectedElements([API.getElement(r2)]);
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    expect(API.getElement(r2).x).toBe(1);

    switchPage(DEFAULT_PAGE_ID);
    undo();
    expect(API.getElement(r1).x).toBe(0);
    expect(API.getElement(r2).x).toBe(1);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

    switchPage(p2Id);
    undo();
    expect(API.getElement(r2).x).toBe(0);
    expect(h.state.activePageId).toBe(p2Id);
  });

  it("does not record page switching as an undo step", () => {
    const p2Id = addPage();
    switchPage(DEFAULT_PAGE_ID);
    switchPage(p2Id);
    expect(API.getUndoStack().length).toBe(0);
    undo();
    expect(h.state.activePageId).toBe(p2Id);
  });

  it("finds text on another page and switches to it", async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const p2Id = addPage();
    switchPage(DEFAULT_PAGE_ID);
    API.setElements([
      API.createElement({ type: "text", text: "pipeline", pageId: p2Id }),
    ]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    const searchInput = await waitFor(() => {
      const input =
        h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
          `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
        );
      expect(input).toBeTruthy();
      return input!;
    });
    updateTextEditor(searchInput, "pipeline");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(1);
    });
    await waitFor(() => expect(h.state.activePageId).toBe(p2Id));
  });

  it("hides the tab bar in zen mode and via UIOptions", async () => {
    expect(queryContainer("[data-testid='pages-tab-bar']")).not.toBe(null);
    API.setAppState({ zenModeEnabled: true });
    expect(queryContainer("[data-testid='pages-tab-bar']")).toBe(null);

    GlobalTestState.renderResult.rerender(
      <Excalidraw handleKeyboardGlobally={true} UIOptions={{ pages: false }} />,
    );
    API.setAppState({ zenModeEnabled: false });
    await waitFor(() =>
      expect(queryContainer("[data-testid='pages-tab-bar']")).toBe(null),
    );
  });

  it("lets view mode switch but not edit pages", () => {
    const p2Id = addPage();
    API.setAppState({ viewModeEnabled: true });

    expect(queryContainer("[data-testid='pages-add-button']")).toBe(null);
    expect(queryContainer("[data-testid='pages-tab-menu-trigger']")).toBe(null);

    const tabs = getTabs();
    expect(tabs.length).toBe(2);
    fireEvent.click(tabs[0]);
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
    fireEvent.click(tabs[1]);
    expect(h.state.activePageId).toBe(p2Id);
  });
});
