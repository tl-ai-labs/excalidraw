import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { DEFAULT_PAGE_ID, MAX_PAGE_NAME_LENGTH } from "@excalidraw/common";
import {
  adoptElementsIntoPage,
  applyPageTombstones,
  deletePage,
  dropDeletedPageElements,
  getDefaultPage,
  getLivePages,
  getNeighbourPageId,
  getNextPageName,
  getPageViewport,
  MAX_REMOTE_PAGES,
  movePage,
  normalizePageName,
  reconcilePages,
  sanitizeRemotePages,
} from "@excalidraw/element";

import { Scene } from "../src/Scene";

import type {
  ExcalidrawElement,
  ExcalidrawPage,
  FractionalIndex,
} from "../src/types";

const createPage = (
  id: string,
  index: string,
  overrides: Partial<ExcalidrawPage> = {},
): ExcalidrawPage => ({
  ...getDefaultPage(),
  id,
  name: id,
  index: index as FractionalIndex,
  ...overrides,
});

const createElement = (
  id: string,
  index: string,
  pageId?: string,
): ExcalidrawElement => {
  const element = {
    ...API.createElement({ id, type: "rectangle" }),
    index: index as FractionalIndex,
  };
  return pageId ? { ...element, pageId } : element;
};

const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);

const indices = (elements: readonly ExcalidrawElement[]) =>
  elements.map((element) => element.index);

const createPagedScene = (activePageId: string) => {
  const scene = new Scene(null, { paged: true });
  scene.replaceElementsByPage(
    new Map([
      ["P1", [createElement("one", "a0", "P1")]],
      ["P2", [createElement("two", "a0", "P2")]],
    ]),
    { replaceAll: true, activePageId },
  );
  return scene;
};

describe("page model", () => {
  it("default page is deterministic", () => {
    const page = getDefaultPage();

    expect(page).toEqual(getDefaultPage());
    expect(page).toMatchObject({
      id: DEFAULT_PAGE_ID,
      name: "Page 1",
      version: 1,
      versionNonce: 0,
    });
  });

  it("next page name", () => {
    expect(
      getNextPageName([
        createPage("a", "a0", { name: "Page 1" }),
        createPage("b", "a1", { name: "Roadmap" }),
        createPage("c", "a2", { name: "Page 7" }),
        createPage("d", "a3", { name: "Page 9", isDeleted: true }),
      ]),
    ).toBe("Page 8");
  });

  it("name normalization", () => {
    expect(normalizePageName(`  ${"x".repeat(150)}  `, "Page 3")).toBe(
      "x".repeat(100),
    );
    expect(normalizePageName("   ", "Page 3")).toBe("Page 3");
  });

  it("move between neighbours", () => {
    const pages = [
      createPage("a", "a0"),
      createPage("b", "a1"),
      createPage("c", "a2"),
    ];

    const moved = movePage(pages, "c", 0);

    expect(ids(getLivePages(moved))).toEqual(["c", "a", "b"]);
    expect(moved.find((page) => page.id === "c")!.version).toBeGreaterThan(1);
    expect(moved.find((page) => page.id === "a")!.version).toBe(1);
    expect(moved.find((page) => page.id === "b")!.version).toBe(1);
  });

  it("move with equal neighbour indices", () => {
    const pages = [
      createPage("a", "a1"),
      createPage("b", "a1"),
      createPage("c", "a2"),
    ];
    let moved: readonly ExcalidrawPage[] = [];

    expect(() => {
      moved = movePage(pages, "c", 1);
    }).not.toThrow();
    expect(ids(getLivePages(moved))).toEqual(["a", "c", "b"]);
    expect(new Set(moved.map((page) => page.index)).size).toBe(3);
  });

  it("neighbour after delete", () => {
    const pages = [
      createPage("A", "a0"),
      createPage("B", "a1"),
      createPage("C", "a2"),
    ];

    expect(getNeighbourPageId(pages, "B", undefined)).toBe("C");
    expect(getNeighbourPageId(pages, "C", undefined)).toBe("B");
    expect(getNeighbourPageId(pages, "B", new Set(["A", "B"]))).toBe("A");
  });

  it("deletePage tombstones the record", () => {
    const pages = [createPage("a", "a0"), createPage("b", "a1")];

    const next = deletePage(pages, "b");
    const deleted = next.find((page) => page.id === "b")!;

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.version).toBeGreaterThan(1);
    expect(ids(getLivePages(next))).toEqual(["a"]);
  });
});

describe("reconcilePages", () => {
  it("keeps both creates", () => {
    const base = createPage("a", "a0");
    const local = [base, createPage("X", "a1")];
    const remote = [base, createPage("Y", "a1")];

    const expected = ["a", "X", "Y"];
    expect(ids(getLivePages(reconcilePages(local, remote)))).toEqual(expected);
    expect(ids(getLivePages(reconcilePages(remote, local)))).toEqual(expected);
  });

  it("rename conflict resolves like elements", () => {
    const winner = createPage("a", "a0", {
      name: "winner",
      version: 2,
      versionNonce: 1,
    });
    const loser = createPage("a", "a0", {
      name: "loser",
      version: 2,
      versionNonce: 5,
    });

    expect(reconcilePages([winner], [loser])[0].name).toBe("winner");
    expect(reconcilePages([loser], [winner])[0].name).toBe("winner");
  });

  it("tombstone beats a higher version", () => {
    const other = createPage("other", "a0");
    const local = [
      other,
      createPage("a", "a1", { version: 2, isDeleted: true }),
    ];
    const remote = [other, createPage("a", "a1", { name: "new", version: 5 })];

    for (const result of [
      reconcilePages(local, remote),
      reconcilePages(remote, local),
    ]) {
      expect(result.find((page) => page.id === "a")?.isDeleted ?? true).toBe(
        true,
      );
      expect(ids(getLivePages(result))).toEqual(["other"]);
    }
  });

  it("pristine default is dropped", () => {
    const local = [getDefaultPage()];
    const remote = [createPage("P2", "a1")];

    expect(ids(reconcilePages(local, remote))).toEqual(["P2"]);
    expect(ids(reconcilePages(remote, local))).toEqual(["P2"]);
  });

  it("no page is left deleted", () => {
    const local = [createPage("a", "a0", { isDeleted: true })];
    const remote = [createPage("b", "a1", { isDeleted: true })];

    expect(ids(getLivePages(reconcilePages(local, remote)))).toEqual(["a"]);
    expect(ids(getLivePages(reconcilePages(remote, local)))).toEqual(["a"]);
  });
});

describe("page tombstones and adoption", () => {
  it("tombstones delete elements", () => {
    const elements = [
      { ...createElement("one", "a0", "gone"), version: 10 },
    ] as ExcalidrawElement[];

    const result = applyPageTombstones(elements, [
      getDefaultPage(),
      createPage("gone", "a1", { isDeleted: true }),
    ]);
    expect(result[0].isDeleted).toBe(true);

    expect(
      applyPageTombstones(elements, [
        getDefaultPage(),
        createPage("gone", "a1"),
      ]),
    ).toBe(elements);
  });

  it("adoption keeps the default page bare", () => {
    const element = createElement("one", "a0", "P");
    const version = element.version;

    const [adopted] = adoptElementsIntoPage([element], DEFAULT_PAGE_ID);

    expect("pageId" in adopted).toBe(false);
    expect(adopted.version).toBe(version);
  });
});

describe("paged Scene", () => {
  it("shows one page", () => {
    const scene = createPagedScene("P1");

    expect(ids(scene.getNonDeletedElements())).toEqual(["one"]);
    expect(ids(scene.getAllElementsIncludingDeleted()).sort()).toEqual([
      "one",
      "two",
    ]);

    scene.setActivePage("P2");

    expect(ids(scene.getNonDeletedElements())).toEqual(["two"]);
    expect(ids(scene.getAllElementsIncludingDeleted()).sort()).toEqual([
      "one",
      "two",
    ]);
  });

  it("replaceAllElements writes the active page only", () => {
    const scene = createPagedScene("P2");

    scene.replaceAllElements([
      createElement("bare", "a0"),
      createElement("foreign", "a1", "P1"),
    ]);

    expect(
      scene.getElementsIncludingDeleted().map((element) => element.pageId),
    ).toEqual(["P2", "P2"]);
    expect(ids(scene.getPageElements("P2"))).toEqual(["bare", "foreign"]);
    expect(ids(scene.getPageElements("P1"))).toEqual(["one"]);
    expect(scene.getPageElements("P1")[0].pageId).toBe("P1");
  });

  it("indices are per page", () => {
    const scene = new Scene(null, { paged: true });

    scene.replaceElementsByPage(
      new Map([
        [
          "P1",
          [createElement("one", "a0", "P1"), createElement("two", "a1", "P1")],
        ],
        [
          "P2",
          [
            createElement("three", "a0", "P2"),
            createElement("four", "a1", "P2"),
          ],
        ],
      ]),
      { replaceAll: true, activePageId: "P1" },
    );

    expect(indices(scene.getPageElements("P1"))).toEqual(["a0", "a1"]);
    expect(indices(scene.getPageElements("P2"))).toEqual(["a0", "a1"]);
  });

  it("unpaged Scene never adopts", () => {
    const scene = new Scene([createElement("one", "a0", "P2")]);

    expect(scene.getElementsIncludingDeleted()[0].pageId).toBe("P2");
  });
});

describe("sanitizeRemotePages", () => {
  it("returns [] for non-lists", () => {
    for (const value of [undefined, null, "pages", {}, []]) {
      expect(sanitizeRemotePages(value)).toEqual([]);
    }
  });

  it("drops invalid records and keeps valid neighbours", () => {
    const good1 = createPage("g1", "a0");
    const good2 = createPage("g2", "a1");
    const bad: unknown[] = [
      null,
      { ...createPage("b1", "a2"), name: {} },
      { ...createPage("b2", "a2"), name: "x".repeat(MAX_PAGE_NAME_LENGTH + 1) },
      { ...createPage("b3", "a2"), index: "" },
      { ...createPage("b4", "a2"), version: Infinity },
      { ...createPage("b5", "a2"), isDeleted: "no" },
    ];

    for (const entry of bad) {
      expect(ids(sanitizeRemotePages([good1, entry, good2]))).toEqual([
        "g1",
        "g2",
      ]);
    }
  });

  it("keeps the first of duplicate ids", () => {
    const result = sanitizeRemotePages([
      createPage("a", "a0", { name: "first" }),
      createPage("a", "a1", { name: "second" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("first");
  });

  it("caps the list", () => {
    const many = Array.from({ length: MAX_REMOTE_PAGES + 5 }, (_, i) =>
      createPage(`p${i}`, "a0"),
    );

    expect(sanitizeRemotePages(many)).toHaveLength(MAX_REMOTE_PAGES);
  });

  it("strips unknown keys, keeps index, adds no default page", () => {
    const page = createPage("a", "a1");

    const result = sanitizeRemotePages([{ ...page, extra: 1, viewport: {} }]);

    expect(result).toEqual([page]);
    expect("extra" in result[0]).toBe(false);
    expect(result[0].index).toBe("a1");
    expect(ids(result)).not.toContain(DEFAULT_PAGE_ID);
  });
});

describe("dropDeletedPageElements", () => {
  it("drops elements on tombstoned pages only", () => {
    const pages = [
      createPage("live", "a0"),
      createPage("gone", "a1", { isDeleted: true }),
    ];
    const elements = [
      createElement("on-live", "a0", "live"),
      createElement("on-gone", "a1", "gone"),
      createElement("on-unknown", "a2", "unknown"),
      { ...createElement("deleted", "a3", "live"), isDeleted: true },
    ] as ExcalidrawElement[];

    expect(ids(dropDeletedPageElements(elements, pages))).toEqual([
      "on-live",
      "on-unknown",
      "deleted",
    ]);
  });

  it("returns the same array when no page is tombstoned", () => {
    const elements = [createElement("one", "a0", "live")];

    expect(dropDeletedPageElements(elements, [createPage("live", "a0")])).toBe(
      elements,
    );
  });
});

describe("getPageViewport", () => {
  it("returns own viewports only", () => {
    const viewport = { scrollX: 1, scrollY: 2, zoom: 1.5 };
    const viewports = { p1: viewport };

    expect(getPageViewport(viewports, "p1")).toEqual(viewport);
    expect(getPageViewport(viewports, "constructor")).toBeUndefined();
    expect(getPageViewport(viewports, "toString")).toBeUndefined();
    expect(getPageViewport(viewports, "missing")).toBeUndefined();
  });
});
