import { MAX_TEXT_STYLE_RANGES } from "@excalidraw/common";
import { CaptureUpdateAction, newElementWith } from "@excalidraw/excalidraw";
import {
  createRedoAction,
  createUndoAction,
} from "@excalidraw/excalidraw/actions/actionHistory";
import { syncInvalidIndices } from "@excalidraw/element";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { act, render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";
import { vi } from "vitest";

import { StoreIncrement } from "@excalidraw/element";

import type { DurableIncrement, EphemeralIncrement } from "@excalidraw/element";
import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";

import ExcalidrawApp from "../App";

const { h } = window;

Object.defineProperty(window, "crypto", {
  value: {
    getRandomValues: (arr: number[]) =>
      arr.forEach((v, i) => (arr[i] = Math.floor(Math.random() * 256))),
    subtle: {
      generateKey: () => {},
      exportKey: () => ({ k: "sTdLvMC_M3V8_vGa3UVRDg" }),
    },
  },
});

vi.mock("../../excalidraw-app/data/firebase.ts", () => {
  const loadFromFirebase = async () => null;
  const saveToFirebase = () => {};
  const isSavedToFirebase = () => true;
  const loadFilesFromFirebase = async () => ({
    loadedFiles: [],
    erroredFiles: [],
  });
  const saveFilesToFirebase = async () => ({
    savedFiles: new Map(),
    erroredFiles: new Map(),
  });

  return {
    loadFromFirebase,
    saveToFirebase,
    isSavedToFirebase,
    loadFilesFromFirebase,
    saveFilesToFirebase,
  };
});

vi.mock("socket.io-client", () => {
  return {
    default: () => {
      return {
        close: () => {},
        on: () => {},
        once: () => {},
        off: () => {},
        emit: () => {},
      };
    },
  };
});

/**
 * These test would deserve to be extended by testing collab with (at least) two clients simultanouesly,
 * while having access to both scenes, appstates stores, histories and etc.
 * i.e. multiplayer history tests could be a good first candidate, as we could test both history stacks simultaneously.
 */
describe("collaboration", () => {
  it("should emit two ephemeral increments even though updates get batched", async () => {
    const durableIncrements: DurableIncrement[] = [];
    const ephemeralIncrements: EphemeralIncrement[] = [];

    await render(<ExcalidrawApp />);

    h.store.onStoreIncrementEmitter.on((increment) => {
      if (StoreIncrement.isDurable(increment)) {
        durableIncrements.push(increment);
      } else {
        ephemeralIncrements.push(increment);
      }
    });

    // eslint-disable-next-line dot-notation
    expect(h.store["scheduledMicroActions"].length).toBe(0);
    expect(durableIncrements.length).toBe(0);
    expect(ephemeralIncrements.length).toBe(0);

    const rectProps = {
      type: "rectangle",
      id: "A",
      height: 200,
      width: 100,
      x: 0,
      y: 0,
    } as const;

    const rect = API.createElement({ ...rectProps });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    await waitFor(() => {
      // expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(durableIncrements.length).toBe(1);
    });

    // simulate two batched remote updates
    act(() => {
      h.app.updateScene({
        elements: [newElementWith(h.elements[0], { x: 100 })],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      h.app.updateScene({
        elements: [newElementWith(h.elements[0], { x: 200 })],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      // we scheduled two micro actions,
      // which confirms they are going to be executed as part of one batched component update
      // eslint-disable-next-line dot-notation
      expect(h.store["scheduledMicroActions"].length).toBe(2);
    });

    await waitFor(() => {
      // altough the updates get batched,
      // we expect two ephemeral increments for each update,
      // and each such update should have the expected change
      expect(ephemeralIncrements.length).toBe(2);
      expect(ephemeralIncrements[0].change.elements.A).toEqual(
        expect.objectContaining({ x: 100 }),
      );
      expect(ephemeralIncrements[1].change.elements.A).toEqual(
        expect.objectContaining({ x: 200 }),
      );
      // eslint-disable-next-line dot-notation
      expect(h.store["scheduledMicroActions"].length).toBe(0);
    });
  });

  it("should allow to undo / redo even on force-deleted elements", async () => {
    await render(<ExcalidrawApp />);
    const rect1Props = {
      type: "rectangle",
      id: "A",
      height: 200,
      width: 100,
    } as const;

    const rect2Props = {
      type: "rectangle",
      id: "B",
      width: 100,
      height: 200,
    } as const;

    const rect1 = API.createElement({ ...rect1Props });
    const rect2 = API.createElement({ ...rect2Props });

    API.updateScene({
      elements: syncInvalidIndices([rect1, rect2]),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.updateScene({
      elements: syncInvalidIndices([
        rect1,
        newElementWith(h.elements[1], { isDeleted: true }),
      ]),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
    });

    // one form of force deletion happens when starting the collab, not to sync potentially sensitive data into the server
    window.collab.startCollaboration(null);

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(2);
      // we never delete from the local snapshot as it is used for correct diff calculation
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
      expect(h.elements).toEqual([expect.objectContaining(rect1Props)]);
    });

    const undoAction = createUndoAction(h.history);
    act(() => h.app.actionManager.executeAction(undoAction));

    // with explicit undo (as addition) we expect our item to be restored from the snapshot!
    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: false }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: false }),
      ]);
    });

    // simulate force deleting the element remotely
    API.updateScene({
      elements: syncInvalidIndices([rect1]),
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
      expect(h.elements).toEqual([expect.objectContaining(rect1Props)]);
    });

    const redoAction = createRedoAction(h.history);
    act(() => h.app.actionManager.executeAction(redoAction));

    // with explicit redo (as removal) we again restore the element from the snapshot!
    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
    });
  });
});

describe("collaboration text style ranges", () => {
  const range = { id: "r1", seq: 1, start: 0, end: 5, color: "#ff0000" };

  const renderLocalText = async () => {
    await render(<ExcalidrawApp />);

    API.updateScene({
      elements: syncInvalidIndices([
        API.createElement({ type: "text", id: "T", text: "hello world" }),
      ]),
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    // read after the update, because syncing indices bumps the version
    return h.elements[0];
  };

  const receiveRemoteElements = (
    remoteElements: readonly typeof h.elements[number][],
  ) => {
    // eslint-disable-next-line dot-notation
    const reconciled = window.collab["_reconcileElements"](
      remoteElements as readonly RemoteExcalidrawElement[],
    );
    act(() => {
      // eslint-disable-next-line dot-notation
      window.collab["handleRemoteSceneUpdate"](reconciled);
    });
  };

  it("should bring a remote update with ranges into the scene", async () => {
    const local = await renderLocalText();

    receiveRemoteElements([
      {
        ...local,
        version: local.version + 1,
        textStyleRanges: [range],
      } as typeof local,
    ]);

    await waitFor(() => {
      expect(h.elements[0]).toEqual(
        expect.objectContaining({ textStyleRanges: [range] }),
      );
    });
  });

  it("should keep valid ranges and tombstones through restore before reconcile", async () => {
    const local = await renderLocalText();
    const tombstone = { id: "r0", seq: 1 };

    receiveRemoteElements([
      {
        ...local,
        version: local.version + 1,
        textStyleRanges: [
          range,
          { id: "bad", seq: 2, start: 0, end: 5, color: "url(evil)" },
        ],
        clearedTextStyleRanges: [tombstone],
      } as typeof local,
    ]);

    await waitFor(() => {
      expect(h.elements[0]).toEqual(
        expect.objectContaining({
          textStyleRanges: [range],
          clearedTextStyleRanges: [tombstone],
        }),
      );
    });
  });

  it("should merge a losing remote copy without a broadcast", async () => {
    const { getSceneVersion } = await import("@excalidraw/element");

    const local = await renderLocalText();
    const { version, versionNonce } = local;
    const sceneVersionBefore = getSceneVersion(h.elements);

    receiveRemoteElements([
      {
        ...local,
        version: version - 1,
        versionNonce: versionNonce + 1,
        textStyleRanges: [range],
      } as typeof local,
    ]);

    await waitFor(() => {
      expect(h.elements[0]).toEqual(
        expect.objectContaining({
          textStyleRanges: [range],
          version,
          versionNonce,
        }),
      );
    });
    expect(getSceneVersion(h.elements)).toBe(sceneVersionBefore);
    expect(window.collab.getLastBroadcastedOrReceivedSceneVersion()).toBe(
      sceneVersionBefore,
    );
  });

  it("should cap a remote update with too many ranges to the highest seq", async () => {
    const local = await renderLocalText();
    const ranges = Array.from(
      { length: MAX_TEXT_STYLE_RANGES + 5 },
      (_, index) => ({
        id: `r${index}`,
        seq: index + 1,
        start: 0,
        end: 5,
        color: "#ff0000",
      }),
    );

    receiveRemoteElements([
      {
        ...local,
        version: local.version + 1,
        textStyleRanges: ranges,
      } as typeof local,
    ]);

    await waitFor(() => {
      expect(h.elements[0]).toEqual(
        expect.objectContaining({
          textStyleRanges: ranges.slice(5),
        }),
      );
    });
    expect((h.elements[0] as any).textStyleRanges).toHaveLength(
      MAX_TEXT_STYLE_RANGES,
    );
  });
});
