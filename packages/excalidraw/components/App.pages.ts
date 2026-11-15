import {
  CaptureUpdateAction,
  getVisiblePages,
  isElementOnPage,
  isVisiblePage,
  newElementWith,
  newPage,
  resolveActivePageId,
  updatePage,
} from "@excalidraw/element";

import type { ExcalidrawPage } from "@excalidraw/element/types";

import { actionFinalize } from "../actions";
import { t } from "../i18n";
import { getScrollToContentState } from "../viewport";

import type { AppState } from "../types";
import type App from "./App";

/**
 * Owns the pages of the drawing: creating, renaming, reordering, deleting
 * pages and switching between them.
 *
 * Page metadata lives in `appState.pages` (persisted & synced with the
 * document), elements are linked to their page by `element.pageId`. The
 * scene and the history expose only the active page (see
 * `Scene.setActivePageId()`, `History.setActivePage()`).
 */
export class AppPages {
  constructor(
    private app: App,
    private dependencies: {
      /** swaps the scene's & history's active page (synchronously) */
      syncActivePage: (pageId: string) => void;
    },
  ) {}

  /** non-deleted pages, in tab order */
  getPages = (): ExcalidrawPage[] => getVisiblePages(this.app.state.pages);

  getActivePageId = () => this.app.state.activePageId;

  /** non-deleted elements of the page, or of the active page */
  getPageElements = (pageId: string = this.app.state.activePageId) =>
    this.app.scene
      .getAllPagesElementsIncludingDeleted()
      .filter(
        (element) => !element.isDeleted && isElementOnPage(element, pageId),
      );

  /**
   * Shows the page: its elements, and the viewport it was last left at
   * (scrolled to its content if it wasn't visited yet). Selection is
   * cleared, and undo / redo switch to the page's own history.
   */
  setActive = (pageId: string) => {
    if (
      pageId === this.app.state.activePageId ||
      !isVisiblePage(this.app.state.pages, pageId)
    ) {
      return;
    }
    this.switchTo(pageId, {});
  };

  /**
   * Adds a page after the last one (or at `index` of the visible pages)
   * and switches to it.
   */
  create = (opts?: { name?: string; index?: number; activate?: boolean }) => {
    const pages = this.getPages();
    const index = Math.max(
      0,
      Math.min(opts?.index ?? pages.length, pages.length),
    );
    const page = newPage({
      name: opts?.name?.trim() || this.getNextPageName(pages),
      order: 0,
    });

    const nextPages = this.reorder(
      [...pages.slice(0, index), page, ...pages.slice(index)],
      // a fresh page has version 1, set its order without bumping it
      page.id,
    );
    const allPages = [
      ...this.app.state.pages.filter((p) => p.isDeleted),
      ...nextPages,
    ];

    if (opts?.activate === false) {
      this.commit({ pages: allPages });
    } else {
      this.switchTo(page.id, { pages: allPages });
    }

    return allPages.find((p) => p.id === page.id)!;
  };

  rename = (pageId: string, name: string) => {
    const nextName = name.trim();
    const page = this.app.state.pages.find((p) => p.id === pageId);
    if (!page || page.isDeleted || !nextName || nextName === page.name) {
      return;
    }
    this.commit({
      pages: this.app.state.pages.map((p) =>
        p.id === pageId ? updatePage(p, { name: nextName }) : p,
      ),
    });
  };

  /** moves the page to `toIndex` of the visible pages */
  move = (pageId: string, toIndex: number) => {
    const pages = this.getPages();
    const fromIndex = pages.findIndex((p) => p.id === pageId);
    if (fromIndex === -1) {
      return;
    }
    toIndex = Math.max(0, Math.min(toIndex, pages.length - 1));
    if (toIndex === fromIndex) {
      return;
    }
    const nextVisible = [...pages];
    const [page] = nextVisible.splice(fromIndex, 1);
    nextVisible.splice(toIndex, 0, page);

    this.commit({
      pages: [
        ...this.app.state.pages.filter((p) => p.isDeleted),
        ...this.reorder(nextVisible),
      ],
    });
  };

  /**
   * Deletes the page and its elements. The last page can't be deleted.
   * Not undoable (the page's history is dropped).
   *
   * @returns whether the page was deleted
   */
  delete = (pageId: string) => {
    const pages = this.getPages();
    const index = pages.findIndex((p) => p.id === pageId);
    if (index === -1 || pages.length < 2) {
      return false;
    }

    const nextPages = this.app.state.pages.map((p) =>
      p.id === pageId ? updatePage(p, { isDeleted: true }) : p,
    );

    // delete (rather than remove) the elements, so that the deletion syncs
    const scene = this.app.scene;
    let didDeleteElements = false;
    const nextElements = scene
      .getAllPagesElementsIncludingDeleted()
      .map((element) => {
        if (!element.isDeleted && isElementOnPage(element, pageId)) {
          didDeleteElements = true;
          return newElementWith(element, { isDeleted: true });
        }
        return element;
      });

    if (pageId === this.app.state.activePageId) {
      const neighbor = pages[index + 1] ?? pages[index - 1];
      this.switchTo(neighbor.id, { pages: nextPages });
    } else {
      this.commit({ pages: nextPages });
    }

    if (didDeleteElements) {
      scene.replaceAllElements(nextElements, { replaceAllPages: true });
    }
    this.app.history.clearPage(pageId);

    return true;
  };

  /** "Page N", with the first N (from the page count up) not in use */
  private getNextPageName(pages: readonly ExcalidrawPage[]) {
    const names = new Set(pages.map((page) => page.name));
    let number = pages.length + 1;
    while (names.has(t("pages.defaultName", { number }))) {
      number++;
    }
    return t("pages.defaultName", { number });
  }

  /** sets `order` to the position, bumping versions of changed pages */
  private reorder(pages: readonly ExcalidrawPage[], newPageId?: string) {
    return pages.map((page, order) => {
      if (page.id === newPageId) {
        return { ...page, order };
      }
      return page.order === order ? page : updatePage(page, { order });
    });
  }

  private commit(updates: Pick<AppState, "pages">) {
    // page changes aren't undoable, and must not end up in the next undo
    // entry either
    this.app.store.scheduleAction(CaptureUpdateAction.NEVER);
    this.app.setState(updates);
  }

  private switchTo(pageId: string, updates: Partial<Pick<AppState, "pages">>) {
    const app = this.app;

    // finish what's in progress on the current page: the text editor
    // submits on blur, the rest is finalized
    if (app.state.editingTextElement) {
      const activeElement = app.ownerDocument.activeElement;
      if (activeElement instanceof app.ownerWindow.HTMLElement) {
        activeElement.blur();
      }
    }
    if (app.state.multiElement || app.state.newElement) {
      app.actionManager.executeAction(actionFinalize);
    }

    const state = app.state;
    const pages = updates.pages ?? state.pages;
    const nextPageId = resolveActivePageId(pages, pageId);

    const pageViewports = {
      ...state.pageViewports,
      [state.activePageId]: {
        scrollX: state.scrollX,
        scrollY: state.scrollY,
        zoom: state.zoom,
      },
    };

    const viewport = pageViewports[nextPageId] ?? {
      ...getScrollToContentState(this.getPageElements(nextPageId), state),
      zoom: state.zoom,
    };

    this.dependencies.syncActivePage(nextPageId);

    // the viewport and selection of the previous page aren't undoable state
    // of the next page
    app.store.scheduleAction(CaptureUpdateAction.NEVER);
    app.setState({
      pages,
      activePageId: nextPageId,
      pageViewports,
      scrollX: viewport.scrollX,
      scrollY: viewport.scrollY,
      zoom: viewport.zoom,
      selectedElementIds: {},
      selectedGroupIds: {},
      previousSelectedElementIds: {},
      editingGroupId: null,
      selectedLinearElement: null,
      editingTextElement: null,
      hoveredElementIds: {},
      activeEmbeddable: null,
      showHyperlinkPopup: false,
      contextMenu: null,
      frameToHighlight: null,
      elementsToHighlight: null,
      snapLines: [],
      suggestedBinding: null,
      editingFrame: null,
      activeLockedId: null,
      isCropping: false,
      croppingElementId: null,
    });
  }
}
