import { getDefaultPage } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawPage,
  FractionalIndex,
} from "@excalidraw/element/types";

import { API } from "../helpers/api";
import { getDefaultAppState } from "../../appState";
import { reconcileElements } from "../../data/reconcile";
import { serializeAsJSON } from "../../data/json";
import * as restore from "../../data/restore";

import type { RemoteExcalidrawElement } from "../../data/reconcile";
import type { AppState } from "../../types";

const page = (
  id: string,
  name: string,
  index: string,
  overrides: Partial<ExcalidrawPage> = {},
): ExcalidrawPage => ({
  id,
  name,
  index: index as FractionalIndex,
  version: 1,
  versionNonce: 0,
  isDeleted: false,
  updated: 0,
  ...overrides,
});

const element = (
  id: string,
  pageId: string | null,
  index: string,
  overrides: Record<string, unknown> = {},
) =>
  ({
    ...API.createElement({ type: "rectangle", id }),
    index: index as FractionalIndex,
    ...(pageId ? { pageId } : {}),
    ...overrides,
  } as ExcalidrawElement);

const ids = (elements: readonly ExcalidrawElement[]) =>
  elements.map((element) => element.id);

describe("restorePages", () => {
  it("puts legacy data on one default page", () => {
    const elements = [element("a", null, "a0"), element("b", null, "a1")];

    expect(restore.restorePages(undefined)).toEqual([getDefaultPage()]);

    const restored = restore.restoreElements(elements, null);
    expect(ids(restored)).toEqual(["a", "b"]);
    expect(restored.map((element) => element.index)).toEqual(["a0", "a1"]);
    restored.forEach((element) => {
      expect("pageId" in element).toBe(false);
    });
  });

  it("ignores local pages in restoreAppState", () => {
    const localAppState = {
      ...getDefaultAppState(),
      pages: [page("p1", "One", "a0"), page("p2", "Two", "a1")],
      activePageId: "p2",
    } as unknown as AppState;

    const restored = restore.restoreAppState({}, localAppState);
    expect(restored.pages).toEqual([getDefaultPage()]);
    expect(restored.activePageId).toBe(getDefaultPage().id);
  });

  it("falls back to the default page for an empty or malformed list", () => {
    expect(restore.restorePages([])).toEqual([getDefaultPage()]);
    expect(restore.restorePages("pages")).toEqual([getDefaultPage()]);
    expect(restore.restorePages([{}])).toEqual([getDefaultPage()]);
  });

  it("keeps the first of duplicate ids", () => {
    const restored = restore.restorePages([
      page("p1", "First", "a0"),
      page("p1", "Second", "a1"),
    ]);
    expect(restored).toHaveLength(1);
    expect(restored[0].name).toBe("First");
  });

  it("assigns indices in array order when they are missing", () => {
    const restored = restore.restorePages([
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ]);
    expect(restored.map((page) => page.id)).toEqual(["a", "b", "c"]);
    expect(restored[0].index < restored[1].index).toBe(true);
    expect(restored[1].index < restored[2].index).toBe(true);
  });
});

describe("restoreActivePageId", () => {
  const pages = [
    page("p1", "One", "a0"),
    page("p2", "Two", "a1", { isDeleted: true }),
  ];

  it("falls back to the first live page for an unknown id", () => {
    expect(restore.restoreActivePageId("nope", pages)).toBe("p1");
  });

  it("falls back to the first live page for a tombstone", () => {
    expect(restore.restoreActivePageId("p2", pages)).toBe("p1");
  });
});

describe("restorePageViewports", () => {
  it("drops invalid entries and entries for unknown pages", () => {
    const pages = [page("p1", "One", "a0"), page("p2", "Two", "a1")];
    const restored = restore.restorePageViewports(
      {
        p1: { scrollX: NaN, scrollY: 0, zoom: 1 },
        p2: { scrollX: 10, scrollY: 20, zoom: 1 },
        ghost: { scrollX: 1, scrollY: 2, zoom: 1 },
      },
      pages,
    );
    expect(Object.keys(restored)).toEqual(["p2"]);
    expect(restored.p2.scrollX).toBe(10);
    expect(restored.p2.scrollY).toBe(20);
  });
});

describe("restoreElements with pages", () => {
  it("moves an element on an unknown page to the first page", () => {
    const pages = [page("p1", "One", "a0"), page("p2", "Two", "a1")];
    const elements = [
      element("e1", "p1", "a0"),
      element("e2", "missing", "a0"),
    ];

    const restored = restore.restoreElements(elements, null, { pages });
    expect(ids(restored)).toEqual(["e1", "e2"]);
    expect(restored[0].index).toBeTruthy();
    expect(restored[1].index).toBeTruthy();
    expect(restored[0].index! < restored[1].index!).toBe(true);
    expect((restored[1] as any).pageId).toBe("p1");
  });

  it("repairs references that cross pages", () => {
    const pages = [page("p1", "One", "a0"), page("p2", "Two", "a1")];
    const rectangle = element("rect", "p2", "a0");
    const text = element("text", "p1", "a0", {
      type: "text",
      text: "hello",
      originalText: "hello",
      containerId: "rect",
    });
    const arrow = element("arrow", "p1", "a1", {
      type: "arrow",
      points: [
        [0, 0],
        [100, 0],
      ],
      startBinding: { elementId: "rect", focus: 0, gap: 1 },
      endBinding: null,
    });

    const restored = restore.restoreElements([rectangle, text, arrow], null, {
      pages,
      repairBindings: true,
    });
    const restoredText = restored.find((element) => element.id === "text")!;
    const restoredArrow = restored.find((element) => element.id === "arrow")!;
    expect((restoredText as any).containerId).toBe(null);
    expect((restoredArrow as any).startBinding).toBe(null);
  });
});

describe("serializeAsJSON with pages", () => {
  const pages = [
    page("p1", "One", "a0"),
    page("p2", "Two", "a1"),
    page("p3", "Three", "a2"),
  ];
  const elements = [
    element("e1", "p1", "a0"),
    element("e2", "p2", "a0"),
    element("e3", "p3", "a0"),
  ];
  const appState = {
    ...getDefaultAppState(),
    pages,
    activePageId: "p2",
    pageViewports: {
      p1: { scrollX: 1, scrollY: 2, zoom: 1 },
      p3: { scrollX: 3, scrollY: 4, zoom: 1 },
    },
    scrollX: 5,
    scrollY: 6,
    zoom: { value: 2 },
  } as unknown as AppState;

  it("round trips pages, membership, viewports and the active page", () => {
    const json = serializeAsJSON(elements, appState, {}, "local");
    const parsed = JSON.parse(json);

    const restoredPages = restore.restorePages(parsed.appState.pages);
    expect(restoredPages.map((page) => page.id)).toEqual(["p1", "p2", "p3"]);
    expect(restoredPages.map((page) => page.name)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
    expect(
      restore.restoreActivePageId(parsed.appState.activePageId, restoredPages),
    ).toBe("p2");

    const viewports = restore.restorePageViewports(
      parsed.appState.pageViewports,
      restoredPages,
    );
    expect(viewports.p1).toMatchObject({ scrollX: 1, scrollY: 2 });
    expect(viewports.p3).toMatchObject({ scrollX: 3, scrollY: 4 });
    expect(viewports.p2).toMatchObject({ scrollX: 5, scrollY: 6 });

    const restoredElements = restore.restoreElements(parsed.elements, null, {
      pages: restoredPages,
    });
    expect(
      restoredElements.map((element) => [element.id, (element as any).pageId]),
    ).toEqual([
      ["e1", "p1"],
      ["e2", "p2"],
      ["e3", "p3"],
    ]);
  });

  it("does not save tombstones", () => {
    const withTombstone = {
      ...appState,
      pages: [
        ...pages,
        page("p4", "SecretDeletedName", "a3", { isDeleted: true }),
      ],
    } as AppState;
    const json = serializeAsJSON(elements, withTombstone, {}, "local");
    expect(json).not.toContain("SecretDeletedName");
  });

  it("keeps pages but not the active page or viewports in a share payload", () => {
    const json = serializeAsJSON(elements, appState, {}, "database");
    const parsed = JSON.parse(json);
    expect(parsed.appState.pages).toBeDefined();
    expect("activePageId" in parsed.appState).toBe(false);
    expect("pageViewports" in parsed.appState).toBe(false);
  });

  it("writes no page keys for a partial appState", () => {
    const json = serializeAsJSON(elements, {}, {}, "local");
    const parsed = JSON.parse(json);
    expect("pages" in parsed.appState).toBe(false);
    expect("activePageId" in parsed.appState).toBe(false);
    expect("pageViewports" in parsed.appState).toBe(false);
  });
});

describe("serializeAsJSON with a tombstoned page", () => {
  const pages = [
    page("p1", "One", "a0"),
    page("p2", "Two", "a1", { isDeleted: true }),
  ];
  const elements = [
    element("live-1", "p1", "a0"),
    element("live-deleted", "p1", "a1", { isDeleted: true }),
    element("tomb-text", "p2", "a0", {
      type: "text",
      text: "SecretTombText",
      originalText: "SecretTombText",
    }),
    element("tomb-image", "p2", "a1", {
      type: "image",
      fileId: "file-tomb",
    }),
  ];
  const files = {
    "file-tomb": {
      id: "file-tomb",
      mimeType: "image/png",
      dataURL: "data:image/png;base64,AAAA",
      created: 1,
    },
  } as any;
  const appState = {
    ...getDefaultAppState(),
    pages,
    activePageId: "p1",
  } as unknown as AppState;

  it("drops the tombstoned page's elements, text and files", () => {
    const json = serializeAsJSON(elements, appState, files, "local");
    const parsed = JSON.parse(json);

    expect(json).not.toContain("tomb-text");
    expect(json).not.toContain("tomb-image");
    expect(json).not.toContain("SecretTombText");
    expect("file-tomb" in parsed.files).toBe(false);
    expect(json).not.toContain("file-tomb");
  });

  it("keeps live page elements, including deleted ones", () => {
    const json = serializeAsJSON(elements, appState, files, "local");
    const parsed = JSON.parse(json);
    const savedIds = parsed.elements.map((element: any) => element.id);
    expect(savedIds).toContain("live-1");
    expect(savedIds).toContain("live-deleted");
  });
});

describe("restoreAppState with unusual page ids", () => {
  it("restores a finite viewport for a page named constructor", () => {
    const restored = restore.restoreAppState(
      {
        pages: [page("constructor", "C", "a0")],
        activePageId: "constructor",
      } as any,
      null,
    );
    expect(restored.activePageId).toBe("constructor");
    expect(Number.isFinite(restored.scrollX)).toBe(true);
    expect(Number.isFinite(restored.scrollY)).toBe(true);
    expect(Number.isFinite(restored.zoom.value)).toBe(true);
    expect(restored.zoom.value).toBeGreaterThan(0);
  });

  it("restores the saved viewport of a page named constructor", () => {
    const restored = restore.restoreAppState(
      {
        pages: [page("constructor", "C", "a0")],
        activePageId: "constructor",
        pageViewports: {
          constructor: { scrollX: 10, scrollY: 20, zoom: 2 },
        },
      } as any,
      null,
    );
    expect(restored.scrollX).toBe(10);
    expect(restored.scrollY).toBe(20);
    expect(restored.zoom.value).toBe(2);
  });

  it("does not pollute prototypes for a page named __proto__", () => {
    const data = JSON.parse(
      `{"pages":[{"id":"__proto__","name":"P","index":"a0"}],"activePageId":"__proto__","pageViewports":{"__proto__":{"scrollX":5,"scrollY":6,"zoom":1}}}`,
    );
    const restored = restore.restoreAppState(data, null);
    expect(Object.getPrototypeOf(restored.pageViewports)).toBe(
      Object.prototype,
    );
    expect(({} as any).scrollX).toBeUndefined();
  });
});

describe("reconcileElements with pages", () => {
  it("keeps each page ordered when indices repeat across pages", () => {
    const make = (version: number) => [
      element("a1", "p1", "a0", { version }),
      element("a2", "p1", "a1", { version }),
      element("b1", "p2", "a0", { version }),
      element("b2", "p2", "a1", { version }),
    ];
    const local = make(1);
    const remote = make(2) as unknown as RemoteExcalidrawElement[];

    const reconciled = reconcileElements(
      local as any,
      remote,
      getDefaultAppState() as unknown as AppState,
    );

    const pageOf = (pageId: string) =>
      reconciled.filter((element) => (element as any).pageId === pageId);

    expect(ids(pageOf("p1"))).toEqual(["a1", "a2"]);
    expect(ids(pageOf("p2"))).toEqual(["b1", "b2"]);
    expect(pageOf("p1").map((element) => element.index)).toEqual(["a0", "a1"]);
    expect(pageOf("p2").map((element) => element.index)).toEqual(["a0", "a1"]);
  });
});
