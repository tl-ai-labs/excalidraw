import {
  CaptureUpdateAction,
  createPage,
  deletePage,
  getAdjacentPageId,
  getNewPageName,
  getVisiblePages,
  movePage,
  newElementWith,
  renamePage,
} from "@excalidraw/element";

import type { PageViewport } from "@excalidraw/element/types";

import { t } from "../i18n";
import { getNormalizedZoom } from "../scene/normalize";

import { register } from "./register";

import type { AppState, NormalizedZoomValue } from "../types";

export const getSwitchPageAppState = (
  appState: Readonly<AppState>,
  pageId: string,
): Partial<AppState> | null => {
  if (pageId === appState.activePageId) {
    return null;
  }
  if (!getVisiblePages(appState.pages).some((page) => page.id === pageId)) {
    return null;
  }

  const { [pageId]: target, ...rest } = appState.pageViewports;
  const currentViewport: PageViewport = {
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom.value,
  };
  const pageViewports: Record<string, PageViewport> = {
    ...rest,
    [appState.activePageId]: currentViewport,
  };

  return {
    activePageId: pageId,
    pageViewports,
    scrollX: target ? target.scrollX : 0,
    scrollY: target ? target.scrollY : 0,
    zoom: target
      ? { value: getNormalizedZoom(target.zoom) }
      : { value: 1 as NormalizedZoomValue },
    selectedElementIds: {},
    selectedGroupIds: {},
    previousSelectedElementIds: {},
    hoveredElementIds: {},
    editingGroupId: null,
    editingTextElement: null,
    selectedLinearElement: null,
    newElement: null,
    multiElement: null,
    resizingElement: null,
    selectionElement: null,
    activeEmbeddable: null,
    isCropping: false,
    croppingElementId: null,
    editingFrame: null,
    frameToHighlight: null,
    elementsToHighlight: null,
  };
};

export const actionSwitchPage = register<string>({
  name: "switchPage",
  label: "pages.switchTo",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform(_elements, appState, pageId) {
    if (pageId === undefined) {
      return false;
    }
    const switchState = getSwitchPageAppState(appState, pageId);
    if (!switchState) {
      return false;
    }
    return {
      appState: { ...appState, ...switchState },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionCreatePage = register({
  name: "createPage",
  label: "pages.newPage",
  viewMode: false,
  trackEvent: { category: "canvas" },
  perform(_elements, appState) {
    const name = getNewPageName(appState.pages, (n) =>
      t("pages.newPageName", { number: n }),
    );
    const { pages, page } = createPage(appState.pages, name, undefined);
    const switchState = getSwitchPageAppState({ ...appState, pages }, page.id);
    return {
      appState: { ...appState, ...switchState, pages },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionRenamePage = register<{ pageId: string; name: string }>({
  name: "renamePage",
  label: "pages.rename",
  viewMode: false,
  trackEvent: { category: "canvas" },
  perform(_elements, appState, value) {
    if (!value) {
      return false;
    }
    const pages = renamePage(appState.pages, value.pageId, value.name);
    if (pages === appState.pages) {
      return false;
    }
    return {
      appState: { ...appState, pages },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionMovePage = register<{
  pageId: string;
  direction: -1 | 1;
}>({
  name: "movePage",
  label: "pages.moveLeft",
  viewMode: false,
  trackEvent: { category: "canvas" },
  perform(_elements, appState, value) {
    if (!value) {
      return false;
    }
    const pages = movePage(appState.pages, value.pageId, value.direction);
    if (pages === appState.pages) {
      return false;
    }
    return {
      appState: { ...appState, pages },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionDeletePage = register<string>({
  name: "deletePage",
  label: "pages.delete",
  viewMode: false,
  trackEvent: { category: "canvas" },
  perform(_elements, appState, pageId, app) {
    if (pageId === undefined) {
      return false;
    }
    const adjacentId = getAdjacentPageId(appState.pages, pageId);
    const pages = deletePage(appState.pages, pageId);
    if (pages === appState.pages) {
      return false;
    }

    const elements = app.scene
      .getAllPagesElementsIncludingDeleted()
      .map((element) =>
        element.pageId === pageId && !element.isDeleted
          ? newElementWith(element, { isDeleted: true })
          : element,
      );

    const switchState =
      pageId === appState.activePageId && adjacentId !== null
        ? getSwitchPageAppState({ ...appState, pages }, adjacentId)
        : null;

    return {
      elements,
      appState: { ...appState, ...switchState, pages },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});
