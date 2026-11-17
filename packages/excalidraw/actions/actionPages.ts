import { generateNKeysBetween } from "@excalidraw/fractional-indexing";
import {
  CaptureUpdateAction,
  createPage,
  newElementWith,
  newPageWith,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  FractionalIndex,
} from "@excalidraw/element/types";

import { getScrollToContentState } from "../scene";

import { register } from "./register";

import type { AppState, NormalizedZoomValue, PageViewport } from "../types";

export const getPageSwitchAppState = ({
  appState,
  targetPageId,
  elements,
  omitPageId,
}: {
  appState: AppState;
  targetPageId: string;
  elements: readonly ExcalidrawElement[];
  omitPageId?: string;
}) => {
  const nextPageViewports = { ...appState.pageViewports };
  if (appState.activePageId && appState.activePageId !== omitPageId) {
    nextPageViewports[appState.activePageId] = {
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom,
    };
  }
  if (omitPageId) {
    delete nextPageViewports[omitPageId];
  }

  const targetViewport = nextPageViewports[targetPageId];
  let viewportUpdate: PageViewport;
  if (targetViewport) {
    viewportUpdate = targetViewport;
  } else {
    const targetElements = elements.filter(
      (el) => !el.isDeleted && el.pageId === targetPageId,
    );
    const defaultZoom = { value: 1 as NormalizedZoomValue };
    if (targetElements.length > 0) {
      const scrollState = getScrollToContentState(targetElements, {
        ...appState,
        zoom: defaultZoom,
      });
      viewportUpdate = {
        scrollX: scrollState.scrollX,
        scrollY: scrollState.scrollY,
        zoom: defaultZoom,
      };
    } else {
      viewportUpdate = {
        scrollX: 0,
        scrollY: 0,
        zoom: defaultZoom,
      };
    }
  }

  return {
    activePageId: targetPageId,
    pageViewports: nextPageViewports,
    ...viewportUpdate,
    selectedElementIds: {},
    previousSelectedElementIds: {},
    selectedGroupIds: {},
    editingGroupId: null,
    selectedLinearElement: null,
    editingTextElement: null,
    newElement: null,
    resizingElement: null,
    multiElement: null,
    selectionElement: null,
    isCropping: false,
    croppingElementId: null,
    editingFrame: null,
    activeLockedId: null,
    lockedMultiSelections: {},
    contextMenu: null,
    openPopup: null,
  };
};

const getNextPageName = (existingNames: readonly string[]): string => {
  const nameSet = new Set(existingNames);
  let n = existingNames.length + 1;
  while (nameSet.has(`Page ${n}`)) {
    n++;
  }
  return `Page ${n}`;
};

export const actionCreatePage = register({
  name: "createPage",
  label: "pages.addPage",
  trackEvent: { category: "canvas" },
  viewMode: false,
  predicate: (_elements, appState) => !appState.viewModeEnabled,
  perform: (elements, appState, _value, app) => {
    if (appState.viewModeEnabled) {
      return false;
    }
    const allPages = app.scene.getPagesIncludingDeleted();
    const nonDeletedPages = app.scene.getPages();
    const lastPage = nonDeletedPages[nonDeletedPages.length - 1];
    const nextIndex = generateNKeysBetween(
      lastPage?.index ?? null,
      null,
      1,
    )[0] as FractionalIndex;

    const newPage = createPage({
      name: getNextPageName(nonDeletedPages.map((p) => p.name)),
      index: nextIndex,
    });

    return {
      pages: [...allPages, newPage],
      appState: {
        ...appState,
        ...getPageSwitchAppState({
          appState,
          targetPageId: newPage.id,
          elements,
        }),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionSwitchPage = register<string>({
  name: "switchPage",
  label: "pages.switchPage",
  trackEvent: { category: "canvas" },
  viewMode: true,
  perform: (_elements, _appState, pageId, app) => {
    if (!pageId) {
      return false;
    }
    app.setActivePage(pageId);
    return false;
  },
});

export const actionRenamePage = register<{ pageId: string; name: string }>({
  name: "renamePage",
  label: "pages.rename",
  trackEvent: { category: "canvas" },
  viewMode: false,
  predicate: (_elements, appState) => !appState.viewModeEnabled,
  perform: (_elements, appState, value, app) => {
    if (appState.viewModeEnabled || !value) {
      return false;
    }
    const trimmed = value.name.trim();
    if (!trimmed) {
      return false;
    }
    const allPages = app.scene.getPagesIncludingDeleted();
    const target = allPages.find((p) => p.id === value.pageId && !p.isDeleted);
    if (!target || target.name === trimmed) {
      return false;
    }

    const nextPages = allPages.map((p) =>
      p.id === value.pageId ? newPageWith(p, { name: trimmed }) : p,
    );

    return {
      pages: nextPages,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionDeletePage = register<string>({
  name: "deletePage",
  label: "pages.delete",
  trackEvent: { category: "canvas" },
  viewMode: false,
  predicate: (_elements, appState, _props, app) =>
    !appState.viewModeEnabled && app.scene.getPages().length > 1,
  perform: (elements, appState, pageId, app) => {
    if (appState.viewModeEnabled || !pageId) {
      return false;
    }
    const nonDeletedPages = app.scene.getPages();
    if (nonDeletedPages.length <= 1) {
      return false;
    }
    const idx = nonDeletedPages.findIndex((p) => p.id === pageId);
    if (idx === -1) {
      return false;
    }

    const allPages = app.scene.getPagesIncludingDeleted();
    const nextPages = allPages.map((p) =>
      p.id === pageId ? newPageWith(p, { isDeleted: true }) : p,
    );

    const nextElements = elements.map((el) =>
      el.pageId === pageId && !el.isDeleted
        ? newElementWith(el, { isDeleted: true })
        : el,
    );

    let nextAppState: Partial<typeof appState>;
    if (appState.activePageId === pageId) {
      const nextActivePage =
        nonDeletedPages[idx + 1] ?? nonDeletedPages[idx - 1];
      nextAppState = getPageSwitchAppState({
        appState,
        targetPageId: nextActivePage.id,
        elements: nextElements,
        omitPageId: pageId,
      });
    } else {
      const nextPageViewports = { ...appState.pageViewports };
      delete nextPageViewports[pageId];
      nextAppState = {
        pageViewports: nextPageViewports,
      };
    }

    app.clearPageHistory(pageId);

    return {
      elements: nextElements,
      pages: nextPages,
      appState: {
        ...appState,
        ...nextAppState,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionReorderPage = register<{
  pageId: string;
  targetIndex: number;
}>({
  name: "reorderPage",
  label: "pages.reorder",
  trackEvent: { category: "canvas" },
  viewMode: false,
  predicate: (_elements, appState) => !appState.viewModeEnabled,
  perform: (_elements, appState, value, app) => {
    if (appState.viewModeEnabled || !value) {
      return false;
    }
    const nonDeletedPages = app.scene.getPages();
    const currentIndex = nonDeletedPages.findIndex(
      (p) => p.id === value.pageId,
    );
    if (currentIndex === -1) {
      return false;
    }
    const clampedTarget = Math.max(
      0,
      Math.min(nonDeletedPages.length - 1, value.targetIndex),
    );
    if (clampedTarget === currentIndex) {
      return false;
    }

    const withoutMoved = nonDeletedPages.filter((p) => p.id !== value.pageId);
    const prevPage = withoutMoved[clampedTarget - 1] ?? null;
    const nextPage = withoutMoved[clampedTarget] ?? null;

    const newIndex = generateNKeysBetween(
      prevPage?.index ?? null,
      nextPage?.index ?? null,
      1,
    )[0] as FractionalIndex;

    const allPages = app.scene.getPagesIncludingDeleted();
    const nextPages = allPages.map((p) =>
      p.id === value.pageId ? newPageWith(p, { index: newIndex }) : p,
    );

    return {
      pages: nextPages,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});
