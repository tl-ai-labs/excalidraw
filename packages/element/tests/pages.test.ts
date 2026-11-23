import {
  createPage,
  deletePage,
  getAdjacentPageId,
  getDefaultPage,
  getVisiblePages,
  MAX_PAGE_NAME_LENGTH,
  movePage,
  reconcilePages,
  renamePage,
  repairElementPages,
  restoreActivePageId,
  restorePages,
  syncInvalidIndices,
  validateFractionalIndices,
} from "@excalidraw/element";

import { validateOrderKey } from "@excalidraw/fractional-indexing";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawPage,
  FractionalIndex,
} from "@excalidraw/element/types";

const makePage = (
  id: string,
  index: string,
  overrides: Partial<ExcalidrawPage> = {},
): ExcalidrawPage => ({
  id,
  name: id,
  index,
  version: 1,
  versionNonce: 0,
  isDeleted: false,
  ...overrides,
});

const ids = (pages: readonly ExcalidrawPage[]) => pages.map((page) => page.id);

describe("page model helpers", () => {
  it("getDefaultPage is deterministic", () => {
    const first = getDefaultPage();
    const second = getDefaultPage();
    expect(first).toEqual(second);
    expect(first.id).toBe("page-1");
    expect(first.name).toBe("Page 1");
  });

  it("createPage appends after the last visible page", () => {
    const initial = [getDefaultPage()];
    const { pages, page } = createPage(initial, "Page 2", "p2");
    expect(pages).toHaveLength(2);
    expect(page.id).toBe("p2");
    expect(page.index > initial[0].index).toBe(true);
    expect(ids(getVisiblePages(pages))).toEqual(["page-1", "p2"]);
  });

  it("renamePage rejects empty names", () => {
    const pages = [getDefaultPage()];
    expect(renamePage(pages, "page-1", "   ")).toBe(pages);
  });

  it("renamePage bumps version", () => {
    const pages = [getDefaultPage()];
    const next = renamePage(pages, "page-1", "SDK flow");
    expect(next[0].name).toBe("SDK flow");
    expect(next[0].version).toBe(pages[0].version + 1);
  });

  it("movePage reorders and refuses edges", () => {
    const pages = [
      makePage("A", "a0"),
      makePage("B", "a1"),
      makePage("C", "a2"),
    ];
    const moved = movePage(pages, "C", -1);
    expect(ids(getVisiblePages(moved))).toEqual(["A", "C", "B"]);
    const refused = movePage(moved, "A", -1);
    expect(refused).toBe(moved);
    expect(ids(getVisiblePages(refused))).toEqual(["A", "C", "B"]);
  });

  it("deletePage refuses the last page and tombstones otherwise", () => {
    const single = [makePage("A", "a0")];
    expect(deletePage(single, "A")).toBe(single);

    const two = [makePage("A", "a0"), makePage("B", "a1")];
    const next = deletePage(two, "B");
    expect(next.find((page) => page.id === "B")?.isDeleted).toBe(true);
    expect(ids(getVisiblePages(next))).toEqual(["A"]);
  });

  it("getAdjacentPageId prefers the next page", () => {
    const pages = [
      makePage("A", "a0"),
      makePage("B", "a1"),
      makePage("C", "a2"),
    ];
    expect(getAdjacentPageId(pages, "A")).toBe("B");
    expect(getAdjacentPageId(pages, "B")).toBe("C");
    expect(getAdjacentPageId(pages, "C")).toBe("B");
  });

  it("restorePages repairs invalid input", () => {
    expect(ids(restorePages(undefined))).toEqual(["page-1"]);
    expect(ids(restorePages([]))).toEqual(["page-1"]);
    expect(ids(restorePages([{ name: "no id" }]))).toEqual(["page-1"]);

    const restored = restorePages([
      makePage("A", "a0", { name: "first" }),
      makePage("A", "a1", { name: "duplicate" }),
      makePage("B", "a2"),
    ]);
    expect(ids(restored)).toEqual(["A", "B"]);
    expect(restored[0].name).toBe("first");
  });

  it("restorePages repairs a malformed index followed by a missing index", () => {
    const restored = restorePages([
      { id: "x", name: "X", index: "!" },
      { id: "y", name: "Y" },
    ]);
    expect(restored).toHaveLength(2);
    for (const page of restored) {
      expect(() => validateOrderKey(page.index)).not.toThrow();
    }
    expect(restored[0].index < restored[1].index).toBe(true);
    expect(() => createPage(restored, "Z", "z")).not.toThrow();
    expect(() => movePage(restored, restored[1].id, -1)).not.toThrow();
    expect(() => movePage(restored, restored[0].id, 1)).not.toThrow();
  });

  it("restorePages truncates names longer than the cap", () => {
    const restored = restorePages([
      { id: "x", name: "n".repeat(MAX_PAGE_NAME_LENGTH + 10), index: "a0" },
    ]);
    expect(restored[0].name).toHaveLength(MAX_PAGE_NAME_LENGTH);
  });

  it("restorePages drops prototype-polluting ids", () => {
    const restored = restorePages([
      { id: "__proto__", name: "a", index: "a0" },
      { id: "constructor", name: "b", index: "a1" },
      { id: "prototype", name: "c", index: "a2" },
      { id: "ok", name: "d", index: "a3" },
    ]);
    expect(ids(restored)).toEqual(["ok"]);
  });

  it("restorePages replaces non-safe-integer versions", () => {
    const restored = restorePages([
      { id: "x", name: "X", index: "a0", version: 1e308 },
      { id: "y", name: "Y", index: "a1", version: NaN },
    ]);
    for (const page of restored) {
      expect(Number.isSafeInteger(page.version)).toBe(true);
    }
  });

  it("restoreActivePageId falls back to the first visible page", () => {
    const pages = [
      makePage("A", "a0", { isDeleted: true }),
      makePage("B", "a1"),
      makePage("C", "a2"),
    ];
    expect(restoreActivePageId(pages, "unknown")).toBe("B");
    expect(restoreActivePageId(pages, "A")).toBe("B");
  });

  it("reconcilePages takes the higher version", () => {
    const local = makePage("A", "a0", { name: "local", version: 2 });
    const remote = makePage("A", "a0", { name: "remote", version: 3 });
    expect(reconcilePages([local], [remote])).toEqual([remote]);

    const lowNonce = makePage("A", "a0", {
      name: "low",
      version: 2,
      versionNonce: 1,
    });
    const highNonce = makePage("A", "a0", {
      name: "high",
      version: 2,
      versionNonce: 9,
    });
    expect(reconcilePages([highNonce], [lowNonce])).toEqual([lowNonce]);
    expect(reconcilePages([lowNonce], [highNonce])).toEqual([lowNonce]);
  });

  it("repairElementPages moves dangling elements and cuts cross-page links", () => {
    const pages = [makePage("p1", "a0"), makePage("p2", "a1")];
    const noPage = API.createElement({ type: "rectangle" });
    const unknownPage = {
      ...API.createElement({ type: "rectangle" }),
      pageId: "missing",
    };
    const target = {
      ...API.createElement({ type: "rectangle" }),
      pageId: "p2",
    };
    const arrowBase = API.createElement({ type: "arrow" });
    const arrow = {
      ...arrowBase,
      pageId: "p1",
      startBinding: { elementId: target.id, focus: 0, gap: 0 },
    } as unknown as ExcalidrawLinearElement;

    const repaired = repairElementPages<ExcalidrawElement>(
      [noPage, unknownPage, target, arrow],
      pages,
      "p1",
    );
    const byId = new Map(repaired.map((element) => [element.id, element]));
    expect(byId.get(noPage.id)?.pageId).toBe("p1");
    expect(byId.get(unknownPage.id)?.pageId).toBe("p1");
    expect(byId.get(target.id)?.pageId).toBe("p2");
    const repairedArrow = byId.get(arrow.id) as
      | ExcalidrawLinearElement
      | undefined;
    expect(repairedArrow?.startBinding).toBeNull();
  });
});

describe("per-page fractional indices", () => {
  it("syncInvalidIndices validates each page separately", () => {
    const make = (pageId: string, index: string) => ({
      ...API.createElement({ type: "rectangle" }),
      pageId,
      index: index as FractionalIndex,
    });
    const elements = [
      make("p1", "a1"),
      make("p2", "a0"),
      make("p1", "a2"),
      make("p2", "a1"),
    ];
    const before = elements.map((element) => element.index);

    const synced = syncInvalidIndices(elements);
    expect(synced.map((element) => element.index)).toEqual(before);
    expect(() =>
      validateFractionalIndices(synced, {
        shouldThrow: true,
        includeBoundTextValidation: true,
        ignoreLogs: true,
      }),
    ).not.toThrow();
  });
});
