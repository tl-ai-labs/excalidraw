import { DEFAULT_PAGE_ID, DEFAULT_PAGE_NAME } from "@excalidraw/common";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";

import type {
  AppState,
  NormalizedZoomValue,
} from "@excalidraw/excalidraw/types";

import { Scene, getElementPageId } from "../src/Scene";
import { AppStateDelta } from "../src/delta";
import { syncInvalidIndices } from "../src/fractionalIndex";
import { newElement, newFrameElement } from "../src/newElement";
import { getObservedAppState } from "../src/store";

describe("pages element and scene support", () => {
  it("omits pageId for default page and preserves non-default pageId on newElement", () => {
    const defaultImplicit = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
    });
    const defaultExplicit = newElement({
      type: "rectangle",
      x: 10,
      y: 10,
      pageId: DEFAULT_PAGE_ID,
    });
    const secondPageEl = newElement({
      type: "rectangle",
      x: 20,
      y: 20,
      pageId: "page-2",
    });

    expect(defaultImplicit.pageId).toBeUndefined();
    expect("pageId" in defaultImplicit).toBe(false);
    expect(defaultExplicit.pageId).toBeUndefined();
    expect("pageId" in defaultExplicit).toBe(false);
    expect(secondPageEl.pageId).toBe("page-2");

    const knownPages = [{ id: DEFAULT_PAGE_ID }, { id: "page-2" }];
    expect(getElementPageId(defaultImplicit, knownPages)).toBe(DEFAULT_PAGE_ID);
    expect(getElementPageId(secondPageEl, knownPages)).toBe("page-2");
    expect(getElementPageId({ pageId: "page-99" }, knownPages)).toBe(
      DEFAULT_PAGE_ID,
    );
  });

  it("Scene filters non-deleted elements and frames by activePageId while retaining all elements in getElementsIncludingDeleted and getAllNonDeletedElements", () => {
    const rectPage1 = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
    });
    const framePage1 = newFrameElement({
      x: 0,
      y: 0,
      name: "Frame P1",
    });
    const rectPage2 = newElement({
      type: "rectangle",
      x: 50,
      y: 50,
      pageId: "page-2",
    });
    const framePage2 = newFrameElement({
      x: 50,
      y: 50,
      name: "Frame P2",
      pageId: "page-2",
    });
    const orphanRect = newElement({
      type: "rectangle",
      x: 100,
      y: 100,
      pageId: "page-99",
    });
    const deletedPage1 = {
      ...newElement({
        type: "rectangle",
        x: 150,
        y: 150,
      }),
      isDeleted: true,
    };

    const initialElements = syncInvalidIndices([
      rectPage1,
      framePage1,
      rectPage2,
      framePage2,
      orphanRect,
      deletedPage1,
    ]);

    const scene = new Scene(initialElements);
    const pageIds = new Set([DEFAULT_PAGE_ID, "page-2"]);

    scene.setActivePage(DEFAULT_PAGE_ID, pageIds);

    expect(scene.getActivePageId()).toBe(DEFAULT_PAGE_ID);
    expect(scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      rectPage1.id,
      framePage1.id,
      orphanRect.id,
    ]);
    expect(Array.from(scene.getNonDeletedElementsMap().keys())).toEqual([
      rectPage1.id,
      framePage1.id,
      orphanRect.id,
    ]);
    expect(scene.getNonDeletedFramesLikes().map((el) => el.id)).toEqual([
      framePage1.id,
    ]);
    expect(scene.getAllNonDeletedElements().map((el) => el.id)).toEqual([
      rectPage1.id,
      framePage1.id,
      rectPage2.id,
      framePage2.id,
      orphanRect.id,
    ]);
    expect(scene.getElementsIncludingDeleted()).toHaveLength(6);

    scene.setActivePage("page-2", pageIds);
    expect(scene.getActivePageId()).toBe("page-2");
    expect(scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      rectPage2.id,
      framePage2.id,
    ]);
    expect(scene.getNonDeletedFramesLikes().map((el) => el.id)).toEqual([
      framePage2.id,
    ]);
    expect(scene.getAllNonDeletedElements()).toHaveLength(5);

    const insertedOnPage2 = newElement({
      type: "ellipse",
      x: 10,
      y: 10,
    });
    scene.insertElement(insertedOnPage2);

    const insertedInScene = scene.getElement(insertedOnPage2.id);
    expect(insertedInScene?.pageId).toBe("page-2");
    expect(scene.getNonDeletedElements().map((el) => el.id)).toContain(
      insertedOnPage2.id,
    );

    const replacedOnPage2 = newElement({
      type: "diamond",
      x: 30,
      y: 30,
    });
    scene.replaceAllElements(
      syncInvalidIndices([
        ...scene.getElementsIncludingDeleted(),
        replacedOnPage2,
      ]),
    );
    expect(scene.getElement(replacedOnPage2.id)?.pageId).toBe("page-2");
  });

  it("StoreDelta and ObservedAppState ignore activePageId switches and never switch activePageId when applying deltas", () => {
    const emptyScene = new Scene();
    const baseAppState: AppState = {
      ...getDefaultAppState(),
      width: 100,
      height: 100,
      offsetTop: 0,
      offsetLeft: 0,
      pages: [
        {
          id: DEFAULT_PAGE_ID,
          name: DEFAULT_PAGE_NAME,
          scrollX: 0,
          scrollY: 0,
          zoom: { value: 1 as NormalizedZoomValue },
        },
        {
          id: "page-2",
          name: "Page 2",
          scrollX: 0,
          scrollY: 0,
          zoom: { value: 1 as NormalizedZoomValue },
        },
      ],
      activePageId: DEFAULT_PAGE_ID,
    };

    const switchedAppState = {
      ...baseAppState,
      activePageId: "page-2",
      pages: [
        {
          id: DEFAULT_PAGE_ID,
          name: DEFAULT_PAGE_NAME,
          scrollX: 120,
          scrollY: -80,
          zoom: { value: 2 as NormalizedZoomValue },
        },
        {
          id: "page-2",
          name: "Page 2",
          scrollX: 0,
          scrollY: 0,
          zoom: { value: 1 as NormalizedZoomValue },
        },
      ],
    };

    const observedBefore = getObservedAppState(baseAppState);
    const observedAfterSwitch = getObservedAppState(switchedAppState);

    expect("activePageId" in observedBefore).toBe(false);
    expect("activePageId" in observedAfterSwitch).toBe(false);

    const switchDelta = AppStateDelta.calculate(
      observedBefore,
      observedAfterSwitch,
    );
    expect(switchDelta.isEmpty()).toBe(true);

    const renamedAppState = {
      ...switchedAppState,
      pages: [
        switchedAppState.pages[0],
        {
          ...switchedAppState.pages[1],
          name: "Architecture",
        },
      ],
    };
    const observedAfterRename = getObservedAppState(renamedAppState);
    const renameDelta = AppStateDelta.calculate(
      observedAfterSwitch,
      observedAfterRename,
    );
    expect(renameDelta.isEmpty()).toBe(false);

    const [nextAppState] = renameDelta.applyTo(
      switchedAppState,
      emptyScene.getElementsMapIncludingDeleted(),
    );

    expect(nextAppState.activePageId).toBe("page-2");
    expect(nextAppState.pages[1]?.name).toBe("Architecture");

    const inverseRenameDelta = renameDelta.inverse();
    const [revertedAppState] = inverseRenameDelta.applyTo(
      {
        ...nextAppState,
        activePageId: "page-2",
      },
      emptyScene.getElementsMapIncludingDeleted(),
    );
    expect(revertedAppState.activePageId).toBe("page-2");
    expect(revertedAppState.pages[1]?.name).toBe("Page 2");
  });
});
