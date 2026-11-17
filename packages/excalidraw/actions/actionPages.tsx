import {
  CaptureUpdateAction,
  createPage,
  getCommonBounds,
  getLivePages,
  movePage,
  newElementWith,
  updatePage,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";
import { centerScrollOn } from "../viewport";

import { register } from "./register";

import type { AppState, PageViewport } from "../types";
import type { ActionResult } from "./types";

/** state which is only meaningful on the page it was created on */
const getTransientPageState = (): Partial<AppState> => ({
  selectedElementIds: {},
  selectedGroupIds: {},
  editingGroupId: null,
  selectedLinearElement: null,
  newElement: null,
  editingTextElement: null,
  selectionElement: null,
  multiElement: null,
  resizingElement: null,
  suggestedBinding: null,
  frameToHighlight: null,
  editingFrame: null,
  croppingElementId: null,
  activeEmbeddable: null,
  contextMenu: null,
  elementsToHighlight: null,
  hoveredElementIds: {},
});

/**
 * Computes the appState update for switching to another page: saves the
 * viewport of the current page and restores the target's (or a default
 * viewport, centered on the page's content, if it was never visited).
 */
export const getSwitchPageAppState = (
  appState: Readonly<AppState>,
  nextPageId: string,
  nextPageElements: readonly ExcalidrawElement[],
): Partial<AppState> => {
  const pageViewports: Record<string, PageViewport> = {
    ...appState.pageViewports,
    [appState.activePageId]: {
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom,
    },
  };

  let viewport = pageViewports[nextPageId];
  if (!viewport) {
    const zoom = { value: 1 as AppState["zoom"]["value"] };
    const visible = nextPageElements.filter((el) => !el.isDeleted);
    if (visible.length) {
      const [minX, minY, maxX, maxY] = getCommonBounds(visible);
      viewport = {
        zoom,
        ...centerScrollOn({
          scenePoint: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
          viewportDimensions: {
            width: appState.width,
            height: appState.height,
          },
          zoom,
        }),
      };
    } else {
      viewport = { scrollX: 0, scrollY: 0, zoom };
    }
  }

  return {
    ...getTransientPageState(),
    pageViewports,
    activePageId: nextPageId,
    scrollX: viewport.scrollX,
    scrollY: viewport.scrollY,
    zoom: viewport.zoom,
  };
};

type PageActionValue = {
  id?: string;
  name?: string;
  /** target position among the live pages (movePage) */
  to?: number;
  skipConfirm?: boolean;
};

const resolvePageId = (appState: Readonly<AppState>, value?: PageActionValue) =>
  value?.id ?? appState.activePageId;

export const actionSwitchPage = register<PageActionValue>({
  name: "switchPage",
  label: "pages.switch",
  allPages: true,
  viewMode: true,
  navigation: true,
  trackEvent: { category: "canvas", action: "switchPage" },
  perform: (elements, appState, value, app) => {
    const id = value?.id;
    if (
      !id ||
      id === appState.activePageId ||
      !getLivePages(appState.pages).some((page) => page.id === id)
    ) {
      return false;
    }
    return {
      appState: getSwitchPageAppState(
        appState,
        id,
        elements.filter((el) => app.scene.getElementPageId(el) === id),
      ),
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionCreatePage = register<PageActionValue>({
  name: "createPage",
  label: "pages.new",
  allPages: true,
  trackEvent: { category: "canvas", action: "createPage" },
  predicate: (elements, appState) => !appState.viewModeEnabled,
  perform: (elements, appState) => {
    const page = createPage(appState.pages, undefined);
    return {
      appState: {
        ...getSwitchPageAppState(appState, page.id, []),
        pages: [...appState.pages, page],
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionRenamePage = register<PageActionValue>({
  name: "renamePage",
  label: "pages.rename",
  allPages: true,
  trackEvent: { category: "canvas", action: "renamePage" },
  predicate: (elements, appState) => !appState.viewModeEnabled,
  perform: (elements, appState, value) => {
    const id = resolvePageId(appState, value);
    const name = value?.name?.trim();
    const page = appState.pages.find((page) => page.id === id);
    if (!page || page.isDeleted || !name || name === page.name) {
      return false;
    }
    return {
      appState: { pages: updatePage(appState.pages, id, { name }) },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

const createMoveAction = (name: "movePageLeft" | "movePageRight") => {
  const direction = name === "movePageLeft" ? -1 : 1;
  return register<PageActionValue>({
    name,
    label: name === "movePageLeft" ? "pages.moveLeft" : "pages.moveRight",
    allPages: true,
    trackEvent: { category: "canvas", action: name },
    predicate: (elements, appState) => !appState.viewModeEnabled,
    perform: (elements, appState, value) => {
      const id = resolvePageId(appState, value);
      const live = getLivePages(appState.pages);
      const position = live.findIndex((page) => page.id === id);
      const target = position + direction;
      if (position === -1 || target < 0 || target >= live.length) {
        return false;
      }
      return {
        appState: { pages: movePage(appState.pages, id, target) },
        captureUpdate: CaptureUpdateAction.NEVER,
      };
    },
  });
};

export const actionMovePage = register<PageActionValue>({
  name: "movePage",
  label: "pages.move",
  allPages: true,
  trackEvent: { category: "canvas", action: "movePage" },
  predicate: (elements, appState) => !appState.viewModeEnabled,
  perform: (elements, appState, value) => {
    const id = resolvePageId(appState, value);
    const live = getLivePages(appState.pages);
    const from = live.findIndex((page) => page.id === id);
    if (from === -1 || value?.to === undefined || value.to === from) {
      return false;
    }
    return {
      appState: { pages: movePage(appState.pages, id, value.to) },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionMovePageLeft = createMoveAction("movePageLeft");
export const actionMovePageRight = createMoveAction("movePageRight");

export const actionDeletePage = register<PageActionValue>({
  name: "deletePage",
  label: "pages.delete",
  allPages: true,
  trackEvent: { category: "canvas", action: "deletePage" },
  predicate: (elements, appState) =>
    !appState.viewModeEnabled && getLivePages(appState.pages).length > 1,
  perform: (elements, appState, value, app): ActionResult => {
    const id = resolvePageId(appState, value);
    const live = getLivePages(appState.pages);
    const position = live.findIndex((page) => page.id === id);
    // the last remaining page can't be deleted
    if (position === -1 || live.length <= 1) {
      return false;
    }

    const pageElements = elements.filter(
      (el) => app.scene.getElementPageId(el) === id,
    );
    if (
      !value?.skipConfirm &&
      pageElements.some((el) => !el.isDeleted) &&
      !window.confirm(t("pages.deleteConfirm", { name: live[position].name }))
    ) {
      return false;
    }

    const nextPages = updatePage(appState.pages, id, { isDeleted: true });
    const nextElements = elements.map((el) =>
      app.scene.getElementPageId(el) === id && !el.isDeleted
        ? newElementWith(el, { isDeleted: true })
        : el,
    );

    const pageViewports = { ...appState.pageViewports };
    delete pageViewports[id];

    let nextAppState: Partial<AppState>;
    if (id === appState.activePageId) {
      const nextActive = live[position + 1] ?? live[position - 1];
      nextAppState = getSwitchPageAppState(
        { ...appState, pageViewports },
        nextActive.id,
        elements.filter(
          (el) => app.scene.getElementPageId(el) === nextActive.id,
        ),
      );
      // the deleted page's viewport must not be kept
      delete (nextAppState.pageViewports as Record<string, PageViewport>)[id];
    } else {
      nextAppState = { pageViewports };
    }

    return {
      elements: nextElements,
      appState: { ...nextAppState, pages: nextPages },
      // deleting a page is not undoable
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});
