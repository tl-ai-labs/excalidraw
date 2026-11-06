import * as common from "@excalidraw/common";
import { DEFAULT_PAGE_ID } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  Scene,
  Store,
  getElementPageId,
  newElement,
  syncInvalidIndices,
} from "@excalidraw/element";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";

import type { ExcalidrawElement } from "@excalidraw/element/types";

const createTestElement = (
  overrides: Partial<ExcalidrawElement> & { id: string },
): ExcalidrawElement => {
  const base = newElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    boundElements: null,
    locked: false,
    ...(overrides.pageId ? { pageId: overrides.pageId } : {}),
  });
  return {
    ...base,
    ...overrides,
  } as ExcalidrawElement;
};

describe("Scene and Store page awareness", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isolates active-page elements in Scene queries while exposing all elements via getAll*", () => {
    const elPage1 = createTestElement({ id: "el-p1" });
    const elPage1Deleted = createTestElement({
      id: "el-p1-del",
      isDeleted: true,
    });
    const elPage2 = createTestElement({ id: "el-p2", pageId: "page-2" });
    const elPage2Deleted = createTestElement({
      id: "el-p2-del",
      pageId: "page-2",
      isDeleted: true,
    });

    const allOrdered = syncInvalidIndices([
      elPage1,
      elPage1Deleted,
      elPage2,
      elPage2Deleted,
    ]);
    const scene = new Scene(allOrdered);

    expect(scene.getActivePageId()).toBe(DEFAULT_PAGE_ID);
    expect(getElementPageId(elPage1)).toBe(DEFAULT_PAGE_ID);
    expect(getElementPageId(elPage2)).toBe("page-2");

    // Active page is DEFAULT_PAGE_ID
    expect(scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      elPage1.id,
    ]);
    expect(scene.getElementsIncludingDeleted().map((e) => e.id)).toEqual([
      elPage1.id,
      elPage1Deleted.id,
    ]);
    expect(Array.from(scene.getElementsMapIncludingDeleted().keys())).toEqual([
      elPage1.id,
      elPage1Deleted.id,
    ]);
    expect(scene.getElement(elPage1.id)?.id).toBe(elPage1.id);
    expect(scene.getElement(elPage2.id)).toBeNull();
    expect(
      scene
        .getSelectedElements({
          selectedElementIds: { [elPage1.id]: true, [elPage2.id]: true },
        })
        .map((e) => e.id),
    ).toEqual([elPage1.id]);

    // All-page getters always include both pages
    expect(scene.getAllNonDeletedElements().map((e) => e.id)).toEqual([
      elPage1.id,
      elPage2.id,
    ]);
    expect(scene.getAllElementsIncludingDeleted().map((e) => e.id)).toEqual([
      elPage1.id,
      elPage1Deleted.id,
      elPage2.id,
      elPage2Deleted.id,
    ]);
    expect(
      Array.from(scene.getAllElementsMapIncludingDeleted().keys()),
    ).toEqual([elPage1.id, elPage1Deleted.id, elPage2.id, elPage2Deleted.id]);

    // Switch active page to page-2
    scene.setActivePageId("page-2");
    expect(scene.getActivePageId()).toBe("page-2");
    expect(scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      elPage2.id,
    ]);
    expect(scene.getElementsIncludingDeleted().map((e) => e.id)).toEqual([
      elPage2.id,
      elPage2Deleted.id,
    ]);
    expect(Array.from(scene.getElementsMapIncludingDeleted().keys())).toEqual([
      elPage2.id,
      elPage2Deleted.id,
    ]);
    expect(scene.getElement(elPage1.id)).toBeNull();
    expect(scene.getElement(elPage2.id)?.id).toBe(elPage2.id);
    expect(
      scene
        .getSelectedElements({
          selectedElementIds: { [elPage1.id]: true, [elPage2.id]: true },
        })
        .map((e) => e.id),
    ).toEqual([elPage2.id]);

    // All-page getters still return everything
    expect(scene.getAllNonDeletedElements().map((e) => e.id)).toEqual([
      elPage1.id,
      elPage2.id,
    ]);
  });

  it("stamps non-default activePageId on insertElement and omits pageId on DEFAULT_PAGE_ID", () => {
    const scene = new Scene();
    const el1 = createTestElement({ id: "el-default" });
    const el2 = createTestElement({ id: "el-page2" });

    const randomSpy = vi.spyOn(common, "randomId");
    scene.insertElement(el1);
    expect(randomSpy).not.toHaveBeenCalled();

    const insertedDefault = scene.getElement("el-default")!;
    expect(insertedDefault).toBeDefined();
    expect(insertedDefault.pageId).toBeUndefined();
    expect(
      Object.prototype.hasOwnProperty.call(insertedDefault, "pageId"),
    ).toBe(false);

    scene.setActivePageId("page-2");
    scene.insertElement(el2);
    expect(randomSpy).not.toHaveBeenCalled();

    const insertedPage2 = scene.getElement("el-page2")!;
    expect(insertedPage2).toBeDefined();
    expect(insertedPage2.pageId).toBe("page-2");
    expect(scene.getAllNonDeletedElements().map((e) => e.id)).toEqual([
      "el-default",
      "el-page2",
    ]);
  });

  it("merges active-page updates with other pages in replaceAllElements and supports replaceAllPages", () => {
    const elPage1 = createTestElement({ id: "el-1", x: 10 });
    const elPage2 = createTestElement({ id: "el-2", x: 20, pageId: "page-2" });
    const scene = new Scene(syncInvalidIndices([elPage1, elPage2]));

    // Active page is DEFAULT_PAGE_ID; update only active page elements
    const updatedElPage1 = { ...elPage1, x: 99 };
    const newElPage1 = createTestElement({ id: "el-1b", x: 50 });
    scene.replaceAllElements(syncInvalidIndices([updatedElPage1, newElPage1]));

    expect(scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      "el-1",
      "el-1b",
    ]);
    expect(scene.getElement("el-1")?.x).toBe(99);
    // Page 2 element was preserved in master list
    expect(scene.getAllNonDeletedElements().map((e) => e.id)).toEqual([
      "el-2",
      "el-1",
      "el-1b",
    ]);

    // Switch to page-2 and update active page with an un-stamped new element
    scene.setActivePageId("page-2");
    const newOnPage2 = createTestElement({ id: "el-2b", x: 77 });
    scene.replaceAllElements(syncInvalidIndices([elPage2, newOnPage2]));

    expect(scene.getNonDeletedElements().map((e) => e.id)).toEqual([
      "el-2",
      "el-2b",
    ]);
    expect(scene.getElement("el-2b")?.pageId).toBe("page-2");
    expect(scene.getAllNonDeletedElements().map((e) => e.id)).toEqual([
      "el-1",
      "el-1b",
      "el-2",
      "el-2b",
    ]);

    // replaceAllPages: true replaces the entire master list
    const onlyEl = createTestElement({ id: "only-el", pageId: "page-2" });
    scene.replaceAllElements(syncInvalidIndices([onlyEl]), {
      replaceAllPages: true,
    });
    expect(scene.getAllNonDeletedElements().map((e) => e.id)).toEqual([
      "only-el",
    ]);
  });

  it("preserves non-active page elements in Store snapshot across micro-actions", () => {
    const elPage1 = createTestElement({ id: "store-p1", x: 10 });
    const elPage2 = createTestElement({
      id: "store-p2",
      x: 20,
      pageId: "page-2",
    });
    const scene = new Scene(syncInvalidIndices([elPage1, elPage2]));
    const appState = {
      ...getDefaultAppState(),
      offsetTop: 0,
      offsetLeft: 0,
      width: 800,
      height: 600,
    };

    const store = new Store({
      scene,
      state: appState,
    } as any);

    // Initialize store snapshot with both pages' elements
    store.scheduleAction(CaptureUpdateAction.NEVER);
    store.commit(scene.getAllElementsMapIncludingDeleted(), appState);

    expect(store.snapshot.elements.has(elPage1.id)).toBe(true);
    expect(store.snapshot.elements.has(elPage2.id)).toBe(true);

    // Switch to page-2 and mutate only page-2 via scheduleMicroAction
    scene.setActivePageId("page-2");
    const mutatedPage2 = {
      ...elPage2,
      x: 120,
      version: elPage2.version + 1,
      versionNonce: elPage2.versionNonce + 1,
    };

    store.scheduleMicroAction({
      action: CaptureUpdateAction.IMMEDIATELY,
      elements: syncInvalidIndices([mutatedPage2]),
      appState,
    });
    scene.replaceAllElements(syncInvalidIndices([mutatedPage2]));
    store.commit(scene.getAllElementsMapIncludingDeleted(), appState);

    // Both page-default and page-2 elements remain intact in store.snapshot.elements
    expect(store.snapshot.elements.get(elPage1.id)?.isDeleted).toBe(false);
    expect(store.snapshot.elements.get(elPage2.id)?.x).toBe(120);
  });
});
