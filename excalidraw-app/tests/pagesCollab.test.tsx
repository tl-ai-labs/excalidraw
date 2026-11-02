import { DEFAULT_PAGE_ID } from "@excalidraw/common";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  decryptData,
  encryptData,
  generateEncryptionKey,
} from "@excalidraw/excalidraw/data/encryption";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import {
  act,
  render,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";
import {
  getDefaultPage,
  getLivePages,
  getPagesVersion,
  getSceneVersion,
  newPage,
} from "@excalidraw/element";
import { vi } from "vitest";

import type { AppState } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  ExcalidrawPage,
} from "@excalidraw/element/types";

import ExcalidrawApp from "../App";
import { loadFromFirebase, saveToFirebase } from "../data/firebase";

import type Portal from "../collab/Portal";

const { h } = window;

const documents = vi.hoisted(() => new Map<string, any>());

vi.mock("firebase/app", () => ({
  initializeApp: () => ({}),
}));

vi.mock("firebase/storage", () => ({
  getStorage: () => ({}),
  ref: () => ({}),
  uploadBytes: async () => ({}),
}));

vi.mock("firebase/firestore", () => {
  class BytesMock {
    constructor(private bytes: Uint8Array) {}
    static fromUint8Array(bytes: Uint8Array) {
      return new BytesMock(bytes);
    }
    toUint8Array() {
      return this.bytes;
    }
  }

  const snapshot = (path: string) => ({
    exists: () => documents.has(path),
    data: () => documents.get(path),
  });

  return {
    Bytes: BytesMock,
    getFirestore: () => ({}),
    doc: (_firestore: unknown, collection: string, id: string) => ({
      path: `${collection}/${id}`,
    }),
    getDoc: async (ref: { path: string }) => snapshot(ref.path),
    runTransaction: async (_firestore: unknown, update: any) =>
      update({
        get: async (ref: { path: string }) => snapshot(ref.path),
        set: (ref: { path: string }, data: any) => {
          documents.set(ref.path, data);
        },
        update: (ref: { path: string }, data: any) => {
          documents.set(ref.path, { ...documents.get(ref.path), ...data });
        },
      }),
  };
});

const socketHandlers = vi.hoisted(
  () => new Map<string, (...args: any[]) => any>(),
);

vi.mock("socket.io-client", () => ({
  default: () => ({
    id: "me",
    emit: () => {},
    on: (event: string, handler: (...args: any[]) => any) => {
      socketHandlers.set(event, handler);
    },
    off: () => {},
    once: () => {},
    close: () => {},
  }),
}));

const ROOM_ID = "room-1";
const SECRET_NAME = "Confidential roadmap";

const rectangle = (id: string, pageId: string): ExcalidrawElement => {
  const element = API.createElement({ type: "rectangle", id });
  return pageId === DEFAULT_PAGE_ID ? element : { ...element, pageId };
};

const bytesToString = (bytes: Uint8Array) => {
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
};

const decryptJSON = async (
  iv: Uint8Array<ArrayBuffer>,
  ciphertext: ArrayBuffer,
  key: string,
) =>
  JSON.parse(
    new TextDecoder().decode(
      new Uint8Array(await decryptData(iv, ciphertext, key)),
    ),
  );

const createPortal = (roomKey: string) =>
  ({
    roomId: ROOM_ID,
    roomKey,
    socket: {},
  } as unknown as Portal);

describe("multi-page rooms in Firestore", () => {
  beforeEach(() => {
    documents.clear();
  });

  it("saves and loads a multi-page drawing with encrypted page names", async () => {
    const roomKey = await generateEncryptionKey();
    const first = getDefaultPage();
    const second = newPage([first], SECRET_NAME);
    const pages = [first, second];
    const elements = [rectangle("one", first.id), rectangle("two", second.id)];
    const appState = {
      ...getDefaultAppState(),
      pages,
      activePageId: first.id,
    } as unknown as AppState;

    const saved = await saveToFirebase(
      createPortal(roomKey!),
      elements as any,
      appState,
    );

    expect(saved).not.toBeNull();

    const stored = documents.get(`scenes/${ROOM_ID}`);

    expect(stored.pagesIv).toBeDefined();
    expect(stored.pagesCiphertext).toBeDefined();

    // older clients keep reading an element array from `ciphertext`
    const storedElements = await decryptJSON(
      stored.iv.toUint8Array(),
      stored.ciphertext.toUint8Array(),
      roomKey!,
    );
    expect(Array.isArray(storedElements)).toBe(true);
    expect(storedElements.map((element: any) => element.id).sort()).toEqual([
      "one",
      "two",
    ]);

    // page names are not readable in the stored document
    for (const field of ["iv", "ciphertext", "pagesIv", "pagesCiphertext"]) {
      expect(bytesToString(stored[field].toUint8Array())).not.toContain(
        SECRET_NAME,
      );
    }
    expect(
      Object.keys(stored).filter((key) =>
        JSON.stringify(stored[key]).includes(SECRET_NAME),
      ),
    ).toEqual([]);

    const loaded = await loadFromFirebase(ROOM_ID, roomKey!, null);

    expect(loaded).not.toBeNull();
    expect(loaded!.elements.map((element) => element.id).sort()).toEqual([
      "one",
      "two",
    ]);
    expect(getLivePages(loaded!.pages).map((page) => page.name)).toEqual([
      first.name,
      SECRET_NAME,
    ]);
  });

  it("loads a legacy document without a page list", async () => {
    const roomKey = await generateEncryptionKey();
    const element = API.createElement({ type: "rectangle", id: "legacy" });
    const { encryptedBuffer, iv } = await encryptData(
      roomKey!,
      new TextEncoder().encode(JSON.stringify([element])),
    );
    const { Bytes } = await import("firebase/firestore");

    documents.set(`scenes/${ROOM_ID}`, {
      sceneVersion: getSceneVersion([element]),
      iv: Bytes.fromUint8Array(iv),
      ciphertext: Bytes.fromUint8Array(new Uint8Array(encryptedBuffer)),
    });

    const loaded = await loadFromFirebase(ROOM_ID, roomKey!, null);

    expect(loaded).not.toBeNull();
    expect(loaded!.pages).toEqual([]);
    expect(loaded!.elements.map((el) => el.id)).toEqual(["legacy"]);
  });
});

describe("multi-page collaboration broadcasts", () => {
  const emit = vi.fn();
  let roomKey: string;

  const decodeEmitted = async () => {
    const payloads: any[] = [];
    for (const call of emit.mock.calls) {
      const [, , encrypted, iv] = call;
      if (encrypted && iv) {
        payloads.push(await decryptJSON(iv, encrypted, roomKey));
      }
    }
    return payloads;
  };

  beforeEach(async () => {
    emit.mockClear();
    roomKey = (await generateEncryptionKey())!;
    await render(<ExcalidrawApp />);

    const { portal } = window.collab;
    portal.socket = {
      id: "me",
      emit,
      on: () => {},
      off: () => {},
      once: () => {},
      close: () => {},
    } as any;
    portal.roomId = ROOM_ID;
    portal.roomKey = roomKey;
    portal.socketInitialized = true;
  });

  afterEach(() => {
    window.collab.queueBroadcastAllElements.cancel();
    window.collab.queueSaveToFirebase.cancel();
    window.collab.onPointerUpdate.cancel();
    window.collab.portal.socket = null;
  });

  it("broadcasts pages for a page-only change", async () => {
    const { collab } = window;
    const elements = h.app.scene.getAllElementsIncludingDeleted();

    collab.setLastBroadcastedOrReceivedSceneVersion(getSceneVersion(elements));
    // eslint-disable-next-line dot-notation
    collab["lastBroadcastedOrReceivedPagesVersion"] = getPagesVersion(
      h.state.pages,
    );
    collab.syncElements(elements, h.state);
    emit.mockClear();

    let page!: ExcalidrawPage;
    act(() => {
      page = h.app.pages.createPage({ name: "Added", activate: false });
    });
    collab.syncElements(h.app.scene.getAllElementsIncludingDeleted(), h.state);

    await waitFor(async () => {
      const payloads = await decodeEmitted();
      const update = payloads.find((payload) => payload.payload?.pages);
      expect(update).toBeDefined();
      expect(
        update.payload.pages.map((record: ExcalidrawPage) => record.id),
      ).toContain(page.id);
    });
  });

  it("relays the pointer with its pageId on a page switch", async () => {
    const { collab } = window;
    const elements = h.app.scene.getAllElementsIncludingDeleted();

    let page!: ExcalidrawPage;
    act(() => {
      page = h.app.pages.createPage({ name: "Other", activate: false });
    });

    collab.onPointerUpdate({
      pointer: { x: 1, y: 2, tool: "pointer" },
      button: "up",
      pointersMap: new Map(),
    });
    // first call only records the active page
    collab.syncElements(elements, h.state);
    emit.mockClear();

    act(() => {
      h.app.pages.setActivePage(page.id);
    });
    collab.syncElements(h.app.scene.getAllElementsIncludingDeleted(), h.state);

    await waitFor(async () => {
      const payloads = await decodeEmitted();
      const mouse = payloads
        .filter((payload) => payload.type === "MOUSE_LOCATION")
        .pop();
      expect(mouse).toBeDefined();
      expect(mouse.payload.pageId).toBe(page.id);
    });
  });
});

describe("malformed remote page records over the socket", () => {
  let roomKey: string;

  const receive = async (payload: unknown) => {
    const { encryptedBuffer, iv } = await encryptData(
      roomKey,
      new TextEncoder().encode(JSON.stringify(payload)),
    );
    await act(async () => {
      await socketHandlers.get("client-broadcast")!(encryptedBuffer, iv);
    });
  };

  beforeEach(async () => {
    socketHandlers.clear();
    roomKey = (await generateEncryptionKey())!;
    await render(<ExcalidrawApp />);
    await act(async () => {
      await window.collab.startCollaboration({ roomId: ROOM_ID, roomKey });
    });
    await waitFor(() => {
      expect(socketHandlers.has("client-broadcast")).toBe(true);
    });
  });

  afterEach(() => {
    window.collab.queueBroadcastAllElements.cancel();
    window.collab.queueSaveToFirebase.cancel();
    window.collab.onPointerUpdate.cancel();
    // eslint-disable-next-line dot-notation
    clearTimeout(window.collab["socketInitializationTimer"]);
    window.collab.portal.socket = null;
  });

  it("drops bad page entries and keeps the valid one", async () => {
    const valid = newPage([getDefaultPage()], "Valid");

    await receive({
      type: "SCENE_UPDATE",
      payload: {
        elements: [],
        pages: [valid, { id: "bad", name: {} }, null],
      },
    });

    expect(document.querySelector(".excalidraw")).not.toBeNull();
    expect(
      await screen.findByRole("tab", { name: /Valid/ }),
    ).toBeInTheDocument();
    expect(h.state.pages.map((page) => page?.id)).toContain(valid.id);
    expect(h.state.pages.map((page) => page?.id)).not.toContain("bad");
    expect(
      h.state.pages.every(
        (page) => page && typeof page.name === "string" && page.id !== "bad",
      ),
    ).toBe(true);
  });

  it.each([["nope"], [[null]]])(
    "ignores pages payload %j and applies later updates",
    async (pages) => {
      const before = h.state.pages;

      await receive({
        type: "SCENE_UPDATE",
        payload: { elements: [], pages },
      });

      expect(document.querySelector(".excalidraw")).not.toBeNull();
      expect(h.state.pages).toEqual(before);

      const later = newPage([getDefaultPage()], "Later");
      await receive({
        type: "SCENE_UPDATE",
        payload: { elements: [], pages: [later] },
      });

      expect(h.state.pages.map((page) => page.id)).toContain(later.id);
      expect(
        await screen.findByRole("tab", { name: /Later/ }),
      ).toBeInTheDocument();
    },
  );
});

describe("malformed remote page records in Firestore", () => {
  const storeDocument = async (
    roomKey: string,
    elements: unknown[],
    pagesValue: unknown,
  ) => {
    const encrypt = (value: unknown) =>
      encryptData(roomKey, new TextEncoder().encode(JSON.stringify(value)));
    const stored = await encrypt(elements);
    const pages = await encrypt(pagesValue);
    const { Bytes } = await import("firebase/firestore");

    documents.set(`scenes/${ROOM_ID}`, {
      sceneVersion: getSceneVersion(elements as ExcalidrawElement[]),
      iv: Bytes.fromUint8Array(stored.iv),
      ciphertext: Bytes.fromUint8Array(new Uint8Array(stored.encryptedBuffer)),
      pagesIv: Bytes.fromUint8Array(pages.iv),
      pagesCiphertext: Bytes.fromUint8Array(
        new Uint8Array(pages.encryptedBuffer),
      ),
    });
  };

  beforeEach(() => {
    documents.clear();
  });

  it("loads only valid records and does not write bad ones back", async () => {
    const roomKey = (await generateEncryptionKey())!;
    const valid = newPage([getDefaultPage()], "Valid");
    const element = rectangle("one", DEFAULT_PAGE_ID);

    await storeDocument(
      roomKey,
      [element],
      [null, { id: "bad", name: {} }, valid],
    );

    const loaded = await loadFromFirebase(ROOM_ID, roomKey, null);

    expect(loaded).not.toBeNull();
    expect(loaded!.pages.map((page) => page.id)).toEqual([valid.id]);

    const appState = {
      ...getDefaultAppState(),
      pages: [getDefaultPage()],
      activePageId: DEFAULT_PAGE_ID,
    } as unknown as AppState;

    const saved = await saveToFirebase(
      createPortal(roomKey),
      [element] as any,
      appState,
    );

    expect(saved).not.toBeNull();
    expect(saved!.pages.map((page) => page.id)).toContain(valid.id);

    const stored = documents.get(`scenes/${ROOM_ID}`);
    const storedPages = await decryptJSON(
      stored.pagesIv.toUint8Array(),
      stored.pagesCiphertext.toUint8Array(),
      roomKey,
    );

    expect(Array.isArray(storedPages)).toBe(true);
    expect(storedPages.every((page: unknown) => page !== null)).toBe(true);
    expect(storedPages.map((page: any) => page.id)).not.toContain("bad");
    expect(storedPages.map((page: any) => page.id)).toContain(valid.id);
  });

  it("loads an empty page list when pagesCiphertext is not an array", async () => {
    const roomKey = (await generateEncryptionKey())!;

    await storeDocument(roomKey, [rectangle("one", DEFAULT_PAGE_ID)], {
      id: "bad",
      name: "nope",
    });

    const loaded = await loadFromFirebase(ROOM_ID, roomKey, null);

    expect(loaded).not.toBeNull();
    expect(loaded!.pages).toEqual([]);
    expect(loaded!.elements.map((element) => element.id)).toEqual(["one"]);
  });
});
