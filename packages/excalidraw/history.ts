import { DEFAULT_PAGE_ID, Emitter } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  StoreChange,
  StoreDelta,
  getElementPageId,
} from "@excalidraw/element";

import type {
  RenderEnvironment,
  StoreSnapshot,
  Store,
} from "@excalidraw/element";

import type { SceneElementsMap } from "@excalidraw/element/types";

import type { AppState } from "./types";

export class HistoryDelta extends StoreDelta {
  /**
   * Apply the delta to the passed elements and appState, does not modify the snapshot.
   */
  public applyTo(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: StoreSnapshot,
    /** measures the labels re-laid out after applying */
    renderEnvironment?: RenderEnvironment,
  ): [SceneElementsMap, AppState, boolean] {
    const [nextElements, elementsContainVisibleChange] = this.elements.applyTo(
      elements,
      // used to fallback into local snapshot in case we couldn't apply the delta
      // due to a missing (force deleted) elements in the scene
      snapshot.elements,
      // we don't want to apply the `version` and `versionNonce` properties for history
      // as we always need to end up with a new version due to collaboration,
      // approaching each undo / redo as a new user action
      {
        excludedProperties: new Set(["version", "versionNonce"]),
        renderEnvironment,
      },
    );

    const [nextAppState, appStateContainsVisibleChange] = this.appState.applyTo(
      appState,
      nextElements,
    );

    const appliedVisibleChanges =
      elementsContainVisibleChange || appStateContainsVisibleChange;

    return [nextElements, nextAppState, appliedVisibleChanges];
  }

  /**
   * Overriding once to avoid type casting everywhere.
   */
  public static override calculate(
    prevSnapshot: StoreSnapshot,
    nextSnapshot: StoreSnapshot,
  ) {
    return super.calculate(prevSnapshot, nextSnapshot) as HistoryDelta;
  }

  /**
   * Overriding once to avoid type casting everywhere.
   */
  public static override inverse(delta: StoreDelta): HistoryDelta {
    return super.inverse(delta) as HistoryDelta;
  }

  /**
   * Overriding once to avoid type casting everywhere.
   */
  public static override applyLatestChanges(
    delta: StoreDelta,
    prevElements: SceneElementsMap,
    nextElements: SceneElementsMap,
    modifierOptions?: "deleted" | "inserted",
  ) {
    return super.applyLatestChanges(
      delta,
      prevElements,
      nextElements,
      modifierOptions,
    ) as HistoryDelta;
  }
}

export class HistoryChangedEvent {
  constructor(
    public readonly isUndoStackEmpty: boolean = true,
    public readonly isRedoStackEmpty: boolean = true,
  ) {}
}

export class History {
  public readonly onHistoryChangedEmitter = new Emitter<
    [HistoryChangedEvent]
  >();

  private activePageId: string = DEFAULT_PAGE_ID;
  private readonly undoStacks = new Map<string, HistoryDelta[]>([
    [DEFAULT_PAGE_ID, []],
  ]);
  private readonly redoStacks = new Map<string, HistoryDelta[]>([
    [DEFAULT_PAGE_ID, []],
  ]);

  public get undoStack(): HistoryDelta[] {
    let stack = this.undoStacks.get(this.activePageId);
    if (!stack) {
      stack = [];
      this.undoStacks.set(this.activePageId, stack);
    }
    return stack;
  }

  public get redoStack(): HistoryDelta[] {
    let stack = this.redoStacks.get(this.activePageId);
    if (!stack) {
      stack = [];
      this.redoStacks.set(this.activePageId, stack);
    }
    return stack;
  }

  public get isUndoStackEmpty() {
    return this.undoStack.length === 0;
  }

  public get isRedoStackEmpty() {
    return this.redoStack.length === 0;
  }

  constructor(private readonly store: Store) {}

  public setActivePageId(pageId: string) {
    if (this.activePageId === pageId) {
      return;
    }
    this.activePageId = pageId;
    if (!this.undoStacks.has(pageId)) {
      this.undoStacks.set(pageId, []);
    }
    if (!this.redoStacks.has(pageId)) {
      this.redoStacks.set(pageId, []);
    }
    this.onHistoryChangedEmitter.trigger(
      new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
    );
  }

  public deletePage(pageId: string) {
    this.undoStacks.delete(pageId);
    this.redoStacks.delete(pageId);
  }

  public clear() {
    for (const stack of this.undoStacks.values()) {
      stack.length = 0;
    }
    for (const stack of this.redoStacks.values()) {
      stack.length = 0;
    }
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  private getUndoStackForPage(pageId: string): HistoryDelta[] {
    let stack = this.undoStacks.get(pageId);
    if (!stack) {
      stack = [];
      this.undoStacks.set(pageId, stack);
    }
    return stack;
  }

  private getRedoStackForPage(pageId: string): HistoryDelta[] {
    let stack = this.redoStacks.get(pageId);
    if (!stack) {
      stack = [];
      this.redoStacks.set(pageId, stack);
    }
    return stack;
  }

  private resolveDeltaPageId(delta: StoreDelta): string {
    for (const [id, entry] of Object.entries(delta.elements.added)) {
      const pageId =
        entry.inserted?.pageId ??
        entry.deleted?.pageId ??
        this.store.snapshot.elements.get(id)?.pageId;
      return getElementPageId({ pageId });
    }
    for (const [id, entry] of Object.entries(delta.elements.updated)) {
      const pageId =
        entry.inserted?.pageId ??
        entry.deleted?.pageId ??
        this.store.snapshot.elements.get(id)?.pageId;
      return getElementPageId({ pageId });
    }
    for (const [id, entry] of Object.entries(delta.elements.removed)) {
      const pageId =
        entry.inserted?.pageId ??
        entry.deleted?.pageId ??
        this.store.snapshot.elements.get(id)?.pageId;
      return getElementPageId({ pageId });
    }

    const selectedElementIds =
      delta.appState.delta.inserted.selectedElementIds ??
      delta.appState.delta.deleted.selectedElementIds;
    if (selectedElementIds) {
      for (const id of Object.keys(selectedElementIds)) {
        const element = this.store.snapshot.elements.get(id);
        if (element) {
          return getElementPageId({ pageId: element.pageId });
        }
      }
    }

    return this.activePageId;
  }

  /**
   * Record a non-empty local durable increment, which will go into the undo stack..
   * Do not re-record history entries, which were already pushed to undo / redo stack, as part of history action.
   */
  public record(delta: StoreDelta) {
    if (delta.isEmpty() || delta instanceof HistoryDelta) {
      return;
    }

    // construct history entry, so once it's emitted, it's not recorded again
    const historyDelta = HistoryDelta.inverse(delta);

    const targetPageId = this.resolveDeltaPageId(delta);
    this.getUndoStackForPage(targetPageId).push(historyDelta);

    if (!historyDelta.elements.isEmpty()) {
      // don't reset redo stack on local appState changes,
      // as a simple click (unselect) could lead to losing all the redo entries
      // only reset on non empty elements changes!
      this.getRedoStackForPage(targetPageId).length = 0;
    }

    this.onHistoryChangedEmitter.trigger(
      new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
    );
  }

  public undo(
    elements: SceneElementsMap,
    appState: AppState,
    /** measures the labels re-laid out after undoing (the host's, in the editor) */
    renderEnvironment?: RenderEnvironment,
  ) {
    return this.perform(
      elements,
      appState,
      () => History.pop(this.undoStack),
      (entry: HistoryDelta) => History.push(this.redoStack, entry),
      renderEnvironment,
    );
  }

  public redo(
    elements: SceneElementsMap,
    appState: AppState,
    /** measures the labels re-laid out after redoing (the host's, in the editor) */
    renderEnvironment?: RenderEnvironment,
  ) {
    return this.perform(
      elements,
      appState,
      () => History.pop(this.redoStack),
      (entry: HistoryDelta) => History.push(this.undoStack, entry),
      renderEnvironment,
    );
  }

  private perform(
    elements: SceneElementsMap,
    appState: AppState,
    pop: () => HistoryDelta | null,
    push: (entry: HistoryDelta) => void,
    renderEnvironment: RenderEnvironment | undefined,
  ): [SceneElementsMap, AppState] | void {
    try {
      let historyDelta = pop();

      if (historyDelta === null) {
        return;
      }

      const action = CaptureUpdateAction.IMMEDIATELY;

      let prevSnapshot = this.store.snapshot;

      let nextElements = elements;
      let nextAppState = appState;
      let containsVisibleChange = false;

      // iterate through the history entries in case they result in no visible changes
      while (historyDelta) {
        try {
          [nextElements, nextAppState, containsVisibleChange] =
            historyDelta.applyTo(
              nextElements,
              nextAppState,
              prevSnapshot,
              renderEnvironment,
            );

          const prevElements = prevSnapshot.elements;
          const nextSnapshot = prevSnapshot.maybeClone(
            action,
            nextElements,
            nextAppState,
          );

          const change = StoreChange.create(prevSnapshot, nextSnapshot);
          const delta = HistoryDelta.applyLatestChanges(
            historyDelta,
            prevElements,
            nextElements,
          );

          if (!delta.isEmpty()) {
            // schedule immediate capture, so that it's emitted for the sync purposes
            this.store.scheduleMicroAction({
              action,
              change,
              delta,
            });

            historyDelta = delta;
          }

          prevSnapshot = nextSnapshot;
        } finally {
          push(historyDelta);
        }

        if (containsVisibleChange) {
          break;
        }

        historyDelta = pop();
      }

      return [nextElements, nextAppState];
    } finally {
      // trigger the history change event before returning completely
      // also trigger it just once, no need doing so on each entry
      this.onHistoryChangedEmitter.trigger(
        new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
      );
    }
  }

  private static pop(stack: HistoryDelta[]): HistoryDelta | null {
    if (!stack.length) {
      return null;
    }

    const entry = stack.pop();

    if (entry !== undefined) {
      return entry;
    }

    return null;
  }

  private static push(stack: HistoryDelta[], entry: HistoryDelta) {
    const inversedEntry = HistoryDelta.inverse(entry);
    return stack.push(inversedEntry);
  }
}
