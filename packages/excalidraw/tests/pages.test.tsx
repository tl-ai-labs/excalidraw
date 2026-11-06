import React from "react";

import { CLASSES, KEYS } from "@excalidraw/common";
import { getVisiblePages } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { actionSelectAll } from "../actions";
import { actionChangeExportScale } from "../actions/actionExport";
import { serializeAsJSON } from "../data/json";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { act, fireEvent, render, screen, waitFor } from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const getTabs = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid^="page-tab-"]'),
  ).filter((el) => el.getAttribute("role") === "tab");

const clickAddPage = () => {
  fireEvent.click(screen.getByTestId("page-add"));
};

const switchTo = (pageId: string) => {
  fireEvent.click(screen.getByTestId(`page-tab-${pageId}`));
};

const visiblePages = () => getVisiblePages(h.state.pages);

const renameActivePage = (name: string) => {
  fireEvent.click(screen.getByTestId("page-rename"));
  const input = screen.getByTestId("page-rename-input") as HTMLInputElement;
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: KEYS.ENTER });
};

const rect = (props: { id?: string } = {}) =>
  API.createElement({ type: "rectangle", x: 0, y: 0, ...props });

describe("pages", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
  });

  it("creating a page adds an active empty tab", () => {
    API.setElements([rect()]);
    API.setAppState({ scrollX: 50, scrollY: 20 });
    clickAddPage();

    const tabs = getTabs();
    expect(tabs.length).toBe(2);
    const newPage = visiblePages()[1];
    expect(h.state.activePageId).toBe(newPage.id);
    expect(
      screen
        .getByTestId(`page-tab-${newPage.id}`)
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(h.app.scene.getNonDeletedElements()).toEqual([]);
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);
    expect(h.state.zoom.value).toBe(1);
  });

  it("only the active page's elements render and are selectable", () => {
    const page1 = h.state.activePageId;
    const rectangle = rect({ id: "rect1" });
    API.setElements([rectangle]);
    clickAddPage();
    const page2 = h.state.activePageId;
    expect(page2).not.toBe(page1);
    const ellipse = API.createElement({
      type: "ellipse",
      id: "ellipse1",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "#ffc9c9",
      fillStyle: "solid",
    });
    API.updateScene({ elements: [ellipse] });

    expect(h.app.scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      "ellipse1",
    ]);
    expect(h.app.visibleElements.map((e) => e.id)).toEqual(["ellipse1"]);

    act(() => {
      h.app.actionManager.executeAction(actionSelectAll);
    });
    expect(Object.keys(h.state.selectedElementIds)).toEqual(["ellipse1"]);

    API.clearSelection();
    mouse.clickAt(50, 50);
    expect(Object.keys(h.state.selectedElementIds)).toEqual(["ellipse1"]);

    expect(
      h.app.getSceneElementsIncludingDeleted().find((e) => e.id === "rect1")
        ?.pageId,
    ).toBe(page1);
  });

  it("renaming a page updates the tab and saved data", () => {
    const pageId = h.state.activePageId;
    renameActivePage("Data pipeline");
    expect(screen.getByTestId(`page-tab-${pageId}`).textContent).toContain(
      "Data pipeline",
    );
    const json = serializeAsJSON(
      h.app.getSceneElementsIncludingDeleted(),
      h.state,
      h.app.files,
      "local",
    );
    expect(json).toContain("Data pipeline");

    renameActivePage("  ");
    expect(screen.getByTestId(`page-tab-${pageId}`).textContent).toContain(
      "Data pipeline",
    );
    expect(visiblePages()[0].name).toBe("Data pipeline");
  });

  it("reordering pages changes tab and saved order", () => {
    const p1 = h.state.activePageId;
    clickAddPage();
    const p2 = h.state.activePageId;
    clickAddPage();
    const p3 = h.state.activePageId;

    fireEvent.click(screen.getByTestId("page-move-left"));

    expect(getTabs().map((t) => t.getAttribute("data-testid"))).toEqual([
      `page-tab-${p1}`,
      `page-tab-${p3}`,
      `page-tab-${p2}`,
    ]);
    expect(visiblePages().map((p) => p.id)).toEqual([p1, p3, p2]);
  });

  it("deleting a page removes its tab and elements", async () => {
    const p1 = h.state.activePageId;
    clickAddPage();
    const rectangle = rect({ id: "rect2" });
    API.updateScene({ elements: [rectangle] });

    fireEvent.click(screen.getByTestId("page-delete"));
    const confirm = await waitFor(() => {
      const btn = document.querySelector<HTMLButtonElement>(
        ".confirm-dialog [aria-label='Confirm'], .confirm-dialog button.Dialog__action-button--danger",
      );
      expect(btn).not.toBeNull();
      return btn as HTMLButtonElement;
    });
    fireEvent.click(confirm);

    await waitFor(() => expect(getTabs().length).toBe(1));
    expect(
      h.app.getSceneElementsIncludingDeleted().find((e) => e.id === "rect2")
        ?.isDeleted,
    ).toBe(true);
    expect(h.state.activePageId).toBe(p1);
    expect(
      (screen.getByTestId("page-delete") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("undo stays on its page", () => {
    const pA = h.state.activePageId;
    mouse.reset();
    Keyboard.keyPress(KEYS.R);
    mouse.down(10, 10);
    mouse.up(100, 100);
    const rectangle = h.app.scene.getNonDeletedElements()[0];
    expect(rectangle.pageId).toBe(pA);
    const rectVersion = rectangle.version;

    clickAddPage();
    const pB = h.state.activePageId;
    const undoBefore = API.getUndoStack().length;
    switchTo(pA);
    switchTo(pB);
    expect(API.getUndoStack().length).toBe(undoBefore);

    Keyboard.keyPress(KEYS.O);
    mouse.down(10, 10);
    mouse.up(100, 100);
    const ellipse = h.app.scene.getNonDeletedElements()[0];
    expect(ellipse.type).toBe("ellipse");

    Keyboard.undo();
    const all = () => h.app.getSceneElementsIncludingDeleted();
    expect(all().find((e) => e.id === ellipse.id)?.isDeleted).toBe(true);
    const rectNow = all().find((e) => e.id === rectangle.id);
    expect(rectNow?.isDeleted).toBe(false);
    expect(rectNow?.version).toBe(rectVersion);

    Keyboard.undo();
    expect(all().find((e) => e.id === rectangle.id)?.isDeleted).toBe(false);

    switchTo(pA);
    Keyboard.undo();
    expect(all().find((e) => e.id === rectangle.id)?.isDeleted).toBe(true);
  });

  it("each page keeps its own viewport", () => {
    const pA = h.state.activePageId;
    API.setAppState({
      scrollX: 100,
      zoom: { value: 2 as typeof h.state.zoom.value },
    });
    clickAddPage();
    const pB = h.state.activePageId;
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);
    expect(h.state.zoom.value).toBe(1);

    switchTo(pA);
    expect(h.state.scrollX).toBe(100);
    expect(h.state.zoom.value).toBe(2);

    switchTo(pB);
    expect(h.state.scrollX).toBe(0);
    expect(h.state.zoom.value).toBe(1);
  });

  it("export contains only the active page", () => {
    API.setElements([rect({ id: "p1rect" })]);
    clickAddPage();
    API.updateScene({ elements: [rect({ id: "p2rect" })] });

    const spy = vi
      .spyOn(actionChangeExportScale, "perform")
      .mockImplementation(() => false);
    act(() => {
      h.app.actionManager.executeAction(actionChangeExportScale, "api", 2);
    });
    expect(spy).toHaveBeenCalled();
    const elements = spy.mock.calls[0][0] as readonly ExcalidrawElement[];
    expect(elements.filter((e) => !e.isDeleted).map((e) => e.id)).toEqual([
      "p2rect",
    ]);
    spy.mockRestore();
  });

  it("search finds text on another page and switches to it", async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const p1 = h.state.activePageId;
    clickAddPage();
    const p2 = h.state.activePageId;
    const text = API.createElement({ type: "text", text: "pipeline" });
    API.updateScene({ elements: [text] });
    switchTo(p1);
    expect(h.state.activePageId).toBe(p1);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    const input = await waitFor(() => {
      const el =
        h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
          `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
        );
      expect(el).not.toBeNull();
      return el as HTMLInputElement;
    });
    fireEvent.change(input, { target: { value: "pipeline" } });

    const pageName = visiblePages().find((p) => p.id === p2)?.name ?? "";
    const label = await waitFor(() => {
      const el = document.querySelector<HTMLElement>(".preview-page");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(label.textContent).toContain(pageName);

    const item = label.closest(".result-item") ?? label;
    fireEvent.click(item);
    await waitFor(() => expect(h.state.activePageId).toBe(p2));
  });

  it("paste and library insert add to the active page", () => {
    const p1rect = rect({ id: "p1only" });
    API.setElements([p1rect]);
    const p1 = h.state.activePageId;
    clickAddPage();
    const p2 = h.state.activePageId;

    act(() => {
      h.app.addElementsFromPasteOrLibrary({
        elements: [rect({ id: "pasted" })],
        position: { clientX: 10, clientY: 10 },
        files: null,
      });
    });
    const active = h.app.scene.getNonDeletedElements();
    expect(active.length).toBe(1);
    expect(active[0].pageId).toBe(p2);
    const page1Elements = h.app
      .getSceneElementsIncludingDeleted()
      .filter((e) => e.pageId === p1);
    expect(page1Elements.map((e) => e.id)).toEqual(["p1only"]);
    expect(page1Elements[0].version).toBe(API.getElement(p1rect).version);
  });

  it("view mode shows switch-only tabs", () => {
    const p1 = h.state.activePageId;
    clickAddPage();
    const p2 = h.state.activePageId;
    API.setAppState({ viewModeEnabled: true });

    expect(getTabs().length).toBe(2);
    switchTo(p1);
    expect(h.state.activePageId).toBe(p1);
    switchTo(p2);
    expect(h.state.activePageId).toBe(p2);
    expect(screen.queryByTestId("page-add")).toBeNull();
    expect(screen.queryByTestId("page-rename")).toBeNull();
    expect(screen.queryByTestId("page-delete")).toBeNull();
  });

  it("zen mode hides the tab bar", () => {
    API.setAppState({ zenModeEnabled: true });
    expect(document.querySelector(".page-tab-bar")).toBeNull();
  });
});
