import {
  CaptureUpdateAction,
  createPage,
  deletePage,
  getAdjacentPageId,
  getVisiblePages,
  isElementOnPage,
  movePage,
  newElementWith,
  renamePage,
} from "@excalidraw/element";

import { PlusIcon, TrashIcon } from "../components/icons";
import { getNormalizedZoom } from "../scene/normalize";

import { register } from "./register";

import type { Action } from "./types";
import type { AppState } from "../types";

export const getPageSwitchAppState = (
  appState: Readonly<AppState>,
  targetPageId: string,
): Partial<AppState> | null => {
  if (targetPageId === appState.activePageId) {
    return null;
  }

  const visiblePages = getVisiblePages(appState.pages);
  if (!visiblePages.some((page) => page.id === targetPageId)) {
    return null;
  }

  const pageViewports = {
    ...appState.pageViewports,
    [appState.activePageId]: {
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom.value,
    },
  };

  const targetViewport = pageViewports[targetPageId];
  const scrollX = targetViewport ? targetViewport.scrollX : 0;
  const scrollY = targetViewport ? targetViewport.scrollY : 0;
  const zoomValue = targetViewport ? targetViewport.zoom : 1;

  return {
    activePageId: targetPageId,
    pageViewports,
    scrollX,
    scrollY,
    zoom: {
      value: getNormalizedZoom(zoomValue),
    },
    selectedElementIds: {},
    selectedGroupIds: {},
    editingGroupId: null,
    previousSelectedElementIds: {},
    hoveredElementIds: {},
    selectedLinearElement: null,
    editingTextElement: null,
    newElement: null,
    multiElement: null,
    resizingElement: null,
    isCropping: false,
    croppingElementId: null,
    suggestedBinding: null,
    frameToHighlight: null,
    elementsToHighlight: null,
    activeEmbeddable: null,
    editingFrame: null,
    snapLines: [],
    contextMenu: null,
  };
};

export const actionSwitchPage: Action<string> = register<string>({
  name: "switchPage",
  label: "pages.switchPage",
  viewMode: true,
  trackEvent: {
    category: "canvas",
  },
  perform(elements, appState, targetPageId) {
    if (!targetPageId) {
      return false;
    }
    const switchAppState = getPageSwitchAppState(appState, targetPageId);
    if (!switchAppState) {
      return false;
    }
    return {
      appState: {
        ...appState,
        ...switchAppState,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionAddPage: Action = register({
  name: "addPage",
  icon: PlusIcon,
  label: "pages.addPage",
  viewMode: false,
  trackEvent: {
    category: "canvas",
  },
  perform(elements, appState) {
    const { pages, page } = createPage(appState.pages, appState.activePageId);
    const switchAppState = getPageSwitchAppState(
      {
        ...appState,
        pages,
      },
      page.id,
    );

    return {
      appState: {
        ...appState,
        pages,
        ...(switchAppState || {}),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionRenamePage: Action<{
  pageId: string;
  name: string;
}> = register<{
  pageId: string;
  name: string;
}>({
  name: "renamePage",
  label: "pages.renamePage",
  viewMode: false,
  trackEvent: {
    category: "canvas",
  },
  perform(elements, appState, value) {
    if (!value || !value.pageId || !value.name.trim()) {
      return false;
    }
    const nextPages = renamePage(appState.pages, value.pageId, value.name);
    if (nextPages === appState.pages) {
      return false;
    }
    return {
      appState: {
        ...appState,
        pages: nextPages,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionMovePage: Action<{
  pageId: string;
  toIndex: number;
}> = register<{
  pageId: string;
  toIndex: number;
}>({
  name: "movePage",
  label: "pages.movePage",
  viewMode: false,
  trackEvent: {
    category: "canvas",
  },
  perform(elements, appState, value) {
    if (!value || !value.pageId || typeof value.toIndex !== "number") {
      return false;
    }
    const nextPages = movePage(appState.pages, value.pageId, value.toIndex);
    if (nextPages === appState.pages) {
      return false;
    }
    return {
      appState: {
        ...appState,
        pages: nextPages,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionMovePageLeft: Action<string | null> = register<
  string | null
>({
  name: "movePageLeft",
  label: "pages.movePageLeft",
  viewMode: false,
  trackEvent: {
    category: "canvas",
  },
  predicate(elements, appState) {
    const visiblePages = getVisiblePages(appState.pages);
    const currentIndex = visiblePages.findIndex(
      (page) => page.id === appState.activePageId,
    );
    return currentIndex > 0;
  },
  perform(elements, appState, value) {
    const pageId = value || appState.activePageId;
    const visiblePages = getVisiblePages(appState.pages);
    const currentIndex = visiblePages.findIndex((page) => page.id === pageId);
    if (currentIndex <= 0) {
      return false;
    }
    const nextPages = movePage(appState.pages, pageId, currentIndex - 1);
    if (nextPages === appState.pages) {
      return false;
    }
    return {
      appState: {
        ...appState,
        pages: nextPages,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionMovePageRight: Action<string | null> = register<
  string | null
>({
  name: "movePageRight",
  label: "pages.movePageRight",
  viewMode: false,
  trackEvent: {
    category: "canvas",
  },
  predicate(elements, appState) {
    const visiblePages = getVisiblePages(appState.pages);
    const currentIndex = visiblePages.findIndex(
      (page) => page.id === appState.activePageId,
    );
    return currentIndex !== -1 && currentIndex < visiblePages.length - 1;
  },
  perform(elements, appState, value) {
    const pageId = value || appState.activePageId;
    const visiblePages = getVisiblePages(appState.pages);
    const currentIndex = visiblePages.findIndex((page) => page.id === pageId);
    if (currentIndex === -1 || currentIndex >= visiblePages.length - 1) {
      return false;
    }
    const nextPages = movePage(appState.pages, pageId, currentIndex + 1);
    if (nextPages === appState.pages) {
      return false;
    }
    return {
      appState: {
        ...appState,
        pages: nextPages,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionDeletePage: Action<string | null> = register<string | null>({
  name: "deletePage",
  icon: TrashIcon,
  label: "pages.deletePage",
  viewMode: false,
  trackEvent: {
    category: "canvas",
  },
  predicate(elements, appState) {
    return getVisiblePages(appState.pages).length > 1;
  },
  perform(elements, appState, value) {
    const pageId = value || appState.activePageId;
    const visiblePages = getVisiblePages(appState.pages);
    if (visiblePages.length <= 1) {
      return false;
    }
    const adjacentPageId = getAdjacentPageId(appState.pages, pageId);
    const nextPages = deletePage(appState.pages, pageId);
    if (nextPages === appState.pages) {
      return false;
    }

    const nextElements = elements.map((el) =>
      isElementOnPage(el, pageId) && !el.isDeleted
        ? newElementWith(el, { isDeleted: true })
        : el,
    );

    let nextAppState: Partial<AppState> = {
      ...appState,
      pages: nextPages,
    };

    if (pageId === appState.activePageId && adjacentPageId) {
      const pageViewports = { ...appState.pageViewports };
      delete pageViewports[pageId];

      const switchAppState = getPageSwitchAppState(
        {
          ...appState,
          pages: appState.pages,
          pageViewports,
        },
        adjacentPageId,
      );

      nextAppState = {
        ...nextAppState,
        ...switchAppState,
        pageViewports: switchAppState?.pageViewports ?? pageViewports,
      };
    }

    return {
      elements: nextElements,
      appState: nextAppState,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});
