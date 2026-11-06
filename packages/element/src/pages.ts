import {
  getUpdatedTimestamp,
  randomId,
  randomInteger,
} from "@excalidraw/common";

import {
  generateKeyBetween,
  generateNKeysBetween,
  validateOrderKey,
} from "@excalidraw/fractional-indexing";

import type { Mutable } from "@excalidraw/common/utility-types";

import type { DrawingPage, ExcalidrawElement, PageViewport } from "./types";

export const DEFAULT_PAGE_ID = "default" as const;

export const getDefaultPages = (): DrawingPage[] => [
  {
    id: DEFAULT_PAGE_ID,
    name: "Page 1",
    index: "a0",
    version: 1,
    versionNonce: 0,
    isDeleted: false,
  },
];

export const getElementPageId = (
  element: Pick<ExcalidrawElement, "pageId">,
): string => {
  return element.pageId ?? DEFAULT_PAGE_ID;
};

export const isElementOnPage = (
  element: Pick<ExcalidrawElement, "pageId">,
  pageId: string,
): boolean => {
  return getElementPageId(element) === pageId;
};

const comparePages = (a: DrawingPage, b: DrawingPage): number => {
  if (a.index < b.index) {
    return -1;
  }
  if (a.index > b.index) {
    return 1;
  }
  if (a.id < b.id) {
    return -1;
  }
  if (a.id > b.id) {
    return 1;
  }
  return 0;
};

export const getVisiblePages = (
  pages: readonly DrawingPage[],
): DrawingPage[] => {
  return pages
    .filter((page) => !page.isDeleted)
    .slice()
    .sort(comparePages);
};

export const getDefaultPageName = (pages: readonly DrawingPage[]): string => {
  const visiblePages = getVisiblePages(pages);
  const existingNames = new Set(visiblePages.map((page) => page.name));

  let n = visiblePages.length + 1;
  while (existingNames.has(`Page ${n}`)) {
    n++;
  }
  return `Page ${n}`;
};

const bumpPage = (
  page: DrawingPage,
  updates: Partial<DrawingPage>,
): DrawingPage => {
  return {
    ...page,
    ...updates,
    version: page.version + 1,
    versionNonce: randomInteger(),
  };
};

export const createPage = (
  pages: readonly DrawingPage[],
  afterPageId: string | null,
  name?: string,
): { pages: DrawingPage[]; page: DrawingPage } => {
  const visiblePages = getVisiblePages(pages);

  let afterIndex = -1;
  if (afterPageId != null) {
    afterIndex = visiblePages.findIndex((page) => page.id === afterPageId);
  }

  const after =
    afterIndex !== -1
      ? visiblePages[afterIndex]
      : visiblePages[visiblePages.length - 1] ?? null;

  let nextVisible: DrawingPage | null = null;
  if (afterIndex !== -1) {
    for (let i = afterIndex + 1; i < visiblePages.length; i++) {
      if (after == null || visiblePages[i].index > after.index) {
        nextVisible = visiblePages[i];
        break;
      }
    }
  }

  const nextIndex =
    after != null && nextVisible != null && nextVisible.index <= after.index
      ? null
      : nextVisible?.index ?? null;

  const index = generateKeyBetween(after?.index ?? null, nextIndex);

  const newPage: DrawingPage = {
    id: randomId(),
    name: name ?? getDefaultPageName(pages),
    index,
    version: 1,
    versionNonce: randomInteger(),
    isDeleted: false,
  };

  return {
    pages: [...pages, newPage],
    page: newPage,
  };
};

export const renamePage = (
  pages: readonly DrawingPage[],
  pageId: string,
  name: string,
): readonly DrawingPage[] => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return pages;
  }

  const targetPage = pages.find((page) => page.id === pageId);
  if (!targetPage || targetPage.isDeleted || targetPage.name === trimmedName) {
    return pages;
  }

  return pages.map((page) =>
    page.id === pageId ? bumpPage(page, { name: trimmedName }) : page,
  );
};

export const movePage = (
  pages: readonly DrawingPage[],
  pageId: string,
  toIndex: number,
): readonly DrawingPage[] => {
  const targetPage = pages.find((page) => page.id === pageId);
  if (!targetPage || targetPage.isDeleted) {
    return pages;
  }

  const visibleWithoutMoved = getVisiblePages(pages).filter(
    (page) => page.id !== pageId,
  );

  const clampedIndex = Math.max(
    0,
    Math.min(toIndex, visibleWithoutMoved.length),
  );
  const prev = clampedIndex > 0 ? visibleWithoutMoved[clampedIndex - 1] : null;
  const next =
    clampedIndex < visibleWithoutMoved.length
      ? visibleWithoutMoved[clampedIndex]
      : null;

  // Check if target is already logically in this position
  if (
    (prev == null || targetPage.index > prev.index) &&
    (next == null || targetPage.index < next.index)
  ) {
    return pages;
  }

  const nextIndex =
    prev != null && next != null && next.index <= prev.index
      ? null
      : next?.index ?? null;

  const newKey = generateKeyBetween(prev?.index ?? null, nextIndex);
  if (newKey === targetPage.index) {
    return pages;
  }

  return pages.map((page) =>
    page.id === pageId ? bumpPage(page, { index: newKey }) : page,
  );
};

export const deletePage = (
  pages: readonly DrawingPage[],
  pageId: string,
): readonly DrawingPage[] => {
  const targetPage = pages.find((page) => page.id === pageId);
  if (!targetPage || targetPage.isDeleted) {
    return pages;
  }

  const visiblePages = getVisiblePages(pages);
  if (visiblePages.length <= 1) {
    return pages;
  }

  return pages.map((page) =>
    page.id === pageId ? bumpPage(page, { isDeleted: true }) : page,
  );
};

export const getAdjacentPageId = (
  pages: readonly DrawingPage[],
  pageId: string,
): string | null => {
  const visiblePages = getVisiblePages(pages);
  const currentIndex = visiblePages.findIndex((page) => page.id === pageId);

  if (currentIndex === -1) {
    return null;
  }

  if (currentIndex + 1 < visiblePages.length) {
    return visiblePages[currentIndex + 1].id;
  }
  if (currentIndex - 1 >= 0) {
    return visiblePages[currentIndex - 1].id;
  }

  return null;
};

export const getPageElements = <T extends ExcalidrawElement>(
  elements: readonly T[],
  pageId: string,
): T[] => {
  return elements.filter((element) => isElementOnPage(element, pageId));
};

export const assignElementToPage = <T extends ExcalidrawElement>(
  element: T,
  pageId: string,
): T => {
  // Safe in-place mutation: element is newly constructed and not yet in the scene
  const mutable = element as Mutable<T>;
  if (pageId === DEFAULT_PAGE_ID) {
    delete mutable.pageId;
  } else {
    mutable.pageId = pageId;
  }
  return element;
};

export const reassignOrphanedElementsToPage = <T extends ExcalidrawElement>(
  elements: readonly T[],
  pages: readonly DrawingPage[],
): T[] => {
  const visiblePages = getVisiblePages(pages);
  if (visiblePages.length === 0) {
    return elements as T[];
  }

  const firstVisible = visiblePages[0];
  const visiblePageIds = new Set(visiblePages.map((page) => page.id));

  let didChange = false;
  const nextElements = elements.map((element) => {
    const pageId = getElementPageId(element);
    if (!visiblePageIds.has(pageId)) {
      didChange = true;
      if (firstVisible.id === DEFAULT_PAGE_ID) {
        const { pageId: _omit, ...rest } = element;
        return {
          ...rest,
          version: element.version + 1,
          versionNonce: randomInteger(),
          updated: getUpdatedTimestamp(),
        } as T;
      }
      return {
        ...element,
        pageId: firstVisible.id,
        version: element.version + 1,
        versionNonce: randomInteger(),
        updated: getUpdatedTimestamp(),
      } as T;
    }
    return element;
  });

  return didChange ? nextElements : (elements as T[]);
};

export const reconcilePages = (
  local: readonly DrawingPage[],
  remote: readonly DrawingPage[] | null | undefined,
): readonly DrawingPage[] => {
  if (!remote || remote.length === 0) {
    return local;
  }

  const pagesById = new Map<string, DrawingPage>();
  for (const page of local) {
    pagesById.set(page.id, page);
  }

  for (const remotePage of remote) {
    const localPage = pagesById.get(remotePage.id);
    if (!localPage) {
      pagesById.set(remotePage.id, remotePage);
    } else if (remotePage.version > localPage.version) {
      pagesById.set(remotePage.id, remotePage);
    } else if (
      remotePage.version === localPage.version &&
      remotePage.versionNonce < localPage.versionNonce
    ) {
      pagesById.set(remotePage.id, remotePage);
    }
  }

  return Array.from(pagesById.values()).sort(comparePages);
};

export const getPagesVersion = (
  pages: readonly DrawingPage[] | undefined,
): number => {
  if (!pages) {
    return 0;
  }
  return pages.reduce((acc, page) => acc + page.version, 0);
};

const isValidOrderKey = (key: string): boolean => {
  try {
    validateOrderKey(key);
    return true;
  } catch {
    return false;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const restorePageState = (
  appState:
    | { pages?: unknown; activePageId?: unknown; pageViewports?: unknown }
    | null
    | undefined,
): {
  pages: DrawingPage[];
  activePageId: string;
  pageViewports: Record<string, PageViewport>;
} => {
  let restoredPages: DrawingPage[] = [];

  if (appState && Array.isArray(appState.pages)) {
    const seenIds = new Set<string>();
    const rawValidPages: Array<{
      id: string;
      name: string;
      index?: string;
      version: number;
      versionNonce: number;
      isDeleted: boolean;
    }> = [];

    let maxValidKey: string | null = null;

    for (const item of appState.pages) {
      if (
        isRecord(item) &&
        typeof item.id === "string" &&
        item.id.length > 0 &&
        typeof item.name === "string"
      ) {
        const id = item.id;
        if (seenIds.has(id)) {
          continue;
        }
        seenIds.add(id);

        const name = item.name;
        const index =
          typeof item.index === "string" && isValidOrderKey(item.index)
            ? item.index
            : undefined;

        if (index && (maxValidKey == null || index > maxValidKey)) {
          maxValidKey = index;
        }

        const version =
          typeof item.version === "number" &&
          Number.isFinite(item.version) &&
          item.version >= 1
            ? item.version
            : 1;
        const versionNonce =
          typeof item.versionNonce === "number" &&
          Number.isFinite(item.versionNonce)
            ? item.versionNonce
            : 0;
        const isDeleted =
          typeof item.isDeleted === "boolean" ? item.isDeleted : false;

        rawValidPages.push({
          id,
          name,
          index,
          version,
          versionNonce,
          isDeleted,
        });
      }
    }

    if (rawValidPages.length > 0) {
      const missingIndicesCount = rawValidPages.filter(
        (p) => p.index == null,
      ).length;
      const fillKeys = generateNKeysBetween(
        maxValidKey,
        null,
        missingIndicesCount,
      );
      let fillIndex = 0;
      restoredPages = rawValidPages.map((page) => ({
        id: page.id,
        name: page.name,
        index: page.index ?? fillKeys[fillIndex++],
        version: page.version,
        versionNonce: page.versionNonce,
        isDeleted: page.isDeleted,
      }));
    }
  }

  const visiblePages = getVisiblePages(restoredPages);
  if (visiblePages.length === 0) {
    restoredPages = getDefaultPages();
  }

  const validVisiblePages = getVisiblePages(restoredPages);
  const visibleIds = new Set(validVisiblePages.map((page) => page.id));
  const allPageIds = new Set(restoredPages.map((page) => page.id));

  let activePageId = validVisiblePages[0].id;
  if (
    typeof appState?.activePageId === "string" &&
    visibleIds.has(appState.activePageId)
  ) {
    activePageId = appState.activePageId;
  }

  const pageViewports: Record<string, PageViewport> = {};
  if (isRecord(appState?.pageViewports)) {
    for (const [key, viewport] of Object.entries(appState.pageViewports)) {
      if (
        allPageIds.has(key) &&
        isRecord(viewport) &&
        typeof viewport.scrollX === "number" &&
        Number.isFinite(viewport.scrollX) &&
        typeof viewport.scrollY === "number" &&
        Number.isFinite(viewport.scrollY) &&
        typeof viewport.zoom === "number" &&
        Number.isFinite(viewport.zoom) &&
        viewport.zoom > 0
      ) {
        pageViewports[key] = {
          scrollX: viewport.scrollX,
          scrollY: viewport.scrollY,
          zoom: viewport.zoom,
        };
      }
    }
  }

  return {
    pages: restoredPages,
    activePageId,
    pageViewports,
  };
};

export const toActivePageExportState = <
  T extends {
    pages?: readonly DrawingPage[];
    activePageId?: string;
    pageViewports?: Record<string, PageViewport>;
  },
>(
  appState: T,
): T => {
  const activeId = appState.activePageId ?? DEFAULT_PAGE_ID;
  const activePage =
    appState.pages?.find((page) => page.id === activeId && !page.isDeleted) ??
    null;

  const exportPages: readonly DrawingPage[] = activePage
    ? [activePage]
    : getDefaultPages();

  const exportViewports: Record<string, PageViewport> = {};
  if (appState.pageViewports && appState.pageViewports[activeId]) {
    exportViewports[activeId] = appState.pageViewports[activeId];
  }

  return {
    ...appState,
    pages: exportPages,
    pageViewports: exportViewports,
  };
};
