import throttle from "lodash.throttle";

import { arrayToMap, isDevEnv, isTestEnv } from "@excalidraw/common";

import {
  orderByFractionalIndex,
  syncInvalidIndices,
  validateFractionalIndices,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import type { MakeBrand } from "@excalidraw/common/utility-types";

import type { AppState, ExcalidrawPage } from "../types";

export type ReconciledExcalidrawElement = OrderedExcalidrawElement &
  MakeBrand<"ReconciledElement">;

export type RemoteExcalidrawElement = OrderedExcalidrawElement &
  MakeBrand<"RemoteExcalidrawElement">;

export const shouldDiscardRemoteElement = (
  localAppState: AppState,
  local: OrderedExcalidrawElement | undefined,
  remote: RemoteExcalidrawElement,
): boolean => {
  if (
    local &&
    // local element is being edited
    (local.id === localAppState.editingTextElement?.id ||
      local.id === localAppState.resizingElement?.id ||
      local.id === localAppState.newElement?.id ||
      // local element is newer
      local.version > remote.version ||
      // resolve conflicting edits deterministically by taking the one with
      // the lowest versionNonce
      (local.version === remote.version &&
        local.versionNonce <= remote.versionNonce))
  ) {
    return true;
  }
  return false;
};

const validateIndicesThrottled = throttle(
  (
    orderedElements: readonly OrderedExcalidrawElement[],
    localElements: readonly OrderedExcalidrawElement[],
    remoteElements: readonly RemoteExcalidrawElement[],
  ) => {
    if (isDevEnv() || isTestEnv() || window?.DEBUG_FRACTIONAL_INDICES) {
      // create new instances due to the mutation
      const elements = syncInvalidIndices(
        orderedElements.map((x) => ({ ...x })),
      );

      validateFractionalIndices(elements, {
        // throw in dev & test only, to remain functional on `DEBUG_FRACTIONAL_INDICES`
        shouldThrow: isTestEnv() || isDevEnv(),
        includeBoundTextValidation: true,
        reconciliationContext: {
          localElements,
          remoteElements,
        },
      });
    }
  },
  1000 * 60,
  { leading: true, trailing: false },
);

export const reconcileElements = (
  localElements: readonly OrderedExcalidrawElement[],
  remoteElements: readonly RemoteExcalidrawElement[],
  localAppState: AppState,
): ReconciledExcalidrawElement[] => {
  const localElementsMap = arrayToMap(localElements);
  const reconciledElements: OrderedExcalidrawElement[] = [];
  const added = new Set<string>();

  // process remote elements
  for (const remoteElement of remoteElements) {
    if (!added.has(remoteElement.id)) {
      const localElement = localElementsMap.get(remoteElement.id);
      const discardRemoteElement = shouldDiscardRemoteElement(
        localAppState,
        localElement,
        remoteElement,
      );

      if (localElement && discardRemoteElement) {
        reconciledElements.push(localElement);
        added.add(localElement.id);
      } else {
        reconciledElements.push(remoteElement);
        added.add(remoteElement.id);
      }
    }
  }

  // process remaining local elements
  for (const localElement of localElements) {
    if (!added.has(localElement.id)) {
      reconciledElements.push(localElement);
      added.add(localElement.id);
    }
  }

  const orderedElements = orderByFractionalIndex(reconciledElements);

  validateIndicesThrottled(orderedElements, localElements, remoteElements);

  // de-duplicate indices
  syncInvalidIndices(orderedElements);

  return orderedElements as ReconciledExcalidrawElement[];
};

export const reconcilePages = (
  localPages: readonly ExcalidrawPage[],
  remotePages: readonly ExcalidrawPage[] | undefined,
  elements?: readonly ExcalidrawElement[],
): ExcalidrawPage[] => {
  if (!remotePages || !remotePages.length) {
    return [...localPages];
  }

  const localMap = new Map(localPages.map((p) => [p.id, p]));
  const result: ExcalidrawPage[] = [];
  const seen = new Set<string>();

  for (const remotePage of remotePages) {
    if (!remotePage?.id || seen.has(remotePage.id)) {
      continue;
    }
    seen.add(remotePage.id);
    const localPage = localMap.get(remotePage.id);
    result.push({
      id: remotePage.id,
      name: remotePage.name || localPage?.name || "Page",
      scrollX: localPage ? localPage.scrollX : remotePage.scrollX ?? 0,
      scrollY: localPage ? localPage.scrollY : remotePage.scrollY ?? 0,
      zoom: localPage ? localPage.zoom : remotePage.zoom,
    });
  }

  if (elements?.length) {
    const pageIdsWithNonDeletedElements = new Set<string>();
    for (const element of elements) {
      if (!element.isDeleted && element.pageId) {
        pageIdsWithNonDeletedElements.add(element.pageId);
      }
    }
    for (const localPage of localPages) {
      if (
        !seen.has(localPage.id) &&
        pageIdsWithNonDeletedElements.has(localPage.id)
      ) {
        seen.add(localPage.id);
        result.push(localPage);
      }
    }
  }

  return result.length ? result : [...localPages];
};
