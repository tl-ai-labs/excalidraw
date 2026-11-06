import { DEFAULT_PAGE_ID, getDefaultPage } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawPage,
} from "@excalidraw/element/types";

import { API } from "../helpers/api";
import * as restore from "../../data/restore";
import { getDefaultAppState } from "../../appState";
import { serializeAsJSON } from "../../data/json";
import { loadFromBlob } from "../../data/blob";

const makePage = (id: string, name: string, index: string): ExcalidrawPage => ({
  id,
  name,
  index,
  version: 1,
  versionNonce: 1,
  isDeleted: false,
});

const onPage = <T extends ExcalidrawElement>(
  element: T,
  pageId: string,
): T => ({
  ...element,
  pageId,
});

const toBlob = (data: unknown) =>
  new Blob([JSON.stringify(data)], { type: "application/json" });

describe("pages restore", () => {
  it("serializeAsJSON and restore round-trip every page", () => {
    // page-3 renamed and moved before page-2
    const pages = [
      makePage("page-1", "Page 1", "a0"),
      { ...makePage("page-3", "Renamed", "a1"), version: 3 },
      makePage("page-2", "Page 2", "a2"),
    ];
    const elements = [
      onPage(API.createElement({ type: "rectangle", id: "r1" }), "page-1"),
      onPage(API.createElement({ type: "ellipse", id: "e1" }), "page-2"),
      onPage(API.createElement({ type: "diamond", id: "d1" }), "page-3"),
    ];
    const appState = {
      ...getDefaultAppState(),
      pages,
      activePageId: "page-2",
      pageViewports: { "page-3": { scrollX: 10, scrollY: -20, zoom: 2 } },
    };

    const json = serializeAsJSON(
      elements,
      appState as Parameters<typeof serializeAsJSON>[1],
      {},
      "local",
    );
    const data = JSON.parse(json);

    const restoredAppState = restore.restoreAppState(data.appState, null);
    const restoredElements = restore.restoreElements(data.elements, null);

    expect(restoredAppState.pages.map((page) => page.id)).toEqual([
      "page-1",
      "page-3",
      "page-2",
    ]);
    expect(restoredAppState.pages.map((page) => page.name)).toEqual([
      "Page 1",
      "Renamed",
      "Page 2",
    ]);
    expect(restoredAppState.activePageId).toBe("page-2");
    expect(restoredAppState.pageViewports).toEqual({
      "page-3": { scrollX: 10, scrollY: -20, zoom: 2 },
    });
    expect(
      restoredElements.map((element) => [element.id, element.pageId]),
    ).toEqual([
      ["r1", "page-1"],
      ["e1", "page-2"],
      ["d1", "page-3"],
    ]);
  });

  it("a legacy file restores onto one default page", async () => {
    const blob = toBlob({
      type: "excalidraw",
      version: 2,
      source: "test",
      elements: [
        API.createElement({ type: "rectangle", id: "r1" }),
        API.createElement({ type: "ellipse", id: "e1" }),
      ],
      appState: {},
      files: {},
    });

    const data = await loadFromBlob(blob, null, null);

    expect(data.appState.pages).toEqual([getDefaultPage()]);
    expect(data.appState.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(data.elements.length).toBe(2);
    for (const element of data.elements) {
      expect(element.pageId).toBe(DEFAULT_PAGE_ID);
    }
  });

  it("dangling page references are repaired", async () => {
    const blob = toBlob({
      type: "excalidraw",
      version: 2,
      source: "test",
      elements: [
        onPage(API.createElement({ type: "rectangle", id: "r1" }), "missing"),
      ],
      appState: {
        pages: [makePage("page-a", "A", "a0"), makePage("page-b", "B", "a1")],
        activePageId: "unknown",
      },
      files: {},
    });

    const data = await loadFromBlob(blob, null, null);

    expect(data.appState.activePageId).toBe("page-a");
    expect(data.elements.length).toBe(1);
    expect(data.elements[0].pageId).toBe("page-a");
  });

  it("duplicate page ids keep the first entry", () => {
    const restoredAppState = restore.restoreAppState(
      {
        pages: [
          makePage("dup", "First", "a0"),
          makePage("dup", "Second", "a1"),
        ],
        activePageId: "dup",
      },
      null,
    );

    expect(restoredAppState.pages.length).toBe(1);
    expect(restoredAppState.pages[0].id).toBe("dup");
    expect(restoredAppState.pages[0].name).toBe("First");
  });

  it("restoreElements drops a malformed pageId", () => {
    const element = {
      ...API.createElement({ type: "rectangle", id: "r1" }),
      pageId: 42,
    } as unknown as ExcalidrawElement;

    const [restored] = restore.restoreElements([element], null);

    expect(restored).toBeDefined();
    expect("pageId" in restored).toBe(false);
  });
});
