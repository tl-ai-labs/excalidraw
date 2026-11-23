import { Emitter } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  StoreChange,
  StoreDelta,
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

  public readonly undoStack: HistoryDelta[] = [];
  public readonly redoStack: HistoryDelta[] = [];

  private readonly entryPageIds = new WeakMap<HistoryDelta, string | null>();

  private isOnActivePage(entry: HistoryDelta) {
    const pageId = this.entryPageIds.get(entry);
    return pageId === null || pageId === undefined
      ? true
      : pageId === this.getActivePageId();
  }

  public get isUndoStackEmpty() {
    return !this.undoStack.some((entry) => this.isOnActivePage(entry));
  }

  public get isRedoStackEmpty() {
    return !this.redoStack.some((entry) => this.isOnActivePage(entry));
  }

  constructor(
    private readonly store: Store,
    private readonly getActivePageId: () => string | null = () => null,
  ) {}

  public notifyActivePageChanged() {
    this.onHistoryChangedEmitter.trigger(
      new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
    );
  }

  public clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
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

    this.entryPageIds.set(historyDelta, this.getActivePageId());
    this.undoStack.push(historyDelta);

    if (!historyDelta.elements.isEmpty()) {
      // don't reset redo stack on local appState changes,
      // as a simple click (unselect) could lead to losing all the redo entries
      // only reset on non empty elements changes!
      for (let i = this.redoStack.length - 1; i >= 0; i--) {
        if (this.isOnActivePage(this.redoStack[i])) {
          this.redoStack.splice(i, 1);
        }
      }
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
      () => this.popForActivePage(this.undoStack),
      (entry: HistoryDelta) => this.pushTagged(this.redoStack, entry),
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
      () => this.popForActivePage(this.redoStack),
      (entry: HistoryDelta) => this.pushTagged(this.undoStack, entry),
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

  private popForActivePage(stack: HistoryDelta[]): HistoryDelta | null {
    for (let i = stack.length - 1; i >= 0; i--) {
      const entry = stack[i];
      if (this.isOnActivePage(entry)) {
        stack.splice(i, 1);
        return entry;
      }
    }

    return null;
  }

  private pushTagged(stack: HistoryDelta[], entry: HistoryDelta) {
    const pageId = this.entryPageIds.get(entry) ?? this.getActivePageId();
    const inversedEntry = History.push(stack, entry);
    this.entryPageIds.set(inversedEntry, pageId);
  }

  private static push(stack: HistoryDelta[], entry: HistoryDelta) {
    const inversedEntry = HistoryDelta.inverse(entry);
    stack.push(inversedEntry);
    return inversedEntry;
  }
}
