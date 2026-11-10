import { DEFAULT_PAGE_ID, randomId, randomInteger } from "@excalidraw/common";

import { generateKeyBetween } from "@excalidraw/fractional-indexing";

import type { Mutable } from "@excalidraw/common/utility-types";

import type {
  ExcalidrawElement,
  ExcalidrawPage,
  FractionalIndex,
} from "./types";

export type ScenePageOptions = Readonly<{
  activePageId: string;
  homePageId: string;
  pageIds: ReadonlySet<string>;
  isSinglePage: boolean;
}>;

export const sortPages = (
  pages: readonly ExcalidrawPage[],
): ExcalidrawPage[] => {
  return [...pages].sort((a, b) => {
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
  });
};

export const createDefaultPages = (): ExcalidrawPage[] => {
  return [
    {
      id: DEFAULT_PAGE_ID,
      name: "",
      index: "a0" as FractionalIndex,
      version: 1,
      versionNonce: 0,
      isDeleted: false,
    },
  ];
};

export const getNonDeletedPages = (
  pages: readonly ExcalidrawPage[],
): ExcalidrawPage[] => {
  return pages.filter((page) => !page.isDeleted);
};

export const getHomePageId = (pages: readonly ExcalidrawPage[]): string => {
  if (pages.length === 0) {
    return DEFAULT_PAGE_ID;
  }
  let hasDefault = false;
  let smallestId = pages[0].id;

  for (const page of pages) {
    if (page.id === DEFAULT_PAGE_ID) {
      hasDefault = true;
      break;
    }
    if (page.id < smallestId) {
      smallestId = page.id;
    }
  }

  if (hasDefault) {
    return DEFAULT_PAGE_ID;
  }

  return smallestId;
};

export const resolveActivePageId = (
  pages: readonly ExcalidrawPage[],
  activePageId: string | null | undefined,
): string => {
  const nonDeleted = getNonDeletedPages(pages);
  if (activePageId && nonDeleted.some((p) => p.id === activePageId)) {
    return activePageId;
  }

  const homePageId = getHomePageId(pages);
  if (nonDeleted.some((p) => p.id === homePageId)) {
    return homePageId;
  }

  if (nonDeleted.length > 0) {
    return nonDeleted[0].id;
  }

  return DEFAULT_PAGE_ID;
};

const scenePageOptionsCache = new WeakMap<
  readonly ExcalidrawPage[],
  { activePageId: string | null | undefined; options: ScenePageOptions }
>();

export const getScenePageOptions = (
  pages: readonly ExcalidrawPage[],
  activePageId: string | null | undefined,
): ScenePageOptions => {
  const cached = scenePageOptionsCache.get(pages);
  if (cached && cached.activePageId === activePageId) {
    return cached.options;
  }

  const resolvedActivePageId = resolveActivePageId(pages, activePageId);
  const homePageId = getHomePageId(pages);
  const pageIds = new Set<string>();
  for (const page of pages) {
    pageIds.add(page.id);
  }

  const options: ScenePageOptions = {
    activePageId: resolvedActivePageId,
    homePageId,
    pageIds,
    isSinglePage: pages.length <= 1,
  };

  scenePageOptionsCache.set(pages, { activePageId, options });

  return options;
};

export const getElementPageId = (
  element: ExcalidrawElement,
  options: ScenePageOptions | null,
): string => {
  if (!options) {
    return DEFAULT_PAGE_ID;
  }
  if (
    typeof element.pageId === "string" &&
    options.pageIds.has(element.pageId)
  ) {
    return element.pageId;
  }
  return options.homePageId;
};

export const isElementOnActivePage = (
  element: ExcalidrawElement,
  options: ScenePageOptions | null,
): boolean => {
  if (!options || options.isSinglePage) {
    return true;
  }
  return getElementPageId(element, options) === options.activePageId;
};

export const stampElementsPage = (
  elements: readonly ExcalidrawElement[],
  options: ScenePageOptions | null,
): void => {
  if (!options) {
    return;
  }

  for (const element of elements) {
    const mutableElement = element as Mutable<ExcalidrawElement>;
    if (options.activePageId === options.homePageId) {
      delete mutableElement.pageId;
    } else {
      mutableElement.pageId = options.activePageId;
    }
  }
};

export const generatePageIndex = (
  pages: readonly ExcalidrawPage[],
): FractionalIndex => {
  let highestIndex: FractionalIndex | null = null;
  for (const page of pages) {
    if (highestIndex === null || page.index > highestIndex) {
      highestIndex = page.index;
    }
  }
  return generateKeyBetween(highestIndex, null) as FractionalIndex;
};

export const getReorderedPageIndex = (
  pages: readonly ExcalidrawPage[],
  pageId: string,
  toPosition: number,
): FractionalIndex => {
  const sortedNonDeleted = sortPages(
    getNonDeletedPages(pages).filter((p) => p.id !== pageId),
  );

  const clampedPosition = Math.max(
    0,
    Math.min(toPosition, sortedNonDeleted.length),
  );

  const prev =
    clampedPosition > 0 ? sortedNonDeleted[clampedPosition - 1] : null;
  const next =
    clampedPosition < sortedNonDeleted.length
      ? sortedNonDeleted[clampedPosition]
      : null;

  if (prev && next && prev.index === next.index) {
    return prev.index;
  }

  return generateKeyBetween(
    prev?.index ?? null,
    next?.index ?? null,
  ) as FractionalIndex;
};

export const newPage = (opts: {
  name: string;
  pages: readonly ExcalidrawPage[];
}): ExcalidrawPage => {
  return {
    id: randomId(),
    name: opts.name,
    index: generatePageIndex(opts.pages),
    version: 1,
    versionNonce: randomInteger(),
    isDeleted: false,
  };
};

export const updatePage = (
  page: ExcalidrawPage,
  updates: Partial<Pick<ExcalidrawPage, "name" | "index" | "isDeleted">>,
): ExcalidrawPage => {
  return {
    ...page,
    ...updates,
    version: page.version + 1,
    versionNonce: randomInteger(),
  };
};

export const reconcilePages = (
  localPages: readonly ExcalidrawPage[],
  remotePages: readonly ExcalidrawPage[],
): ExcalidrawPage[] => {
  const localMap = new Map<string, ExcalidrawPage>();
  for (const page of localPages) {
    localMap.set(page.id, page);
  }

  const resultMap = new Map<string, ExcalidrawPage>();

  for (const remote of remotePages) {
    const local = localMap.get(remote.id);
    if (!local) {
      resultMap.set(remote.id, remote);
    } else {
      const keepLocal =
        local.version > remote.version ||
        (local.version === remote.version &&
          local.versionNonce <= remote.versionNonce);
      resultMap.set(remote.id, keepLocal ? local : remote);
    }
  }

  for (const local of localPages) {
    if (!resultMap.has(local.id)) {
      resultMap.set(local.id, local);
    }
  }

  return sortPages(Array.from(resultMap.values()));
};

export const getPagesVersion = (
  pages: readonly ExcalidrawPage[] | null | undefined,
): number => {
  if (!pages || pages.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const page of pages) {
    sum += page.version;
  }
  return sum;
};

export const applyPageChanges = (
  pages: readonly ExcalidrawPage[],
  changed: readonly ExcalidrawPage[],
): ExcalidrawPage[] => {
  const pageMap = new Map<string, ExcalidrawPage>();
  for (const page of pages) {
    pageMap.set(page.id, page);
  }

  for (const changedPage of changed) {
    const existing = pageMap.get(changedPage.id);
    if (existing) {
      pageMap.set(changedPage.id, {
        ...existing,
        name: changedPage.name,
        index: changedPage.index,
        isDeleted: changedPage.isDeleted,
        version: Math.max(existing.version, changedPage.version) + 1,
        versionNonce: randomInteger(),
      });
    } else {
      pageMap.set(changedPage.id, {
        ...changedPage,
        version: changedPage.version + 1,
        versionNonce: randomInteger(),
      });
    }
  }

  return sortPages(Array.from(pageMap.values()));
};

export const MAX_PAGES = 1000;
export const MAX_PAGE_NAME_LENGTH = 256;

const RESERVED_PAGE_IDS = new Set(["__proto__", "constructor", "prototype"]);

export const restorePages = (input: unknown): ExcalidrawPage[] => {
  if (!Array.isArray(input)) {
    return createDefaultPages();
  }

  const keptPages: ExcalidrawPage[] = [];
  const seenIds = new Set<string>();
  let lastIndex: FractionalIndex | null = null;

  for (const raw of input) {
    if (keptPages.length >= MAX_PAGES) {
      break;
    }
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== "string" || item.id.trim() === "") {
      continue;
    }
    if (RESERVED_PAGE_IDS.has(item.id)) {
      continue;
    }
    if (seenIds.has(item.id)) {
      continue;
    }
    seenIds.add(item.id);

    const rawName = typeof item.name === "string" ? item.name : "";
    const name = rawName.slice(0, MAX_PAGE_NAME_LENGTH);
    let index: FractionalIndex;
    let isValidIndex = false;
    if (typeof item.index === "string" && item.index.length > 0) {
      try {
        generateKeyBetween(item.index, null);
        isValidIndex = true;
      } catch {
        isValidIndex = false;
      }
    }
    if (isValidIndex) {
      index = item.index as FractionalIndex;
    } else {
      index = generateKeyBetween(lastIndex, null) as FractionalIndex;
    }
    lastIndex = index;

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

    keptPages.push({
      id: item.id,
      name,
      index,
      version,
      versionNonce,
      isDeleted,
    });
  }

  const sorted = sortPages(keptPages);
  const nonDeleted = getNonDeletedPages(sorted);

  if (nonDeleted.length === 0) {
    const tombstones = sorted.filter((p) => p.isDeleted);
    return sortPages([...createDefaultPages(), ...tombstones]);
  }

  return sorted;
};
