import type { ExcalidrawElement, PageId } from "./types";

export const DEFAULT_PAGE_ID: PageId = "page-1";

export const isElementOnPage = (
  element: ExcalidrawElement,
  pageId: PageId | null | undefined,
): boolean => {
  if (!pageId) {
    return true;
  }
  if (element.pageId) {
    return element.pageId === pageId;
  }
  return pageId === DEFAULT_PAGE_ID;
};

export const filterElementsByPage = <T extends ExcalidrawElement>(
  elements: readonly T[],
  pageId: PageId | null | undefined,
): T[] => {
  if (!pageId) {
    return [...elements];
  }
  return elements.filter((el) => isElementOnPage(el, pageId));
};

/**
 * Stamps an element with the given pageId.
 * For the default page (`DEFAULT_PAGE_ID`), omits `pageId` to preserve
 * backward compatibility with legacy files and element snapshots.
 */
export const withElementPageId = <T extends ExcalidrawElement>(
  element: T,
  pageId: PageId | null | undefined,
): T => {
  if (!pageId || pageId === DEFAULT_PAGE_ID) {
    if ("pageId" in element && element.pageId !== undefined) {
      const { pageId: _removed, ...rest } = element;
      return rest as T;
    }
    return element;
  }
  if (element.pageId === pageId) {
    return element;
  }
  return {
    ...element,
    pageId,
  };
};
