import { DEFAULT_PAGE_ID } from "@excalidraw/common";
import {
  Scene,
  getElementPageId,
  syncInvalidIndices,
} from "@excalidraw/element";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  decryptData,
  generateEncryptionKey,
} from "@excalidraw/excalidraw/data/encryption";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "@excalidraw/excalidraw/tests/test-utils";
import { vi } from "vitest";

import type {
  ExcalidrawPage,
  NormalizedZoomValue,
} from "@excalidraw/excalidraw/types";

import ExcalidrawApp from "../App";
import { getSyncableElements } from "../data";
import { exportToBackend, importFromBackend } from "../data";
import { loadFromFirebase, saveToFirebase } from "../data/firebase";
import { LocalData } from "../data/LocalData";
import { importFromLocalStorage } from "../data/localStorage";

import type Portal from "../collab/Portal";

const firestoreDocs = new Map<string, any>();

vi.mock("../data/firebaseSDK", () => {
  const doc = (_firestore: unknown, collection: string, id: string) => ({
    key: `${collection}/${id}`,
  });

  const getDoc = async (docRef: { key: string }) => ({
    exists: () => firestoreDocs.has(docRef.key),
    data: () => firestoreDocs.get(docRef.key),
  });

  const runTransaction = async (
    _firestore: unknown,
    updateFn: (transaction: {
      get: (docRef: { key: string }) => Promise<{
        exists: () => boolean;
        data: () => any;
      }>;
      set: (docRef: { key: string }, data: any) => void;
      update: (docRef: { key: string }, data: any) => void;
    }) => Promise<any>,
  ) => {
    const transaction = {
      get: getDoc,
      set: (docRef: { key: string }, data: any) => {
        firestoreDocs.set(docRef.key, data);
      },
      update: (docRef: { key: string }, data: any) => {
        firestoreDocs.set(docRef.key, data);
      },
    };
    return updateFn(transaction);
  };

  return {
    initializeApp: () => ({}),
    getFirestore: () => ({}),
    doc,
    getDoc,
    runTransaction,
    Bytes: {
      fromUint8Array: (arr: Uint8Array) => ({
        toUint8Array: () => arr,
      }),
    },
    getStorage: () => ({}),
    ref: (_storage: unknown, path: string) => path,
    uploadBytes: async () => undefined,
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

describe("excalidraw-app multi-page integration", () => {
  const dimensions = { height: 768, width: 1024 };
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    mockBoundingClientRect(dimensions);
  });

  beforeEach(() => {
    firestoreDocs.clear();
    localStorage.clear();
    LocalData.resumeSave("collaboration");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("renders the page tab bar by default in ExcalidrawApp", async () => {
    const { container } = await render(<ExcalidrawApp />);
    const pageBar = container.querySelector('[data-testid="page-bar"]');
    expect(pageBar).not.toBeNull();
  });

  it("round-trips all pages, elements, viewports, and activePageId through share links (exportToBackend and importFromBackend)", async () => {
    const backendStore = new Map<string, ArrayBuffer>();

    globalThis.fetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          const id = "share-multi-page-id";
          const body = init.body as any;
          if (body && typeof body.byteLength === "number") {
            if (typeof body.byteOffset === "number" && body.buffer) {
              const bytes = new Uint8Array(
                body.buffer,
                body.byteOffset,
                body.byteLength,
              );
              backendStore.set(id, bytes.slice().buffer);
            } else {
              const bytes = new Uint8Array(body);
              backendStore.set(id, bytes.slice().buffer);
            }
          }
          return {
            ok: true,
            json: async () => ({ id }),
          } as Response;
        }

        const stored =
          backendStore.get("share-multi-page-id") ?? new ArrayBuffer(0);
        return {
          ok: true,
          arrayBuffer: async () => stored,
        } as Response;
      },
    ) as unknown as typeof fetch;

    const pages: readonly ExcalidrawPage[] = [
      {
        id: DEFAULT_PAGE_ID,
        name: "Overview",
        scrollX: 120,
        scrollY: -45,
        zoom: { value: 1.25 as NormalizedZoomValue },
      },
      {
        id: "page-2",
        name: "Architecture",
        scrollX: -310,
        scrollY: 240,
        zoom: { value: 2 as NormalizedZoomValue },
      },
    ];

    const elPage1 = API.createElement({
      type: "rectangle",
      id: "rect-page-1",
      x: 10,
      y: 20,
    });
    const elPage2 = {
      ...API.createElement({
        type: "ellipse",
        id: "ellipse-page-2",
        x: 300,
        y: 400,
      }),
      pageId: "page-2",
    };

    const appState = {
      ...getDefaultAppState(),
      pages,
      activePageId: "page-2",
      scrollX: -310,
      scrollY: 240,
      zoom: { value: 2 as NormalizedZoomValue },
    };

    const exportResult = await exportToBackend(
      [elPage1, elPage2],
      appState,
      {},
    );

    expect(exportResult.errorMessage).toBeNull();
    expect(exportResult.url).toBeTruthy();

    const parsedUrl = new URL(exportResult.url!);
    const hashMatch = parsedUrl.hash.match(/^#json=([^,]+),(.+)$/);
    expect(hashMatch).not.toBeNull();

    const [, shareId, shareKey] = hashMatch!;
    const importedData = await importFromBackend(shareId, shareKey);
    const restoredElements = restoreElements(importedData.elements, null);
    const restoredAppState = restoreAppState(importedData.appState, null);

    expect(restoredAppState.pages).toEqual(pages);
    expect(restoredAppState.activePageId).toBe("page-2");
    expect(restoredAppState.scrollX).toBe(-310);
    expect(restoredAppState.scrollY).toBe(240);
    expect(restoredAppState.zoom.value).toBe(2);

    expect(restoredElements.map((el) => el.id)).toEqual([
      "rect-page-1",
      "ellipse-page-2",
    ]);
    expect(getElementPageId(restoredElements[0], restoredAppState.pages)).toBe(
      DEFAULT_PAGE_ID,
    );
    expect(getElementPageId(restoredElements[1], restoredAppState.pages)).toBe(
      "page-2",
    );
  });

  it("round-trips all pages, elements, viewports, and activePageId through local autosave (LocalData and importFromLocalStorage)", () => {
    const pages: readonly ExcalidrawPage[] = [
      {
        id: DEFAULT_PAGE_ID,
        name: "Page 1",
        scrollX: 50,
        scrollY: 75,
        zoom: { value: 1 as NormalizedZoomValue },
      },
      {
        id: "page-2",
        name: "Wireframes",
        scrollX: -180,
        scrollY: 90,
        zoom: { value: 1.5 as NormalizedZoomValue },
      },
    ];

    const elPage1 = API.createElement({
      type: "rectangle",
      id: "local-el-1",
      x: 5,
      y: 15,
    });
    const elPage2 = {
      ...API.createElement({
        type: "diamond",
        id: "local-el-2",
        x: 80,
        y: 160,
      }),
      pageId: "page-2",
    };

    const appState = {
      ...getDefaultAppState(),
      name: "Untitled",
      pages,
      activePageId: "page-2",
      scrollX: -180,
      scrollY: 90,
      zoom: { value: 1.5 as NormalizedZoomValue },
    } as any;

    LocalData.save([elPage1, elPage2], appState, {}, () => {});
    LocalData.flushSave();

    const savedLocal = importFromLocalStorage();
    const restoredElements = restoreElements(savedLocal.elements, null);
    const restoredAppState = restoreAppState(savedLocal.appState, null);

    expect(restoredAppState.pages).toEqual(pages);
    expect(restoredAppState.activePageId).toBe("page-2");
    expect(restoredAppState.scrollX).toBe(-180);
    expect(restoredAppState.scrollY).toBe(90);
    expect(restoredAppState.zoom.value).toBe(1.5);
    expect(restoredElements.map((el) => el.id)).toEqual([
      "local-el-1",
      "local-el-2",
    ]);
    expect(getElementPageId(restoredElements[0], restoredAppState.pages)).toBe(
      DEFAULT_PAGE_ID,
    );
    expect(getElementPageId(restoredElements[1], restoredAppState.pages)).toBe(
      "page-2",
    );
  });

  it("saves and loads room pages in Firebase as a backward-compatible JSON array so a room loaded with no peers online keeps every element on its own page", async () => {
    const roomKey = await generateEncryptionKey("string");
    const roomId = "room-multipage-1";
    const fakeSocket = {} as any;
    const portal = {
      roomId,
      roomKey,
      socket: fakeSocket,
    } as unknown as Portal;

    const pages: readonly ExcalidrawPage[] = [
      {
        id: DEFAULT_PAGE_ID,
        name: "Page 1",
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 as NormalizedZoomValue },
      },
      {
        id: "page-2",
        name: "Page 2",
        scrollX: 100,
        scrollY: 200,
        zoom: { value: 1 as NormalizedZoomValue },
      },
    ];

    const elPage1 = API.createElement({
      type: "rectangle",
      id: "firebase-el-p1",
      x: 10,
      y: 10,
    });
    const elPage2 = {
      ...API.createElement({
        type: "ellipse",
        id: "firebase-el-p2",
        x: 200,
        y: 200,
      }),
      pageId: "page-2",
    };

    const syncableElements = getSyncableElements(
      syncInvalidIndices([elPage1, elPage2]),
    );
    const appState = {
      ...getDefaultAppState(),
      pages,
      activePageId: "page-2",
    } as any;

    const saved = await saveToFirebase(portal, syncableElements, appState);
    expect(saved).not.toBeNull();
    expect(saved?.pages).toEqual(pages);

    const rawDoc = firestoreDocs.get(`scenes/${roomId}`);
    expect(rawDoc).toBeDefined();

    const decryptedBuffer = await decryptData(
      rawDoc.iv.toUint8Array(),
      rawDoc.ciphertext.toUint8Array(),
      roomKey,
    );
    const decryptedJson = new TextDecoder("utf-8").decode(
      new Uint8Array(decryptedBuffer),
    );
    const parsedPayload = JSON.parse(decryptedJson);

    expect(Array.isArray(parsedPayload)).toBe(true);
    const legacyRestored = restoreElements(parsedPayload, null);
    expect(legacyRestored.map((el) => el.id)).toEqual([
      "firebase-el-p1",
      "firebase-el-p2",
    ]);

    const loaded = await loadFromFirebase(roomId, roomKey, null);
    expect(loaded).not.toBeNull();
    expect(loaded?.pages).toEqual(pages);
    expect(loaded?.elements.map((el) => el.id)).toEqual([
      "firebase-el-p1",
      "firebase-el-p2",
    ]);

    const scene = new Scene();
    scene.setActivePage(
      loaded!.pages![0].id,
      loaded!.pages!.map((p) => p.id),
    );
    scene.replaceAllElements(loaded!.elements, { preservePageIds: true });

    expect(scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      "firebase-el-p1",
    ]);

    scene.setActivePage(
      "page-2",
      loaded!.pages!.map((p) => p.id),
    );
    expect(scene.getNonDeletedElements().map((el) => el.id)).toEqual([
      "firebase-el-p2",
    ]);
  });
});
