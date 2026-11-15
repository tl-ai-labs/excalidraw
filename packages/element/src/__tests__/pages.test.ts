import { Scene } from "../Scene";
import {
  orderByFractionalIndex,
  syncInvalidIndices,
  syncMovedIndices,
  validateFractionalIndices,
} from "../fractionalIndex";
import { newElementWith } from "../mutateElement";
import { newElement } from "../newElement";
import {
  DEFAULT_PAGE_ID,
  getDefaultPage,
  getElementPageId,
  getVisiblePages,
  newPage,
  reconcilePages,
  resolveActivePageId,
  restorePages,
  updatePage,
} from "../pages";

import type {
  ExcalidrawElement,
  FractionalIndex,
  OrderedExcalidrawElement,
} from "../types";

const rect = (id: string, pageId?: string, index: string | null = null) => {
  const element = newElement({ type: "rectangle", x: 0, y: 0 });
  return {
    ...element,
    id,
    index: index as FractionalIndex | null,
    ...(pageId ? { pageId } : {}),
  } as OrderedExcalidrawElement;
};

const ids = (elements: readonly ExcalidrawElement[]) =>
  elements.map((element) => element.id);

describe("pages", () => {
  describe("Scene", () => {
    it("exposes all elements without an active page", () => {
      const scene = new Scene([rect("a"), rect("b", "p2")], {
        skipValidation: true,
      });
      expect(ids(scene.getElementsIncludingDeleted())).toEqual(["a", "b"]);
    });

    it("exposes the active page's elements, and keeps other pages on replace", () => {
      const scene = new Scene([rect("a"), rect("b", "p2"), rect("c")], {
        skipValidation: true,
      });
      scene.setActivePageId(DEFAULT_PAGE_ID);

      expect(ids(scene.getElementsIncludingDeleted())).toEqual(["a", "c"]);
      expect(ids(scene.getNonDeletedElements())).toEqual(["a", "c"]);
      expect(scene.getElement("b")).toBe(null);
      expect(scene.getAllPagesElementsMapIncludingDeleted().has("b")).toBe(
        true,
      );

      // replacing the page's elements doesn't drop the other page
      scene.replaceAllElements([scene.getElement("c")!]);
      expect(ids(scene.getElementsIncludingDeleted())).toEqual(["c"]);
      expect(ids(scene.getAllPagesElementsIncludingDeleted())).toEqual([
        "c",
        "b",
      ]);

      scene.setActivePageId("p2");
      expect(ids(scene.getElementsIncludingDeleted())).toEqual(["b"]);

      // `replaceAllPages` replaces the whole document
      scene.replaceAllElements([rect("d")], { replaceAllPages: true });
      expect(ids(scene.getAllPagesElementsIncludingDeleted())).toEqual(["d"]);
      expect(ids(scene.getElementsIncludingDeleted())).toEqual([]);
    });

    it("assigns new elements without a page to the active page", () => {
      const scene = new Scene([rect("a")], { skipValidation: true });
      scene.setActivePageId("p2");

      const added = rect("b");
      scene.insertElement(added);
      expect(added.pageId).toBe("p2");
      expect(ids(scene.getElementsIncludingDeleted())).toEqual(["b"]);

      // existing elements of the default page aren't moved
      scene.replaceAllElements(scene.getAllPagesElementsIncludingDeleted());
      expect(
        getElementPageId(
          scene.getAllPagesElementsMapIncludingDeleted().get("a")!,
        ),
      ).toBe(DEFAULT_PAGE_ID);

      // ... and on the default page, new elements don't get a pageId at all
      scene.setActivePageId(DEFAULT_PAGE_ID);
      const added2 = rect("c");
      scene.insertElement(added2);
      expect(added2.pageId).toBeUndefined();
      expect(ids(scene.getElementsIncludingDeleted())).toEqual(["a", "c"]);
    });

    it("replaces the page an element moved to", () => {
      const scene = new Scene([rect("a"), rect("b")], { skipValidation: true });
      scene.setActivePageId(DEFAULT_PAGE_ID);

      const moved = newElementWith(scene.getElement("b")!, { pageId: "p2" });
      scene.replaceAllElements([scene.getElement("a")!, moved]);

      expect(ids(scene.getElementsIncludingDeleted())).toEqual(["a"]);
      expect(ids(scene.getAllPagesElementsIncludingDeleted())).toEqual([
        "a",
        "b",
      ]);
      scene.setActivePageId("p2");
      expect(scene.getElement("b")).toBe(moved);
    });
  });

  describe("fractional indices", () => {
    it("are validated and synced per page", () => {
      // every page starts its own order
      const elements = [
        rect("a", undefined, "a0"),
        rect("b", undefined, "a1"),
        rect("c", "p2", "a0"),
        rect("d", "p2", "a1"),
      ];
      expect(() =>
        validateFractionalIndices(elements, {
          shouldThrow: true,
          includeBoundTextValidation: true,
          ignoreLogs: true,
        }),
      ).not.toThrow();

      const versions = elements.map((element) => element.version);
      syncInvalidIndices(elements);
      expect(elements.map((element) => element.index)).toEqual([
        "a0",
        "a1",
        "a0",
        "a1",
      ]);
      expect(elements.map((element) => element.version)).toEqual(versions);
    });

    it("syncs moved elements without touching other pages", () => {
      const a = rect("a", undefined, "a0");
      const b = rect("b", undefined, "a1");
      const c = rect("c", "p2", "a0");
      const d = rect("d", "p2", "a1");
      // move "b" to the back of the default page
      const elements = [b, a, c, d];
      syncMovedIndices(elements, new Map([[b.id, b]]));

      expect(b.index! < a.index!).toBe(true);
      expect(a.index).toBe("a0");
      expect(c.index).toBe("a0");
      expect(d.index).toBe("a1");
    });

    it("orders by page, then by index", () => {
      const elements = [
        rect("c", "p2", "a1"),
        rect("a", undefined, "a1"),
        rect("d", "p2", "a0"),
        rect("b", undefined, "a0"),
      ];
      expect(ids(orderByFractionalIndex(elements))).toEqual([
        "d",
        "c",
        "b",
        "a",
      ]);
    });
  });

  describe("restore & reconcile", () => {
    it("restores scenes without pages onto the default page", () => {
      expect(restorePages(undefined)).toEqual([getDefaultPage()]);
      expect(restorePages([])).toEqual([getDefaultPage()]);
      expect(resolveActivePageId(restorePages(undefined), undefined)).toBe(
        DEFAULT_PAGE_ID,
      );
      expect(getElementPageId(rect("a"))).toBe(DEFAULT_PAGE_ID);
    });

    it("sanitizes pages and keeps at least one visible page", () => {
      const deletedDefault = updatePage(getDefaultPage(), { isDeleted: true });
      const restored = restorePages([
        deletedDefault,
        { id: 1 },
        null,
        { id: "x", name: "", isDeleted: true },
        { id: "x", name: "duplicate" },
      ]);
      expect(getVisiblePages(restored).map((page) => page.id)).toEqual([
        DEFAULT_PAGE_ID,
      ]);
      expect(restored.find((page) => page.id === "x")!.isDeleted).toBe(true);
    });

    it("resolves the active page to a visible one", () => {
      const p2 = newPage({ name: "Page 2", order: 1 });
      const pages = [getDefaultPage(), updatePage(p2, { isDeleted: true })];
      expect(resolveActivePageId(pages, p2.id)).toBe(DEFAULT_PAGE_ID);
      expect(resolveActivePageId(pages, "missing")).toBe(DEFAULT_PAGE_ID);
    });

    it("reconciles pages per page by version", () => {
      const base = getDefaultPage();
      const p2 = newPage({ name: "Page 2", order: 1 });

      const local = [updatePage(base, { name: "Local" }), p2];
      const remote = [
        base,
        updatePage(updatePage(p2, { name: "Remote" }), { order: 2 }),
        newPage({ name: "Page 3", order: 3, id: "p3" }),
      ];

      const reconciled = reconcilePages(local, remote);
      expect(reconciled.map((page) => page.name)).toEqual([
        "Local",
        "Remote",
        "Page 3",
      ]);

      // no change keeps the instance
      expect(reconcilePages(reconciled, remote)).toBe(reconciled);

      // tombstones win over older versions
      const deleted = updatePage(reconciled[2], { isDeleted: true });
      expect(
        getVisiblePages(reconcilePages(reconciled, [deleted])).map(
          (page) => page.name,
        ),
      ).toEqual(["Local", "Remote"]);
    });
  });
});
