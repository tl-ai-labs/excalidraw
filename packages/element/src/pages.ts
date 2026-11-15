import { randomId, randomInteger } from "@excalidraw/common";

import type { Mutable } from "@excalidraw/common/utility-types";

import type { ExcalidrawElement, ExcalidrawPage } from "./types";

/**
 * Id of the page that elements without a `pageId` belong to. Files saved
 * before pages existed restore onto this page. It's a constant so that every
 * client of a collaboration session derives the same default page.
 */
export const DEFAULT_PAGE_ID = "default-page";

export const DEFAULT_PAGE_NAME = "Page 1";

export const getElementPageId = (
  element: Pick<ExcalidrawElement, "pageId">,
): string => element.pageId || DEFAULT_PAGE_ID;

export const isElementOnPage = (
  element: Pick<ExcalidrawElement, "pageId">,
  pageId: string,
) => getElementPageId(element) === pageId;

/** deterministic, so that clients restoring the same legacy scene agree */
export const getDefaultPage = (): ExcalidrawPage => ({
  id: DEFAULT_PAGE_ID,
  name: DEFAULT_PAGE_NAME,
  order: 0,
  version: 1,
  versionNonce: 0,
  isDeleted: false,
  updated: 1,
});

export const newPage = (opts: {
  name: string;
  order: number;
  id?: string;
}): ExcalidrawPage => ({
  id: opts.id ?? randomId(),
  name: opts.name,
  order: opts.order,
  version: 1,
  versionNonce: randomInteger(),
  isDeleted: false,
  updated: Date.now(),
});

/** returns a new page instance with bumped version */
export const updatePage = (
  page: ExcalidrawPage,
  updates: Partial<Pick<ExcalidrawPage, "name" | "order" | "isDeleted">>,
): ExcalidrawPage => ({
  ...page,
  ...updates,
  version: page.version + 1,
  versionNonce: randomInteger(),
  updated: Date.now(),
});

const comparePages = (a: ExcalidrawPage, b: ExcalidrawPage) =>
  a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const orderPages = (pages: readonly ExcalidrawPage[]) =>
  [...pages].sort(comparePages);

/** non-deleted pages, in tab order */
export const getVisiblePages = (
  pages: readonly ExcalidrawPage[],
): ExcalidrawPage[] => orderPages(pages.filter((page) => !page.isDeleted));

export const getPage = (
  pages: readonly ExcalidrawPage[],
  pageId: string | null | undefined,
) => (pageId ? pages.find((page) => page.id === pageId) ?? null : null);

export const isVisiblePage = (
  pages: readonly ExcalidrawPage[],
  pageId: string | null | undefined,
) => !!getPage(pages, pageId) && !getPage(pages, pageId)!.isDeleted;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** drops malformed pages & normalizes fields of (untrusted) pages */
const sanitizePages = (pages: unknown): ExcalidrawPage[] => {
  const restored: ExcalidrawPage[] = [];
  const seen = new Set<string>();

  if (Array.isArray(pages)) {
    for (const page of pages) {
      if (
        !page ||
        typeof page !== "object" ||
        typeof page.id !== "string" ||
        !page.id ||
        seen.has(page.id)
      ) {
        continue;
      }
      seen.add(page.id);
      restored.push({
        id: page.id,
        name:
          typeof page.name === "string" && page.name.trim()
            ? page.name
            : `Page ${restored.length + 1}`,
        order: isFiniteNumber(page.order) ? page.order : restored.length,
        version:
          isFiniteNumber(page.version) && page.version > 0 ? page.version : 1,
        versionNonce: isFiniteNumber(page.versionNonce) ? page.versionNonce : 0,
        isDeleted: !!page.isDeleted,
        updated: isFiniteNumber(page.updated) ? page.updated : 1,
      });
    }
  }

  return restored;
};

/**
 * Sanitizes (untrusted) pages and makes sure there's at least one visible
 * page. Legacy scenes without pages get the default page.
 */
export const restorePages = (pages: unknown): ExcalidrawPage[] => {
  const restored = sanitizePages(pages);

  if (!restored.some((page) => !page.isDeleted)) {
    const defaultPage = restored.find((page) => page.id === DEFAULT_PAGE_ID);
    if (defaultPage) {
      // revive the tombstone rather than minting a conflicting page
      restored[restored.indexOf(defaultPage)] = updatePage(defaultPage, {
        isDeleted: false,
      });
    } else {
      restored.push(getDefaultPage());
    }
  }

  return orderPages(restored);
};

/**
 * Picks the page to show: the requested one if it's visible, otherwise the
 * first visible page.
 */
export const resolveActivePageId = (
  pages: readonly ExcalidrawPage[],
  requestedPageId: string | null | undefined,
): string => {
  if (isVisiblePage(pages, requestedPageId)) {
    return requestedPageId!;
  }
  return getVisiblePages(pages)[0]?.id ?? DEFAULT_PAGE_ID;
};

const shouldDiscardRemotePage = (
  local: ExcalidrawPage | undefined,
  remote: ExcalidrawPage,
) =>
  !!local &&
  (local.version > remote.version ||
    (local.version === remote.version &&
      local.versionNonce <= remote.versionNonce));

/**
 * Merges local & remote pages, page by page (last-writer-wins on `version`).
 *
 * @returns the local array instance if nothing changed
 */
export const reconcilePages = (
  localPages: readonly ExcalidrawPage[],
  remotePages: readonly ExcalidrawPage[],
): readonly ExcalidrawPage[] => {
  const merged = new Map(localPages.map((page) => [page.id, page]));
  let didChange = false;

  for (const remote of sanitizePages(remotePages)) {
    if (!shouldDiscardRemotePage(merged.get(remote.id), remote)) {
      merged.set(remote.id, remote);
      didChange = true;
    }
  }

  return didChange ? orderPages(Array.from(merged.values())) : localPages;
};

/**
 * Hash of the pages' versions, to cheaply detect changes (i.e. to decide
 * whether to broadcast them to collaborators).
 */
export const hashPagesVersion = (pages: readonly ExcalidrawPage[]) => {
  let hash = 5381;
  for (const page of pages) {
    hash = (hash << 5) + hash + page.versionNonce;
  }
  return hash >>> 0;
};

/**
 * Groups elements by page, preserving the relative order of the elements
 * and the order in which pages first appear.
 */
export const groupElementsByPage = <
  T extends Pick<ExcalidrawElement, "pageId">,
>(
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

/**
 * Moves a (new, not yet synced) element onto the page by mutating it. Use
 * `newElementWith(element, { pageId })` for elements already in the scene.
 */
export const setElementPageId = (
  element: ExcalidrawElement,
  pageId: string,
) => {
  if (pageId === DEFAULT_PAGE_ID) {
    delete (element as Mutable<ExcalidrawElement>).pageId;
  } else {
    (element as Mutable<ExcalidrawElement>).pageId = pageId;
  }
};
