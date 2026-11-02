import {
  getTextStyleRuns,
  newElementWith,
  remapTextStyles,
  syncInvalidIndices,
  withTextStyles,
} from "@excalidraw/element";

import {
  randomInteger,
  cloneJSON,
  MAX_CLEARED_TEXT_STYLE_RANGES,
  MAX_TEXT_STYLE_RANGES,
} from "@excalidraw/common";

import type {
  ExcalidrawElement,
  FractionalIndex,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import { API } from "../helpers/api";

import { reconcileElements } from "../../data/reconcile";
import { bumpElementVersions } from "../../data/restore";

import type { RemoteExcalidrawElement } from "../../data/reconcile";

import type { AppState } from "../../types";

type Id = string;
type ElementLike = {
  id: string;
  version: number;
  versionNonce: number;
  index: string;
};

type Cache = Record<string, ExcalidrawElement | undefined>;

const createElement = (opts: { uid: string } | ElementLike) => {
  let uid: string;
  let id: string;
  let version: number | null;
  let versionNonce: number | null = null;
  if ("uid" in opts) {
    const match = opts.uid.match(/^(\w+)(?::(\d+))?$/)!;
    id = match[1];
    version = match[2] ? parseInt(match[2]) : null;
    uid = version ? `${id}:${version}` : id;
  } else {
    ({ id, version, versionNonce } = opts);
    uid = id;
  }
  return {
    uid,
    id,
    version,
    versionNonce: versionNonce || randomInteger(),
  };
};

const idsToElements = (ids: (Id | ElementLike)[], cache: Cache = {}) => {
  return syncInvalidIndices(
    ids.reduce((acc, _uid) => {
      const { uid, id, version, versionNonce } = createElement(
        typeof _uid === "string" ? { uid: _uid } : _uid,
      );
      const cached = cache[uid];
      const elem = {
        id,
        version: version ?? 0,
        versionNonce,
        ...cached,
      } as ExcalidrawElement;
      // @ts-ignore
      cache[uid] = elem;
      acc.push(elem);
      return acc;
    }, [] as ExcalidrawElement[]),
  );
};

const test = <U extends `${string}:${"L" | "R"}`>(
  local: (Id | ElementLike)[],
  remote: (Id | ElementLike)[],
  target: U[],
) => {
  const cache: Cache = {};
  const _local = idsToElements(local, cache);
  const _remote = idsToElements(remote, cache);

  const reconciled = reconcileElements(
    cloneJSON(_local),
    cloneJSON(_remote) as RemoteExcalidrawElement[],
    {} as AppState,
  );

  const reconciledIds = reconciled.map((x) => x.id);
  const reconciledIndices = reconciled.map((x) => x.index);

  expect(target.length).toEqual(reconciled.length);
  expect(reconciledIndices.length).toEqual(
    new Set([...reconciledIndices]).size,
  ); // expect no duplicated indices
  assert.deepEqual(
    reconciledIds,
    target.map((uid) => {
      const [, id, source] = uid.match(/^(\w+):([LR])$/)!;
      const element = (source === "L" ? _local : _remote).find(
        (e) => e.id === id,
      )!;

      return element.id;
    }),
    "remote reconciliation",
  );

  // convergent reconciliation on the remote client
  try {
    assert.deepEqual(
      reconcileElements(
        cloneJSON(_remote),
        cloneJSON(_local as RemoteExcalidrawElement[]),
        {} as AppState,
      ).map((x) => x.id),
      reconciledIds,
      "convergent reconciliation",
    );
  } catch (error: any) {
    console.error("local original", _remote);
    console.error("remote original", _local);
    throw error;
  }

  // bidirectional re-reconciliation on remote client
  try {
    assert.deepEqual(
      reconcileElements(
        cloneJSON(_remote),
        cloneJSON(reconciled as unknown as RemoteExcalidrawElement[]),
        {} as AppState,
      ).map((x) => x.id),
      reconciledIds,
      "local re-reconciliation",
    );
  } catch (error: any) {
    console.error("local original", _remote);
    console.error("remote reconciled", reconciled);
    throw error;
  }
};

describe("elements reconciliation", () => {
  it("reconcileElements()", () => {
    // -------------------------------------------------------------------------
    //
    // in following tests, we pass:
    //  (1) an array of local elements and their version (:1, :2...)
    //  (2) an array of remote elements and their version (:1, :2...)
    //  (3) expected reconciled elements
    //
    // in the reconciled array:
    //  :L means local element was resolved
    //  :R means remote element was resolved
    //
    // if versions are missing, it defaults to version 0
    // -------------------------------------------------------------------------

    test(["A:1", "B:1", "C:1"], ["B:2"], ["A:L", "B:R", "C:L"]);
    test(["A:1", "B:1", "C"], ["B:2", "A:2"], ["B:R", "A:R", "C:L"]);
    test(["A:2", "B:1", "C"], ["B:2", "A:1"], ["A:L", "B:R", "C:L"]);
    test(["A:1", "C:1"], ["B:1"], ["A:L", "B:R", "C:L"]);
    test(["A", "B"], ["A:1"], ["A:R", "B:L"]);
    test(["A"], ["A", "B"], ["A:L", "B:R"]);
    test(["A"], ["A:1", "B"], ["A:R", "B:R"]);
    test(["A:2"], ["A:1", "B"], ["A:L", "B:R"]);
    test(["A:2"], ["B", "A:1"], ["A:L", "B:R"]);
    test(["A:1"], ["B", "A:2"], ["B:R", "A:R"]);
    test(["A"], ["A:1"], ["A:R"]);
    test(["A", "B:1", "D"], ["B", "C:2", "A"], ["C:R", "A:R", "B:L", "D:L"]);

    // some of the following tests are kinda arbitrary and they're less
    // likely to happen in real-world cases
    test(["A", "B"], ["B:1", "A:1"], ["B:R", "A:R"]);
    test(["A:2", "B:2"], ["B:1", "A:1"], ["A:L", "B:L"]);
    test(["A", "B", "C"], ["A", "B:2", "G", "C"], ["A:L", "B:R", "G:R", "C:L"]);
    test(["A", "B", "C"], ["A", "B:2", "G"], ["A:R", "B:R", "C:L", "G:R"]);
    test(
      ["A:2", "B:2", "C"],
      ["D", "B:1", "A:3"],
      ["D:R", "B:L", "A:R", "C:L"],
    );
    test(
      ["A:2", "B:2", "C"],
      ["D", "B:2", "A:3", "C"],
      ["D:R", "B:L", "A:R", "C:L"],
    );
    test(
      ["A", "B", "C", "D", "E", "F"],
      ["A", "B:2", "X", "E:2", "F", "Y"],
      ["A:L", "B:R", "X:R", "C:L", "E:R", "D:L", "F:L", "Y:R"],
    );

    // fractional elements (previously annotated)
    test(
      ["A", "B", "C"],
      ["A", "B", "X", "Y", "Z"],
      ["A:R", "B:R", "C:L", "X:R", "Y:R", "Z:R"],
    );

    test(["A"], ["X", "Y"], ["A:L", "X:R", "Y:R"]);
    test(["A"], ["X", "Y", "Z"], ["A:L", "X:R", "Y:R", "Z:R"]);
    test(["A", "B"], ["C", "D", "F"], ["A:L", "C:R", "B:L", "D:R", "F:R"]);

    test(
      ["A", "B", "C", "D"],
      ["C:1", "B", "D:1"],
      ["A:L", "C:R", "B:L", "D:R"],
    );
    test(
      ["A", "B", "C"],
      ["X", "A", "Y", "B", "Z"],
      ["X:R", "A:R", "Y:R", "B:L", "C:L", "Z:R"],
    );
    test(
      ["B", "A", "C"],
      ["X", "A", "Y", "B", "Z"],
      ["X:R", "A:R", "C:L", "Y:R", "B:R", "Z:R"],
    );
    test(["A", "B"], ["A", "X", "Y"], ["A:R", "B:L", "X:R", "Y:R"]);
    test(
      ["A", "B", "C", "D", "E"],
      ["A", "X", "C", "Y", "D", "Z"],
      ["A:R", "B:L", "X:R", "C:R", "Y:R", "D:R", "E:L", "Z:R"],
    );
    test(
      ["X", "Y", "Z"],
      ["A", "B", "C"],
      ["A:R", "X:L", "B:R", "Y:L", "C:R", "Z:L"],
    );
    test(
      ["X", "Y", "Z"],
      ["A", "B", "C", "X", "D", "Y", "Z"],
      ["A:R", "B:R", "C:R", "X:L", "D:R", "Y:L", "Z:L"],
    );
    test(
      ["A", "B", "C", "D", "E"],
      ["C", "X", "A", "Y", "D", "E:1"],
      ["B:L", "C:L", "X:R", "A:R", "Y:R", "D:R", "E:R"],
    );
    test(
      ["C:1", "B", "D:1"],
      ["A", "B", "C:1", "D:1"],
      ["A:R", "B:R", "C:R", "D:R"],
    );

    test(
      ["C:1", "B", "D:1"],
      ["A", "B", "C:2", "D:1"],
      ["A:R", "B:L", "C:R", "D:L"],
    );

    test(
      ["A", "B", "C", "D"],
      ["A", "C:1", "B", "D:1"],
      ["A:L", "C:R", "B:L", "D:R"],
    );

    test(
      ["A", "B", "C", "D"],
      ["C", "X", "B", "Y", "A", "Z"],
      ["C:R", "D:L", "X:R", "B:R", "Y:R", "A:R", "Z:R"],
    );

    test(
      ["A", "B", "C", "D"],
      ["A", "B:1", "C:1"],
      ["A:R", "B:R", "C:R", "D:L"],
    );

    test(
      ["A", "B", "C", "D"],
      ["A", "C:1", "B:1"],
      ["A:R", "C:R", "B:R", "D:L"],
    );

    test(
      ["A", "B", "C", "D"],
      ["A", "C:1", "B", "D:1"],
      ["A:R", "C:R", "B:R", "D:R"],
    );

    test(["A:1", "B:1", "C"], ["B:2"], ["A:L", "B:R", "C:L"]);
    test(["A:1", "B:1", "C"], ["B:2", "C:2"], ["A:L", "B:R", "C:R"]);
    test(["A", "B"], ["A", "C", "B", "D"], ["A:R", "C:R", "B:R", "D:R"]);
    test(["A", "B"], ["B", "C", "D"], ["A:L", "B:R", "C:R", "D:R"]);
    test(["A", "B"], ["C", "D"], ["A:L", "C:R", "B:L", "D:R"]);
    test(["A", "B"], ["A", "B:1"], ["A:L", "B:R"]);
    test(["A:2", "B"], ["A", "B:1"], ["A:L", "B:R"]);
    test(["A:2", "B:2"], ["B:1"], ["A:L", "B:L"]);
    test(["A:2", "B:2"], ["B:1", "C"], ["A:L", "B:L", "C:R"]);
    test(["A:2", "B:2"], ["A", "C", "B:1"], ["A:L", "B:L", "C:R"]);

    // concurrent convergency
    test(["A", "B", "C"], ["A", "B", "D"], ["A:R", "B:R", "C:L", "D:R"]);
    test(["A", "B", "E"], ["A", "B", "D"], ["A:R", "B:R", "D:R", "E:L"]);
    test(
      ["A", "B", "C"],
      ["A", "B", "D", "E"],
      ["A:R", "B:R", "C:L", "D:R", "E:R"],
    );
    test(
      ["A", "B", "E"],
      ["A", "B", "D", "C"],
      ["A:R", "B:R", "D:R", "E:L", "C:R"],
    );
    test(["A", "B"], ["B", "D"], ["A:L", "B:R", "D:R"]);
    test(["C", "A", "B"], ["C", "B", "D"], ["C:R", "A:L", "B:R", "D:R"]);
  });

  it("test identical elements reconciliation", () => {
    const testIdentical = (
      local: ElementLike[],
      remote: ElementLike[],
      expected: Id[],
    ) => {
      const ret = reconcileElements(
        local as unknown as OrderedExcalidrawElement[],
        remote as unknown as RemoteExcalidrawElement[],
        {} as AppState,
      );

      if (new Set(ret.map((x) => x.id)).size !== ret.length) {
        throw new Error("reconcileElements: duplicate elements found");
      }

      assert.deepEqual(
        ret.map((x) => x.id),
        expected,
      );
    };

    // identical id/version/versionNonce/index
    // -------------------------------------------------------------------------

    testIdentical(
      [{ id: "A", version: 1, versionNonce: 1, index: "a0" }],
      [{ id: "A", version: 1, versionNonce: 1, index: "a0" }],
      ["A"],
    );
    testIdentical(
      [
        { id: "A", version: 1, versionNonce: 1, index: "a0" },
        { id: "B", version: 1, versionNonce: 1, index: "a0" },
      ],
      [
        { id: "B", version: 1, versionNonce: 1, index: "a0" },
        { id: "A", version: 1, versionNonce: 1, index: "a0" },
      ],
      ["A", "B"],
    );

    // actually identical (arrays and element objects)
    // -------------------------------------------------------------------------

    const elements1 = [
      {
        id: "A",
        version: 1,
        versionNonce: 1,
        index: "a0",
      },
      {
        id: "B",
        version: 1,
        versionNonce: 1,
        index: "a0",
      },
    ];

    testIdentical(elements1, elements1, ["A", "B"]);
    testIdentical(elements1, elements1.slice(), ["A", "B"]);
    testIdentical(elements1.slice(), elements1, ["A", "B"]);
    testIdentical(elements1.slice(), elements1.slice(), ["A", "B"]);

    const el1 = {
      id: "A",
      version: 1,
      versionNonce: 1,
      index: "a0",
    };
    const el2 = {
      id: "B",
      version: 1,
      versionNonce: 1,
      index: "a0",
    };
    testIdentical([el1, el2], [el2, el1], ["A", "B"]);
  });
});

describe("reconcileElements text style ranges", () => {
  type TextEl = Parameters<typeof withTextStyles>[0];
  type Ranges = NonNullable<TextEl["textStyleRanges"]>;
  type Cleared = NonNullable<TextEl["clearedTextStyleRanges"]>;

  const BASE = "a timeout in the request";

  const textCopy = (
    originalText: string,
    version: number,
    versionNonce: number,
    ranges?: Ranges,
    cleared?: Cleared,
  ) => {
    const el = {
      ...API.createElement({
        type: "text",
        id: "T",
        text: originalText,
        index: "a0" as FractionalIndex,
      }),
      originalText,
      text: originalText,
      version,
      versionNonce,
    } as TextEl;
    return withTextStyles(el, {
      ranges: ranges ?? [],
      cleared: cleared ?? [],
    });
  };

  const both = (a: TextEl, b: TextEl, appState: Partial<AppState> = {}) => {
    const run = (local: TextEl, remote: TextEl) =>
      reconcileElements(
        [cloneJSON(local)] as unknown as OrderedExcalidrawElement[],
        [cloneJSON(remote)] as unknown as RemoteExcalidrawElement[],
        appState as AppState,
      )[0] as TextEl;
    return [run(a, b), run(b, a)] as const;
  };

  const span = (text: string, word: string) => {
    const start = text.indexOf(word);
    return { start, end: start + word.length };
  };

  const range = (
    id: string,
    seq: number,
    text: string,
    word: string,
    color = "#ff0000",
  ) => ({ id, seq, ...span(text, word), color });

  const getText = (el: TextEl, r: { start: number; end: number }) =>
    el.originalText.slice(r.start, r.end);

  const rangesOf = (el: TextEl) => el.textStyleRanges ?? [];
  const clearedOf = (el: TextEl) => el.clearedTextStyleRanges ?? [];
  const idsOf = (el: TextEl) => rangesOf(el).map((r) => r.id);

  it("keeps different ranges from both clients", () => {
    for (const [na, nb] of [
      [1, 2],
      [2, 1],
    ]) {
      const a = textCopy(BASE, 2, na, [range("x", 1, BASE, "timeout")]);
      const b = textCopy(BASE, 2, nb, [range("y", 1, BASE, "request")]);
      for (const res of both(a, b)) {
        expect(idsOf(res)).toEqual(["x", "y"]);
      }
    }
  });

  it("keeps a style through an insert elsewhere", () => {
    const a = textCopy(BASE, 2, 1, [range("x", 1, BASE, "timeout")]);
    const b = textCopy(`so ${BASE}`, 3, 2);
    for (const res of both(a, b)) {
      expect(res.originalText).toBe(`so ${BASE}`);
      expect(rangesOf(res).map((r) => getText(res, r))).toEqual(["timeout"]);
    }
  });

  it("keeps a style through a delete elsewhere", () => {
    const a = textCopy(BASE, 2, 1, [range("x", 1, BASE, "timeout")]);
    const b = textCopy("timeout in the request", 3, 2);
    for (const res of both(a, b)) {
      expect(res.originalText).toBe("timeout in the request");
      expect(rangesOf(res).map((r) => getText(res, r))).toEqual(["timeout"]);
    }
  });

  it("grows a range with an edit inside it", () => {
    const a = textCopy(BASE, 2, 1, [range("x", 1, BASE, "timeout")]);
    const b = textCopy("a time-out in the request", 3, 2);
    for (const res of both(a, b)) {
      expect(rangesOf(res).map((r) => getText(res, r))).toEqual(["time-out"]);
    }
  });

  it("shrinks a range with an edit inside it", () => {
    const a = textCopy(BASE, 2, 1, [range("x", 1, BASE, "timeout")]);
    const b = textCopy("a tout in the request", 3, 2);
    for (const res of both(a, b)) {
      expect(rangesOf(res).map((r) => getText(res, r))).toEqual(["tout"]);
    }
  });

  it("maps loser ranges onto the winning text when both edit", () => {
    const aText = `so ${BASE}`;
    const bText = "a timeout in the end";
    const a = textCopy(aText, 3, 1, [
      range("t", 1, aText, "timeout"),
      range("r", 2, aText, "request", "#00ff00"),
    ]);
    const b = textCopy(bText, 4, 2, [range("t", 1, bText, "timeout")]);
    for (const res of both(a, b)) {
      expect(res.originalText).toBe(bText);
      expect(rangesOf(res).map((r) => getText(res, r))).toEqual(["timeout"]);
      expect(idsOf(res)).toEqual(["t"]);
    }
  });

  it("keeps a winner's range when the loser deleted its characters", () => {
    const bText = `${BASE}!`;
    const a = textCopy("a in the request", 3, 1);
    const b = textCopy(bText, 4, 2, [range("x", 1, bText, "timeout")]);
    for (const res of both(a, b)) {
      expect(res.originalText).toBe(bText);
      expect(rangesOf(res).map((r) => getText(res, r))).toEqual(["timeout"]);
      expect(clearedOf(res)).toEqual([]);
    }
  });

  it("gives one result for overlapping styles", () => {
    const a = textCopy(BASE, 2, 1, [range("a", 1, BASE, "timeout", "#ff0000")]);
    const b = textCopy(BASE, 2, 2, [range("b", 1, BASE, "timeout", "#0000ff")]);
    const [r1, r2] = both(a, b);
    expect(rangesOf(r1)).toEqual(rangesOf(r2));
    expect(idsOf(r1)).toEqual(["a", "b"]);
    const colors = getTextStyleRuns(r1.originalText, 0, rangesOf(r1))
      .filter((run) => run.color)
      .map((run) => run.color);
    expect(colors).toEqual(["#0000ff"]);
  });

  it("does not bring a cleared range back from a stale peer", () => {
    const x = range("x", 1, BASE, "timeout");
    const a = textCopy(BASE, 3, 1, [], [{ id: "x", seq: 1 }]);
    const b = textCopy(BASE, 2, 2, [x]);
    for (const res of both(a, b)) {
      expect(idsOf(res)).toEqual([]);
      expect(clearedOf(res).map((c) => c.id)).toEqual(["x"]);
    }
  });

  it("keeps a clear when the stale peer wins", () => {
    const bText = `so ${BASE}`;
    const a = textCopy(BASE, 3, 1, [], [{ id: "x", seq: 1 }]);
    const b = textCopy(bText, 5, 2, [range("x", 1, bText, "timeout")]);
    for (const res of both(a, b)) {
      expect(res.originalText).toBe(bText);
      expect(idsOf(res)).toEqual([]);
    }
  });

  it("keeps a concurrent range through a clear", () => {
    const a = textCopy(BASE, 3, 1, [], [{ id: "x", seq: 1 }]);
    const b = textCopy(BASE, 2, 2, [
      range("x", 1, BASE, "timeout"),
      range("y", 2, BASE, "timeout", "#0000ff"),
    ]);
    for (const res of both(a, b)) {
      expect(idsOf(res)).toEqual(["y"]);
    }
  });

  const makePairs = (na: number, nb: number) => {
    const longer = `so ${BASE}`;
    return [
      [
        textCopy(BASE, 2, na, [range("x", 1, BASE, "timeout")]),
        textCopy(BASE, 2, nb, [range("y", 1, BASE, "request")]),
      ],
      [
        textCopy(BASE, 2, na, [range("x", 1, BASE, "timeout")]),
        textCopy(longer, 3, nb),
      ],
      [
        textCopy(BASE, 3, na, [], [{ id: "x", seq: 1 }]),
        textCopy(BASE, 2, nb, [range("x", 1, BASE, "timeout")]),
      ],
      [
        textCopy(BASE, 3, na, [], [{ id: "x", seq: 1 }]),
        textCopy(BASE, 2, nb, [
          range("x", 1, BASE, "timeout"),
          range("y", 2, BASE, "timeout", "#0000ff"),
        ]),
      ],
    ] as const;
  };

  it("is independent of which side has the higher nonce", () => {
    for (const [na, nb] of [
      [1, 2],
      [2, 1],
    ]) {
      for (const [a, b] of makePairs(na, nb)) {
        const [r1, r2] = both(a, b);
        expect(rangesOf(r1)).toEqual(rangesOf(r2));
        expect(clearedOf(r1)).toEqual(clearedOf(r2));
      }
    }
  });

  it("changes nothing when a merge is repeated", () => {
    for (const [a, b] of makePairs(1, 2)) {
      const merged = both(a, b)[0];
      const again = [
        reconcileElements(
          [cloneJSON(merged)] as unknown as OrderedExcalidrawElement[],
          [cloneJSON(a)] as unknown as RemoteExcalidrawElement[],
          {} as AppState,
        )[0],
        reconcileElements(
          [cloneJSON(a)] as unknown as OrderedExcalidrawElement[],
          [cloneJSON(merged)] as unknown as RemoteExcalidrawElement[],
          {} as AppState,
        )[0],
      ] as TextEl[];
      for (const res of again) {
        expect(rangesOf(res)).toEqual(rangesOf(merged));
        expect(clearedOf(res)).toEqual(clearedOf(merged));
      }
    }
  });

  it("causes no drift on a version bump tie", () => {
    const a = textCopy(BASE, 2, 1, [range("x", 1, BASE, "timeout")]);
    const b = textCopy(BASE, 2, 2, [range("y", 1, BASE, "request")]);
    const merged = both(a, b)[0];
    const bumped = bumpElementVersions(
      [cloneJSON(merged)] as unknown as OrderedExcalidrawElement[],
      [cloneJSON(a)] as unknown as OrderedExcalidrawElement[],
    );
    const res = reconcileElements(
      bumped,
      [cloneJSON(b)] as unknown as RemoteExcalidrawElement[],
      {} as AppState,
    )[0] as TextEl;
    expect(rangesOf(res)).toEqual(rangesOf(merged));
  });

  it("keeps the winner's version and nonce on merge", () => {
    const a = textCopy(BASE, 2, 5, [range("x", 1, BASE, "timeout")]);
    const b = textCopy(BASE, 3, 7, [range("y", 1, BASE, "request")]);
    for (const res of both(a, b)) {
      expect(idsOf(res)).toEqual(["x", "y"]);
      expect(res.version).toBe(3);
      expect(res.versionNonce).toBe(7);
    }
  });

  it("returns a new object only when the merge changes something", () => {
    const local = textCopy(BASE, 3, 1, [range("x", 1, BASE, "timeout")]);
    const remote = textCopy(BASE, 2, 2, [range("y", 1, BASE, "request")]);
    const merged = reconcileElements(
      [local] as unknown as OrderedExcalidrawElement[],
      [remote] as unknown as RemoteExcalidrawElement[],
      {} as AppState,
    )[0] as TextEl;
    expect(merged).not.toBe(local);
    expect(merged.version).toBe(local.version);
    expect(idsOf(merged)).toEqual(["x", "y"]);

    const plainRemote = textCopy(BASE, 2, 2);
    const same = reconcileElements(
      [local] as unknown as OrderedExcalidrawElement[],
      [plainRemote] as unknown as RemoteExcalidrawElement[],
      {} as AppState,
    )[0];
    expect(same).toBe(local);
  });

  it("keeps remote ranges during an edit", () => {
    const remoteText = `${BASE} more`;
    const local = textCopy(BASE, 3, 1);
    const remote = textCopy(remoteText, 4, 2, [
      range("y", 1, remoteText, "request"),
    ]);
    const res = reconcileElements(
      [local] as unknown as OrderedExcalidrawElement[],
      [remote] as unknown as RemoteExcalidrawElement[],
      { editingTextElement: local } as unknown as AppState,
    )[0] as TextEl;
    expect(res.originalText).toBe(BASE);
    expect(rangesOf(res).map((r) => getText(res, r))).toEqual(["request"]);

    const next = `${BASE}!`;
    const state = remapTextStyles(res, next, undefined)!;
    const committed = withTextStyles(
      newElementWith(res, { originalText: next, text: next }),
      state,
    );
    expect(rangesOf(committed).map((r) => getText(committed, r))).toEqual([
      "request",
    ]);
  });

  it("reconciles unstyled text as before", () => {
    const a = textCopy(BASE, 1, 1);
    const b = textCopy(BASE, 2, 2);
    const res = reconcileElements(
      [a] as unknown as OrderedExcalidrawElement[],
      [b] as unknown as RemoteExcalidrawElement[],
      {} as AppState,
    )[0] as TextEl;
    expect(res.version).toBe(2);
    expect(res).not.toHaveProperty("textStyleRanges");
    expect(res).not.toHaveProperty("clearedTextStyleRanges");

    const c = textCopy(BASE, 2, 1);
    const tie = reconcileElements(
      [c] as unknown as OrderedExcalidrawElement[],
      [b] as unknown as RemoteExcalidrawElement[],
      {} as AppState,
    )[0] as TextEl;
    expect(tie.version).toBe(2);
    expect(tie).not.toHaveProperty("textStyleRanges");
    expect(tie).not.toHaveProperty("clearedTextStyleRanges");
  });

  it("carries over a tombstone that only the loser has", () => {
    const a = textCopy(BASE, 3, 1);
    const b = textCopy(BASE, 2, 2, [], [{ id: "x", seq: 1 }]);
    for (const res of both(a, b)) {
      expect(clearedOf(res)).toEqual([{ id: "x", seq: 1 }]);
    }
  });

  it("keeps the tombstone bound on merge", () => {
    const ca: Cleared = Array.from({ length: 40 }, (_, i) => ({
      id: `a${i}`,
      seq: i * 2 + 1,
    }));
    const cb: Cleared = Array.from({ length: 40 }, (_, i) => ({
      id: `b${i}`,
      seq: i * 2 + 2,
    }));
    const a = textCopy(BASE, 2, 1, [], ca);
    const b = textCopy(BASE, 3, 2, [], cb);
    const [r1, r2] = both(a, b);
    expect(clearedOf(r1)).toHaveLength(MAX_CLEARED_TEXT_STYLE_RANGES);
    expect(Math.min(...clearedOf(r1).map((c) => c.seq))).toBe(
      80 - MAX_CLEARED_TEXT_STYLE_RANGES + 1,
    );
    expect(clearedOf(r1)).toEqual(clearedOf(r2));
  });

  it("keeps the range bound on merge", () => {
    const make = (prefix: string): Ranges =>
      Array.from({ length: MAX_TEXT_STYLE_RANGES }, (_, i) =>
        range(`${prefix}${i}`, i + 1, BASE, "timeout"),
      );
    const ra = make("a");
    const rb = make("b");
    const expected = [...ra, ...rb]
      .sort((x, y) => x.seq - y.seq || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
      .slice(-MAX_TEXT_STYLE_RANGES);

    // remote taken, then remote discarded
    for (const [va, vb] of [
      [2, 3],
      [3, 2],
    ]) {
      const a = textCopy(BASE, va, 1, ra);
      const b = textCopy(BASE, vb, 2, rb);
      const winner = va > vb ? a : b;
      const [r1, r2] = both(a, b);
      for (const res of [r1, r2]) {
        expect(rangesOf(res)).toHaveLength(MAX_TEXT_STYLE_RANGES);
        expect(rangesOf(res)).toEqual(expected);
        expect(res.version).toBe(winner.version);
        expect(res.versionNonce).toBe(winner.versionNonce);
      }
      expect(rangesOf(r1)).toEqual(rangesOf(r2));

      const again = [
        reconcileElements(
          [cloneJSON(r1)] as unknown as OrderedExcalidrawElement[],
          [cloneJSON(a)] as unknown as RemoteExcalidrawElement[],
          {} as AppState,
        )[0],
        reconcileElements(
          [cloneJSON(b)] as unknown as OrderedExcalidrawElement[],
          [cloneJSON(r1)] as unknown as RemoteExcalidrawElement[],
          {} as AppState,
        )[0],
      ] as TextEl[];
      for (const res of again) {
        expect(rangesOf(res)).toEqual(expected);
      }
    }
  });
});
