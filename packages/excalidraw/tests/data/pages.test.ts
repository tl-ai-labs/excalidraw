import {
  assignElementToPage,
  DEFAULT_PAGE_ID,
  getElementPageId,
  getVisiblePages,
  toActivePageExportState,
} from "@excalidraw/element";

import type { DrawingPage, ExcalidrawElement } from "@excalidraw/element/types";

import { API } from "../helpers/api";
import * as restore from "../../data/restore";
import { getDefaultAppState } from "../../appState";
import { serializeAsJSON } from "../../data/json";
import { loadFromBlob } from "../../data/blob";
import { prepareElementsForExport } from "../../data";

import type { AppState } from "../../types";

const pageA: DrawingPage = {
  id: "page-a",
  name: "Alpha",
  index: "a0",
  version: 1,
  versionNonce: 1,
  isDeleted: false,
};

const pageB: DrawingPage = {
  id: "page-b",
  name: "Beta",
  index: "a1",
  version: 1,
  versionNonce: 2,
  isDeleted: false,
};

const createOnPage = (id: string, pageId: string): ExcalidrawElement =>
  assignElementToPage(
    API.createElement({
      type: "rectangle",
      id,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }),
    pageId,
  );

const makeAppState = (overrides: Partial<AppState>): AppState =>
  ({
    ...getDefaultAppState(),
    width: 1000,
    height: 800,
    offsetTop: 0,
    offsetLeft: 0,
    ...overrides,
  } as unknown as AppState);

const toBlob = (json: string) => new Blob([json], { type: "application/json" });

describe("multi-page data serialization and restore", () => {
  it("round trip keeps pages, names, order, elements and viewports", async () => {
    const elA = createOnPage("el-a", pageA.id);
    const elB = createOnPage("el-b", pageB.id);
    const appState = makeAppState({
      pages: [pageA, pageB],
      activePageId: pageA.id,
      pageViewports: { [pageB.id]: { scrollX: 30, scrollY: 40, zoom: 2 } },
      scrollX: 10,
      scrollY: 20,
      zoom: { value: 1.5 as any },
    } as Partial<AppState>);

    const json = serializeAsJSON([elA, elB], appState, {}, "local");
    const loaded: any = await loadFromBlob(toBlob(json), null, null);

    const visible = getVisiblePages(loaded.appState.pages);
    expect(visible.map((page) => page.id)).toEqual([pageA.id, pageB.id]);
    expect(visible.map((page) => page.name)).toEqual(["Alpha", "Beta"]);
    expect(loaded.appState.activePageId).toBe(pageA.id);

    const byId = new Map<string, ExcalidrawElement>(
      loaded.elements.map((el: ExcalidrawElement) => [el.id, el]),
    );
    expect(getElementPageId(byId.get("el-a")!)).toBe(pageA.id);
    expect(getElementPageId(byId.get("el-b")!)).toBe(pageB.id);

    expect(loaded.appState.pageViewports[pageA.id]).toEqual({
      scrollX: 10,
      scrollY: 20,
      zoom: 1.5,
    });
    expect(loaded.appState.pageViewports[pageB.id]).toEqual({
      scrollX: 30,
      scrollY: 40,
      zoom: 2,
    });
  });

  it("legacy file restores onto one default page", async () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const json = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "test",
      elements: [rect],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    });
    const loaded: any = await loadFromBlob(toBlob(json), null, null);

    const visible = getVisiblePages(loaded.appState.pages);
    expect(visible.length).toBe(1);
    expect(visible[0].id).toBe(DEFAULT_PAGE_ID);
    expect(loaded.appState.activePageId).toBe(DEFAULT_PAGE_ID);
    for (const element of loaded.elements) {
      expect(getElementPageId(element)).toBe(DEFAULT_PAGE_ID);
    }
  });

  it("elements of an unknown page restore onto the first page", async () => {
    const orphan = createOnPage("orphan", "page-missing");
    const json = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "test",
      elements: [orphan],
      appState: { pages: [pageA, pageB], activePageId: pageA.id },
      files: {},
    });
    const loaded: any = await loadFromBlob(toBlob(json), null, null);

    const first = getVisiblePages(loaded.appState.pages)[0];
    expect(getElementPageId(loaded.elements[0])).toBe(first.id);
  });

  it("older readers keep the data: restoreElements keeps pageId or drops default", () => {
    const custom = {
      ...API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
      }),
      pageId: "p2",
    };
    const onDefault = {
      ...API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
      }),
      pageId: DEFAULT_PAGE_ID,
    };
    const restored = restore.restoreElements([custom, onDefault], null);

    expect(restored[0].pageId).toBe("p2");
    expect(restored[1].pageId).toBeUndefined();
  });

  it("export contains only the active page", () => {
    const elA = createOnPage("el-a", pageA.id);
    const elB = createOnPage("el-b", pageB.id);

    const { exportedElements } = prepareElementsForExport(
      [elA, elB],
      { selectedElementIds: {}, activePageId: pageA.id },
      false,
    );
    expect(exportedElements.length).toBe(1);
    expect(exportedElements[0].id).toBe(elA.id);
  });

  it("embedded scene holds only the active page", () => {
    const exported = toActivePageExportState({
      pages: [pageA, pageB],
      activePageId: pageA.id,
      pageViewports: {
        [pageA.id]: { scrollX: 1, scrollY: 2, zoom: 1 },
        [pageB.id]: { scrollX: 3, scrollY: 4, zoom: 2 },
      },
    });

    expect(exported.pages).toEqual([pageA]);
    expect(Object.keys(exported.pageViewports!)).toEqual([pageA.id]);
  });
});
