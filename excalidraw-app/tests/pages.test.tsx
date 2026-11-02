import { DEFAULT_PAGE_ID } from "@excalidraw/common";
import { CaptureUpdateAction, reconcileElements } from "@excalidraw/excalidraw";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import * as InteractiveScene from "@excalidraw/excalidraw/renderer/interactiveScene";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { act, render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";
import {
  applyPageTombstones,
  deletePage,
  getDefaultPage,
  getElementPageId,
  getLivePages,
  getNeighbourPageId,
  movePage,
  newPage,
  reconcilePages,
  renamePage,
} from "@excalidraw/element";
import { vi } from "vitest";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  AppState,
  Collaborator,
  SocketId,
} from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  ExcalidrawPage,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import ExcalidrawApp from "../App";
import { STORAGE_KEYS } from "../app_constants";
import { getSyncablePages } from "../data";
import { LocalData } from "../data/LocalData";
import { importFromLocalStorage } from "../data/localStorage";

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

type Client = {
  pages: readonly ExcalidrawPage[];
  elements: readonly ExcalidrawElement[];
};

// API.createElement doesn't take a pageId, so it's set on the result
const rectangle = (id: string, pageId: string): ExcalidrawElement => {
  const element = API.createElement({ type: "rectangle", id });
  return pageId === DEFAULT_PAGE_ID ? element : { ...element, pageId };
};

const addPage = (pages: readonly ExcalidrawPage[], name: string) => {
  const page = newPage(pages, name);
  return { page, pages: [...pages, page] };
};

const receive = (local: Client, remote: Client): Client => {
  const pages = reconcilePages(local.pages, remote.pages);
  const elements = reconcileElements(
    local.elements as OrderedExcalidrawElement[],
    remote.elements as unknown as RemoteExcalidrawElement[],
    getDefaultAppState() as AppState,
  );
  return { pages, elements: applyPageTombstones(elements, pages) };
};

const exchange = (a: Client, b: Client) => [receive(a, b), receive(b, a)];

const byPage = (client: Client, pageId: string) =>
  client.elements
    .filter(
      (element) => !element.isDeleted && getElementPageId(element) === pageId,
    )
    .map((element) => element.id);

const livePageList = (pages: readonly ExcalidrawPage[]) =>
  getLivePages(pages).map((page) => [page.id, page.name]);

const createPage = (name: string) => {
  let page!: ExcalidrawPage;
  act(() => {
    page = h.app.pages.createPage({ name, activate: false });
  });
  return page;
};

const setActivePage = (pageId: string) =>
  act(() => {
    h.app.pages.setActivePage(pageId);
  });

const receiveInEditor = (
  pages: readonly ExcalidrawPage[],
  elements: readonly ExcalidrawElement[] = h.app.scene.getAllElementsIncludingDeleted(),
) =>
  act(() => {
    h.app.updateScene({
      elements,
      pages,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  });

describe("multi-page drawings in the web app", () => {
  beforeEach(() => {
    LocalData.flushSave();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("local storage round trip keeps every page", () => {
    const first = getDefaultPage();
    const second = addPage([first], "Second");
    const third = addPage(second.pages, "Third");
    const pageViewports = {
      [first.id]: { scrollX: 1, scrollY: 2, zoom: 1 },
      [second.page.id]: { scrollX: 3, scrollY: 4, zoom: 2 },
      [third.page.id]: { scrollX: 5, scrollY: 6, zoom: 0.5 },
    };
    const appState = {
      ...getDefaultAppState(),
      pages: third.pages,
      activePageId: second.page.id,
      pageViewports,
    } as unknown as AppState;

    LocalData.save(
      [
        rectangle("one", first.id),
        rectangle("two", second.page.id),
        rectangle("three", third.page.id),
      ],
      appState,
      {},
      () => {},
    );
    LocalData.flushSave();

    const saved = importFromLocalStorage();
    const restoredState = restoreAppState(saved.appState, null);
    const restored = {
      pages: restoredState.pages,
      elements: restoreElements(saved.elements, null),
    };

    expect(livePageList(restored.pages)).toEqual(livePageList(third.pages));
    expect(restoredState.activePageId).toBe(second.page.id);
    expect(restoredState.pageViewports).toEqual(pageViewports);
    expect(byPage(restored, first.id)).toEqual(["one"]);
    expect(byPage(restored, second.page.id)).toEqual(["two"]);
    expect(byPage(restored, third.page.id)).toEqual(["three"]);
  });

  it("legacy local data becomes one default page", () => {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify([
        API.createElement({ type: "rectangle", id: "one" }),
        API.createElement({ type: "ellipse", id: "two" }),
      ]),
    );
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify({ scrollX: 10, scrollY: 20 }),
    );

    const saved = importFromLocalStorage();
    const restoredState = restoreAppState(saved.appState, null);
    const restored = {
      pages: restoredState.pages,
      elements: restoreElements(saved.elements, null),
    };

    expect(getLivePages(restored.pages).map((page) => page.id)).toEqual([
      DEFAULT_PAGE_ID,
    ]);
    expect(restoredState.activePageId).toBe(DEFAULT_PAGE_ID);
    expect(byPage(restored, DEFAULT_PAGE_ID)).toEqual(["one", "two"]);
  });

  it("elements converge across clients on different pages", () => {
    const first = getDefaultPage();
    const { page: second, pages } = addPage([first], "Second");

    const [na, nb] = exchange(
      { pages, elements: [rectangle("a1", first.id)] },
      { pages, elements: [rectangle("b1", second.id)] },
    );

    for (const client of [na, nb]) {
      expect(byPage(client, first.id)).toEqual(["a1"]);
      expect(byPage(client, second.id)).toEqual(["b1"]);
    }
  });

  it("page list converges after concurrent changes", () => {
    const x = addPage([getDefaultPage()], "X");
    const y = addPage(x.pages, "Y");
    const z = addPage(y.pages, "Z");

    const created = addPage(z.pages, "From A");
    const pagesA = renamePage(created.pages, x.page.id, "Renamed");

    const other = addPage(z.pages, "From B");
    const pagesB = deletePage(movePage(other.pages, z.page.id, 0), y.page.id);

    const [na, nb] = exchange(
      { pages: pagesA, elements: [] },
      { pages: pagesB, elements: [] },
    );

    expect(livePageList(na.pages)).toEqual(livePageList(nb.pages));
    expect(
      getLivePages(na.pages)
        .map((page) => page.name)
        .sort(),
    ).toEqual(["From A", "From B", "Page 1", "Renamed", "Z"].sort());
  });

  it("late joiner receives every page and element", async () => {
    await render(<ExcalidrawApp />);

    const first = getDefaultPage();
    const second = addPage([first], "Second");
    const third = addPage(second.pages, "Third");

    receiveInEditor(third.pages, [
      rectangle("one", first.id),
      rectangle("two", second.page.id),
      rectangle("three", third.page.id),
    ]);

    expect(livePageList(h.state.pages)).toEqual(livePageList(third.pages));
    expect(h.state.activePageId).toBe(first.id);
    expect(
      h.app.scene
        .getAllElementsIncludingDeleted()
        .map((element) => element.id)
        .sort(),
    ).toEqual(["one", "three", "two"]);
    expect(h.elements.map((element) => element.id)).toEqual(["one"]);
  });

  it("active page stays local when a remote page list arrives", async () => {
    await render(<ExcalidrawApp />);

    const second = createPage("Second");
    setActivePage(second.id);

    receiveInEditor(addPage(h.state.pages, "Remote").pages);

    expect(getLivePages(h.state.pages)).toHaveLength(3);
    expect(h.state.activePageId).toBe(second.id);
  });

  it("viewer moves to a neighbour when their page is deleted", async () => {
    await render(<ExcalidrawApp />);

    const second = createPage("Second");
    createPage("Third");
    setActivePage(second.id);

    const neighbour = getNeighbourPageId(
      getLivePages(h.state.pages),
      second.id,
      undefined,
    );

    receiveInEditor(deletePage(h.state.pages, second.id));

    expect(neighbour).not.toBeNull();
    expect(h.state.activePageId).toBe(neighbour);
  });

  it("delete beats a concurrent edit", () => {
    const { page: second, pages } = addPage([getDefaultPage()], "Second");
    const element = rectangle("d1", second.id);

    const deletedPages = deletePage(pages, second.id);
    const a = {
      pages: deletedPages,
      elements: applyPageTombstones([element], deletedPages),
    };
    const b = {
      pages,
      elements: [
        { ...element, version: element.version + 10, versionNonce: 1 },
      ],
    };

    const [na, nb] = exchange(a, b);
    const find = (client: Client) =>
      client.elements.find(({ id }) => id === "d1");

    expect(find(na)?.isDeleted).toBe(true);
    expect(find(nb)?.isDeleted).toBe(true);
  });

  it("cursors follow the page", async () => {
    const renderInteractiveScene = vi.spyOn(
      InteractiveScene,
      "renderInteractiveScene",
    );
    await render(<ExcalidrawApp />);

    const second = createPage("Second");
    setActivePage(second.id);

    const collaborator = (pageId?: string): Collaborator => ({
      pointer: { x: 10, y: 10, tool: "pointer" },
      button: "up",
      username: "collaborator",
      pageId,
    });

    act(() => {
      h.app.updateScene({
        collaborators: new Map([
          ["same" as SocketId, collaborator(second.id)],
          ["other" as SocketId, collaborator(DEFAULT_PAGE_ID)],
          ["missing" as SocketId, collaborator()],
        ]),
      });
    });

    await waitFor(() => {
      const { calls } = renderInteractiveScene.mock;
      const lastCall = calls[calls.length - 1][0];
      expect(
        [...lastCall.renderConfig.remotePointerViewportCoords.keys()].sort(),
      ).toEqual(["missing", "same"]);
    });
  });

  it("page records hold no viewport", async () => {
    await render(<ExcalidrawApp />);

    const second = createPage("Second");
    setActivePage(second.id);

    const syncable = getSyncablePages(h.state.pages);

    expect(Object.keys(h.state.pageViewports).length).toBeGreaterThan(0);
    expect(syncable.length).toBeGreaterThan(0);
    for (const page of syncable) {
      for (const key of ["viewport", "scrollX", "scrollY", "zoom"]) {
        expect(page).not.toHaveProperty(key);
      }
    }
  });
});
