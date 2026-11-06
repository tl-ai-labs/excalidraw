import { describe, expect, it } from "vitest";

import { newElementWith } from "@excalidraw/element";
import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";
import { reconcileElements } from "@excalidraw/excalidraw/data/reconcile";
import { restore } from "@excalidraw/excalidraw/data/restore";
import {
  decryptData,
  encryptData,
  generateEncryptionKey,
} from "@excalidraw/excalidraw/data/encryption";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, ExcalidrawPage } from "@excalidraw/excalidraw/types";

const makeElement = (
  id: string,
  pageId: string | undefined,
  extra: Record<string, unknown> = {},
) =>
  ({
    id,
    type: "rectangle",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    angle: 0,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    seed: 1,
    version: 1,
    versionNonce: 1,
    index: "a0",
    isDeleted: false,
    ...(pageId ? { pageId } : {}),
    ...extra,
  } as unknown as ExcalidrawElement);

const PAGES: ExcalidrawPage[] = [
  { id: "page-1", name: "Page 1" },
  { id: "page-2", name: "Second" },
];

describe("AC-8.1 localStorage persistence", () => {
  it("restores all pages, elements, activePageId and viewports", () => {
    const appState = {
      ...getDefaultAppState(),
      pages: PAGES,
      activePageId: "page-2",
      pageViewports: {
        "page-1": { scrollX: 5, scrollY: 6, zoom: { value: 1 } },
        "page-2": { scrollX: 7, scrollY: 8, zoom: { value: 2 } },
      },
    } as unknown as AppState;

    const stored = clearAppStateForLocalStorage(appState);
    const elements = [makeElement("a", undefined), makeElement("b", "page-2")];

    const restored = restore({ elements, appState: stored } as any, null, null);

    expect(restored.appState.pages.map((p) => p.id)).toEqual([
      "page-1",
      "page-2",
    ]);
    expect(restored.appState.activePageId).toBe("page-2");
    expect(restored.appState.pageViewports["page-1"].scrollX).toBe(5);
    expect(restored.appState.pageViewports["page-2"].scrollY).toBe(8);
    expect(restored.elements.map((el) => el.id)).toEqual(["a", "b"]);
    expect(restored.elements[1].pageId).toBe("page-2");
  });

  it("assigns orphaned elements to the first page", () => {
    const restored = restore(
      {
        elements: [makeElement("x", "missing-page")],
        appState: { pages: PAGES, activePageId: "page-1" },
      } as any,
      null,
      null,
    );

    expect(restored.elements[0].pageId).toBeUndefined();
  });
});

describe("AC-8.2 collaboration reconciliation", () => {
  it("merges remote elements across pages", () => {
    const local = [makeElement("p1", undefined)];
    const remote = [
      makeElement("p1", undefined, { version: 2, versionNonce: 2 }),
      makeElement("p2", "page-2", { index: "a1" }),
    ];
    const appState = {
      ...getDefaultAppState(),
      pages: PAGES,
      activePageId: "page-1",
      scrollX: 42,
      scrollY: 43,
    } as unknown as AppState;

    const reconciled = reconcileElements(local as any, remote as any, appState);

    expect(reconciled.map((el) => el.id).sort()).toEqual(["p1", "p2"]);
    expect(reconciled.find((el) => el.id === "p2")?.pageId).toBe("page-2");
    expect(appState.scrollX).toBe(42);
    expect(appState.scrollY).toBe(43);
    expect(appState.activePageId).toBe("page-1");
  });
});

describe("AC-8.3 deleted page tombstones", () => {
  it("keeps tombstoned elements deleted against a stale peer copy", () => {
    const original = makeElement("el-2", "page-2");
    const tombstone = newElementWith(original, { isDeleted: true });
    const stalePeerCopy = makeElement("el-2", "page-2");

    expect(tombstone.isDeleted).toBe(true);
    expect(tombstone.version).toBeGreaterThan(original.version);

    const appState = {
      ...getDefaultAppState(),
      pages: PAGES,
      activePageId: "page-1",
    } as unknown as AppState;

    const reconciled = reconcileElements(
      [tombstone] as any,
      [stalePeerCopy] as any,
      appState,
    );

    expect(reconciled).toHaveLength(1);
    expect(reconciled[0].isDeleted).toBe(true);
  });
});

describe("AC-8.4 E2EE page list", () => {
  it("encrypts pages inside ciphertext and reads legacy arrays", async () => {
    const key = await generateEncryptionKey();
    const elements = [makeElement("a", undefined)];

    const multi = await encryptData(
      key!,
      JSON.stringify({ elements, pages: PAGES }),
    );
    const legacy = await encryptData(key!, JSON.stringify(elements));

    const multiParsed = JSON.parse(
      new TextDecoder().decode(
        await decryptData(multi.iv, multi.encryptedBuffer, key!),
      ),
    );
    const legacyParsed = JSON.parse(
      new TextDecoder().decode(
        await decryptData(legacy.iv, legacy.encryptedBuffer, key!),
      ),
    );

    expect(Array.isArray(multiParsed)).toBe(false);
    expect(multiParsed.pages).toEqual(PAGES);
    expect(multiParsed.elements).toHaveLength(1);
    expect(Array.isArray(legacyParsed)).toBe(true);
    expect(legacyParsed[0].id).toBe("a");

    const raw = new TextDecoder().decode(new Uint8Array(multi.encryptedBuffer));
    expect(raw.includes("Second")).toBe(false);
  });
});
