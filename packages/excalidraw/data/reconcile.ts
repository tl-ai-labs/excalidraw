import throttle from "lodash.throttle";

import { arrayToMap, isDevEnv, isTestEnv } from "@excalidraw/common";

import {
  areTextRangesEqual,
  isTextElement,
  normalizeTextRanges,
  orderByFractionalIndex,
  syncInvalidIndices,
  validateFractionalIndices,
} from "@excalidraw/element";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

import type { MakeBrand } from "@excalidraw/common/utility-types";

import type { AppState } from "../types";

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

      const sanitizeReconciledElement = (
        element: OrderedExcalidrawElement,
      ): OrderedExcalidrawElement => {
        if (!isTextElement(element) || !("textRanges" in element)) {
          return element;
        }
        const normalized = normalizeTextRanges(
          element.textRanges,
          typeof element.originalText === "string"
            ? element.originalText.length
            : 0,
        );
        if (!normalized) {
          const cloned = { ...element };
          delete (cloned as any).textRanges;
          return cloned;
        }
        if (
          areTextRangesEqual(element.textRanges, normalized) &&
          Array.isArray(element.textRanges)
        ) {
          return element;
        }
        return { ...element, textRanges: normalized };
      };

      if (localElement && discardRemoteElement) {
        reconciledElements.push(sanitizeReconciledElement(localElement));
        added.add(localElement.id);
      } else {
        reconciledElements.push(sanitizeReconciledElement(remoteElement));
        added.add(remoteElement.id);
      }
    }
  }

  // process remaining local elements
  for (const localElement of localElements) {
    if (!added.has(localElement.id)) {
      if (isTextElement(localElement) && "textRanges" in localElement) {
        const normalized = normalizeTextRanges(
          localElement.textRanges,
          typeof localElement.originalText === "string"
            ? localElement.originalText.length
            : 0,
        );
        if (!normalized) {
          const cloned = { ...localElement };
          delete (cloned as any).textRanges;
          reconciledElements.push(cloned);
        } else if (
          areTextRangesEqual(localElement.textRanges, normalized) &&
          Array.isArray(localElement.textRanges)
        ) {
          reconciledElements.push(localElement);
        } else {
          reconciledElements.push({ ...localElement, textRanges: normalized });
        }
      } else {
        reconciledElements.push(localElement);
      }
      added.add(localElement.id);
    }
  }

  const orderedElements = orderByFractionalIndex(reconciledElements);

  validateIndicesThrottled(orderedElements, localElements, remoteElements);

  // de-duplicate indices
  syncInvalidIndices(orderedElements);

  return orderedElements as ReconciledExcalidrawElement[];
};
