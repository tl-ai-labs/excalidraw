import { flushSync } from "react-dom";

import { arrayToMap, DEFAULT_PAGE_ID } from "@excalidraw/common";

import {
  deletePage,
  getElementPageId,
  getLivePages,
  getNeighbourPageId,
  getPageViewport,
  groupElementsByPage,
  movePage,
  newElementWith,
  newPage,
  renamePage,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawPage,
  PageViewport,
} from "@excalidraw/element/types";

import { actionFinalize } from "../actions";

import type { History } from "../history";
import type App from "./App";
import type { AppState, NormalizedZoomValue } from "../types";

type AppPagesDependencies = {
  getHistory: () => History;
  addNewImagesToImageCache: () => void;
};

const isOnlyDefaultPage = (pages: readonly ExcalidrawPage[]) => {
  const livePages = getLivePages(pages);
  return livePages.length === 1 && livePages[0].id === DEFAULT_PAGE_ID;
};

const getLivePageViewports = (
  viewports: Readonly<Record<string, PageViewport>>,
  pages: readonly ExcalidrawPage[],
) => {
  const liveViewports: Record<string, PageViewport> = {};
  for (const { id } of getLivePages(pages)) {
    if (viewports[id]) {
      liveViewports[id] = viewports[id];
    }
  }
  return liveViewports;
};

/**
 * Returns a copy of the appState without the page keys, which only AppPages
 * and a drawing replacement may write.
 */
export const omitPageState = <
  T extends {
    pages?: unknown;
    activePageId?: unknown;
    pageViewports?: unknown;
  },
>(
  appState: T | null,
): Omit<T, "pages" | "activePageId" | "pageViewports"> | null => {
  if (!appState) {
    return null;
  }
  const { pages, activePageId, pageViewports, ...rest } = appState;
  return rest;
};

/**
 * The page list and the active page: every change to either goes through
 * here, whether it comes from the tab bar, the host, a collaborator or a
 * loaded file. Commits are synchronous, so a page id is usable by the very
 * next call.
 */
export class AppPages {
  constructor(private app: App, private dependencies: AppPagesDependencies) {}

  public getPages = (): readonly ExcalidrawPage[] => {
    return getLivePages(this.app.state.pages);
  };

  public getActivePageId = (): string => {
    return this.app.state.activePageId;
  };

  public setActivePage = (pageId: string): void => {
    const { activePageId, pages } = this.app.state;
    if (
      pageId === activePageId ||
      !getLivePages(pages).some((page) => page.id === pageId)
    ) {
      return;
    }

    // commit in-progress work so that it lands on the leaving page
    this.app.text.textWysiwygSubmitHandler?.();
    flushSync(() => {
      const { multiElement, selectedLinearElement } = this.app.state;
      if (multiElement || selectedLinearElement?.isEditing) {
        this.app.actionManager.executeAction(actionFinalize);
      }
      this.app.setState({});
    });

    this.app.viewport.destroy();

    const state = this.app.state;
    const viewport = getPageViewport(state.pageViewports, pageId);
    const nextState: Pick<
      AppState,
      | "activePageId"
      | "pageViewports"
      | "scrollX"
      | "scrollY"
      | "zoom"
      | "selectedElementIds"
      | "previousSelectedElementIds"
      | "selectedGroupIds"
      | "hoveredElementIds"
      | "editingGroupId"
      | "selectedLinearElement"
      | "editingTextElement"
      | "newElement"
      | "multiElement"
      | "resizingElement"
      | "selectionElement"
      | "activeEmbeddable"
      | "activeLockedId"
      | "editingFrame"
      | "isCropping"
      | "croppingElementId"
      | "contextMenu"
      | "showHyperlinkPopup"
      | "suggestedBinding"
      | "frameToHighlight"
      | "elementsToHighlight"
      | "snapLines"
    > = {
      activePageId: pageId,
      pageViewports: {
        ...state.pageViewports,
        [state.activePageId]: {
          scrollX: state.scrollX,
          scrollY: state.scrollY,
          zoom: state.zoom.value,
        },
      },
      scrollX: viewport?.scrollX ?? 0,
      scrollY: viewport?.scrollY ?? 0,
      zoom: { value: (viewport?.zoom ?? 1) as NormalizedZoomValue },
      selectedElementIds: {},
      previousSelectedElementIds: {},
      selectedGroupIds: {},
      hoveredElementIds: {},
      editingGroupId: null,
      selectedLinearElement: null,
      editingTextElement: null,
      newElement: null,
      multiElement: null,
      resizingElement: null,
      selectionElement: null,
      activeEmbeddable: null,
      activeLockedId: null,
      editingFrame: null,
      isCropping: false,
      croppingElementId: null,
      contextMenu: null,
      showHyperlinkPopup: false,
      suggestedBinding: null,
      frameToHighlight: null,
      elementsToHighlight: null,
      snapLines: [],
    };

    this.dependencies.getHistory().setActivePage(pageId);
    flushSync(() => {
      this.app.scene.setActivePage(pageId);
      this.app.store.resetSnapshot(
        this.app.scene.getElementsMapIncludingDeleted(),
        { ...state, ...nextState },
      );
      this.app.setState(nextState);
    });

    // both only walk the active page
    this.dependencies.addNewImagesToImageCache();
    this.app.fonts
      .loadSceneFonts(state.currentItemFontFamily)
      .then((fontFaces) => this.app.fonts.onLoaded(fontFaces));
  };

  public createPage = ({
    name,
    activate = true,
  }: { name?: string; activate?: boolean } = {}): ExcalidrawPage => {
    const { pages } = this.app.state;
    const page = newPage(pages, name);

    flushSync(() => {
      this.app.setState({ pages: [...pages, page] });
    });

    if (activate) {
      this.setActivePage(page.id);
    }

    return page;
  };

  public renamePage = (pageId: string, name: string): void => {
    const { pages } = this.app.state;
    const nextPages = renamePage(pages, pageId, name);
    if (nextPages !== pages) {
      flushSync(() => {
        this.app.setState({ pages: nextPages });
      });
    }
  };

  public movePage = (pageId: string, toPosition: number): void => {
    const { pages } = this.app.state;
    const nextPages = movePage(pages, pageId, toPosition);
    if (nextPages !== pages) {
      flushSync(() => {
        this.app.setState({ pages: nextPages });
      });
    }
  };

  public deletePage = (pageId: string): boolean => {
    const { activePageId, pages } = this.app.state;
    const livePages = getLivePages(pages);
    if (
      livePages.length <= 1 ||
      !livePages.some((page) => page.id === pageId)
    ) {
      return false;
    }

    if (pageId === activePageId) {
      const neighbourId = getNeighbourPageId(livePages, pageId, undefined);
      if (neighbourId) {
        this.setActivePage(neighbourId);
      }
    }

    const elements = this.app.scene
      .getPageElements(pageId)
      .map((element) =>
        element.isDeleted
          ? element
          : newElementWith(element, { isDeleted: true }),
      );
    this.app.scene.replaceElementsByPage(new Map([[pageId, elements]]));
    this.dependencies.getHistory().deletePage(pageId);

    const nextPages = deletePage(this.app.state.pages, pageId);
    flushSync(() => {
      this.app.setState({
        pages: nextPages,
        pageViewports: getLivePageViewports(
          this.app.state.pageViewports,
          nextPages,
        ),
      });
    });

    return true;
  };

  public applyPages = (pages: readonly ExcalidrawPage[]): void => {
    const { activePageId, pages: prevPages, pageViewports } = this.app.state;
    if (pages === prevPages) {
      return;
    }

    // a list with no live page would leave the drawing with no page to show
    if (!getLivePages(pages).length) {
      return;
    }

    const prevLivePages = getLivePages(prevPages);
    const nextLivePages = getLivePages(pages);
    const nextIds = new Set(nextLivePages.map((page) => page.id));

    const history = this.dependencies.getHistory();
    for (const page of prevLivePages) {
      if (!nextIds.has(page.id)) {
        history.deletePage(page.id);
      }
    }

    flushSync(() => {
      this.app.setState({
        pages,
        pageViewports: getLivePageViewports(pageViewports, pages),
      });
    });

    if (!nextIds.has(activePageId)) {
      const nextActivePageId =
        getNeighbourPageId(prevLivePages, activePageId, nextIds) ??
        nextLivePages[0]?.id;
      if (nextActivePageId) {
        this.setActivePage(nextActivePageId);
      }
    }
  };

  /**
   * Groups a host's elements by the page they're written to.
   *
   * @returns null when the write can go straight to `replaceAllElements`
   */
  public routeElements = (
    elements: readonly ExcalidrawElement[],
    wholeDrawing: boolean,
  ): Map<string, ExcalidrawElement[]> | null => {
    const { activePageId, pages } = this.app.state;

    if (wholeDrawing) {
      const groups = groupElementsByPage(elements);
      if (!groups.has(activePageId)) {
        groups.set(activePageId, []);
      }
      return groups;
    }

    const livePages = getLivePages(pages);
    if (livePages.length === 1 && !this.app.scene.hasOtherPages()) {
      return null;
    }

    const groups = new Map<string, ExcalidrawElement[]>();
    if (!elements.length) {
      groups.set(activePageId, []);
      return groups;
    }

    const liveIds = new Set(livePages.map((page) => page.id));
    const existingElements = arrayToMap(
      this.app.scene.getAllElementsIncludingDeleted(),
    );

    for (const element of elements) {
      const existingElement = existingElements.get(element.id);
      let pageId = activePageId;
      if (element.pageId !== undefined && liveIds.has(element.pageId)) {
        pageId = element.pageId;
      } else if (existingElement) {
        pageId = getElementPageId(existingElement);
      }

      const group = groups.get(pageId);
      if (group) {
        group.push(element);
      } else {
        groups.set(pageId, [element]);
      }
    }

    return groups;
  };

  public isUndoableReplace = (pages: readonly ExcalidrawPage[]): boolean => {
    return (
      !this.app.scene.hasOtherPages() &&
      isOnlyDefaultPage(this.app.state.pages) &&
      isOnlyDefaultPage(pages)
    );
  };

  public replaceDrawing = (
    elements: readonly ExcalidrawElement[],
    appState: Pick<AppState, "pages" | "activePageId"> & Partial<AppState>,
  ): void => {
    if (this.isUndoableReplace(appState.pages)) {
      this.app.scene.replaceAllElements(elements);
      return;
    }

    const history = this.dependencies.getHistory();
    history.clear();
    history.setActivePage(appState.activePageId);
    this.app.scene.replaceElementsByPage(groupElementsByPage(elements), {
      replaceAll: true,
      activePageId: appState.activePageId,
    });
    this.app.store.resetSnapshot(
      this.app.scene.getElementsMapIncludingDeleted(),
      { ...this.app.state, ...appState },
    );
  };
}
