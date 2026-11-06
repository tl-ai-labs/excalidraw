import { KEYS } from "@excalidraw/common";

import { CaptureUpdateAction, Excalidraw } from "../index";
import { serializeAsJSON } from "../data/json";
import { restore } from "../data/restore";
import { exportToSvg } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { fireEvent, render, waitFor } from "./test-utils";

import type { NormalizedZoomValue } from "../types";

const { h } = window;

const addRect = (id: string) => {
  API.updateScene({
    elements: [...h.elements, API.createElement({ type: "rectangle", id })],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
};

const undo = () => {
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    Keyboard.keyPress(KEYS.Z);
  });
};

const activeIds = () => h.app.scene.getNonDeletedElements().map((el) => el.id);

const allIds = () => h.app.getAllSceneElements().map((el) => el.id);

describe("pages", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("AC-1: isolates elements and selection per active page", () => {
    addRect("r1");
    const page1 = h.state.activePageId;
    const page2 = h.app.addPage();
    expect(h.state.pages.length).toBe(2);
    expect(h.state.activePageId).toBe(page2);
    addRect("r2");

    expect(activeIds()).toEqual(["r2"]);
    expect(allIds().sort()).toEqual(["r1", "r2"]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.A);
    });
    expect(Object.keys(h.state.selectedElementIds)).toEqual(["r2"]);

    h.app.switchPage(page1);
    expect(activeIds()).toEqual(["r1"]);
    expect(allIds().sort()).toEqual(["r1", "r2"]);
  });

  it("AC-2: keeps per-page viewport and clears selection on switch", () => {
    addRect("r1");
    const page1 = h.state.activePageId;
    h.setState({
      scrollX: 100,
      scrollY: 50,
      zoom: { value: 2 as NormalizedZoomValue },
      selectedElementIds: { r1: true },
    });

    const page2 = h.app.addPage();
    expect(h.state.selectedElementIds).toEqual({});
    h.setState({
      scrollX: -30,
      scrollY: -20,
      zoom: { value: 0.5 as NormalizedZoomValue },
    });

    h.app.switchPage(page1);
    expect(h.state.scrollX).toBe(100);
    expect(h.state.scrollY).toBe(50);
    expect(h.state.zoom.value).toBe(2);
    expect(h.state.selectedElementIds).toEqual({});

    h.app.switchPage(page2);
    expect(h.state.scrollX).toBe(-30);
    expect(h.state.scrollY).toBe(-20);
    expect(h.state.zoom.value).toBe(0.5);
  });

  it("AC-3: renames, reorders and deletes pages", () => {
    const page1 = h.state.activePageId;
    const addButtonSelector = '[data-testid="page-add-button"]';
    const deleteSelector = `[data-testid="page-delete-${page1}"]`;
    const deleteButton = document.querySelector(deleteSelector);
    expect((deleteButton as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector(addButtonSelector)).not.toBeNull();

    addRect("r1");
    const page2 = h.app.addPage();
    addRect("r2");

    h.app.renamePage(page2, "SDK flow");
    expect(h.state.pages.find((p) => p.id === page2)?.name).toBe("SDK flow");

    h.app.reorderPages(1, 0);
    expect(h.state.pages.map((p) => p.id)).toEqual([page2, page1]);

    const versionBefore = h.app
      .getAllSceneElementsIncludingDeleted()
      .find((el) => el.id === "r2")!.version;

    h.app.deletePage(page2);
    expect(h.state.pages.length).toBe(1);
    expect(h.state.activePageId).toBe(page1);

    const deleted = h.app
      .getAllSceneElementsIncludingDeleted()
      .find((el) => el.id === "r2")!;
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.version).toBeGreaterThan(versionBefore);
    expect(allIds()).toEqual(["r1"]);

    h.app.deletePage(page1);
    expect(h.state.pages.length).toBe(1);
  });

  it("AC-4: isolates undo history per page", () => {
    addRect("rect1");
    const page1 = h.state.activePageId;
    const page2 = h.app.addPage();
    addRect("rect2");

    undo();
    expect(h.state.activePageId).toBe(page2);
    expect(activeIds()).toEqual([]);
    expect(allIds()).toEqual(["rect1"]);

    h.app.switchPage(page1);
    undo();
    expect(h.state.activePageId).toBe(page1);
    expect(allIds()).toEqual([]);
  });

  it("AC-5: exports active page visually, serializes all pages", async () => {
    addRect("r1");
    h.app.addPage();
    addRect("r2");
    h.app.switchPage(h.state.pages[0].id);

    const appState = { ...h.state, exportBackground: false };
    const svgAll = await exportToSvg(
      h.app.getAllSceneElements(),
      appState,
      h.app.files,
    );
    const svgActive = await exportToSvg(
      h.app.scene.getNonDeletedElements(),
      appState,
      h.app.files,
    );
    expect(svgAll.outerHTML.length).toBe(svgActive.outerHTML.length);

    for (const target of ["local", "database"] as const) {
      const json = JSON.parse(
        serializeAsJSON(
          h.app.scene.getNonDeletedElements(),
          h.state,
          h.app.files,
          target,
        ),
      );
      expect(json.elements.map((el: { id: string }) => el.id).sort()).toEqual([
        "r1",
        "r2",
      ]);
      expect(json.appState.pages.length).toBe(2);
    }
  });

  it("AC-6: restores legacy and multi-page payloads", () => {
    const legacy = restore(
      {
        elements: [API.createElement({ type: "rectangle", id: "l1" })],
        appState: {},
      },
      null,
      null,
    );
    expect(legacy.appState.pages.length).toBe(1);
    expect(legacy.appState.activePageId).toBe(legacy.appState.pages[0].id);
    expect(legacy.elements.length).toBe(1);

    const multi = restore(
      {
        elements: [
          { ...API.createElement({ type: "rectangle", id: "a1" }), pageId: "a" },
          { ...API.createElement({ type: "rectangle", id: "b1" }), pageId: "b" },
        ],
        appState: {
          pages: [
            { id: "a", name: "Alpha" },
            { id: "b", name: "Beta" },
          ],
          activePageId: "b",
          pageViewports: {
            a: {
              scrollX: 10,
              scrollY: 20,
              zoom: { value: 2 as NormalizedZoomValue },
            },
            b: {
              scrollX: 5,
              scrollY: 6,
              zoom: { value: 1 as NormalizedZoomValue },
            },
          },
        },
      },
      null,
      null,
    );
    expect(multi.appState.pages.map((p) => p.name)).toEqual(["Alpha", "Beta"]);
    expect(multi.appState.activePageId).toBe("b");
    expect(multi.appState.pageViewports.a.scrollX).toBe(10);
    expect(multi.appState.pageViewports.b.scrollY).toBe(6);
    expect(multi.elements.find((el) => el.id === "a1")?.pageId).toBe("a");
    expect(multi.elements.find((el) => el.id === "b1")?.pageId).toBe("b");
  });

  it("AC-7: search switches to the page of the match", async () => {
    API.updateScene({
      elements: [API.createElement({ type: "text", id: "t1", text: "Hello" })],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    const page1 = h.state.activePageId;
    const page2 = h.app.addPage();
    API.updateScene({
      elements: [
        API.createElement({ type: "text", id: "t2", text: "PipelineNode" }),
      ],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    h.app.switchPage(page1);
    expect(h.state.activePageId).toBe(page1);

    h.setState({ openSidebar: { name: "default", tab: "search" } });

    await waitFor(() => {
      expect(document.querySelector(".layer-ui__search input")).not.toBeNull();
    });
    const input = document.querySelector(
      ".layer-ui__search input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "PipelineNode" } });

    await waitFor(() => {
      expect(h.state.activePageId).toBe(page2);
    });
  });
});
