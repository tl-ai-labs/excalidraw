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

import { reconcilePages } from "@excalidraw/excalidraw";
import { restoreAppState } from "@excalidraw/excalidraw/data/restore";

import type { DurableIncrement, EphemeralIncrement } from "@excalidraw/element";

import ExcalidrawApp from "../App";
import { WS_SUBTYPES } from "../app_constants";
import { LocalData } from "../data/LocalData";
import { importFromLocalStorage } from "../data/localStorage";
import { saveToFirebase } from "../data/firebase";

const { h } = window;

Object.defineProperty(window, "crypto", {
  value: {
    getRandomValues: (arr: number[]) =>
      arr.forEach((v, i) => (arr[i] = Math.floor(Math.random() * 256))),
    subtle: {
      generateKey: () => {},
      exportKey: () => ({ k: "sTdLvMC_M3V8_vGa3UVRDg" }),
      importKey: async () => ({}),
      encrypt: async () => new ArrayBuffer(8),
      decrypt: async () => new ArrayBuffer(8),
    },
  },
});

vi.mock("../../excalidraw-app/data/firebase.ts", () => {
  const loadFromFirebase = async () => null;
  const saveToFirebase = vi.fn(async () => null);
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

  describe("pages", () => {
    const page1 = {
      id: "default",
      name: "Page 1",
      index: "a0",
      version: 1,
      versionNonce: 1,
      isDeleted: false,
    } as any;
    const page2 = {
      id: "page2",
      name: "Page 2",
      index: "a1",
      version: 1,
      versionNonce: 1,
      isDeleted: false,
    } as any;

    const setupTwoPages = (
      activePageId = "default",
      extraPages: any[] = [],
    ) => {
      const rect1 = newElementWith(
        API.createElement({
          type: "rectangle",
          id: "rect1",
          width: 100,
          height: 100,
        }),
        { pageId: "default" } as any,
      );
      const rect2 = newElementWith(
        API.createElement({
          type: "rectangle",
          id: "rect2",
          x: 300,
          width: 100,
          height: 100,
        }),
        { pageId: "page2" } as any,
      );
      act(() => {
        h.app.updateScene({
          elements: syncInvalidIndices([rect1, rect2]),
          appState: {
            pages: [page1, page2, ...extraPages],
            activePageId,
          } as any,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      });
    };

    const openPortal = () => {
      const portal: any = window.collab.portal;
      portal.socket = {
        id: "socket1",
        connected: true,
        emit: vi.fn(),
        on: () => {},
        once: () => {},
        off: () => {},
        close: () => {},
      };
      portal.roomId = "room1";
      portal.roomKey = "sTdLvMC_M3V8_vGa3UVRDg";
      portal.socketInitialized = true;
      return vi
        .spyOn(portal, "_broadcastSocketData")
        .mockImplementation(async () => {});
    };

    it("SCENE_UPDATE carries pages and every page's elements", async () => {
      await render(<ExcalidrawApp />);
      setupTwoPages();
      const spy = openPortal();
      await window.collab.portal.broadcastScene(
        WS_SUBTYPES.UPDATE,
        window.collab.getSceneElementsIncludingDeleted() as any,
        true,
      );
      expect(spy).toHaveBeenCalled();
      const payload = (spy.mock.calls[0][0] as any).payload;
      const ids = payload.elements.map((e: any) => e.id);
      expect(ids).toContain("rect1");
      expect(ids).toContain("rect2");
      expect(payload.pages.map((p: any) => p.id)).toEqual(["default", "page2"]);
    });

    it("SCENE_INIT for a late joiner holds all pages", async () => {
      await render(<ExcalidrawApp />);
      setupTwoPages("default", [
        { ...page2, id: "page3", index: "a2", name: "Renamed", version: 2 },
        { ...page2, id: "page4", index: "a3", isDeleted: true, version: 2 },
      ]);
      const spy = openPortal();
      await window.collab.portal.broadcastScene(
        WS_SUBTYPES.INIT,
        window.collab.getSceneElementsIncludingDeleted() as any,
        true,
      );
      const payload = (spy.mock.calls[0][0] as any).payload;
      expect(payload.pages.map((p: any) => p.id)).toEqual([
        "default",
        "page2",
        "page3",
        "page4",
      ]);
      expect(payload.pages[2].name).toBe("Renamed");
      expect(payload.pages[3].isDeleted).toBe(true);
    });

    it("remote page changes are applied per page", async () => {
      await render(<ExcalidrawApp />);
      setupTwoPages();
      const collab: any = window.collab;
      const remotePages = [
        { ...page1, name: "Renamed Page 1", version: 2, versionNonce: 2 },
        page2,
        { ...page2, id: "page3", index: "a2", name: "Page 3" },
      ];
      const remoteRect2 = {
        ...h.app.scene
          .getElementsIncludingDeleted()
          .find((e) => e.id === "rect2")!,
        x: 500,
        version: 50,
      };
      act(() => {
        const pages = collab._reconcilePages(remotePages);
        const elements = collab._reconcileElements([remoteRect2]);
        collab.handleRemoteSceneUpdate(elements, pages);
      });
      await waitFor(() => {
        expect(h.state.pages).toEqual([
          expect.objectContaining({ id: "default", name: "Renamed Page 1" }),
          expect.objectContaining({ id: "page2", name: "Page 2" }),
          expect.objectContaining({ id: "page3", name: "Page 3" }),
        ]);
        expect(h.state.activePageId).toBe("default");
        const el = h.app.scene
          .getElementsIncludingDeleted()
          .find((e) => e.id === "rect2");
        expect(el?.x).toBe(500);
      });
    });

    it("localStorage autosave restores every page", async () => {
      await render(<ExcalidrawApp />);
      setupTwoPages();
      LocalData.resumeSave("collaboration");
      expect(LocalData.isSavePaused()).toBe(false);
      LocalData.save(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        {},
        () => {},
      );
      LocalData.flushSave();
      await waitFor(() => {
        const { elements, appState } = importFromLocalStorage();
        const restored = restoreAppState(appState as any, null);
        expect(restored.pages.map((p) => p.id)).toEqual(["default", "page2"]);
        const ids = elements.map((e) => e.id);
        expect(ids).toContain("rect1");
        expect(ids).toContain("rect2");
      });
    });

    it("concurrent page creation keeps both pages in the same order on both peers", () => {
      const a = { ...page2, id: "pageA", index: "a1" };
      const b = { ...page2, id: "pageB", index: "a1" };
      const peer1 = reconcilePages([page1, a], [page1, b]);
      const peer2 = reconcilePages([page1, b], [page1, a]);
      expect(peer1.map((p) => p.id)).toEqual(peer2.map((p) => p.id));
      expect(peer1.map((p) => p.id)).toEqual(["default", "pageA", "pageB"]);
    });

    it("starting a room keeps every page's elements", async () => {
      await render(<ExcalidrawApp />);
      setupTwoPages("page2");
      vi.mocked(saveToFirebase).mockClear();
      const portal: any = window.collab.portal;
      portal.socket = null;
      act(() => {
        void window.collab.startCollaboration(null);
      });
      await waitFor(() => {
        expect(saveToFirebase).toHaveBeenCalled();
      });
      const spy = vi
        .spyOn(portal, "_broadcastSocketData")
        .mockImplementation(async () => {});
      portal.roomId = portal.roomId ?? "room1";
      portal.roomKey = portal.roomKey ?? "sTdLvMC_M3V8_vGa3UVRDg";
      await portal.broadcastScene(
        WS_SUBTYPES.INIT,
        window.collab.getSceneElementsIncludingDeleted(),
        true,
      );
      const all = h.app.scene.getElementsIncludingDeleted();
      expect(all).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "rect1",
            pageId: "default",
            isDeleted: false,
          }),
          expect.objectContaining({
            id: "rect2",
            pageId: "page2",
            isDeleted: false,
          }),
        ]),
      );
      const savedIds = (
        vi.mocked(saveToFirebase).mock.calls[0] as any[]
      )[1].map((e: any) => e.id);
      expect(savedIds).toContain("rect1");
      expect(savedIds).toContain("rect2");
      expect(spy).toHaveBeenCalled();
      const payload = (spy.mock.calls[0][0] as any).payload;
      const ids = payload.elements.map((e: any) => e.id);
      expect(ids).toContain("rect1");
      expect(ids).toContain("rect2");
      expect(payload.pages.map((p: any) => p.id)).toEqual(["default", "page2"]);
    });
  });
});
