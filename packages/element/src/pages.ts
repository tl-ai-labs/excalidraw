import {
  getUpdatedTimestamp,
  randomId,
  randomInteger,
} from "@excalidraw/common";
import {
  generateNKeysBetween,
  validateOrderKey,
} from "@excalidraw/fractional-indexing";

import type { Mutable } from "@excalidraw/common/utility-types";

import type { ExcalidrawPage, FractionalIndex } from "./types";

export const DEFAULT_PAGE_NAME = "Page 1";

export const createPage = (opts?: {
  id?: string;
  name?: string;
  index?: FractionalIndex;
  version?: number;
  versionNonce?: number;
  isDeleted?: boolean;
  updated?: number;
}): ExcalidrawPage => {
  return {
    id: opts?.id || randomId(),
    name: opts?.name ?? DEFAULT_PAGE_NAME,
    index:
      opts?.index ??
      (generateNKeysBetween(null, null, 1)[0] as FractionalIndex),
    version: opts?.version ?? 1,
    versionNonce: opts?.versionNonce ?? randomInteger(),
    isDeleted: opts?.isDeleted ?? false,
    updated: opts?.updated ?? getUpdatedTimestamp(),
  };
};

export const newPageWith = (
  page: ExcalidrawPage,
  updates: Partial<
    Omit<ExcalidrawPage, "id" | "version" | "versionNonce" | "updated">
  >,
): ExcalidrawPage => {
  return {
    ...page,
    ...updates,
    version: page.version + 1,
    versionNonce: randomInteger(),
    updated: getUpdatedTimestamp(),
  };
};

export const bumpPageVersion = (
  page: ExcalidrawPage,
  localVersion?: number,
): ExcalidrawPage => {
  return {
    ...page,
    version: Math.max(page.version, localVersion ?? 0) + 1,
    versionNonce: randomInteger(),
    updated: getUpdatedTimestamp(),
  };
};

export const orderPagesByFractionalIndex = <T extends ExcalidrawPage>(
  pages: readonly T[],
): T[] => {
  return [...pages].sort((a, b) => {
    if (a.index < b.index) {
      return -1;
    }
    if (a.index > b.index) {
      return 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
};

export const syncInvalidPageIndices = (
  pages: readonly ExcalidrawPage[],
): ExcalidrawPage[] => {
  const result = pages.map((page) => ({ ...page }));

  let prevIndex: FractionalIndex | null = null;
  for (let i = 0; i < result.length; i++) {
    const page = result[i] as Mutable<ExcalidrawPage>;
    let isValid = true;
    try {
      validateOrderKey(page.index);
      if (prevIndex !== null && page.index <= prevIndex) {
        isValid = false;
      }
    } catch {
      isValid = false;
    }

    if (!isValid) {
      let nextValidIndex: FractionalIndex | null = null;
      for (let j = i + 1; j < result.length; j++) {
        try {
          validateOrderKey(result[j].index);
          if (prevIndex === null || result[j].index > prevIndex) {
            nextValidIndex = result[j].index;
            break;
          }
        } catch {
          // continue searching
        }
      }
      page.index = generateNKeysBetween(
        prevIndex,
        nextValidIndex,
        1,
      )[0] as FractionalIndex;
    }
    prevIndex = page.index;
  }

  return result;
};

export const getPagesVersion = (pages: readonly ExcalidrawPage[]) =>
  pages.reduce((acc, page) => acc + page.version, 0);
