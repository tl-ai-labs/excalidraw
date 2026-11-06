import { randomId } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  getElementPageId,
  newElementWith,
} from "@excalidraw/element";

import { register } from "./register";

import type { ExcalidrawPage, NormalizedZoomValue } from "../types";

export function getNextDefaultPageName(
  pages: readonly ExcalidrawPage[],
): string {
  const existingNames = new Set(pages.map((p) => p.name));
  let n = pages.length + 1;
  while (existingNames.has(`Page ${n}`)) {
    n++;
  }
  return `Page ${n}`;
}

const clearTransientState = {
  selectedElementIds: {},
  selectedGroupIds: {},
  editingGroupId: null,
  selectedLinearElement: null,
  editingTextElement: null,
  editingFrame: null,
  activeEmbeddable: null,
  croppingElementId: null,
  isCropping: false,
};

export const actionSwitchPage = register({
  name: "switchPage",
  label: "pages.title",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform(elements, appState, value, app) {
    const targetPageId = value as string;
    if (!targetPageId || targetPageId === appState.activePageId) {
      return false;
    }

    const targetPage = appState.pages.find((p) => p.id === targetPageId);
    if (!targetPage) {
      return false;
    }

    const updatedPages = appState.pages.map((p) =>
      p.id === appState.activePageId
        ? {
            ...p,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            zoom: appState.zoom,
          }
        : p,
    );

    app.scene.setActivePageId(targetPage.id);

    return {
      appState: {
        ...appState,
        ...clearTransientState,
        pages: updatedPages,
        activePageId: targetPage.id,
        scrollX: targetPage.scrollX,
        scrollY: targetPage.scrollY,
        zoom: targetPage.zoom,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionCreatePage = register({
  name: "createPage",
  label: "pages.addPage",
  viewMode: false,
  trackEvent: { category: "canvas" },
  perform(elements, appState, value, app) {
    const pageVal = value as { name?: string } | undefined;
    const newPageName =
      (typeof pageVal?.name === "string" && pageVal.name.trim()) ||
      getNextDefaultPageName(appState.pages);

    const newPage: ExcalidrawPage = {
      id: randomId(),
      name: newPageName,
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 as NormalizedZoomValue },
    };

    const updatedPages = appState.pages
      .map((p) =>
        p.id === appState.activePageId
          ? {
              ...p,
              scrollX: appState.scrollX,
              scrollY: appState.scrollY,
              zoom: appState.zoom,
            }
          : p,
      )
      .concat(newPage);

    app.scene.setActivePageId(newPage.id);

    return {
      appState: {
        ...appState,
        ...clearTransientState,
        pages: updatedPages,
        activePageId: newPage.id,
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 as NormalizedZoomValue },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionRenamePage = register({
  name: "renamePage",
  label: "pages.renamePage",
  viewMode: false,
  trackEvent: { category: "canvas" },
  perform(elements, appState, value) {
    const renameVal = value as { id?: string; name?: string } | undefined;
    if (!renameVal || typeof renameVal.id !== "string") {
      return false;
    }

    const trimmedName =
      typeof renameVal.name === "string" ? renameVal.name.trim() : "";
    if (!trimmedName) {
      return false;
    }

    const updatedPages = appState.pages.map((p) =>
      p.id === renameVal.id ? { ...p, name: trimmedName } : p,
    );

    return {
      appState: {
        ...appState,
        pages: updatedPages,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionReorderPages = register({
  name: "reorderPages",
  label: "pages.title",
  viewMode: false,
  trackEvent: { category: "canvas" },
  perform(elements, appState, value) {
    const reorderVal = value as
      | { fromIndex?: number; toIndex?: number }
      | undefined;
    if (!reorderVal) {
      return false;
    }

    const { fromIndex, toIndex } = reorderVal;
    const len = appState.pages.length;

    if (
      typeof fromIndex !== "number" ||
      typeof toIndex !== "number" ||
      fromIndex < 0 ||
      fromIndex >= len ||
      toIndex < 0 ||
      toIndex >= len ||
      fromIndex === toIndex
    ) {
      return false;
    }

    const pages = [...appState.pages];
    const [movedPage] = pages.splice(fromIndex, 1);
    pages.splice(toIndex, 0, movedPage);

    return {
      appState: {
        ...appState,
        pages,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionDeletePage = register({
  name: "deletePage",
  label: "pages.deletePage",
  viewMode: false,
  trackEvent: { category: "canvas" },
  perform(elements, appState, value, app) {
    const targetPageId = (value as string | undefined) || appState.activePageId;

    if (appState.pages.length <= 1) {
      return false;
    }

    const deletedIndex = appState.pages.findIndex((p) => p.id === targetPageId);
    if (deletedIndex === -1) {
      return false;
    }

    const remainingPages = appState.pages
      .filter((p) => p.id !== targetPageId)
      .map((p) =>
        p.id === appState.activePageId && targetPageId !== appState.activePageId
          ? {
              ...p,
              scrollX: appState.scrollX,
              scrollY: appState.scrollY,
              zoom: appState.zoom,
            }
          : p,
      );
    const updatedElements = app.scene
      .getAllElementsIncludingDeleted()
      .map((el) =>
        getElementPageId(el) === targetPageId && !el.isDeleted
          ? newElementWith(el, { isDeleted: true })
          : el,
      );

    if (targetPageId === appState.activePageId) {
      const nextIndex = deletedIndex > 0 ? deletedIndex - 1 : 0;
      const nextActivePage = remainingPages[nextIndex];

      app.scene.setActivePageId(nextActivePage.id);

      return {
        elements: updatedElements,
        appState: {
          ...appState,
          ...clearTransientState,
          pages: remainingPages,
          activePageId: nextActivePage.id,
          scrollX: nextActivePage.scrollX,
          scrollY: nextActivePage.scrollY,
          zoom: nextActivePage.zoom,
        },
        replaceAllPages: true,
        captureUpdate: CaptureUpdateAction.NEVER,
      };
    }

    return {
      elements: updatedElements,
      appState: {
        ...appState,
        pages: remainingPages,
      },
      replaceAllPages: true,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});
