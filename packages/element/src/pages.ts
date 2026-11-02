import {
  DEFAULT_PAGE_ID,
  MAX_PAGE_NAME_LENGTH,
  PAGE_NAME_PREFIX,
  getUpdatedTimestamp,
  randomId,
  randomInteger,
} from "@excalidraw/common";

import {
  generateNKeysBetween,
  validateOrderKey,
} from "@excalidraw/fractional-indexing";

import type { Mutable } from "@excalidraw/common/utility-types";

import { newElementWith } from "./mutateElement";

import type { ElementUpdate } from "./mutateElement";

import type {
  ExcalidrawElement,
  ExcalidrawPage,
  FractionalIndex,
  PageViewport,
} from "./types";

const comparePages = (a: ExcalidrawPage, b: ExcalidrawPage) => {
  if (a.index !== b.index) {
    return a.index < b.index ? -1 : 1;
  }
  if (a.id !== b.id) {
    return a.id < b.id ? -1 : 1;
  }
  return 0;
};

export const sortPages = (pages: readonly ExcalidrawPage[]): ExcalidrawPage[] =>
  [...pages].sort(comparePages);

const bumpPage = (
  page: ExcalidrawPage,
  updates: Partial<ExcalidrawPage>,
): ExcalidrawPage => ({
  ...page,
  ...updates,
  version: page.version + 1,
  versionNonce: randomInteger(),
  updated: getUpdatedTimestamp(),
});

export const getElementPageId = (
  element: Pick<ExcalidrawElement, "pageId">,
): string => element.pageId ?? DEFAULT_PAGE_ID;

/**
 * Mutates the elements in place: the caller owns them. Does not bump version.
 */
export const adoptElementsIntoPage = <T extends ExcalidrawElement>(
  elements: readonly T[],
  pageId: string,
): readonly T[] => {
  for (const element of elements) {
    if (
      getElementPageId(element) !== pageId ||
      element.pageId === DEFAULT_PAGE_ID
    ) {
      if (pageId === DEFAULT_PAGE_ID) {
        delete (element as Mutable<ExcalidrawElement>).pageId;
      } else {
        (element as Mutable<ExcalidrawElement>).pageId = pageId;
      }
    }
  }
  return elements;
};

export const groupElementsByPage = <T extends ExcalidrawElement>(
  elements: readonly T[],
): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const element of elements) {
    const pageId = getElementPageId(element);
    let group = groups.get(pageId);
    if (!group) {
      group = [];
      groups.set(pageId, group);
    }
    group.push(element);
  }
  return groups;
};

export const hasPagedElements = (
  elements: readonly ExcalidrawElement[],
): boolean => {
  for (const element of elements) {
    if (element.pageId) {
      return true;
    }
  }
  return false;
};

export const getDefaultPage = (): ExcalidrawPage => ({
  id: DEFAULT_PAGE_ID,
  name: `${PAGE_NAME_PREFIX} 1`,
  index: "a0" as FractionalIndex,
  version: 1,
  versionNonce: 0,
  isDeleted: false,
  updated: 0,
});

export const getLivePages = (
  pages: readonly ExcalidrawPage[],
): ExcalidrawPage[] => sortPages(pages.filter((page) => !page.isDeleted));

export const getNextPageName = (pages: readonly ExcalidrawPage[]): string => {
  const pattern = new RegExp(`^${PAGE_NAME_PREFIX} (\\d+)$`);
  let highest = 0;
  for (const page of pages) {
    if (page.isDeleted) {
      continue;
    }
    const match = pattern.exec(page.name);
    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  }
  return `${PAGE_NAME_PREFIX} ${highest + 1}`;
};

export const normalizePageName = (name: string, fallback: string): string => {
  const normalized = name.trim().slice(0, MAX_PAGE_NAME_LENGTH);
  return normalized || fallback;
};

export const newPage = (
  pages: readonly ExcalidrawPage[],
  name: string | undefined,
): ExcalidrawPage => {
  const live = getLivePages(pages);
  const last = live.length ? live[live.length - 1].index : null;
  return {
    id: randomId(),
    name: normalizePageName(name ?? "", getNextPageName(pages)),
    index: generateNKeysBetween(last, null, 1)[0] as FractionalIndex,
    version: 1,
    versionNonce: randomInteger(),
    isDeleted: false,
    updated: getUpdatedTimestamp(),
  };
};

export const renamePage = (
  pages: readonly ExcalidrawPage[],
  pageId: string,
  name: string,
): readonly ExcalidrawPage[] => {
  const page = pages.find((candidate) => candidate.id === pageId);
  if (!page) {
    return pages;
  }
  const normalized = normalizePageName(name, page.name);
  if (normalized === page.name) {
    return pages;
  }
  return pages.map((candidate) =>
    candidate === page ? bumpPage(page, { name: normalized }) : candidate,
  );
};

export const assignPageIndices = (
  pages: readonly ExcalidrawPage[],
): ExcalidrawPage[] => {
  const indices = generateNKeysBetween(null, null, pages.length);
  return pages.map((page, i) => ({
    ...page,
    index: indices[i] as FractionalIndex,
  }));
};

export const movePage = (
  pages: readonly ExcalidrawPage[],
  pageId: string,
  toPosition: number,
): readonly ExcalidrawPage[] => {
  const live = getLivePages(pages);
  const currentPosition = live.findIndex((page) => page.id === pageId);
  if (currentPosition === -1) {
    return pages;
  }
  const page = live[currentPosition];
  const others = live.filter((candidate) => candidate.id !== pageId);
  const position = Math.min(Math.max(Math.round(toPosition), 0), others.length);
  if (position === currentPosition) {
    return pages;
  }

  const before = others[position - 1];
  const after = others[position];

  if (before && after && before.index === after.index) {
    const ordered = [
      ...others.slice(0, position),
      page,
      ...others.slice(position),
    ];
    const newIndices = new Map(
      assignPageIndices(ordered).map((entry) => [entry.id, entry.index]),
    );
    return pages.map((candidate) => {
      const index = newIndices.get(candidate.id);
      return index && index !== candidate.index
        ? bumpPage(candidate, { index })
        : candidate;
    });
  }

  const index = generateNKeysBetween(
    before ? before.index : null,
    after ? after.index : null,
    1,
  )[0] as FractionalIndex;

  return pages.map((candidate) =>
    candidate === page || candidate.id === pageId
      ? bumpPage(candidate, { index })
      : candidate,
  );
};

export const deletePage = (
  pages: readonly ExcalidrawPage[],
  pageId: string,
): readonly ExcalidrawPage[] =>
  pages.map((page) =>
    page.id === pageId ? bumpPage(page, { isDeleted: true }) : page,
  );

export const getNeighbourPageId = (
  livePages: readonly ExcalidrawPage[],
  pageId: string,
  stillLive: ReadonlySet<string> | undefined,
): string | null => {
  const position = livePages.findIndex((page) => page.id === pageId);
  const isCandidate = (page: ExcalidrawPage) =>
    page.id !== pageId && (!stillLive || stillLive.has(page.id));

  for (let i = position + 1; i < livePages.length; i++) {
    if (isCandidate(livePages[i])) {
      return livePages[i].id;
    }
  }
  for (
    let i = (position === -1 ? livePages.length : position) - 1;
    i >= 0;
    i--
  ) {
    if (isCandidate(livePages[i])) {
      return livePages[i].id;
    }
  }
  return null;
};

export const getPagesVersion = (pages: readonly ExcalidrawPage[]): number =>
  pages.reduce((sum, page) => sum + page.version, 0);

const isPristineDefault = (page: ExcalidrawPage) =>
  page.id === DEFAULT_PAGE_ID && page.version === 1;

const mergePage = (
  local: ExcalidrawPage,
  remote: ExcalidrawPage,
): ExcalidrawPage => {
  if (local.isDeleted || remote.isDeleted) {
    if (local.isDeleted && remote.isDeleted) {
      return remote.version > local.version ? remote : local;
    }
    return local.isDeleted ? local : remote;
  }
  if (remote.version !== local.version) {
    return remote.version > local.version ? remote : local;
  }
  return remote.versionNonce < local.versionNonce ? remote : local;
};

export const reconcilePages = (
  localPages: readonly ExcalidrawPage[],
  remotePages: readonly ExcalidrawPage[],
): readonly ExcalidrawPage[] => {
  const localHasPristine = localPages.some(isPristineDefault);
  const remoteHasPristine = remotePages.some(isPristineDefault);

  let local = localPages;
  let remote = remotePages;
  if (localHasPristine && !remoteHasPristine && remotePages.length > 0) {
    local = localPages.filter((page) => !isPristineDefault(page));
  } else if (remoteHasPristine && !localHasPristine && localPages.length > 0) {
    remote = remotePages.filter((page) => !isPristineDefault(page));
  }

  const merged = new Map<string, ExcalidrawPage>();
  for (const page of local) {
    merged.set(page.id, page);
  }
  for (const page of remote) {
    const existing = merged.get(page.id);
    merged.set(page.id, existing ? mergePage(existing, page) : page);
  }

  let result = [...merged.values()].sort(comparePages);

  if (result.length && !result.some((page) => !page.isDeleted)) {
    const lowest = result[0];
    result = result.map((page) =>
      page === lowest ? { ...page, isDeleted: false } : page,
    );
  }

  const unchanged =
    result.length === localPages.length &&
    result.every((page) => localPages.some((local) => local === page));

  return unchanged ? localPages : result;
};

export const applyPageTombstones = <T extends ExcalidrawElement>(
  elements: readonly T[],
  pages: readonly ExcalidrawPage[],
): readonly T[] => {
  const tombstoned = new Set<string>();
  for (const page of pages) {
    if (page.isDeleted) {
      tombstoned.add(page.id);
    }
  }
  if (!tombstoned.size) {
    return elements;
  }

  let didChange = false;
  const result = elements.map((element) => {
    if (!element.isDeleted && tombstoned.has(getElementPageId(element))) {
      didChange = true;
      return newElementWith(element, {
        isDeleted: true,
      } as ElementUpdate<T>);
    }
    return element;
  });

  return didChange ? result : elements;
};

export const getActivePageElements = <T extends ExcalidrawElement>(
  elements: readonly T[],
  appState: { activePageId?: string } | null | undefined,
): readonly T[] => {
  const activePageId = appState?.activePageId;
  if (
    activePageId === undefined ||
    (activePageId === DEFAULT_PAGE_ID && !hasPagedElements(elements))
  ) {
    return elements;
  }
  return elements.filter(
    (element) => getElementPageId(element) === activePageId,
  );
};

export const getPageViewportsForSave = (appState: {
  activePageId?: string;
  pageViewports?: Readonly<Record<string, PageViewport>>;
  scrollX?: number;
  scrollY?: number;
  zoom?: { value: number };
}): Record<string, PageViewport> => {
  const { activePageId, pageViewports, scrollX, scrollY, zoom } = appState;
  if (
    activePageId !== undefined &&
    scrollX !== undefined &&
    scrollY !== undefined &&
    zoom
  ) {
    return {
      ...pageViewports,
      [activePageId]: { scrollX, scrollY, zoom: zoom.value },
    };
  }
  return (pageViewports ?? {}) as Record<string, PageViewport>;
};

export const getPageViewport = (
  pageViewports: Readonly<Record<string, PageViewport>> | undefined,
  pageId: string,
): PageViewport | undefined =>
  pageViewports && Object.prototype.hasOwnProperty.call(pageViewports, pageId)
    ? pageViewports[pageId]
    : undefined;

export const scopeAppStateToActivePage = <
  T extends {
    pages?: readonly ExcalidrawPage[];
    activePageId?: string;
    pageViewports?: Readonly<Record<string, PageViewport>>;
    scrollX?: number;
    scrollY?: number;
    zoom?: { value: number };
  },
>(
  appState: T,
): T => {
  if (!appState.pages) {
    return appState;
  }
  const active =
    appState.pages.find((page) => page.id === appState.activePageId) ??
    getLivePages(appState.pages)[0];
  const viewports = getPageViewportsForSave(appState);
  const viewport = active ? getPageViewport(viewports, active.id) : undefined;
  return {
    ...appState,
    pages: active ? [active] : [],
    pageViewports: active && viewport ? { [active.id]: viewport } : {},
  };
};

export const isValidPageIndex = (index: unknown): index is FractionalIndex => {
  if (typeof index !== "string" || !index.length) {
    return false;
  }
  try {
    validateOrderKey(index);
    return true;
  } catch {
    return false;
  }
};

export const MAX_REMOTE_PAGES = 1000;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const sanitizeRemotePages = (value: unknown): ExcalidrawPage[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: ExcalidrawPage[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (result.length >= MAX_REMOTE_PAGES) {
      break;
    }
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const { id, name, index, version, versionNonce, isDeleted, updated } =
      record;
    if (
      typeof id !== "string" ||
      !id.length ||
      typeof name !== "string" ||
      name.length > MAX_PAGE_NAME_LENGTH ||
      !isValidPageIndex(index) ||
      !isFiniteNumber(version) ||
      !isFiniteNumber(versionNonce) ||
      !isFiniteNumber(updated) ||
      typeof isDeleted !== "boolean" ||
      seen.has(id)
    ) {
      continue;
    }
    seen.add(id);
    result.push({
      id,
      name,
      index,
      version,
      versionNonce,
      isDeleted,
      updated,
    });
  }
  return result;
};

export const dropDeletedPageElements = <T extends ExcalidrawElement>(
  elements: readonly T[],
  pages: readonly ExcalidrawPage[],
): readonly T[] => {
  const deleted = new Set<string>();
  for (const page of pages) {
    if (page.isDeleted) {
      deleted.add(page.id);
    }
  }
  if (!deleted.size) {
    return elements;
  }
  return elements.filter((element) => !deleted.has(getElementPageId(element)));
};
