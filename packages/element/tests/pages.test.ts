import { describe, it, expect } from "vitest";

import { DEFAULT_PAGE_ID } from "@excalidraw/common";

import { newElement } from "../src";
import {
  createDefaultPages,
  getHomePageId,
  getElementPageId,
  getScenePageOptions,
  reconcilePages,
  restorePages,
  sortPages,
} from "../src/pages";
import { Scene } from "../src/Scene";

import type { ExcalidrawPage, FractionalIndex } from "../src/types";

const makePage = (overrides: Partial<ExcalidrawPage>): ExcalidrawPage => ({
  id: overrides.id ?? "p1",
  name: overrides.name ?? "Page",
  index: overrides.index ?? ("a0" as FractionalIndex),
  version: overrides.version ?? 1,
  versionNonce: overrides.versionNonce ?? 0,
  isDeleted: overrides.isDeleted ?? false,
});

describe("pages", () => {
  it("home page is DEFAULT_PAGE_ID while it exists", () => {
    const defaultPage = makePage({
      id: DEFAULT_PAGE_ID,
      index: "b0" as FractionalIndex,
    });
    const p2 = makePage({ id: "p2", index: "a0" as FractionalIndex });
    const pages = sortPages([defaultPage, p2]);

    expect(pages[0].id).toBe("p2");
    expect(getHomePageId(pages)).toBe(DEFAULT_PAGE_ID);

    const options = getScenePageOptions(pages, "p2");
    const element = {
      ...newElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      }),
      id: "e1",
    };

    expect(getElementPageId(element, options)).toBe(DEFAULT_PAGE_ID);
  });

  it("unknown pageId falls back to the home page", () => {
    const pages = createDefaultPages();
    const options = getScenePageOptions(pages, DEFAULT_PAGE_ID);
    const element = {
      ...newElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      }),
      id: "e1",
    };
    (element as { pageId?: string }).pageId = "missing";

    expect(getElementPageId(element, options)).toBe(getHomePageId(pages));
  });

  it("reconcilePages keeps both concurrent creates in the same order", () => {
    const defaultPage = createDefaultPages()[0];
    const localNew = makePage({
      id: "local_page",
      name: "Local",
      index: "a1" as FractionalIndex,
    });
    const remoteNew = makePage({
      id: "remote_page",
      name: "Remote",
      index: "a1" as FractionalIndex,
    });

    const localPages = [defaultPage, localNew];
    const remotePages = [defaultPage, remoteNew];

    const reconciled1 = reconcilePages(localPages, remotePages);
    const reconciled2 = reconcilePages(remotePages, localPages);

    expect(reconciled1.map((p) => p.id)).toEqual(reconciled2.map((p) => p.id));
    expect(reconciled1.map((p) => p.id)).toContain("local_page");
    expect(reconciled1.map((p) => p.id)).toContain("remote_page");
  });

  it("reconcilePages takes the higher version per page", () => {
    const p1Local = makePage({
      id: "p1",
      name: "Original",
      version: 1,
      versionNonce: 1,
    });
    const p1Remote = makePage({
      id: "p1",
      name: "Renamed Remote",
      version: 2,
      versionNonce: 10,
    });

    const p2Local = makePage({
      id: "p2",
      name: "Deleted Local",
      isDeleted: true,
      version: 3,
      versionNonce: 5,
    });
    const p2Remote = makePage({
      id: "p2",
      name: "Still Live Remote",
      isDeleted: false,
      version: 2,
      versionNonce: 50,
    });

    const reconciled = reconcilePages([p1Local, p2Local], [p1Remote, p2Remote]);
    const byId = new Map(reconciled.map((p) => [p.id, p]));

    expect(byId.get("p1")?.name).toBe("Renamed Remote");
    expect(byId.get("p2")?.isDeleted).toBe(true);
  });

  it("restorePages repairs malformed input", () => {
    const fromUndefined = restorePages(undefined);
    expect(fromUndefined.filter((p) => !p.isDeleted).length).toBe(1);

    const fromGarbage = restorePages([
      null,
      {},
      { id: "" },
      { id: "valid", name: 123, version: "bad" },
    ]);
    expect(fromGarbage.filter((p) => !p.isDeleted).length).toBe(1);
    expect(fromGarbage.find((p) => p.id === "valid")?.name).toBe("");

    const fromAllDeleted = restorePages([
      makePage({ id: "d1", isDeleted: true }),
      makePage({ id: "d2", isDeleted: true }),
    ]);
    expect(fromAllDeleted.filter((p) => !p.isDeleted).length).toBe(1);
    expect(fromAllDeleted.some((p) => p.id === DEFAULT_PAGE_ID)).toBe(true);
  });

  it("Scene serves only the active page", () => {
    const defaultPage = makePage({
      id: DEFAULT_PAGE_ID,
      index: "a0" as FractionalIndex,
    });
    const page2 = makePage({ id: "p2", index: "a1" as FractionalIndex });
    const pages = [defaultPage, page2];

    const e1 = {
      ...newElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        index: "a0" as FractionalIndex,
      }),
      id: "e1",
    };
    (e1 as { pageId?: string }).pageId = DEFAULT_PAGE_ID;

    const e2 = {
      ...newElement({
        type: "rectangle",
        x: 20,
        y: 20,
        width: 10,
        height: 10,
        index: "a1" as FractionalIndex,
      }),
      id: "e2",
    };
    (e2 as { pageId?: string }).pageId = "p2";

    const scene = new Scene([e1, e2], { skipValidation: true });
    scene.setActivePage(getScenePageOptions(pages, "p2"));

    const activeNonDeleted = scene.getNonDeletedElements();
    expect(activeNonDeleted.map((el) => el.id)).toEqual(["e2"]);

    const allElements = scene.getElementsIncludingDeleted();
    expect(allElements.map((el) => el.id)).toEqual(["e1", "e2"]);
  });

  it("mergeActivePageElements keeps other pages untouched", () => {
    const defaultPage = makePage({
      id: DEFAULT_PAGE_ID,
      index: "a0" as FractionalIndex,
    });
    const page2 = makePage({ id: "p2", index: "a1" as FractionalIndex });
    const pages = [defaultPage, page2];

    const e1 = {
      ...newElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        index: "a0" as FractionalIndex,
      }),
      id: "e1",
    };
    (e1 as { pageId?: string }).pageId = DEFAULT_PAGE_ID;

    const e2 = {
      ...newElement({
        type: "rectangle",
        x: 20,
        y: 20,
        width: 10,
        height: 10,
        index: "a1" as FractionalIndex,
      }),
      id: "e2",
    };
    (e2 as { pageId?: string }).pageId = "p2";

    const scene = new Scene([e1, e2], { skipValidation: true });
    scene.setActivePage(getScenePageOptions(pages, "p2"));

    const editedE2 = newElement({
      ...e2,
      x: 50,
      version: e2.version + 1,
    });

    scene.mergeActivePageElements([editedE2]);

    const all = scene.getElementsIncludingDeleted();
    expect(all[0]).toBe(e1);
    expect(all[1].id).toBe("e2");
    expect(all[1].x).toBe(50);
  });
});
