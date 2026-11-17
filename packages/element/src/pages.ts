import { DEFAULT_PAGE_ID, randomId, randomInteger } from "@excalidraw/common";

import { generateKeyBetween } from "@excalidraw/fractional-indexing";

import type { ExcalidrawElement, FractionalIndex, Page } from "./types";

export const DEFAULT_PAGE_NAME = "Page 1";

export const createDefaultPage = (): Page => ({
  id: DEFAULT_PAGE_ID,
  name: DEFAULT_PAGE_NAME,
  index: "a0" as FractionalIndex,
  version: 1,
  versionNonce: 0,
  isDeleted: false,
});

const comparePages = (a: Page, b: Page) =>
  a.index < b.index ? -1 : a.index > b.index ? 1 : a.id < b.id ? -1 : 1;

/** monotonic (per reconciliation) version of a whole page list */
export const getPagesVersion = (pages: readonly Page[] | undefined) =>
  (pages || []).reduce((acc, page) => acc + page.version, 0);

/** non-deleted pages, in tab order */
export const getLivePages = (pages: readonly Page[]): Page[] =>
  pages.filter((page) => !page.isDeleted).sort(comparePages);

/** page which an element is rendered on, given the live page ids (in order) */
export const getElementPageId = (
  element: { pageId?: string },
  livePageIds?: readonly string[],
) => {
  const pageId = element.pageId ?? DEFAULT_PAGE_ID;
  if (livePageIds && livePageIds.length && !livePageIds.includes(pageId)) {
    return livePageIds[0];
  }
  return pageId;
};

export const getNextPageName = (pages: readonly Page[]) => {
  const names = new Set(getLivePages(pages).map((page) => page.name));
  let n = getLivePages(pages).length + 1;
  while (names.has(`Page ${n}`)) {
    n++;
  }
  return `Page ${n}`;
};

export const createPage = (pages: readonly Page[], name?: string): Page => {
  const live = getLivePages(pages);
  const last = live[live.length - 1];
  return {
    id: randomId(),
    name: name ?? getNextPageName(pages),
    index: generateKeyBetween(last?.index ?? null, null) as FractionalIndex,
    version: 1,
    versionNonce: randomInteger(),
    isDeleted: false,
  };
};

/** applies updates to a page, bumping version & versionNonce */
export const updatePage = (
  pages: readonly Page[],
  pageId: string,
  updates: Partial<Pick<Page, "name" | "index" | "isDeleted">>,
): Page[] =>
  pages.map((page) =>
    page.id === pageId
      ? {
          ...page,
          ...updates,
          version: page.version + 1,
          versionNonce: randomInteger(),
        }
      : page,
  );

/** moves a page to the given position among the live pages */
export const movePage = (
  pages: readonly Page[],
  pageId: string,
  toPosition: number,
): Page[] => {
  const live = getLivePages(pages);
  const from = live.findIndex((page) => page.id === pageId);
  if (from === -1) {
    return [...pages];
  }
  const to = Math.max(0, Math.min(live.length - 1, toPosition));
  if (from === to) {
    return [...pages];
  }
  const others = live.filter((page) => page.id !== pageId);
  const before = others[to - 1]?.index ?? null;
  const after = others[to]?.index ?? null;
  return updatePage(pages, pageId, {
    index: generateKeyBetween(before, after) as FractionalIndex,
  });
};

/**
 * Reconciles two page lists per page id: higher version wins, ties are
 * broken by the lower versionNonce. Tombstones are kept.
 */
export const reconcilePages = (
  localPages: readonly Page[],
  remotePages: readonly Page[],
): Page[] => {
  const result = new Map<string, Page>();
  for (const page of localPages) {
    result.set(page.id, page);
  }
  for (const remote of remotePages) {
    const local = result.get(remote.id);
    if (
      !local ||
      remote.version > local.version ||
      (remote.version === local.version &&
        remote.versionNonce < local.versionNonce)
    ) {
      result.set(remote.id, remote);
    }
  }
  return [...result.values()].sort(comparePages);
};

export const isElementOnPage = (
  element: Pick<ExcalidrawElement, "pageId">,
  pageId: string,
  livePageIds?: readonly string[],
) => getElementPageId(element, livePageIds) === pageId;

/**
 * Sanitizes persisted / imported pages. Always returns at least one live page
 * (legacy files, without `pages`, get the single default page).
 */
export const restorePages = (rawPages: unknown): Page[] => {
  if (!Array.isArray(rawPages)) {
    return [createDefaultPage()];
  }
  const pages: Page[] = [];
  const seen = new Set<string>();
  let prevIndex: string | null = null;
  for (const raw of rawPages) {
    if (
      !raw ||
      typeof raw !== "object" ||
      typeof raw.id !== "string" ||
      !raw.id ||
      seen.has(raw.id)
    ) {
      continue;
    }
    seen.add(raw.id);
    let index: string;
    if (typeof raw.index === "string" && raw.index) {
      index = raw.index;
    } else {
      index = generateKeyBetween(prevIndex, null);
    }
    prevIndex = index;
    pages.push({
      id: raw.id,
      name: typeof raw.name === "string" ? raw.name : "",
      index: index as FractionalIndex,
      version:
        Number.isFinite(raw.version) && raw.version > 0 ? raw.version : 1,
      versionNonce: Number.isFinite(raw.versionNonce) ? raw.versionNonce : 0,
      isDeleted: !!raw.isDeleted,
    });
  }
  if (!pages.some((page) => !page.isDeleted)) {
    const fallback = seen.has(DEFAULT_PAGE_ID)
      ? createPage(pages)
      : createDefaultPage();
    pages.push(fallback);
  }
  return pages;
};
