import { arrayToMap, randomId, randomInteger } from "@excalidraw/common";

import {
  generateKeyBetween,
  validateOrderKey,
} from "@excalidraw/fractional-indexing";

import {
  isBindingElement,
  isBoundToContainer,
  isFrameLikeElement,
} from "./typeChecks";

import type { ExcalidrawElement, ExcalidrawPage } from "./types";

/**
 * Pure helpers for the page model.
 *
 * - pages are versioned and tombstoned (`isDeleted`) so they reconcile deterministically
 * - page order is defined by the fractional `index`, ties broken by `id`
 * - no helper mutates its arguments; unchanged inputs are returned by reference
 */

export const DEFAULT_PAGE_ID = "page-1";
export const DEFAULT_PAGE_NAME = "Page 1";

/** Maximum length of a restored page name; longer names are truncated. */
export const MAX_PAGE_NAME_LENGTH = 100;

/** Maximum number of restored pages; entries beyond it are dropped. */
export const MAX_PAGES = 500;

const FORBIDDEN_PAGE_IDS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/**
 * Deterministic default page, so independently started clients converge.
 */
export const getDefaultPage = (): ExcalidrawPage => ({
  id: DEFAULT_PAGE_ID,
  name: DEFAULT_PAGE_NAME,
  index: "a0",
  version: 1,
  versionNonce: 0,
  isDeleted: false,
});

const comparePages = (a: ExcalidrawPage, b: ExcalidrawPage): number => {
  if (a.index !== b.index) {
    return a.index < b.index ? -1 : 1;
  }
  if (a.id !== b.id) {
    return a.id < b.id ? -1 : 1;
  }
  return 0;
};

const sortPages = (pages: readonly ExcalidrawPage[]): ExcalidrawPage[] =>
  [...pages].sort(comparePages);

/**
 * Non-deleted pages sorted by index, then id.
 */
export const getVisiblePages = (
  pages: readonly ExcalidrawPage[],
): ExcalidrawPage[] => sortPages(pages.filter((page) => !page.isDeleted));

/**
 * The visible page with the given id, else the first visible page, else null.
 */
export const getActivePage = (
  pages: readonly ExcalidrawPage[],
  activePageId: string,
): ExcalidrawPage | null => {
  const visible = getVisiblePages(pages);
  return visible.find((page) => page.id === activePageId) ?? visible[0] ?? null;
};

/**
 * Elements belonging to the given page, in input order.
 */
export const getPageElements = <T extends ExcalidrawElement>(
  elements: readonly T[],
  pageId: string,
): T[] => elements.filter((element) => element.pageId === pageId);

/**
 * First generated name (starting at visible count + 1) not used by a visible page.
 */
export const getNewPageName = (
  pages: readonly ExcalidrawPage[],
  formatName: (n: number) => string,
): string => {
  const visible = getVisiblePages(pages);
  const names = new Set(visible.map((page) => page.name));
  let n = visible.length + 1;
  let name = formatName(n);
  while (names.has(name)) {
    n++;
    name = formatName(n);
  }
  return name;
};

export const createPage = (
  pages: readonly ExcalidrawPage[],
  name: string,
  id?: string,
): { pages: ExcalidrawPage[]; page: ExcalidrawPage } => {
  const visible = getVisiblePages(pages);
  const lastVisible = visible[visible.length - 1];
  const page: ExcalidrawPage = {
    id: id ?? randomId(),
    name,
    index: generateKeyBetween(lastVisible?.index ?? null, null),
    version: 1,
    versionNonce: randomInteger(),
    isDeleted: false,
  };
  return { pages: [...pages, page], page };
};

const updatePage = (
  pages: readonly ExcalidrawPage[],
  pageId: string,
  updates: Partial<Pick<ExcalidrawPage, "name" | "index" | "isDeleted">>,
): ExcalidrawPage[] =>
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

export const renamePage = (
  pages: readonly ExcalidrawPage[],
  pageId: string,
  name: string,
): readonly ExcalidrawPage[] => {
  const trimmed = name.trim();
  const page = pages.find((p) => p.id === pageId);
  if (!trimmed || !page || page.isDeleted || page.name === trimmed) {
    return pages;
  }
  return updatePage(pages, pageId, { name: trimmed });
};

export const movePage = (
  pages: readonly ExcalidrawPage[],
  pageId: string,
  direction: -1 | 1,
): readonly ExcalidrawPage[] => {
  const visible = getVisiblePages(pages);
  const i = visible.findIndex((page) => page.id === pageId);
  if (i === -1) {
    return pages;
  }
  if (
    (direction === -1 && i === 0) ||
    (direction === 1 && i === visible.length - 1)
  ) {
    return pages;
  }
  const [before, after] =
    direction === -1
      ? [visible[i - 2], visible[i - 1]]
      : [visible[i + 1], visible[i + 2]];
  const index = generateKeyBetween(before?.index ?? null, after?.index ?? null);
  return updatePage(pages, pageId, { index });
};

export const deletePage = (
  pages: readonly ExcalidrawPage[],
  pageId: string,
): readonly ExcalidrawPage[] => {
  const page = pages.find((p) => p.id === pageId);
  if (!page || page.isDeleted || getVisiblePages(pages).length <= 1) {
    return pages;
  }
  return updatePage(pages, pageId, { isDeleted: true });
};

/**
 * Id of the visible page after `pageId`, else the one before, else null.
 */
export const getAdjacentPageId = (
  pages: readonly ExcalidrawPage[],
  pageId: string,
): string | null => {
  const visible = getVisiblePages(pages);
  const i = visible.findIndex((page) => page.id === pageId);
  if (i === -1) {
    return null;
  }
  return visible[i + 1]?.id ?? visible[i - 1]?.id ?? null;
};

export const getPagesVersion = (pages: readonly ExcalidrawPage[]): number =>
  pages.reduce((sum, page) => sum + page.version, 0);

const isSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value);

const isValidIndex = (value: unknown): value is string => {
  if (typeof value !== "string" || !value) {
    return false;
  }
  try {
    validateOrderKey(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Repairs an unknown page list into a valid one with at least one visible page.
 */
export const restorePages = (pages: unknown): ExcalidrawPage[] => {
  const restored: ExcalidrawPage[] = [];
  const seen = new Set<string>();
  let lastValidKey: string | null = null;

  if (Array.isArray(pages)) {
    for (const entry of pages as unknown[]) {
      if (restored.length >= MAX_PAGES) {
        break;
      }
      if (typeof entry !== "object" || entry === null) {
        continue;
      }
      const raw = entry as Record<string, unknown>;
      const id = raw.id;
      if (
        typeof id !== "string" ||
        !id ||
        FORBIDDEN_PAGE_IDS.has(id) ||
        seen.has(id)
      ) {
        continue;
      }
      seen.add(id);
      const index: string = isValidIndex(raw.index)
        ? raw.index
        : generateKeyBetween(lastValidKey, null);
      if (lastValidKey === null || index > lastValidKey) {
        lastValidKey = index;
      }
      restored.push({
        id,
        name:
          typeof raw.name === "string" && raw.name
            ? raw.name.slice(0, MAX_PAGE_NAME_LENGTH)
            : `Page ${restored.length + 1}`,
        index,
        version: isSafeInteger(raw.version) ? raw.version : 1,
        versionNonce: isSafeInteger(raw.versionNonce) ? raw.versionNonce : 0,
        isDeleted: raw.isDeleted === true,
      });
    }
  }

  if (!restored.some((page) => !page.isDeleted)) {
    const existing = restored.findIndex((page) => page.id === DEFAULT_PAGE_ID);
    if (existing === -1) {
      restored.push(getDefaultPage());
    } else {
      const sorted = sortPages(restored);
      const last = sorted[sorted.length - 1];
      restored[existing] = {
        ...getDefaultPage(),
        index: generateKeyBetween(last?.index ?? null, null),
      };
    }
  }

  return sortPages(restored);
};

export const restoreActivePageId = (
  pages: readonly ExcalidrawPage[],
  activePageId: unknown,
): string => {
  const visible = getVisiblePages(pages);
  if (
    typeof activePageId === "string" &&
    visible.some((page) => page.id === activePageId)
  ) {
    return activePageId;
  }
  return visible[0]?.id ?? DEFAULT_PAGE_ID;
};

/**
 * Union by id; higher version wins, equal versions keep the lower versionNonce.
 */
export const reconcilePages = (
  localPages: readonly ExcalidrawPage[],
  remotePages: readonly ExcalidrawPage[],
): ExcalidrawPage[] => {
  const merged = new Map<string, ExcalidrawPage>();
  for (const page of localPages) {
    merged.set(page.id, page);
  }
  for (const remote of remotePages) {
    const local = merged.get(remote.id);
    if (
      !local ||
      remote.version > local.version ||
      (remote.version === local.version &&
        remote.versionNonce < local.versionNonce)
    ) {
      merged.set(remote.id, remote);
    }
  }
  return sortPages([...merged.values()]);
};

/**
 * Moves elements with a missing or unknown `pageId` to the active page and
 * cuts cross-page bound text, frame membership and bindings. No version bump.
 */
export const repairElementPages = <T extends ExcalidrawElement>(
  elements: readonly T[],
  pages: readonly ExcalidrawPage[],
  activePageId: string,
): T[] => {
  const pageIds = new Set(pages.map((page) => page.id));

  const stamped = elements.map((element) =>
    typeof element.pageId === "string" && pageIds.has(element.pageId)
      ? element
      : ({ ...element, pageId: activePageId } as T),
  );

  const stampedMap = arrayToMap(stamped);
  const withText = stamped.map((element) => {
    if (isBoundToContainer(element)) {
      const container = stampedMap.get(element.containerId);
      if (container && container.pageId !== element.pageId) {
        return { ...element, pageId: container.pageId } as T;
      }
    }
    return element;
  });

  const map = arrayToMap(withText);
  const isOtherPage = (id: string, pageId: string | undefined) => {
    const other = map.get(id);
    return !!other && other.pageId !== pageId;
  };

  return withText.map((element) => {
    let next: T = element;
    const pageId = element.pageId;

    if (element.frameId) {
      const frame = map.get(element.frameId);
      if (frame && isFrameLikeElement(frame) && frame.pageId !== pageId) {
        next = { ...next, frameId: null };
      }
    }

    if (isBindingElement(element)) {
      if (
        element.startBinding &&
        isOtherPage(element.startBinding.elementId, pageId)
      ) {
        next = { ...next, startBinding: null } as T;
      }
      if (
        element.endBinding &&
        isOtherPage(element.endBinding.elementId, pageId)
      ) {
        next = { ...next, endBinding: null } as T;
      }
    }

    if (element.boundElements?.some((b) => isOtherPage(b.id, pageId))) {
      next = {
        ...next,
        boundElements: element.boundElements.filter(
          (b) => !isOtherPage(b.id, pageId),
        ),
      };
    }

    return next;
  });
};
