import {
  applyTextRangeStyle,
  applyTextRangesDelta,
  diffText,
  getTextStyleRuns,
  hashString,
  mapSpanThroughHunks,
  mapTextSpan,
  mergeTextRanges,
  newTextElement,
  sanitizeTextRanges,
  shiftTextRanges,
} from "@excalidraw/element";

import { cloneJSON } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawTextRange,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import { reconcileElements } from "../../data/reconcile";

import { bumpElementVersions, restoreElements } from "../../data/restore";

import type { RemoteExcalidrawElement } from "../../data/reconcile";

import type { AppState } from "../../types";

vi.mock("@excalidraw/element/textDiff", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@excalidraw/element/textDiff")
  >();
  return { ...actual, diffText: vi.fn(actual.diffText) };
});

const T = "Bid request timeout 120ms";
const W = `Urgent: ${T}`;
const RED = "#e03131";

const version = (
  element: ExcalidrawTextElement,
  text: string,
  ver: number,
  versionNonce: number,
): ExcalidrawTextElement => ({
  ...element,
  originalText: text,
  text,
  version: ver,
  versionNonce,
  index: "a0" as any,
});

const run = (
  local: ExcalidrawTextElement,
  remote: ExcalidrawTextElement,
  appState: Partial<AppState> = {},
): ExcalidrawTextElement => {
  return reconcileElements(
    cloneJSON([local]) as unknown as OrderedExcalidrawElement[],
    cloneJSON([remote]) as RemoteExcalidrawElement[],
    appState as AppState,
  )[0] as ExcalidrawTextElement;
};

const sync = (
  local: ExcalidrawTextElement,
  remote: ExcalidrawTextElement,
): ExcalidrawTextElement => {
  const existing = cloneJSON([local]) as unknown as OrderedExcalidrawElement[];
  return bumpElementVersions(
    reconcileElements(
      existing,
      cloneJSON([remote]) as RemoteExcalidrawElement[],
      {} as AppState,
    ),
    existing,
  )[0] as ExcalidrawTextElement;
};

describe("reconcile text ranges", () => {
  let baseElement: ExcalidrawTextElement;

  beforeEach(() => {
    baseElement = {
      ...newTextElement({
        text: T,
        originalText: T,
        x: 0,
        y: 0,
      }),
      id: "elem1",
    };
  });

  it("a losing colour is carried onto the winning text", () => {
    const A = {
      ...version(baseElement, T, 6, 300),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const B = version(baseElement, W, 6, 200);

    const resAB = run(A, B);
    const resBA = run(B, A);

    expect(resAB).toEqual(resBA);
    expect(resAB.originalText).toBe(W);
    expect(resAB.version).toBe(6);
    expect(resAB.versionNonce).toBe(200);

    const range = resAB.textRanges?.ranges[0];
    expect(range?.start).toBe(28);
    expect(range?.end).toBe(33);
    expect(range?.origin).toEqual({
      version: 6,
      versionNonce: 300,
      text: T,
      start: 20,
      end: 25,
    });
    expect(resAB.originalText.slice(range!.start, range!.end)).toBe("120ms");
  });

  it("a winning range edit keeps a losing text's offsets out", () => {
    const A = {
      ...version(baseElement, T, 6, 100),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const B = version(baseElement, W, 6, 200);

    const resAB = run(A, B);
    const resBA = run(B, A);

    expect(resAB).toEqual(resBA);
    expect(resAB.originalText).toBe(T);
    const range = resAB.textRanges?.ranges[0];
    expect(range?.start).toBe(20);
    expect(range?.end).toBe(25);
    expect(range?.origin).toBeUndefined();
  });

  it("both ends of the text changed", () => {
    const A = {
      ...version(baseElement, T, 6, 300),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const B = version(baseElement, `Urgent: ${T}!`, 7, 200);

    const resAB = run(A, B);
    const resBA = run(B, A);

    expect(resAB.textRanges?.ranges[0].start).toBe(28);
    expect(resAB.textRanges?.ranges[0].end).toBe(33);
    expect(resBA.textRanges?.ranges[0].start).toBe(28);
    expect(resBA.textRanges?.ranges[0].end).toBe(33);
  });

  it("the word's edge changed on the winning side", () => {
    const A = {
      ...version(baseElement, T, 6, 300),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const B = version(baseElement, "Bid request timeout 150ms", 7, 200);

    const resAB = run(A, B);
    const resBA = run(B, A);

    expect(resAB.textRanges?.ranges[0].start).toBe(20);
    expect(resAB.textRanges?.ranges[0].end).toBe(25);
    expect(resBA.textRanges?.ranges[0].start).toBe(20);
    expect(resBA.textRanges?.ranges[0].end).toBe(25);
  });

  it("characters gone on the winning side leave nothing visible", () => {
    const A = {
      ...version(baseElement, T, 6, 300),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const B = version(baseElement, "Bid request timeout ", 7, 200);

    const resAB = run(A, B);
    const resBA = run(B, A);

    expect(getTextStyleRuns(resAB)).toEqual([]);
    expect(getTextStyleRuns(resBA)).toEqual([]);

    const rangeAB = resAB.textRanges?.ranges[0];
    expect(rangeAB?.start).toBe(rangeAB?.end);
    expect(rangeAB?.origin).toBeDefined();

    const rangeBA = resBA.textRanges?.ranges[0];
    expect(rangeBA?.start).toBe(rangeBA?.end);
    expect(rangeBA?.origin).toBeDefined();
  });

  it("every arrival order of three versions converges", () => {
    const A = {
      ...version(baseElement, T, 6, 300),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const B = version(baseElement, W, 6, 200);
    const C = version(baseElement, `${T}!`, 7, 100);

    const o1 = run(run(A, B), C);
    const o2 = run(run(A, C), B);
    const o3 = run(run(B, A), C);
    const o4 = run(run(B, C), A);
    const o5 = run(run(C, A), B);
    const o6 = run(run(C, B), A);

    expect(o1).toEqual(o2);
    expect(o2).toEqual(o3);
    expect(o3).toEqual(o4);
    expect(o4).toEqual(o5);
    expect(o5).toEqual(o6);

    const range = o1.textRanges?.ranges[0];
    expect(o1.originalText.slice(range!.start, range!.end)).toBe("120ms");
    expect(o1.version).toBeLessThanOrEqual(7);
  });

  it("an intermediate merge does not change the mapping", () => {
    const A = {
      ...version(baseElement, T, 6, 300),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const B = version(baseElement, W, 6, 200);
    const C = version(baseElement, `${W}!`, 7, 100);

    const abThenC = run(run(A, B), C);
    const aDirectC = run(A, C);

    expect(abThenC).toEqual(aDirectC);
  });

  it("merging keeps the winner's version and nonce", () => {
    const A = {
      ...version(baseElement, T, 6, 300),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const B = version(baseElement, W, 6, 200);

    const res = run(A, B);
    expect(res.version).toBe(B.version);
    expect(res.versionNonce).toBe(B.versionNonce);
  });

  it("only the client that took the remote is bumped", () => {
    const A = {
      ...version(baseElement, T, 6, 300),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const B = version(baseElement, W, 6, 200);

    const a = sync(A, B);
    const b = sync(B, A);

    expect(a.version).toBe(7);
    expect(a.versionNonce).not.toBe(200);

    expect(b.version).toBe(6);
    expect(b.versionNonce).toBe(200);

    expect(a.originalText).toBe(b.originalText);
    expect(a.originalText).toBe(W);
    expect(a.textRanges).toEqual(b.textRanges);

    const rangeA = a.textRanges?.ranges[0];
    expect(rangeA?.start).toBe(28);
    expect(rangeA?.end).toBe(33);
    expect(a.originalText.slice(rangeA!.start, rangeA!.end)).toBe("120ms");
    expect(rangeA?.origin).toEqual({
      version: 6,
      versionNonce: 300,
      text: T,
      start: 20,
      end: 25,
    });

    const rangeB = b.textRanges?.ranges[0];
    expect(rangeB?.origin).toEqual({
      version: 6,
      versionNonce: 300,
      text: T,
      start: 20,
      end: 25,
    });
  });

  it("the next delivery ends the difference in both directions", () => {
    const A = {
      ...version(baseElement, T, 6, 300),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const B = version(baseElement, W, 6, 200);

    const a = sync(A, B);
    const b = sync(B, A);

    const delivery1 = sync(b, a);
    const delivery2 = sync(a, b);
    expect(delivery1).toEqual(a);
    expect(delivery2).toEqual(a);
    expect(a.version).toBe(7);

    const A2 = {
      ...version(baseElement, T, 6, 100),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const a2 = sync(A2, B);
    const b2 = sync(B, A2);

    const delivery3 = sync(a2, b2);
    const delivery4 = sync(b2, a2);
    expect(delivery3).toEqual(b2);
    expect(delivery4).toEqual(b2);
    expect(b2.version).toBe(7);
  });

  it("two bumped clients converge on the delivery after next", () => {
    const A = {
      ...version(baseElement, T, 6, 300),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const B = version(baseElement, W, 6, 200);

    const c = { ...sync(A, B), versionNonce: 500 };
    const d = { ...sync(A, B), versionNonce: 600 };

    const e = sync(d, c);
    const f = sync(c, d);

    expect(e.version).toBe(8);
    expect(f).toEqual(c);
    expect(e.textRanges).toEqual(c.textRanges);

    expect(sync(f, e)).toEqual(e);
    expect(sync(e, f)).toEqual(e);
  });

  it("a bumped register places a record where the unbumped one does", () => {
    const A = version(baseElement, T, 6, 300);
    const withW = version(baseElement, W, 6, 200);
    const B = {
      ...withW,
      textRanges: applyTextRangeStyle(
        withW,
        { start: 28, end: 33 },
        { color: RED },
      ),
    };

    const a = { ...sync(A, B), versionNonce: 500 };
    const b = sync(B, A);

    const C = version(baseElement, `${W}!`, 8, 100);

    const p = run(a, C);
    const q = run(b, C);

    expect(p.textRanges?.ranges[0].start).toBe(28);
    expect(p.textRanges?.ranges[0].end).toBe(33);
    expect(q.textRanges?.ranges[0].start).toBe(28);
    expect(q.textRanges?.ranges[0].end).toBe(33);

    expect(p.textRanges?.ranges[0].origin?.version).toBe(7);
    expect(q.textRanges?.ranges[0].origin?.version).toBe(6);

    expect(run(p, q)).toEqual(p);
    expect(run(q, p)).toEqual(p);
  });

  it("merging again changes nothing", () => {
    const A = {
      ...version(baseElement, T, 6, 300),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const B = version(baseElement, W, 6, 200);

    const merged = run(A, B);

    expect(run(merged, A)).toEqual(merged);
    expect(run(merged, B)).toEqual(merged);

    const cloneMerged = cloneJSON(merged);
    expect(
      reconcileElements(
        [merged] as unknown as OrderedExcalidrawElement[],
        [cloneMerged] as RemoteExcalidrawElement[],
        {} as AppState,
      )[0],
    ).toBe(merged);
  });

  it("a full sync at the same version delivers merged ranges", () => {
    const winnerNoRanges = version(baseElement, W, 6, 200);
    const loserWithRanges = {
      ...version(baseElement, T, 6, 300),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };

    const merged = run(loserWithRanges, winnerNoRanges);

    const res = run(winnerNoRanges, merged);
    expect(res).toEqual(merged);
  });

  it("a removed range stays removed in both orders", () => {
    const base = {
      ...version(baseElement, T, 7, 500),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };

    const A = {
      ...version(base, T, 8, 300),
      textRanges: applyTextRangeStyle(
        base,
        { start: 20, end: 25 },
        { color: null, highlight: null },
      ),
    };

    const B = {
      ...version(base, W, 8, 200),
      textRanges: shiftTextRanges(T, W, base.textRanges),
    };

    expect(getTextStyleRuns(run(A, B))).toEqual([]);
    expect(getTextStyleRuns(run(B, A))).toEqual([]);

    const A2 = { ...A, versionNonce: 200 };
    const B2 = { ...B, versionNonce: 300 };
    expect(getTextStyleRuns(run(A2, B2))).toEqual([]);
    expect(getTextStyleRuns(run(B2, A2))).toEqual([]);

    const BRecolor = {
      ...B,
      textRanges: applyTextRangeStyle(
        B,
        { start: 28, end: 33 },
        { color: "#1971c2" },
      ),
    };
    expect(getTextStyleRuns(run(A, BRecolor))).toEqual([]);
    expect(getTextStyleRuns(run(BRecolor, A))).toEqual([]);
  });

  it("two partial removals do not bring a range back", () => {
    const base = {
      ...version(baseElement, T, 7, 500),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };

    const A = {
      ...version(base, T, 8, 300),
      textRanges: applyTextRangeStyle(
        base,
        { start: 20, end: 23 },
        { color: null, highlight: null },
      ),
    };

    const B = {
      ...version(base, T, 8, 200),
      textRanges: applyTextRangeStyle(
        base,
        { start: 23, end: 25 },
        { color: null, highlight: null },
      ),
    };

    expect(getTextStyleRuns(run(A, B))).toEqual([]);
    expect(getTextStyleRuns(run(B, A))).toEqual([]);
  });

  it("a retired id stays retired", () => {
    const base = {
      ...version(baseElement, T, 7, 500),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };

    const A = {
      ...version(base, T, 8, 300),
      textRanges: {
        textHash: base.textRanges!.textHash,
        ranges: base.textRanges!.ranges.map((r) => ({
          ...r,
          retired: true as const,
        })),
      },
    };

    const B = version(base, T, 9, 200);

    const resAB = run(A, B);
    const resBA = run(B, A);

    expect(resAB.textRanges?.ranges[0].retired).toBe(true);
    expect(resBA.textRanges?.ranges[0].retired).toBe(true);
    expect(getTextStyleRuns(resAB)).toEqual([]);
    expect(getTextStyleRuns(resBA)).toEqual([]);
  });

  it("a deleted styled word leaves nothing on the peer", () => {
    const base = {
      ...version(baseElement, T, 5, 500),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };

    const textDeleted = "Bid request timeout ";
    const A = {
      ...version(base, textDeleted, 6, 200),
      textRanges: shiftTextRanges(T, textDeleted, base.textRanges),
    };

    const resBaseA = run(base, A);
    const resABase = run(A, base);

    expect(resBaseA).toEqual(resABase);
    const rec = resBaseA.textRanges?.ranges[0];
    expect(rec?.start).toBe(rec?.end);
    expect(rec?.origin).toBeUndefined();
    expect(JSON.stringify(resBaseA)).not.toContain("120ms");

    const restored = restoreElements(
      [resBaseA],
      null,
    )[0] as ExcalidrawTextElement;
    expect(restored.textRanges?.ranges.length).toBe(1);
  });

  it("retyping a deleted word stays unstyled on both clients", () => {
    const base = {
      ...version(baseElement, T, 5, 500),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };

    const textDeleted = "Bid request timeout ";
    const A = {
      ...version(base, textDeleted, 6, 200),
      textRanges: shiftTextRanges(T, textDeleted, base.textRanges),
    };

    const A2 = {
      ...version(A, T, 7, 100),
      textRanges: shiftTextRanges(textDeleted, T, A.textRanges),
    };

    const p = run(A, A2);
    const q = run(base, A2);

    expect(p).toEqual(q);
    expect(p.originalText).toBe(T);
    expect(p.textRanges?.ranges[0].start).toBe(p.textRanges?.ranges[0].end);
    expect(p.textRanges?.ranges[0].origin).toBeUndefined();
    expect(getTextStyleRuns(p)).toEqual([]);
  });

  it("a deletion that loses the race keeps the range on the surviving word", () => {
    const base = {
      ...version(baseElement, T, 5, 500),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };

    const textDeleted = "Bid request timeout ";
    const A = {
      ...version(base, textDeleted, 6, 300),
      textRanges: shiftTextRanges(T, textDeleted, base.textRanges),
    };

    const B = {
      ...version(base, W, 6, 200),
      textRanges: shiftTextRanges(T, W, base.textRanges),
    };

    const resAB = run(A, B);
    const resBA = run(B, A);

    expect(resAB).toEqual(resBA);
    expect(resAB.originalText).toBe(W);
    const rec = resAB.textRanges?.ranges[0];
    expect(rec?.start).toBe(28);
    expect(rec?.end).toBe(33);
    expect(resAB.originalText.slice(rec!.start, rec!.end)).toBe("120ms");
    expect(rec?.origin).toBeUndefined();
  });

  it("a deletion that wins the race styles nothing", () => {
    const base = {
      ...version(baseElement, T, 5, 500),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };

    const textDeleted = "Bid request timeout ";
    const A = {
      ...version(base, textDeleted, 6, 100),
      textRanges: shiftTextRanges(T, textDeleted, base.textRanges),
    };

    const B = {
      ...version(base, W, 6, 200),
      textRanges: shiftTextRanges(T, W, base.textRanges),
    };

    const resAB = run(A, B);
    const resBA = run(B, A);

    expect(resAB).toEqual(resBA);
    expect(resAB.originalText).toBe("Bid request timeout ");
    expect(getTextStyleRuns(resAB)).toEqual([]);
    expect(resAB.textRanges?.ranges[0].start).toBe(
      resAB.textRanges?.ranges[0].end,
    );
    expect(resAB.textRanges?.ranges[0].origin).toBeUndefined();
  });

  it("a removal at a repeated character leaves no sliver", () => {
    const baseElem = {
      ...newTextElement({
        text: "ab",
        originalText: "ab",
        x: 0,
        y: 0,
      }),
      id: "elem_rep",
    };
    const base = {
      ...version(baseElem, "ab", 7, 500),
      textRanges: applyTextRangeStyle(
        baseElem,
        { start: 1, end: 2 },
        { color: RED },
      ),
    };

    const A = {
      ...version(base, "ab", 8, 300),
      textRanges: applyTextRangeStyle(
        base,
        { start: 1, end: 2 },
        { color: null, highlight: null },
      ),
    };

    const step1 = shiftTextRanges("ab", "abb", base.textRanges);
    const step2 = shiftTextRanges("abb", "bb", step1);
    const B = {
      ...version(base, "bb", 8, 200),
      textRanges: step2,
    };

    expect(getTextStyleRuns(run(A, B))).toEqual([]);
    expect(getTextStyleRuns(run(B, A))).toEqual([]);

    const A2 = { ...A, versionNonce: 200 };
    const B2 = { ...B, versionNonce: 300 };
    expect(getTextStyleRuns(run(A2, B2))).toEqual([]);
    expect(getTextStyleRuns(run(B2, A2))).toEqual([]);
  });

  it("a partial removal at a repeated character shows only its kept part", () => {
    const baseElem = {
      ...newTextElement({
        text: "abc",
        originalText: "abc",
        x: 0,
        y: 0,
      }),
      id: "elem_rep_part",
    };
    const base = {
      ...version(baseElem, "abc", 7, 500),
      textRanges: applyTextRangeStyle(
        baseElem,
        { start: 1, end: 3 },
        { color: RED },
      ),
    };

    const A = {
      ...version(base, "abc", 8, 300),
      textRanges: applyTextRangeStyle(
        base,
        { start: 1, end: 2 },
        { color: null, highlight: null },
      ),
    };

    const step1 = shiftTextRanges("abc", "abbc", base.textRanges);
    const step2 = shiftTextRanges("abbc", "bbc", step1);
    const B = {
      ...version(base, "bbc", 8, 200),
      textRanges: step2,
    };

    const expected = [{ start: 2, end: 3, color: RED, highlight: null }];

    expect(getTextStyleRuns(run(A, B))).toEqual(expected);
    expect(getTextStyleRuns(run(B, A))).toEqual(expected);

    const A2 = { ...A, versionNonce: 200 };
    const B2 = { ...B, versionNonce: 300 };
    expect(getTextStyleRuns(run(A2, B2))).toEqual(expected);
    expect(getTextStyleRuns(run(B2, A2))).toEqual(expected);
  });

  it("a dropped update's ranges reach the editing client", () => {
    const local = version(baseElement, T, 6, 200);
    const appState = { editingTextElement: local } as unknown as AppState;

    const remote = {
      ...version(baseElement, W, 9, 100),
      textRanges: applyTextRangeStyle(
        version(baseElement, W, 9, 100),
        { start: 28, end: 33 },
        { color: RED },
      ),
    };

    const res = run(local, remote, appState);
    expect(res.originalText).toBe(T);
    expect(res.version).toBe(6);
    const range = res.textRanges?.ranges[0];
    expect(range?.start).toBe(20);
    expect(range?.end).toBe(25);
    expect(res.originalText.slice(range!.start, range!.end)).toBe("120ms");
  });

  it("a dropped update's removal reaches the editing client", () => {
    const local = {
      ...version(baseElement, T, 6, 200),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const appState = { editingTextElement: local } as unknown as AppState;

    const shifted = shiftTextRanges(T, W, local.textRanges);
    const remote = {
      ...version(baseElement, W, 9, 100),
      textRanges: applyTextRangeStyle(
        { originalText: W, textRanges: shifted },
        { start: 28, end: 33 },
        { color: null, highlight: null },
      ),
    };

    const res = run(local, remote, appState);
    expect(res.originalText).toBe(T);
    expect(getTextStyleRuns(res)).toEqual([]);
  });

  it("clients converge once editing ends", () => {
    const local = version(baseElement, T, 6, 200);
    const remote = {
      ...version(baseElement, W, 9, 100),
      textRanges: applyTextRangeStyle(
        version(baseElement, W, 9, 100),
        { start: 28, end: 33 },
        { color: RED },
      ),
    };

    const absorbedLocal = run(local, remote, {
      editingTextElement: local,
    } as unknown as AppState);

    const res1 = run(absorbedLocal, remote);
    const res2 = run(remote, absorbedLocal);

    expect(res1).toEqual(res2);
    expect(res1.originalText).toBe(W);
    expect(res1.version).toBe(9);
  });

  it("elements with no ranges reconcile as today", () => {
    const elemA = version(baseElement, T, 6, 300);
    const elemB = version(baseElement, W, 7, 200);

    const reconciled = reconcileElements(
      [elemA] as unknown as OrderedExcalidrawElement[],
      [elemB] as RemoteExcalidrawElement[],
      {} as AppState,
    );

    expect(reconciled[0]).toBe(elemB);
    expect("textRanges" in reconciled[0]).toBe(false);
  });

  it("merging is pure", () => {
    const A = Object.freeze({
      ...version(baseElement, T, 6, 300),
      textRanges: Object.freeze(
        applyTextRangeStyle(
          baseElement,
          { start: 20, end: 25 },
          { color: RED },
        ),
      ),
    });
    const B = Object.freeze(version(baseElement, W, 6, 200));

    const randomSpy = vi.spyOn(Math, "random");

    let res1: ExcalidrawElement;
    let res2: ExcalidrawElement;
    expect(() => {
      res1 = mergeTextRanges(A, B);
      res2 = mergeTextRanges(A, B);
    }).not.toThrow();

    expect(res1!).toEqual(res2!);
    expect(randomSpy).not.toHaveBeenCalled();

    randomSpy.mockRestore();
  });

  it("a merged element passes restore unchanged", () => {
    const A = {
      ...version(baseElement, T, 6, 300),
      textRanges: applyTextRangeStyle(
        baseElement,
        { start: 20, end: 25 },
        { color: RED },
      ),
    };
    const B = version(baseElement, W, 6, 200);

    const merged = run(A, B);

    const restored = restoreElements(
      [merged],
      null,
    )[0] as ExcalidrawTextElement;
    expect(restored.textRanges).toEqual(merged.textRanges);
  });
});

describe("diff budget", () => {
  const seeded = (length: number, seed: number) => {
    let state = seed;
    let out = "";
    for (let i = 0; i < length; i++) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      out += String.fromCharCode(97 + ((state >>> 16) % 26));
    }
    return out;
  };

  const LONG = seeded(10_000, 12345);

  const element = (
    text: string,
    ver: number,
    versionNonce: number,
    ranges: ExcalidrawTextRange[],
  ): ExcalidrawTextElement => ({
    ...version(
      {
        ...newTextElement({ text: T, originalText: T, x: 0, y: 0 }),
        id: "budget",
      },
      text,
      ver,
      versionNonce,
    ),
    textRanges: { textHash: hashString(text), ranges },
  });

  const carried = (
    id: string,
    z: number,
    text: string,
  ): ExcalidrawTextRange => ({
    id,
    start: 0,
    end: 5,
    z,
    color: RED,
    origin: { version: 1, versionNonce: z, text, start: 10, end: 20 },
  });

  const winner = element(
    LONG,
    9,
    1,
    Array.from({ length: 1024 }, (_, i) =>
      carried(`r${String(i).padStart(4, "0")}`, i + 2, seeded(100, i + 1)),
    ),
  );
  const l1 = element(T, 5, 2, [carried("zzzz", 5000, LONG.slice(5000, 5100))]);
  const l2 = element(
    T,
    4,
    3,
    [0, 1, 2].map((i) => carried(`a${i}`, 1, seeded(100, 5000 + i))),
  );

  it("a merge spends its budget on the highest records first", () => {
    const spy = vi.mocked(diffText);
    spy.mockClear();
    mergeTextRanges(winner, l1);
    const results = spy.mock.results.map((result) => result.value as unknown[]);

    expect(spy).toHaveBeenCalledTimes(1024);
    expect(spy.mock.calls[0][0]).toBe(LONG.slice(5000, 5100));
    for (const call of spy.mock.calls) {
      for (let i = 0; i < 3; i++) {
        expect(call[0]).not.toBe(seeded(100, 5000 + i));
      }
    }
    const multipleHunksCount = results.filter((r) => r.length > 1).length;
    expect(multipleHunksCount).toBeGreaterThan(0);
    expect(multipleHunksCount).toBeLessThan(1024);
    expect(results[results.length - 1].length).toBe(1);
  });

  it("both arrival orders converge when the budget runs out", () => {
    const a = mergeTextRanges(mergeTextRanges(winner, l1), l2);
    const b = mergeTextRanges(mergeTextRanges(winner, l2), l1);
    const top = a.textRanges?.ranges.find((r) => r.id === "zzzz")!;

    expect(a).toEqual(b);
    expect(mergeTextRanges(a, l2)).toBe(a);
    expect(top.start).toBe(5010);
    expect(top.end).toBe(5020);
    expect(a.originalText.slice(top.start, top.end)).toBe(
      LONG.slice(5010, 5020),
    );

    const lowest = a.textRanges?.ranges[0];
    expect(lowest?.id).toBe("r0001");
    expect(lowest?.start).toBe(lowest?.end);
    expect(lowest?.origin).toBeDefined();
  });

  it("a range crosses a change at each end of long text", () => {
    const next = `QQ${LONG.slice(1, 9999)}ZZ`;
    const A = element(T, 5, 2, [
      {
        ...carried("rec", 2, LONG),
        origin: {
          version: 1,
          versionNonce: 2,
          text: LONG,
          start: 5000,
          end: 5010,
        },
      },
    ]);
    const merged = mergeTextRanges(element(next, 9, 1, []), A);
    const record = merged.textRanges!.ranges[0];

    expect(record.start).toBe(5001);
    expect(record.end).toBe(5011);
    expect(next.slice(record.start, record.end)).toBe(LONG.slice(5000, 5010));
  });

  it("two far-apart changes keep a carried range in both arrival orders", () => {
    const NOTE = Array.from(
      { length: 40 },
      (_, i) => `${T} and item ${i}`,
    ).join(" ");
    const at = NOTE.indexOf("item 20");
    const next = `Ad${NOTE.slice(3, NOTE.length - 2)}xx`;

    const baseElement = {
      ...newTextElement({
        text: T,
        originalText: T,
        x: 0,
        y: 0,
      }),
      id: "elem1",
    };

    const A = {
      ...version(baseElement, NOTE, 6, 300),
      textRanges: applyTextRangeStyle(
        { originalText: NOTE },
        { start: at, end: at + 7 },
        { color: RED },
      ),
    };
    const B = version(baseElement, next, 7, 200);

    const resAB = run(A, B);
    const resBA = run(B, A);

    expect(resAB).toEqual(resBA);
    const rec = resAB.textRanges?.ranges[0];
    expect(rec?.start).toBe(at - 1);
    expect(rec?.end).toBe(at + 6);
    expect(next.slice(at - 1, at + 6)).toBe("item 20");
  });
});

describe("diffText alignment and meter", () => {
  const spent = (a: string, b: string) => {
    const meter = { left: 1000000 };
    const hunks = diffText(a, b, meter);
    return { spent: 1000000 - meter.left, hunks };
  };

  const keeps = (oldText: string, newText: string, word: string) => {
    const s = oldText.indexOf(word);
    const m = mapTextSpan(oldText, newText, s, s + word.length);
    return newText.slice(m.start, m.end);
  };

  const tabbed = (text: string) =>
    text
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n");

  it('"abcdefgh" to "stuvwxyz"', () => {
    expect(spent("abcdefgh", "stuvwxyz")).toEqual({
      spent: 62,
      hunks: [{ oldStart: 0, oldEnd: 8, newStart: 0, newEnd: 8 }],
    });
  });

  it('"abcdefghij klm" to "abcdefghij nop"', () => {
    expect(spent("abcdefghij klm", "abcdefghij nop")).toEqual({
      spent: 96,
      hunks: [{ oldStart: 11, oldEnd: 14, newStart: 11, newEnd: 14 }],
    });
  });

  it('"qqq hello brave new world" to "rrr hello brave new world"', () => {
    expect(
      spent("qqq hello brave new world", "rrr hello brave new world"),
    ).toEqual({
      spent: 153,
      hunks: [{ oldStart: 0, oldEnd: 3, newStart: 0, newEnd: 3 }],
    });
  });

  it('"abcabcabc xyz" to "defdefdef uvw"', () => {
    expect(spent("abcabcabc xyz", "defdefdef uvw")).toEqual({
      spent: 106,
      hunks: [{ oldStart: 0, oldEnd: 13, newStart: 0, newEnd: 13 }],
    });
  });

  it('typed character, "hello world" to "hello, world"', () => {
    expect(spent("hello world", "hello, world")).toEqual({
      spent: 1,
      hunks: [{ oldStart: 5, oldEnd: 5, newStart: 5, newEnd: 6 }],
    });
  });

  it("a meter pays for the whole run it reads", () => {
    const letters = (from: number, length: number) =>
      String.fromCharCode(...Array.from({ length }, (_, i) => from + i));
    const short = letters(0x5600, 500);
    const long = letters(0x6000, 1000);
    const a = `${letters(0x4e00, 250)}${short}${letters(0x5000, 250)}${long}q`;
    const b = `${letters(0x5200, 250)}${short}${letters(0x5400, 250)}${long}z`;
    const index = 4 * a.length + b.length;
    const edge = { oldStart: 2000, oldEnd: 2001, newStart: 2000, newEnd: 2001 };
    const bothRuns = [
      { oldStart: 0, oldEnd: 250, newStart: 0, newEnd: 250 },
      { oldStart: 750, oldEnd: 1000, newStart: 750, newEnd: 1000 },
      edge,
    ];

    // long starts where the search first looks, so nothing is read backward.
    expect(diffText(a, b)).toEqual(bothRuns);
    expect(diffText(a, b, { left: index + 1100 })).toEqual(bothRuns);
    expect(diffText(a, b, { left: index + 1000 })).toEqual([
      { oldStart: 0, oldEnd: 1000, newStart: 0, newEnd: 1000 },
      edge,
    ]);
  });

  it('first-gap trim, "x cdefg" to "xy cdefg"', () => {
    expect(diffText("x cdefg", "xy cdefg")).toEqual([
      { oldStart: 1, oldEnd: 1, newStart: 1, newEnd: 2 },
    ]);
  });

  it('surrogate trim end, "a😀b" to "a🨀b"', () => {
    expect(diffText("a😀b", "a🨀b")).toEqual([
      { oldStart: 1, oldEnd: 3, newStart: 1, newEnd: 3 },
    ]);
  });

  it('block end on a shared high surrogate, "Qabcde😀Z" to "Rabcde😁Y"', () => {
    expect(diffText("Qabcde😀Z", "Rabcde😁Y")).toEqual([
      { oldStart: 0, oldEnd: 1, newStart: 0, newEnd: 1 },
      { oldStart: 6, oldEnd: 9, newStart: 6, newEnd: 9 },
    ]);
  });

  it.each([
    ["foo Bid", "foo Before Bid", "Bid"],
    [
      "Bid request timeout 120ms",
      "Bid request timeout 1 second or 120ms",
      "120ms",
    ],
    ["our dashboard shows", "our daily dashboard shows", "dashboard"],
    ["the engineer said", "the escalation engineer said", "engineer"],
    ["Bid request", "Bid and kid request", "Bid"],
    ["the red car", "the red and bed car", "red"],
    ["foo Before Bid", "foo Bid", "Bid"],
    ["foo Bid", "foo BBid", "Bid"],
    ["foo Bid", "foo B Bid", "Bid"],
  ])("addition beside a word: %s -> %s for %s", (a, b, word) => {
    expect(keeps(a, b, word)).toBe(word);
  });

  it.each([
    ["OK", "Not OK at all", "OK"],
    ["v2", "release v2 now", "v2"],
    ["1\n2\n3\n4\n5", tabbed("1\n2\n3\n4\n5"), "3"],
  ])("kept token with no 3-character anchor: %s -> %s for %s", (a, b, word) => {
    expect(keeps(a, b, word)).toBe(word);
  });

  it("1,000 identical lines keep their place on Tab", () => {
    const a = Array.from({ length: 1000 }, () => "the same line again").join(
      "\n",
    );
    const b = tabbed(a);
    for (const i of [0, 1, 499, 500, 998, 999]) {
      const at = i * 20;
      expect(mapTextSpan(a, b, at + 4, at + 8)).toEqual({
        start: at + 4 + (i + 1) * 4,
        end: at + 8 + (i + 1) * 4,
      });
    }
  });

  it("a 200-line note keeps every one-character line", () => {
    const lines = Array.from({ length: 200 }, (_, i) =>
      i % 3 === 0 ? "x" : `line number ${i} of the note`,
    );
    const a = lines.join("\n");
    const b = tabbed(a);

    let at = 0;
    for (let i = 0; i < 200; i++) {
      if (i % 3 === 0) {
        expect(mapTextSpan(a, b, at, at + 1)).toEqual({
          start: at + (i + 1) * 4,
          end: at + 1 + (i + 1) * 4,
        });
      }
      at += lines[i].length + 1;
    }
  });

  it("records sharing one origin text are diffed once", () => {
    const seeded = (length: number, seed: number) => {
      let state = seed;
      let out = "";
      for (let i = 0; i < length; i++) {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        out += String.fromCharCode(97 + ((state >>> 16) % 26));
      }
      return out;
    };

    const sharedOriginText = seeded(100, 999);
    const element = (
      text: string,
      ver: number,
      versionNonce: number,
      ranges: ExcalidrawTextRange[],
    ): ExcalidrawTextElement => ({
      ...version(
        {
          ...newTextElement({ text: T, originalText: T, x: 0, y: 0 }),
          id: "shared_origin_base",
        },
        text,
        ver,
        versionNonce,
      ),
      textRanges: { textHash: hashString(text), ranges },
    });

    const base = element(T, 10, 1, [
      {
        id: "native1",
        start: 0,
        end: 3,
        z: 10,
        color: RED,
      },
    ]);

    const other = element(
      T,
      5,
      2,
      Array.from({ length: 5 }, (_, i) => ({
        id: `c${i}`,
        start: 0,
        end: 5,
        z: i + 1,
        color: RED,
        origin: {
          version: 1,
          versionNonce: i + 1,
          text: sharedOriginText,
          start: 10,
          end: 20,
        },
      })),
    );

    const spy = vi.mocked(diffText);
    spy.mockClear();

    mergeTextRanges(base, other);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("a typed character slides out of a word, past the budget it does not", () => {
    expect(diffText("foo Bid", "foo BBid")).toEqual([
      { oldStart: 4, oldEnd: 4, newStart: 4, newEnd: 5 },
    ]);
    expect(diffText("foo Bid", "foo BBid", { left: 0 })).toEqual([
      { oldStart: 5, oldEnd: 5, newStart: 5, newEnd: 6 },
    ]);
  });

  it("a character typed strictly inside a word still extends it", () => {
    expect(mapTextSpan("foo Bid", "foo Bxid", 4, 7)).toEqual({
      start: 4,
      end: 8,
    });
  });

  it("a diff of 150,000 changed lines returns", () => {
    const lines = (letter: string) => Array(150_000).fill(letter).join("\n");
    const hunks = diffText(lines("a"), lines("b"));
    expect(hunks).toHaveLength(150_000);
    expect(hunks[149_999]).toEqual({
      oldStart: 299_998,
      oldEnd: 299_999,
      newStart: 299_998,
      newEnd: 299_999,
    });
  });

  it("mapping a span reads few hunks of a long list", () => {
    const list = Array.from({ length: 100_000 }, (_, i) => ({
      oldStart: 3 * i,
      oldEnd: 3 * i + 1,
      newStart: 4 * i,
      newEnd: 4 * i + 2,
    }));
    let reads = 0;
    const counted = new Proxy(list, {
      get: (target, key, receiver) => {
        if (typeof key === "string" && /^\d+$/.test(key)) {
          reads++;
        }
        return Reflect.get(target, key, receiver);
      },
    });
    expect(mapSpanThroughHunks(counted, 299_996, 299_999)).toEqual({
      start: 399_995,
      end: 399_999,
    });
    expect(reads).toBeLessThanOrEqual(64);
  });

  it("mapping keeps its answer at hunks that touch", () => {
    const hunks = [
      { oldStart: 2, oldEnd: 4, newStart: 2, newEnd: 2 },
      { oldStart: 4, oldEnd: 4, newStart: 2, newEnd: 5 },
      { oldStart: 6, oldEnd: 8, newStart: 7, newEnd: 8 },
    ];
    const spans = Array.from({ length: 10 }, (_, p) =>
      mapSpanThroughHunks(hunks, p, p + 1),
    );
    expect(spans).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 2 },
      { start: 2, end: 2 },
      { start: 2, end: 6 },
      { start: 6, end: 7 },
      { start: 8, end: 8 },
      { start: 8, end: 8 },
      { start: 8, end: 9 },
      { start: 9, end: 10 },
    ]);
  });
});

describe("origin text storage", () => {
  const NOTE = Array.from({ length: 4000 }, (_, i) => `word${i}`).join(" ");
  const NEXT = `Edited ${NOTE}`;
  const element = (
    text: string,
    ver: number,
    versionNonce: number,
    ranges: ExcalidrawTextRange[],
  ): ExcalidrawTextElement => ({
    ...version(
      {
        ...newTextElement({ text: T, originalText: T, x: 0, y: 0 }),
        id: "stored",
      },
      text,
      ver,
      versionNonce,
    ),
    textRanges: { textHash: hashString(text), ranges },
  });
  const origin = (text: string) => ({ version: 3, versionNonce: 9, text });
  const native = Array.from({ length: 1024 }, (_, i) => ({
    id: `r${String(i).padStart(4, "0")}`,
    start: i * 5,
    end: i * 5 + 4,
    z: i + 1,
    color: RED,
  }));
  const local = element(NOTE, 5, 1, native);
  const winner = element(NEXT, 6, 2, []);
  const merged = mergeTextRanges(winner, local);
  const ranges = merged.textRanges!.ranges;

  it("a merge stores a shared register text once", () => {
    const holders = ranges.filter((r) => r.origin && "text" in r.origin);
    expect(ranges).toHaveLength(1024);
    expect(holders.map((r) => r.id)).toEqual(["r1023"]);
    expect(holders[0].origin).toEqual({
      version: 5,
      versionNonce: 1,
      text: NOTE,
      start: 5115,
      end: 5119,
    });
    expect(ranges[0].origin).toEqual({
      version: 5,
      versionNonce: 1,
      textFrom: "r1023",
      start: 0,
      end: 4,
    });
    expect(JSON.stringify(merged.textRanges).length).toBeLessThan(
      NOTE.length + 1024 * 150,
    );
  });

  it("each distinct text is stored once and stays with the highest record", () => {
    const other = element(T, 4, 3, [
      { ...native[0], origin: { ...origin(T), start: 0, end: 3 } },
      { ...native[1], origin: { ...origin(T), start: 4, end: 7 } },
      { ...native[2], origin: { ...origin(W), start: 0, end: 3 } },
    ]);
    const result = mergeTextRanges(element(NEXT, 6, 2, []), other).textRanges!;
    expect(result.ranges.map((r) => r.origin)).toEqual([
      { version: 3, versionNonce: 9, textFrom: "r0001", start: 0, end: 3 },
      { ...origin(T), start: 4, end: 7 },
      { ...origin(W), start: 0, end: 3 },
    ]);
  });

  it("the shared form changes no offset, and the merge stays idempotent", () => {
    expect(ranges.map((r) => NEXT.slice(r.start, r.end))).toEqual(
      native.map((r) => NOTE.slice(r.start, r.end)),
    );
    expect(mergeTextRanges(merged, local)).toBe(merged);
    expect(run(local, winner)).toEqual(run(winner, local));
    expect(sanitizeTextRanges(merged.textRanges, NEXT)).toBe(merged.textRanges);
  });

  it("a later merge reads a shared text, in either arrival order", () => {
    const third = element(`More ${NEXT}`, 7, 3, []);
    const through = mergeTextRanges(third, merged);
    expect(through).toEqual(mergeTextRanges(third, local));
    expect(
      through.textRanges!.ranges.map((r) =>
        through.originalText.slice(r.start, r.end),
      ),
    ).toEqual(native.map((r) => NOTE.slice(r.start, r.end)));
  });

  it("an undo keeps a shared origin that reads its text", () => {
    const top = ranges[1023];
    const textHash = hashString(NEXT);
    const undone = applyTextRangesDelta(
      merged,
      { textRanges: { textHash, ranges: [top] } },
      { textRanges: { textHash, ranges: [] } },
    )!;
    expect(undone.ranges[1023].retired).toBe(true);
    expect(sanitizeTextRanges(undone, NEXT)?.ranges[0].origin).toEqual(
      ranges[0].origin,
    );
  });

  it("a non-string originalText returns the base", () => {
    for (const value of [123, true, { a: 1 }]) {
      const forged = {
        ...element(T, 9, 1, []),
        originalText: value,
        textRanges: undefined,
      } as unknown as ExcalidrawTextElement;
      const held = {
        ...forged,
        textRanges: {
          textHash: hashString(value as unknown as string),
          ranges: native.slice(1, 2),
        },
      };
      const plain = element(T, 5, 2, native.slice(0, 1));
      expect(mergeTextRanges(forged, plain)).toBe(forged);
      expect(mergeTextRanges(plain, held)).toBe(plain);
    }
  });
});
