import { vi } from "vitest";

import {
  CaptureUpdateAction,
  DEFAULT_PAGE_ID,
  restorePages,
} from "@excalidraw/element";
import { encryptData } from "@excalidraw/excalidraw/data/encryption";
import { reconcileElements } from "@excalidraw/excalidraw/data/reconcile";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";

import type {
  ExcalidrawElement,
  ExcalidrawPage,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import ExcalidrawApp from "../App";
import { LocalData } from "../data/LocalData";
import { importFromLocalStorage } from "../data/localStorage";

import type * as FirebaseModule from "../data/firebase";

type StoredDoc = Record<string, unknown>;

const firestoreStore = new Map<string, StoredDoc>();

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

vi.mock("../data/firebaseSDK", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const key = (segments: unknown[]) =>
    segments.filter((s) => typeof s === "string").join("/");
  const getDoc = async (ref: { path: string }) => ({
    exists: () => firestoreStore.has(ref.path),
    data: () => firestoreStore.get(ref.path),
  });
  return {
    ...actual,
    initializeApp: () => ({}),
    getFirestore: () => ({}),
    doc: (_db: unknown, ...segments: unknown[]) => ({ path: key(segments) }),
    getDoc,
    runTransaction: async (
      _db: unknown,
      fn: (tx: {
        get: typeof getDoc;
        set: (ref: { path: string }, data: StoredDoc) => void;
        update: (ref: { path: string }, data: StoredDoc) => void;
      }) => unknown,
    ) =>
      fn({
        get: getDoc,
        set: (ref, data) => {
          firestoreStore.set(ref.path, data);
        },
        update: (ref, data) => {
          firestoreStore.set(ref.path, {
            ...firestoreStore.get(ref.path),
            ...data,
          });
        },
      }),
    Bytes: {
      fromUint8Array: (u: Uint8Array) => ({ toUint8Array: () => u }),
    },
  };
});

type TestCollab = {
  handleRemotePagesUpdate: (
    pages: readonly ExcalidrawPage[] | undefined,
  ) => void;
  broadcastElements: (elements: readonly ExcalidrawElement[]) => void;
  portal: { broadcastScene: (...args: unknown[]) => Promise<void> };
  excalidrawAPI: ExcalidrawImperativeAPI;
};

const getCollab = () => (window as unknown as { collab: TestCollab }).collab;

const { h } = window;

const page = (
  id: string,
  name: string,
  index: string,
  version = 1,
  versionNonce = 1,
  isDeleted = false,
): ExcalidrawPage => ({ id, name, index, version, versionNonce, isDeleted });

const byId = (pages: readonly ExcalidrawPage[], id: string) =>
  pages.find((p) => p.id === id);

const ROOM_KEY = "sTdLvMC_M3V8_vGa3UVRDg";

describe("page collaboration (Collab)", () => {
  it("remote page create, rename, reorder and delete reach the local client", async () => {
    await render(<ExcalidrawApp />);
    const collab = getCollab();
    const defaultPage = h.state.pages[0];

    collab.handleRemotePagesUpdate([defaultPage, page("p2", "Page 2", "a5")]);
    await waitFor(() => expect(byId(h.state.pages, "p2")).toBeDefined());
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

    collab.handleRemotePagesUpdate([
      defaultPage,
      page("p2", "Renamed", "a5", 2),
    ]);
    await waitFor(() =>
      expect(byId(h.state.pages, "p2")?.name).toBe("Renamed"),
    );

    collab.handleRemotePagesUpdate([
      defaultPage,
      page("p2", "Renamed", "Zz", 3),
    ]);
    await waitFor(() => expect(byId(h.state.pages, "p2")?.index).toBe("Zz"));
    expect(h.state.activePageId).toBe(DEFAULT_PAGE_ID);

    const current = byId(h.state.pages, DEFAULT_PAGE_ID) ?? defaultPage;
    collab.handleRemotePagesUpdate([
      { ...current, version: current.version + 10, isDeleted: true },
      page("p2", "Renamed", "Zz", 3),
    ]);
    await waitFor(() =>
      expect(byId(h.state.pages, DEFAULT_PAGE_ID)?.isDeleted).toBe(true),
    );
    await waitFor(() => expect(h.state.activePageId).toBe("p2"));
  });

  it("concurrent edits on different pages do not clobber each other", async () => {
    await render(<ExcalidrawApp />);
    const collab = getCollab();
    collab.handleRemotePagesUpdate([
      h.state.pages[0],
      page("p2", "Page 2", "a5"),
    ]);
    await waitFor(() => expect(byId(h.state.pages, "p2")).toBeDefined());

    const localEl = {
      ...API.createElement({ type: "rectangle", id: "local" }),
      pageId: DEFAULT_PAGE_ID,
    };
    collab.excalidrawAPI.updateScene({
      elements: [localEl],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    const remoteEl = {
      ...API.createElement({ type: "ellipse", id: "remote" }),
      pageId: "p2",
    };
    const reconciled = reconcileElements(
      collab.excalidrawAPI.getSceneElementsIncludingDeleted() as OrderedExcalidrawElement[],
      [remoteEl] as unknown as RemoteExcalidrawElement[],
      collab.excalidrawAPI.getAppState() as AppState,
    );
    collab.excalidrawAPI.updateScene({
      elements: reconciled,
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    await waitFor(() => {
      const all = collab.excalidrawAPI.getSceneElementsIncludingDeleted();
      const local = all.find((el) => el.id === "local");
      const remote = all.find((el) => el.id === "remote");
      expect(local?.pageId).toBe(DEFAULT_PAGE_ID);
      expect(local?.version).toBe(localEl.version);
      expect(remote?.pageId).toBe("p2");
    });
  });

  it("broadcast payloads carry pages", async () => {
    await render(<ExcalidrawApp />);
    const collab = getCollab();
    const spy = vi
      .spyOn(collab.portal, "broadcastScene")
      .mockResolvedValue(undefined);
    const renamed = {
      ...h.state.pages[0],
      name: "Renamed",
      version: h.state.pages[0].version + 1,
    };
    collab.excalidrawAPI.updateScene({
      appState: { pages: [renamed] },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    await waitFor(() => expect(h.state.pages[0].name).toBe("Renamed"));
    collab.broadcastElements(
      collab.excalidrawAPI.getSceneElementsIncludingDeleted(),
    );
    expect(spy).toHaveBeenCalled();
    expect(collab.excalidrawAPI.getAppState().pages[0].name).toBe("Renamed");
    spy.mockRestore();
  });
});

describe("page persistence in the Firebase room", () => {
  beforeEach(() => {
    firestoreStore.clear();
  });

  const portal = () =>
    ({
      socket: { id: "socket-1" },
      roomId: "room-1",
      roomKey: ROOM_KEY,
    } as unknown as Parameters<typeof FirebaseModule.saveToFirebase>[0]);

  it("the Firebase room keeps every page", async () => {
    const firebase = await vi.importActual<typeof FirebaseModule>(
      "../data/firebase",
    );
    const pages = [
      page(DEFAULT_PAGE_ID, "Page 1", "a0"),
      page("p2", "Two", "a1"),
    ];
    const elements = [
      {
        ...API.createElement({ type: "rectangle", id: "r1" }),
        pageId: DEFAULT_PAGE_ID,
      },
      { ...API.createElement({ type: "ellipse", id: "e1" }), pageId: "p2" },
    ];
    await firebase.saveToFirebase(
      portal(),
      elements as unknown as Parameters<typeof firebase.saveToFirebase>[1],
      { ...h.state, pages, activePageId: DEFAULT_PAGE_ID },
    );
    const loaded = await firebase.loadFromFirebase("room-1", ROOM_KEY, null);
    expect(loaded?.pages).toEqual(pages);
    expect(loaded?.elements.map((el) => [el.id, el.pageId])).toEqual([
      ["r1", DEFAULT_PAGE_ID],
      ["e1", "p2"],
    ]);
  });

  it("a legacy Firebase room loads onto one page", async () => {
    const firebase = await vi.importActual<typeof FirebaseModule>(
      "../data/firebase",
    );
    const elements = [API.createElement({ type: "rectangle", id: "r1" })];
    const { encryptedBuffer, iv } = await encryptData(
      ROOM_KEY,
      JSON.stringify(elements),
    );
    const bytes = (u: Uint8Array) => ({ toUint8Array: () => u });
    const legacyDoc = {
      sceneVersion: 1,
      ciphertext: bytes(new Uint8Array(encryptedBuffer)),
      iv: bytes(iv),
    };
    firestoreStore.set("scenes/room-1", legacyDoc);
    firestoreStore.set("room-1", legacyDoc);
    const loaded = await firebase.loadFromFirebase("room-1", ROOM_KEY, null);
    expect(loaded?.pages).toEqual(restorePages(undefined));
    expect(loaded?.pages[0].id).toBe(DEFAULT_PAGE_ID);
    expect(loaded?.elements.map((el) => el.id)).toEqual(["r1"]);
  });
});

describe("page persistence in localStorage", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("localStorage keeps all pages across a reload", async () => {
    await render(<ExcalidrawApp />);
    const pages = [
      page(DEFAULT_PAGE_ID, "Page 1", "a0"),
      page("p2", "Two", "a1"),
    ];
    const elements = [
      {
        ...API.createElement({ type: "rectangle", id: "r1" }),
        pageId: DEFAULT_PAGE_ID,
      },
      { ...API.createElement({ type: "ellipse", id: "e1" }), pageId: "p2" },
    ];
    LocalData.save(
      elements,
      { ...h.state, pages, activePageId: "p2" },
      {},
      () => {},
    );
    LocalData.flushSave();

    const data = importFromLocalStorage();
    expect(data.appState?.pages).toEqual(pages);
    expect(data.appState?.activePageId).toBe("p2");
    expect(data.elements?.map((el) => [el.id, el.pageId])).toEqual([
      ["r1", DEFAULT_PAGE_ID],
      ["e1", "p2"],
    ]);

    await render(<ExcalidrawApp />);
    await waitFor(() => {
      expect(h.state.pages.map((p) => [p.id, p.name, p.index])).toEqual([
        [DEFAULT_PAGE_ID, "Page 1", "a0"],
        ["p2", "Two", "a1"],
      ]);
      expect(h.state.activePageId).toBe("p2");
    });
  });
});
