import {
  CaptureUpdateAction,
  getElementPageId,
  getNonDeletedPages,
  getReorderedPageIndex,
  getScenePageOptions,
  newElementWith,
  newPage,
  sortPages,
  updatePage,
} from "@excalidraw/element";

import { t } from "../i18n";

import { register } from "./register";

import type { AppState, NormalizedZoomValue } from "../types";
import type { Action } from "./types";

export function getPageSwitchAppState(
  appState: Readonly<AppState>,
  targetPageId: string,
): Partial<AppState> {
  const currentViewport = {
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom,
  };

  const nextPageViewports = {
    ...appState.pageViewports,
    [appState.activePageId]: currentViewport,
  };

  const targetViewport = nextPageViewports[targetPageId];
  delete nextPageViewports[targetPageId];

  return {
    pageViewports: nextPageViewports,
    activePageId: targetPageId,
    scrollX: targetViewport ? targetViewport.scrollX : 0,
    scrollY: targetViewport ? targetViewport.scrollY : 0,
    zoom: targetViewport
      ? targetViewport.zoom
      : { value: 1 as NormalizedZoomValue },
    selectedElementIds: {},
    selectedGroupIds: {},
    editingGroupId: null,
    selectedLinearElement: null,
    editingTextElement: null,
    croppingElementId: null,
    activeEmbeddable: null,
  };
}

export const actionCreatePage: Action = register({
  name: "createPage",
  label: "pages.createPage",
  trackEvent: { category: "canvas" },
  viewMode: false,
  predicate: (elements, appState) => !appState.viewModeEnabled,
  perform: (elements, appState) => {
    const page = newPage({
      name: t("pages.defaultName", {
        number: getNonDeletedPages(appState.pages).length + 1,
      }),
      pages: appState.pages,
    });

    return {
      appState: {
        ...appState,
        ...getPageSwitchAppState(appState, page.id),
        pages: sortPages([...appState.pages, page]),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionSwitchPage: Action<string> = register<string>({
  name: "switchPage",
  label: "pages.switchPage",
  viewMode: true,
  trackEvent: false,
  perform: (elements, appState, formData) => {
    const targetPageId = formData;
    if (
      !targetPageId ||
      targetPageId === appState.activePageId ||
      !getNonDeletedPages(appState.pages).some((p) => p.id === targetPageId)
    ) {
      return false;
    }

    return {
      appState: {
        ...appState,
        ...getPageSwitchAppState(appState, targetPageId),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionRenamePage: Action<{ pageId: string; name: string }> =
  register<{ pageId: string; name: string }>({
    name: "renamePage",
    label: "pages.renamePage",
    viewMode: false,
    trackEvent: false,
    perform: (elements, appState, formData) => {
      const { pageId, name } = formData || {};
      const trimmed = name?.trim();
      if (!trimmed || !pageId) {
        return false;
      }

      const page = appState.pages.find((p) => p.id === pageId);
      if (!page || page.isDeleted || page.name === trimmed) {
        return false;
      }

      const updatedPage = updatePage(page, { name: trimmed });
      const pages = appState.pages.map((p) =>
        p.id === pageId ? updatedPage : p,
      );

      return {
        appState: {
          ...appState,
          pages,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      };
    },
  });

export const actionReorderPage: Action<{ pageId: string; toPosition: number }> =
  register<{ pageId: string; toPosition: number }>({
    name: "reorderPage",
    label: "pages.reorderPage",
    viewMode: false,
    trackEvent: false,
    perform: (elements, appState, formData) => {
      const { pageId, toPosition } = formData || {};
      if (!pageId || typeof toPosition !== "number") {
        return false;
      }

      const page = appState.pages.find((p) => p.id === pageId);
      if (!page || page.isDeleted) {
        return false;
      }

      const nonDeletedPages = getNonDeletedPages(appState.pages);
      const currentPos = nonDeletedPages.findIndex((p) => p.id === pageId);
      if (currentPos === -1 || currentPos === toPosition) {
        return false;
      }

      const nextIndex = getReorderedPageIndex(
        appState.pages,
        pageId,
        toPosition,
      );
      const updatedPage = updatePage(page, { index: nextIndex });
      const pages = sortPages(
        appState.pages.map((p) => (p.id === pageId ? updatedPage : p)),
      );

      return {
        appState: {
          ...appState,
          pages,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      };
    },
  });

export const actionDeletePage: Action<string> = register<string>({
  name: "deletePage",
  label: "pages.deletePage",
  viewMode: false,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState) =>
    getNonDeletedPages(appState.pages).length > 1 && !appState.viewModeEnabled,
  perform: (elements, appState, formData, app) => {
    const pageId = formData || appState.activePageId;
    const nonDeletedPages = getNonDeletedPages(appState.pages);
    if (nonDeletedPages.length <= 1) {
      return false;
    }

    const page = appState.pages.find((p) => p.id === pageId);
    if (!page || page.isDeleted) {
      return false;
    }

    const options = getScenePageOptions(appState.pages, appState.activePageId);
    const sceneElements = app.scene.getElementsIncludingDeleted();

    const nextElements = sceneElements.map((el) => {
      if (!el.isDeleted && getElementPageId(el, options) === pageId) {
        return newElementWith(el, { isDeleted: true });
      }
      return el;
    });

    const updatedPage = updatePage(page, { isDeleted: true });
    const pages = appState.pages.map((p) =>
      p.id === pageId ? updatedPage : p,
    );

    let nextAppState: AppState = {
      ...appState,
      pages,
    };

    if (pageId === appState.activePageId) {
      const currentIndex = nonDeletedPages.findIndex((p) => p.id === pageId);
      const neighbour =
        nonDeletedPages[currentIndex + 1] ?? nonDeletedPages[currentIndex - 1];

      nextAppState = {
        ...nextAppState,
        ...getPageSwitchAppState(nextAppState, neighbour.id),
      };
    }

    return {
      elements: nextElements,
      allPages: true,
      appState: nextAppState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
