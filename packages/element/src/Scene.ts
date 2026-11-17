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

import { getElementPageId } from "./pages";

import type { AppState } from "../../excalidraw/types";

type SceneStateCallback = () => void;
type SceneStateCallbackRemover = () => void;

type SelectionHash = string & { __brand: "selectionHash" };

const getNonDeletedElements = <T extends ExcalidrawElement>(
  allElements: readonly T[],
) => {
  const elementsMap = new Map() as NonDeletedSceneElementsMap;
  const elements: NonDeleted<T>[] = [];
  for (const element of allElements) {
    if (!element.isDeleted) {
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
  // ideally all elements within the scene should be wrapped around with `Ordered` type, but right now there is no real benefit doing so
  private elements: readonly OrderedExcalidrawElement[] = [];
  private nonDeletedFramesLikes: readonly NonDeleted<ExcalidrawFrameLikeElement>[] =
    [];
  private frames: readonly ExcalidrawFrameLikeElement[] = [];
  private elementsMap = toBrandedType<SceneElementsMap>(new Map());
  /** all elements (incl. deleted) of the active page */
  private activePageElements: readonly OrderedExcalidrawElement[] = [];
  private activePageId: string = DEFAULT_PAGE_ID;
  /** ids of live (non-deleted) pages, in tab order. Empty = unknown. */
  private livePageIds: readonly string[] = [];
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

  getActivePageId() {
    return this.activePageId;
  }

  /**
   * Switches the page whose elements are exposed via the non-deleted
   * getters, selection and frame caches.
   */
  setActivePageId(pageId: string, livePageIds?: readonly string[]) {
    const nextLivePageIds = livePageIds ?? this.livePageIds;
    if (
      pageId === this.activePageId &&
      nextLivePageIds.length === this.livePageIds.length &&
      nextLivePageIds.every((id, i) => id === this.livePageIds[i])
    ) {
      return;
    }
    const prevActivePageElements = this.activePageElements;
    const prevActivePageId = this.activePageId;
    this.activePageId = pageId;
    this.livePageIds = nextLivePageIds;
    this.recomputeCaches();
    // only notify if what's exposed actually changed
    if (
      prevActivePageId !== pageId ||
      prevActivePageElements.length !== this.activePageElements.length ||
      prevActivePageElements.some((el, i) => el !== this.activePageElements[i])
    ) {
      this.triggerUpdate();
    }
  }

  /** page the element is displayed on (resolves orphaned pageIds) */
  getElementPageId(element: { pageId?: string }) {
    return getElementPageId(element, this.livePageIds);
  }

  isElementOnActivePage(element: { pageId?: string }) {
    return this.getElementPageId(element) === this.activePageId;
  }

  /** all elements (incl. deleted) of the active page only */
  getActivePageElementsIncludingDeleted() {
    return this.activePageElements;
  }

  /** all elements (incl. deleted) of the given page */
  getPageElementsIncludingDeleted(pageId: string) {
    return this.elements.filter((el) => this.getElementPageId(el) === pageId);
  }

  getNonDeletedElementsMap() {
    return this.nonDeletedElementsMap;
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

  getFramesIncludingDeleted() {
    return this.frames;
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
    },
  ) {
    // we do trust the insertion order on the map, though maybe we shouldn't and should prefer order defined by fractional indices
    const _nextElements = toArray(nextElements);
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
    this.frames = nextFrameLikes;
    this.recomputeCaches();

    this.triggerUpdate();
  }

  /** derives the active-page-only caches from the all-pages element list */
  private recomputeCaches() {
    const activePageElements = this.elements.filter((element) =>
      this.isElementOnActivePage(element),
    );
    // keep the reference stable when nothing page-related changed
    this.activePageElements =
      activePageElements.length === this.elements.length
        ? this.elements
        : activePageElements;

    const nonDeletedElements = getNonDeletedElements(this.activePageElements);
    this.nonDeletedElements = nonDeletedElements.elements;
    this.nonDeletedElementsMap = nonDeletedElements.elementsMap;

    this.nonDeletedFramesLikes = getNonDeletedElements(
      this.frames.filter((frame) => this.isElementOnActivePage(frame)),
    ).elements;
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
    this.activePageElements = [];
    this.nonDeletedElements = [];
    this.nonDeletedFramesLikes = [];
    this.frames = [];
    this.elementsMap.clear();
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

    // new elements created on a non-default page belong to that page
    if (this.activePageId !== DEFAULT_PAGE_ID) {
      for (const element of elements) {
        if (element.pageId === undefined) {
          (element as Mutable<ExcalidrawElement>).pageId = this.activePageId;
        }
      }
    }

    if (!Number.isFinite(index) || index < 0) {
      throw new Error(
        "insertElementAtIndex can only be called with index >= 0",
      );
    }

    const nextElements = [
      ...this.elements.slice(0, index),
      ...elements,
      ...this.elements.slice(index),
    ];

    syncMovedIndices(nextElements, arrayToMap(elements));

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
