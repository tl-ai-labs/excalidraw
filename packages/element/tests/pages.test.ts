import {
  DEFAULT_PAGE_ID,
  Scene,
  createPage,
  deletePage,
  getAdjacentPageId,
  getDefaultPageName,
  getDefaultPages,
  getElementPageId,
  getVisiblePages,
  movePage,
  newElement,
  reassignOrphanedElementsToPage,
  reconcilePages,
  renamePage,
  restorePageState,
  syncInvalidIndices,
  validateFractionalIndices,
} from "@excalidraw/element";

import type { DrawingPage, ExcalidrawElement } from "@excalidraw/element/types";

const makePage = (
  id: string,
  name: string,
  index: string,
  overrides: Partial<DrawingPage> = {},
): DrawingPage => ({
  id,
  name,
  index,
  version: 1,
  versionNonce: 0,
  isDeleted: false,
  ...overrides,
});

const makeRect = (id: string, pageId?: string): ExcalidrawElement => {
  const element = newElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...(pageId ? { pageId } : {}),
  });
  return { ...element, id };
};

const visibleIds = (pages: readonly DrawingPage[]) =>
  getVisiblePages(pages).map((page) => page.id);

describe("pages helper and scene filtering", () => {
  it("default page for legacy data", () => {
    const pages = getDefaultPages();
    expect(pages.length).toBe(1);
    expect(pages[0].id).toBe(DEFAULT_PAGE_ID);
    expect(pages[0].name).toBe("Page 1");

    const element = makeRect("a");
    expect("pageId" in element && element.pageId !== undefined).toBe(false);
    expect(getElementPageId(element)).toBe(DEFAULT_PAGE_ID);
  });

  it("default name is unique", () => {
    const pages: DrawingPage[] = [
      makePage("p1", "Page 1", "a0"),
      makePage("p2", "Page 2", "a1", { isDeleted: true }),
      makePage("p3", "Page 3", "a2"),
    ];

    expect(getDefaultPageName(pages)).toBe("Page 4");

    const pagesWithDeletedOnly: DrawingPage[] = [
      makePage("p1", "Page 1", "a0"),
      makePage("p2", "Page 2", "a1", { isDeleted: true }),
    ];

    expect(getDefaultPageName(pagesWithDeletedOnly)).toBe("Page 2");
  });

  it("createPage inserts after the given page", () => {
    const pages = [makePage("A", "A", "a0"), makePage("B", "B", "a1")];
    const { pages: nextPages, page } = createPage(pages, "A", undefined);

    expect(visibleIds(nextPages)).toEqual(["A", page.id, "B"]);
    expect(page.index > "a0").toBe(true);
    expect(page.index < "a1").toBe(true);
  });

  it("renamePage trims and rejects empty", () => {
    const pages = [makePage("A", "A", "a0")];

    const renamed = renamePage(pages, "A", "  Flow  ");
    expect(renamed[0].name).toBe("Flow");
    expect(renamed[0].version).toBeGreaterThan(pages[0].version);

    expect(renamePage(pages, "A", "   ")).toBe(pages);
  });

  it("movePage reorders", () => {
    const pages = [
      makePage("A", "A", "a0"),
      makePage("B", "B", "a1"),
      makePage("C", "C", "a2"),
    ];
    const moved = movePage(pages, "A", 2);

    expect(visibleIds(moved)).toEqual(["B", "C", "A"]);
    expect(moved.find((page) => page.id === "B")).toBe(pages[1]);
    expect(moved.find((page) => page.id === "C")).toBe(pages[2]);
    expect(moved.find((page) => page.id === "A")).not.toBe(pages[0]);
  });

  it("deletePage keeps at least one page", () => {
    const single = [makePage("A", "A", "a0")];
    expect(deletePage(single, "A")).toBe(single);

    const two = [makePage("A", "A", "a0"), makePage("B", "B", "a1")];
    const next = deletePage(two, "B");
    expect(next.find((page) => page.id === "B")?.isDeleted).toBe(true);
    expect(getVisiblePages(next).length).toBe(1);
  });

  it("adjacent page after delete", () => {
    const pages = [
      makePage("A", "A", "a0"),
      makePage("B", "B", "a1"),
      makePage("C", "C", "a2"),
    ];
    expect(getAdjacentPageId(pages, "B")).toBe("C");
    expect(getAdjacentPageId(pages, "C")).toBe("B");
  });

  it("restorePageState sanitizes input", () => {
    const restoredDefault = restorePageState(undefined);
    expect(restoredDefault.pages.length).toBe(1);
    expect(restoredDefault.pages[0].id).toBe(DEFAULT_PAGE_ID);
    expect(restoredDefault.activePageId).toBe(DEFAULT_PAGE_ID);

    const restored = restorePageState({
      pages: [
        makePage("A", "A", "a0"),
        makePage("A", "A duplicate", "a1"),
        makePage("B", "B", "not a key!"),
      ],
      activePageId: "unknown",
    });

    expect(restored.pages.filter((page) => page.id === "A").length).toBe(1);
    expect(restored.pages.some((page) => page.id === "B")).toBe(true);
    const indices = restored.pages.map((page) => page.index);
    expect(new Set(indices).size).toBe(indices.length);
    expect(
      indices.every(
        (index) => typeof index === "string" && index !== "not a key!",
      ),
    ).toBe(true);
    expect(restored.activePageId).toBe(getVisiblePages(restored.pages)[0].id);
  });

  it("reconcilePages keeps higher versions", () => {
    const local = [
      makePage("A", "Local A", "a1", { version: 3 }),
      makePage("B", "Local B", "a2", { version: 1 }),
    ];
    const remote = [
      makePage("A", "Remote A", "a1", { version: 2 }),
      makePage("B", "Remote B", "a2", { version: 5 }),
      makePage("C", "Remote C", "a0"),
    ];
    const result = reconcilePages(local, remote);

    expect(result.find((page) => page.id === "A")?.name).toBe("Local A");
    expect(result.find((page) => page.id === "B")?.name).toBe("Remote B");
    expect(result.some((page) => page.id === "C")).toBe(true);
    expect(visibleIds(result)).toEqual(["C", "A", "B"]);
  });

  it("orphaned elements move to the first page", () => {
    const pages = [makePage("p1", "Page 1", "a0"), makePage("p2", "P2", "a1")];
    const elements = [makeRect("a", "p2"), makeRect("b", "ghost")];
    const result = reassignOrphanedElementsToPage(elements, pages);

    expect(getElementPageId(result[0])).toBe("p2");
    expect(getElementPageId(result[1])).toBe("p1");
  });

  it("Scene filters by active page", () => {
    const scene = new Scene();
    const elements = syncInvalidIndices([
      makeRect("d1"),
      makeRect("p2a", "p2"),
      makeRect("d2"),
      makeRect("p2b", "p2"),
    ]);
    expect(() =>
      validateFractionalIndices(elements, {
        shouldThrow: true,
        includeBoundTextValidation: false,
      }),
    ).not.toThrow();
    scene.replaceAllElements(elements);

    const allIncludingDeleted = scene.getElementsIncludingDeleted();
    const nonce = scene.getSceneNonce();

    scene.setActivePageId("p2");

    expect(scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      "p2a",
      "p2b",
    ]);
    expect(scene.getNonDeletedElementsAllPages().length).toBe(4);
    expect(scene.getElementsIncludingDeleted()).toBe(allIncludingDeleted);
    expect(scene.getSceneNonce()).not.toBe(nonce);
  });

  it("Scene stamps inserted elements", () => {
    const scene = new Scene();
    scene.setActivePageId("p2");
    scene.insertElement(makeRect("new"));

    expect(scene.getElement("new")?.pageId).toBe("p2");
  });
});
