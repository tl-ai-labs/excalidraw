import throttle from "lodash.throttle";

import {
  randomInteger,
  arrayToMap,
  toBrandedType,
  isDevEnv,
  isTestEnv,
  toArray,
  DEFAULT_PAGE_ID,
} from "@excalidraw/common";
import { isNonDeletedElement } from "@excalidraw/element";
import { isFrameLikeElement } from "@excalidraw/element";
import { getElementsInGroup } from "@excalidraw/element";

import {
  syncInvalidIndices,
  syncMovedIndices,
  validateFractionalIndices,
} from "@excalidraw/element";

import { getSelectedElements } from "@excalidraw/element";

import { mutateElement, type ElementUpdate } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
  ExcalidrawFrameLikeElement,
  ElementsMapOrArray,
  SceneElementsMap,
  NonDeletedSceneElementsMap,
  OrderedExcalidrawElement,
  Ordered,
} from "@excalidraw/element/types";

import type {
  Assert,
  Mutable,
  SameType,
} from "@excalidraw/common/utility-types";

import type { AppState } from "../../excalidraw/types";

type SceneStateCallback = () => void;
type SceneStateCallbackRemover = () => void;

type SelectionHash = string & { __brand: "selectionHash" };

export const getElementPageId = (
  element: { pageId?: string },
  pages?: readonly { id: string }[] | ReadonlySet<string> | null,
): string => {
  const isPageSet = (
    value: readonly { id: string }[] | ReadonlySet<string>,
  ): value is ReadonlySet<string> => value instanceof Set;

  const firstPageId = pages
    ? isPageSet(pages)
      ? pages.values().next().value || DEFAULT_PAGE_ID
      : pages[0]?.id || DEFAULT_PAGE_ID
    : DEFAULT_PAGE_ID;

  if (typeof element.pageId === "string" && element.pageId.length > 0) {
    if (pages) {
      if (isPageSet(pages)) {
        if (pages.size > 0 && !pages.has(element.pageId)) {
          return firstPageId;
        }
      } else if (
        pages.length > 0 &&
        !pages.some((p) => p.id === element.pageId)
      ) {
        return firstPageId;
      }
    }
    return element.pageId;
  }

  return firstPageId;
};

const getNonDeletedElements = <T extends ExcalidrawElement>(
  allElements: readonly T[],
  options?: {
    activePageId?: string;
    pageIds?: ReadonlySet<string> | null;
  },
) => {
  const elementsMap = new Map() as NonDeletedSceneElementsMap;
  const elements: NonDeleted<T>[] = [];
  const activePageId = options?.activePageId;
  const pageIds = options?.pageIds;
  for (const element of allElements) {
    if (!element.isDeleted) {
      if (activePageId && getElementPageId(element, pageIds) !== activePageId) {
        continue;
      }
      elements.push(element as NonDeleted<T>);
      elementsMap.set(
        element.id,
        element as Ordered<NonDeletedExcalidrawElement>,
      );
    }
  }
  return { elementsMap, elements };
};

const validateIndicesThrottled = throttle(
  (elements: readonly ExcalidrawElement[]) => {
    if (isDevEnv() || isTestEnv() || window?.DEBUG_FRACTIONAL_INDICES) {
      validateFractionalIndices(elements, {
        // throw only in dev & test, to remain functional on `DEBUG_FRACTIONAL_INDICES`
        shouldThrow: isDevEnv() || isTestEnv(),
        includeBoundTextValidation: true,
      });
    }
  },
  1000 * 60,
  { leading: true, trailing: false },
);

const hashSelectionOpts = (
  opts: Parameters<InstanceType<typeof Scene>["getSelectedElements"]>[0],
) => {
  const keys = ["includeBoundTextElement", "includeElementsInFrames"] as const;

  type HashableKeys = Omit<typeof opts, "selectedElementIds" | "elements">;

  // just to ensure we're hashing all expected keys
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type _ = Assert<
    SameType<
      Required<HashableKeys>,
      Pick<Required<HashableKeys>, typeof keys[number]>
    >
  >;

  let hash = "";
  for (const key of keys) {
    hash += `${key}:${opts[key] ? "1" : "0"}`;
  }
  return hash as SelectionHash;
};

// ideally this would be a branded type but it'd be insanely hard to work with
// in our codebase
export type ExcalidrawElementsIncludingDeleted = readonly ExcalidrawElement[];

export class Scene {
  // ---------------------------------------------------------------------------
  // instance methods/props
  // ---------------------------------------------------------------------------

  private callbacks: Set<SceneStateCallback> = new Set();

  private nonDeletedElements: readonly Ordered<NonDeletedExcalidrawElement>[] =
    [];
  private nonDeletedElementsMap = toBrandedType<NonDeletedSceneElementsMap>(
    new Map(),
  );
  private allNonDeletedElements: readonly Ordered<NonDeletedExcalidrawElement>[] =
    [];
  private allNonDeletedElementsMap = toBrandedType<NonDeletedSceneElementsMap>(
    new Map(),
  );
  // ideally all elements within the scene should be wrapped around with `Ordered` type, but right now there is no real benefit doing so
  private elements: readonly OrderedExcalidrawElement[] = [];
  private nonDeletedFramesLikes: readonly NonDeleted<ExcalidrawFrameLikeElement>[] =
    [];
  private frames: readonly ExcalidrawFrameLikeElement[] = [];
  private elementsMap = toBrandedType<SceneElementsMap>(new Map());
  private activePageId: string = DEFAULT_PAGE_ID;
  private pageIds: ReadonlySet<string> | null = null;
  private filterByActivePage = false;
  private selectedElementsCache: {
    selectedElementIds: AppState["selectedElementIds"] | null;
    elements: readonly NonDeletedExcalidrawElement[] | null;
    cache: Map<SelectionHash, NonDeletedExcalidrawElement[]>;
  } = {
    selectedElementIds: null,
    elements: null,
    cache: new Map(),
  };
  /**
   * Random integer regenerated each scene update.
   *
   * Does not relate to elements versions, it's only a renderer
   * cache-invalidation nonce at the moment.
   */
  private sceneNonce: number | undefined;

  getSceneNonce() {
    return this.sceneNonce;
  }

  getNonDeletedElementsMap() {
    return this.nonDeletedElementsMap;
  }

  getAllNonDeletedElementsMap() {
    return this.allNonDeletedElementsMap;
  }

  getElementsIncludingDeleted() {
    return this.elements;
  }

  getElementsMapIncludingDeleted() {
    return this.elementsMap;
  }

  getNonDeletedElements() {
    return this.nonDeletedElements;
  }

  getAllNonDeletedElements() {
    return this.allNonDeletedElements;
  }

  getFramesIncludingDeleted() {
    return this.frames;
  }

  getActivePageId() {
    return this.activePageId;
  }

  setActivePage(
    activePageId: string,
    pageIds?: readonly string[] | ReadonlySet<string> | null,
  ) {
    const nextActivePageId = activePageId || DEFAULT_PAGE_ID;
    const nextPageIds = pageIds
      ? pageIds instanceof Set
        ? pageIds
        : new Set(pageIds)
      : null;

    const arePageIdsEqual = (() => {
      if (this.pageIds === nextPageIds) {
        return true;
      }
      if (!this.pageIds || !nextPageIds) {
        return false;
      }
      if (this.pageIds.size !== nextPageIds.size) {
        return false;
      }
      const prevIter = this.pageIds.values();
      const nextIter = nextPageIds.values();
      for (let i = 0; i < this.pageIds.size; i++) {
        if (prevIter.next().value !== nextIter.next().value) {
          return false;
        }
      }
      return true;
    })();

    if (
      this.filterByActivePage &&
      this.activePageId === nextActivePageId &&
      arePageIdsEqual
    ) {
      return;
    }

    const prevActivePageId = this.activePageId;
    const prevFilter = this.filterByActivePage;
    this.filterByActivePage = true;
    this.activePageId = nextActivePageId;
    this.pageIds = nextPageIds;

    const prevElements = this.nonDeletedElements;
    this.updateActivePageElements();

    if (
      prevActivePageId !== this.activePageId ||
      (prevFilter &&
        (prevElements.length !== this.nonDeletedElements.length ||
          prevElements.some((el, idx) => el !== this.nonDeletedElements[idx])))
    ) {
      this.triggerUpdate();
    }
  }

  private updateActivePageElements() {
    if (!this.filterByActivePage) {
      this.nonDeletedElements = this.allNonDeletedElements;
      this.nonDeletedElementsMap = this.allNonDeletedElementsMap;
      this.nonDeletedFramesLikes = getNonDeletedElements(this.frames).elements;
      return;
    }

    const filterOpts = {
      activePageId: this.activePageId,
      pageIds: this.pageIds,
    };
    const nonDeletedElements = getNonDeletedElements(this.elements, filterOpts);
    this.nonDeletedElements = nonDeletedElements.elements;
    this.nonDeletedElementsMap = nonDeletedElements.elementsMap;
    this.nonDeletedFramesLikes = getNonDeletedElements(
      this.frames,
      filterOpts,
    ).elements;
  }

  constructor(
    elements: ElementsMapOrArray | null = null,
    options?: {
      skipValidation?: true;
    },
  ) {
    if (elements) {
      this.replaceAllElements(elements, options);
    }
  }

  getSelectedElements(opts: {
    // NOTE can be ommitted by making Scene constructor require App instance
    selectedElementIds: AppState["selectedElementIds"];
    /**
     * for specific cases where you need to use elements not from current
     * scene state. This in effect will likely result in cache-miss, and
     * the cache won't be updated in this case.
     */
    elements?: ElementsMapOrArray;
    // selection-related options
    includeBoundTextElement?: boolean;
    includeElementsInFrames?: boolean;
  }): NonDeletedExcalidrawElement[] {
    const hash = hashSelectionOpts(opts);

    const elements = opts?.elements || this.nonDeletedElements;
    if (
      this.selectedElementsCache.elements === elements &&
      this.selectedElementsCache.selectedElementIds === opts.selectedElementIds
    ) {
      const cached = this.selectedElementsCache.cache.get(hash);
      if (cached) {
        return cached;
      }
    } else if (opts?.elements == null) {
      // if we're operating on latest scene elements and the cache is not
      //  storing the latest elements, clear the cache
      this.selectedElementsCache.cache.clear();
    }

    const selectedElements = getSelectedElements(
      elements,
      { selectedElementIds: opts.selectedElementIds },
      opts,
    );

    // cache only if we're not using custom elements
    if (opts?.elements == null) {
      this.selectedElementsCache.selectedElementIds = opts.selectedElementIds;
      this.selectedElementsCache.elements = this.nonDeletedElements;
      this.selectedElementsCache.cache.set(hash, selectedElements);
    }

    return selectedElements;
  }

  getNonDeletedFramesLikes(): readonly NonDeleted<ExcalidrawFrameLikeElement>[] {
    return this.nonDeletedFramesLikes;
  }

  getElement<T extends ExcalidrawElement>(id: T["id"]): T | null {
    return (this.elementsMap.get(id) as T | undefined) || null;
  }

  getNonDeletedElement(
    id: ExcalidrawElement["id"],
  ): NonDeleted<ExcalidrawElement> | null {
    const element = this.getElement(id);
    if (element && isNonDeletedElement(element)) {
      return element;
    }
    return null;
  }

  /**
   * A utility method to help with updating all scene elements, with the added
   * performance optimization of not renewing the array if no change is made.
   *
   * Maps all current excalidraw elements, invoking the callback for each
   * element. The callback should either return a new mapped element, or the
   * original element if no changes are made. If no changes are made to any
   * element, this results in a no-op. Otherwise, the newly mapped elements
   * are set as the next scene's elements.
   *
   * @returns whether a change was made
   */
  mapElements(
    iteratee: (element: ExcalidrawElement) => ExcalidrawElement,
  ): boolean {
    let didChange = false;
    const newElements = this.elements.map((element) => {
      const nextElement = iteratee(element);
      if (nextElement !== element) {
        didChange = true;
      }
      return nextElement;
    });
    if (didChange) {
      this.replaceAllElements(newElements);
    }
    return didChange;
  }

  replaceAllElements(
    nextElements: ElementsMapOrArray,
    options?: {
      skipValidation?: true;
      preservePageIds?: boolean;
    },
  ) {
    // we do trust the insertion order on the map, though maybe we shouldn't and should prefer order defined by fractional indices
    let _nextElements = toArray(nextElements);
    if (
      this.filterByActivePage &&
      this.activePageId !== DEFAULT_PAGE_ID &&
      !options?.preservePageIds
    ) {
      let hasNewUnassigned = false;
      for (const el of _nextElements) {
        if (!el.pageId && !this.elementsMap.has(el.id)) {
          hasNewUnassigned = true;
          break;
        }
      }
      if (hasNewUnassigned) {
        _nextElements = _nextElements.map((el) =>
          !el.pageId && !this.elementsMap.has(el.id)
            ? Object.assign(el, { pageId: this.activePageId })
            : el,
        );
      }
    }

    const nextFrameLikes: ExcalidrawFrameLikeElement[] = [];

    if (!options?.skipValidation) {
      validateIndicesThrottled(_nextElements);
    }

    this.elements = syncInvalidIndices(_nextElements);
    this.elementsMap.clear();
    this.elements.forEach((element) => {
      if (isFrameLikeElement(element)) {
        nextFrameLikes.push(element);
      }
      this.elementsMap.set(element.id, element);
    });
    const allNonDeleted = getNonDeletedElements(this.elements);
    this.allNonDeletedElements = allNonDeleted.elements;
    this.allNonDeletedElementsMap = allNonDeleted.elementsMap;

    this.frames = nextFrameLikes;
    this.updateActivePageElements();

    this.triggerUpdate();
  }

  triggerUpdate() {
    this.sceneNonce = randomInteger();

    for (const callback of Array.from(this.callbacks)) {
      callback();
    }
  }

  onUpdate(cb: SceneStateCallback): SceneStateCallbackRemover {
    if (this.callbacks.has(cb)) {
      throw new Error();
    }

    this.callbacks.add(cb);

    return () => {
      if (!this.callbacks.has(cb)) {
        throw new Error();
      }
      this.callbacks.delete(cb);
    };
  }

  destroy() {
    this.elements = [];
    this.nonDeletedElements = [];
    this.allNonDeletedElements = [];
    this.nonDeletedFramesLikes = [];
    this.frames = [];
    this.elementsMap.clear();
    this.nonDeletedElementsMap.clear();
    this.allNonDeletedElementsMap.clear();
    this.selectedElementsCache.selectedElementIds = null;
    this.selectedElementsCache.elements = null;
    this.selectedElementsCache.cache.clear();

    // done not for memory leaks, but to guard against possible late fires
    // (I guess?)
    this.callbacks.clear();
  }

  /** low-level - generally use app.insertNewElements() */
  insertElementsAtIndex(
    elements: ExcalidrawElement[],
    /** null indicates end of the array */
    index: number | null,
  ) {
    if (!elements.length) {
      return;
    }

    if (index === null) {
      index = this.elements.length;
    }

    if (!Number.isFinite(index) || index < 0) {
      throw new Error(
        "insertElementAtIndex can only be called with index >= 0",
      );
    }

    const elementsWithPage =
      this.filterByActivePage && this.activePageId !== DEFAULT_PAGE_ID
        ? elements.map((element) =>
            element.pageId
              ? element
              : Object.assign(element, { pageId: this.activePageId }),
          )
        : elements;

    const nextElements = [
      ...this.elements.slice(0, index),
      ...elementsWithPage,
      ...this.elements.slice(index),
    ];

    syncMovedIndices(nextElements, arrayToMap(elementsWithPage));

    this.replaceAllElements(nextElements);
  }

  /** low-level - generally use app.insertNewElement() */
  insertElement = (element: ExcalidrawElement) => {
    this.insertElementsAtIndex([element], null);
  };

  getElementIndex(elementId: string) {
    return this.elements.findIndex((element) => element.id === elementId);
  }

  getContainerElement = (
    element:
      | (ExcalidrawElement & {
          containerId: ExcalidrawElement["id"] | null;
        })
      | null,
  ) => {
    if (!element) {
      return null;
    }
    if (element.containerId) {
      return this.getElement(element.containerId) || null;
    }
    return null;
  };

  getElementsFromId = (id: string): ExcalidrawElement[] => {
    const elementsMap = this.getNonDeletedElementsMap();
    // first check if the id is an element
    const el = elementsMap.get(id);
    if (el) {
      return [el];
    }

    // then, check if the id is a group
    return getElementsInGroup(elementsMap, id);
  };

  // Mutate an element with passed updates and trigger the component to update. Make sure you
  // are calling it either from a React event handler or within unstable_batchedUpdates().
  mutateElement<TElement extends Mutable<ExcalidrawElement>>(
    element: TElement,
    updates: ElementUpdate<TElement>,
    options: {
      informMutation: boolean;
      isDragging: boolean;
      isBindingEnabled?: boolean;
      isMidpointSnappingEnabled?: boolean;
    } = {
      informMutation: true,
      isDragging: false,
    },
  ) {
    const elementsMap = this.getNonDeletedElementsMap();

    const { version: prevVersion } = element;
    const { version: nextVersion } = mutateElement(
      element,
      elementsMap,
      updates,
      options,
    );

    if (
      // skip if the element is not in the scene (i.e. selection)
      this.elementsMap.has(element.id) &&
      // skip if the element's version hasn't changed, as mutateElement returned the same element
      prevVersion !== nextVersion &&
      options.informMutation
    ) {
      this.triggerUpdate();
    }

    return element;
  }
}
