import { DEFAULT_PAGE_ID, DEFAULT_PAGE_NAME } from "@excalidraw/common";
import { getElementPageId } from "@excalidraw/element";
import { restoreAppState, restoreElements } from "@excalidraw/excalidraw";
import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";
import { generateEncryptionKey } from "@excalidraw/excalidraw/data/encryption";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { act, render } from "@excalidraw/excalidraw/tests/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { NormalizedZoomValue } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

import ExcalidrawApp from "../App";
import {
  isSavedToFirebase,
  loadFromFirebase,
  saveToFirebase,
} from "../data/firebase";
import { importFromLocalStorage } from "../data/localStorage";
import { STORAGE_KEYS } from "../app_constants";

import type Portal from "../collab/Portal";
import type { SyncableExcalidrawElement } from "../data";

const { h } = window;

const mockFirestoreDocs = new Map<string, Record<string, any>>();

vi.mock("firebase/firestore", () => {
  class MockBytes {
    private bytes: Uint8Array;
    constructor(bytes: Uint8Array) {
      this.bytes = new Uint8Array(bytes);
    }
    static fromUint8Array(arr: Uint8Array) {
      return new MockBytes(arr);
    }
    toUint8Array() {
      return new Uint8Array(this.bytes);
    }
  }

  return {
    Bytes: MockBytes,
    getFirestore: vi.fn(() => ({})),
    doc: vi.fn((_db: any, collection: string, id: string) => ({
      path: `${collection}/${id}`,
      id,
    })),
    getDoc: vi.fn(async (docRef: { path: string }) => {
      const data = mockFirestoreDocs.get(docRef.path);
      return {
        exists: () => Boolean(data),
        data: () => data,
      };
    }),
    runTransaction: vi.fn(async (_db: any, updateFn: any) => {
      const stagedWrites = new Map<string, Record<string, any>>();
      const transaction = {
        get: async (docRef: { path: string }) => {
          const data = mockFirestoreDocs.get(docRef.path);
          return {
            exists: () => Boolean(data),
            data: () => data,
          };
        },
        set: (docRef: { path: string }, data: Record<string, any>) => {
          stagedWrites.set(docRef.path, data);
        },
        update: (docRef: { path: string }, data: Record<string, any>) => {
          const prev =
            stagedWrites.get(docRef.path) ||
            mockFirestoreDocs.get(docRef.path) ||
            {};
          stagedWrites.set(docRef.path, { ...prev, ...data });
        },
      };
      const result = await updateFn(transaction);
      for (const [path, data] of stagedWrites.entries()) {
        mockFirestoreDocs.set(path, data);
      }
      return result;
    }),
  };
});

describe("Multi-page collaboration, Firebase room storage, and localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    mockFirestoreDocs.clear();
  });

  it("synchronizes multi-page elements and page list in collaboration while keeping local activePageId independent (AC-10)", async () => {
    await render(<ExcalidrawApp />);

    const collab = window.collab;
    expect(collab).toBeDefined();

    // Local user creates a second page and switches to it with custom viewport
    const page2Id = "page-2";
    const localPages = [
      {
        id: DEFAULT_PAGE_ID,
        name: DEFAULT_PAGE_NAME,
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 as NormalizedZoomValue },
      },
      {
        id: page2Id,
        name: "Page 2",
        scrollX: 120,
        scrollY: 240,
        zoom: { value: 2 as NormalizedZoomValue },
      },
    ];

    const localRectOnPage2 = {
      ...API.createElement({
        type: "rectangle",
        id: "rect-p2",
        x: 50,
        y: 60,
      }),
      pageId: page2Id,
    };

    act(() => {
      h.app.updateScene({
        elements: [localRectOnPage2],
        appState: {
          pages: localPages,
          activePageId: page2Id,
          scrollX: 120,
          scrollY: 240,
          zoom: { value: 2 as NormalizedZoomValue },
        },
      });
    });

    expect(h.state.activePageId).toBe(page2Id);
    expect(h.app.getSceneElements().map((el) => el.id)).toEqual(["rect-p2"]);

    // Remote collaborator sends a SCENE_UPDATE with:
    // - renamed Page 2 ("Page 2 Renamed")
    // - newly added Page 3 ("page-3")
    // - element on Page 3
    // - legacy element without pageId (should land on DEFAULT_PAGE_ID)
    const remoteRectPage3 = {
      ...API.createElement({
        type: "ellipse",
        id: "ellipse-p3",
        x: 300,
        y: 400,
      }),
      pageId: "page-3",
    };
    const remoteLegacyRect = API.createElement({
      type: "rectangle",
      id: "legacy-rect",
      x: 10,
      y: 20,
    });
    delete (remoteLegacyRect as { pageId?: string }).pageId;

    const remotePages = [
      {
        id: DEFAULT_PAGE_ID,
        name: DEFAULT_PAGE_NAME,
        scrollX: 999,
        scrollY: 999,
        zoom: { value: 0.5 as NormalizedZoomValue },
      },
      {
        id: page2Id,
        name: "Page 2 Renamed",
        scrollX: -500,
        scrollY: -500,
        zoom: { value: 0.5 as NormalizedZoomValue },
      },
      {
        id: "page-3",
        name: "Page 3",
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 as NormalizedZoomValue },
      },
    ];

    act(() => {
      (collab as any).handleRemoteSceneUpdate(
        [
          localRectOnPage2 as OrderedExcalidrawElement,
          remoteRectPage3 as OrderedExcalidrawElement,
          remoteLegacyRect as OrderedExcalidrawElement,
        ],
        remotePages,
      );
    });

    // Local user's activePageId and viewport remain on page-2 independently
    expect(h.state.activePageId).toBe(page2Id);
    expect(h.state.scrollX).toBe(120);
    expect(h.state.scrollY).toBe(240);
    expect(h.state.zoom.value).toBe(2);

    // Remote page list additions and renames are merged
    expect(h.state.pages.map((p) => ({ id: p.id, name: p.name }))).toEqual([
      { id: DEFAULT_PAGE_ID, name: DEFAULT_PAGE_NAME },
      { id: page2Id, name: "Page 2 Renamed" },
      { id: "page-3", name: "Page 3" },
    ]);

    // Elements across all pages are stored in the scene; legacy element without pageId resolves to DEFAULT_PAGE_ID
    const allElements = h.app.getSceneElementsIncludingDeleted();
    expect(allElements.map((el) => el.id)).toEqual([
      "rect-p2",
      "ellipse-p3",
      "legacy-rect",
    ]);
    const legacyInScene = allElements.find((el) => el.id === "legacy-rect")!;
    expect(getElementPageId(legacyInScene)).toBe(DEFAULT_PAGE_ID);

    // Remote collaborator deletes page-2 (and marks its elements deleted)
    const deletedRectOnPage2 = {
      ...localRectOnPage2,
      isDeleted: true,
      version: localRectOnPage2.version + 1,
    } as OrderedExcalidrawElement;

    act(() => {
      (collab as any).handleRemoteSceneUpdate(
        [
          deletedRectOnPage2,
          remoteRectPage3 as OrderedExcalidrawElement,
          remoteLegacyRect as OrderedExcalidrawElement,
        ],
        [remotePages[0], remotePages[2]],
      );
    });

    // Since local user's active page (page-2) was deleted remotely, activePageId falls back to pages[0].id
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(h.state.pages.map((p) => p.id)).toEqual([DEFAULT_PAGE_ID, "page-3"]);
    expect(h.app.getSceneElements().map((el) => el.id)).toEqual([
      "legacy-rect",
    ]);
  });

  it("encrypts and loads the room page list on the Firebase room document (AC-10)", async () => {
    const roomKey = await generateEncryptionKey();
    const roomId = "room-multi-page-test";
    const fakeSocket = { id: "socket-1" } as any;
    const fakePortal = {
      roomId,
      roomKey,
      socket: fakeSocket,
    } as unknown as Portal;

    const elPage1 = API.createElement({
      type: "rectangle",
      id: "fb-el-1",
      x: 10,
      y: 10,
    }) as SyncableExcalidrawElement;
    const elPage2 = {
      ...API.createElement({
        type: "diamond",
        id: "fb-el-2",
        x: 100,
        y: 200,
      }),
      pageId: "page-second",
    } as SyncableExcalidrawElement;

    const initialPages = [
      {
        id: DEFAULT_PAGE_ID,
        name: DEFAULT_PAGE_NAME,
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 as NormalizedZoomValue },
      },
      {
        id: "page-second",
        name: "Architecture",
        scrollX: 40,
        scrollY: 80,
        zoom: { value: 1.5 as NormalizedZoomValue },
      },
    ];

    const appState = {
      ...h.state,
      pages: initialPages,
      activePageId: "page-second",
    };

    expect(isSavedToFirebase(fakePortal, [elPage1, elPage2], appState)).toBe(
      false,
    );

    const savedElements = await saveToFirebase(
      fakePortal,
      [elPage1, elPage2],
      appState,
    );
    expect(savedElements).not.toBeNull();
    expect(isSavedToFirebase(fakePortal, savedElements!, appState)).toBe(true);

    // Renaming a page marks isSavedToFirebase as false even when elements haven't changed
    const renamedAppState = {
      ...appState,
      pages: [initialPages[0], { ...initialPages[1], name: "Architecture v2" }],
    };
    expect(isSavedToFirebase(fakePortal, savedElements!, renamedAppState)).toBe(
      false,
    );

    await saveToFirebase(
      fakePortal,
      savedElements as unknown as readonly SyncableExcalidrawElement[],
      renamedAppState,
    );

    // Verify encrypted pagesIv and pagesCiphertext are stored on the Firestore room document
    const storedDoc = mockFirestoreDocs.get(`scenes/${roomId}`);
    expect(storedDoc).toBeDefined();
    expect(storedDoc!.pagesIv).toBeDefined();
    expect(storedDoc!.pagesCiphertext).toBeDefined();

    // Load from Firebase and verify both elements and decrypted pages are returned
    const loadedElements = await loadFromFirebase(roomId, roomKey, null);
    expect(loadedElements).not.toBeNull();
    expect(loadedElements!.map((el) => el.id)).toEqual(["fb-el-1", "fb-el-2"]);
    expect(loadedElements!.find((el) => el.id === "fb-el-2")?.pageId).toBe(
      "page-second",
    );

    const loadedPages = (loadedElements as any).pages;
    expect(loadedPages).toEqual([
      initialPages[0],
      { ...initialPages[1], name: "Architecture v2" },
    ]);
  });

  it("persists and restores multi-page state and elements in browser localStorage (AC-11)", () => {
    const page2Id = "page-design";
    const pages = [
      {
        id: DEFAULT_PAGE_ID,
        name: "Overview",
        scrollX: 15,
        scrollY: 25,
        zoom: { value: 1 as NormalizedZoomValue },
      },
      {
        id: page2Id,
        name: "Wireframes",
        scrollX: 320,
        scrollY: -140,
        zoom: { value: 1.75 as NormalizedZoomValue },
      },
    ];

    const elPage1 = API.createElement({
      type: "rectangle",
      id: "ls-el-1",
      x: 10,
      y: 20,
    });
    const elPage2 = {
      ...API.createElement({
        type: "ellipse",
        id: "ls-el-2",
        x: 200,
        y: 300,
      }),
      pageId: page2Id,
    };

    const appStateToSave = clearAppStateForLocalStorage({
      ...h.state,
      pages,
      activePageId: page2Id,
      scrollX: 320,
      scrollY: -140,
      zoom: { value: 1.75 as NormalizedZoomValue },
    });

    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify([elPage1, elPage2]),
    );
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(appStateToSave),
    );

    const imported = importFromLocalStorage();
    expect(imported.appState).not.toBeNull();

    const restoredAppState = restoreAppState(imported.appState, null);
    const restoredElements = restoreElements(imported.elements, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
      validPageIds: restoredAppState.pages.map((p) => p.id),
      defaultPageId: restoredAppState.pages[0]?.id,
    });

    expect(restoredAppState.pages).toEqual(pages);
    expect(restoredAppState.activePageId).toBe(page2Id);
    expect(restoredAppState.scrollX).toBe(320);
    expect(restoredAppState.scrollY).toBe(-140);
    expect(restoredAppState.zoom.value).toBe(1.75);

    expect(restoredElements.map((el) => el.id)).toEqual(["ls-el-1", "ls-el-2"]);
    expect(
      getElementPageId(restoredElements.find((el) => el.id === "ls-el-1")!),
    ).toBe(DEFAULT_PAGE_ID);
    expect(
      getElementPageId(restoredElements.find((el) => el.id === "ls-el-2")!),
    ).toBe(page2Id);
  });
});
