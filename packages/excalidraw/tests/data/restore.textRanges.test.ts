import {
  areTextRangesEqual,
  getTextStyleRuns,
  hashString,
} from "@excalidraw/element";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { API } from "../helpers/api";
import * as restore from "../../data/restore";

describe("restoreElements textRanges", () => {
  const T = "Bid request timeout 120ms";

  it("legacy text gets no key", () => {
    const element = API.createElement({ type: "text", text: T });
    const [restored] = restore.restoreElements([element], null);

    expect("textRanges" in restored).toBe(false);
  });

  it("ranges survive save and load", () => {
    const textRanges = {
      textHash: hashString(T),
      ranges: [
        {
          id: "r1",
          start: 4,
          end: 11,
          z: 1,
          color: "#e03131",
        },
      ],
    };
    const element = {
      ...API.createElement({ type: "text", text: T }),
      textRanges,
    };

    const saved = JSON.parse(JSON.stringify(element));
    const [restored] = restore.restoreElements(
      [saved],
      null,
    ) as ExcalidrawTextElement[];

    expect(restored.textRanges).toEqual(textRanges);
  });

  it("valid ranges are the same object", () => {
    const textRanges = {
      textHash: hashString(T),
      ranges: [
        {
          id: "r1",
          start: 0,
          end: 3,
          z: 1,
          color: "#1971c2",
        },
      ],
    };
    const element = {
      ...API.createElement({ type: "text", text: T }),
      textRanges,
    };

    const [restored] = restore.restoreElements(
      [element],
      null,
    ) as ExcalidrawTextElement[];

    expect(restored.textRanges).toBe(textRanges);
  });

  it("a container of the wrong type is dropped", () => {
    const element1 = {
      ...API.createElement({ type: "text", text: T }),
      textRanges: "nope" as any,
    };
    const [restored1] = restore.restoreElements([element1], null);
    expect("textRanges" in restored1).toBe(false);

    const element2 = {
      ...API.createElement({ type: "text", text: T }),
      textRanges: { ranges: 3 } as any,
    };
    const [restored2] = restore.restoreElements([element2], null);
    expect("textRanges" in restored2).toBe(false);
  });

  it("stale ranges are dropped", () => {
    const element = {
      ...API.createElement({ type: "text", text: T }),
      textRanges: {
        textHash: hashString("other"),
        ranges: [
          {
            id: "r1",
            start: 0,
            end: 3,
            z: 1,
            color: "#e03131",
          },
        ],
      },
    };

    const [restored] = restore.restoreElements([element], null);

    expect("textRanges" in restored).toBe(false);
  });

  it("records of the wrong type are dropped", () => {
    const valid = {
      id: "valid",
      start: 0,
      end: 3,
      z: 1,
      color: "#e03131",
    };
    const element = {
      ...API.createElement({ type: "text", text: T }),
      textRanges: {
        textHash: hashString(T),
        ranges: [
          null as any,
          42 as any,
          {
            id: "bad",
            start: "0" as any,
            end: 3,
            z: 1,
            color: "#1971c2",
          },
          valid,
        ],
      },
    };

    const [restored] = restore.restoreElements(
      [element],
      null,
    ) as ExcalidrawTextElement[];

    expect(restored.textRanges?.ranges).toEqual([valid]);
  });

  it("out-of-bounds offsets are clamped", () => {
    const element = {
      ...API.createElement({ type: "text", text: T }),
      textRanges: {
        textHash: hashString(T),
        ranges: [
          {
            id: "r1",
            start: -5,
            end: 900,
            z: 1,
            color: "#e03131",
          },
        ],
      },
    };

    const [restored] = restore.restoreElements(
      [element],
      null,
    ) as ExcalidrawTextElement[];

    expect(restored.textRanges?.ranges[0].start).toBe(0);
    expect(restored.textRanges?.ranges[0].end).toBe(T.length);
  });

  it("an inverted range is dropped", () => {
    const element = {
      ...API.createElement({ type: "text", text: T }),
      textRanges: {
        textHash: hashString(T),
        ranges: [
          {
            id: "r1",
            start: 10,
            end: 5,
            z: 1,
            color: "#e03131",
          },
        ],
      },
    };

    const [restored] = restore.restoreElements([element], null);

    expect("textRanges" in restored).toBe(false);
  });

  it("an unusable colour never survives", () => {
    const element = {
      ...API.createElement({ type: "text", text: T }),
      textRanges: {
        textHash: hashString(T),
        ranges: [
          {
            id: "r1",
            start: 0,
            end: 3,
            z: 1,
            color: '"><script>',
          },
          {
            id: "r2",
            start: 4,
            end: 11,
            z: 2,
            color: "#e03131",
            highlight: 12 as any,
          },
        ],
      },
    };

    const [restored] = restore.restoreElements(
      [element],
      null,
    ) as ExcalidrawTextElement[];

    expect(restored.textRanges?.ranges).toEqual([
      {
        id: "r2",
        start: 4,
        end: 11,
        z: 2,
        color: "#e03131",
      },
    ]);
  });

  it("an overlap resolves to disjoint runs", () => {
    const element = {
      ...API.createElement({ type: "text", text: T }),
      textRanges: {
        textHash: hashString(T),
        ranges: [
          {
            id: "r1",
            start: 0,
            end: 10,
            z: 1,
            color: "#1971c2",
          },
          {
            id: "r2",
            start: 5,
            end: 15,
            z: 2,
            color: "#e03131",
          },
        ],
      },
    };

    const [restored] = restore.restoreElements(
      [element],
      null,
    ) as ExcalidrawTextElement[];

    expect(restored.textRanges?.ranges.length).toBe(2);
    const runs = getTextStyleRuns(restored as any);
    expect(runs).toEqual([
      { start: 0, end: 5, color: "#1971c2", highlight: null },
      { start: 5, end: 15, color: "#e03131", highlight: null },
    ]);
  });

  it("too many ranges are capped", () => {
    const ranges = Array.from({ length: 5000 }, (_, i) => ({
      id: `r${i}`,
      start: 0,
      end: 3,
      z: i,
      color: "#e03131",
    }));
    const element = {
      ...API.createElement({ type: "text", text: T }),
      textRanges: {
        textHash: hashString(T),
        ranges,
      },
    };

    expect(() => {
      const [restored] = restore.restoreElements(
        [element],
        null,
      ) as ExcalidrawTextElement[];
      expect(restored.textRanges?.ranges.length).toBe(1024);
    }).not.toThrow();
  });

  it("retired and collapsed records stay", () => {
    const element = {
      ...API.createElement({ type: "text", text: T }),
      textRanges: {
        textHash: hashString(T),
        ranges: [
          {
            id: "r1",
            start: 0,
            end: 3,
            z: 1,
            color: "#e03131",
            retired: true as const,
          },
          {
            id: "r2",
            start: 4,
            end: 4,
            z: 2,
            color: "#1971c2",
            origin: {
              version: 1,
              versionNonce: 123,
              text: T,
              start: 4,
              end: 11,
            },
          },
          {
            id: "r3",
            start: 12,
            end: 12,
            z: 3,
            color: "#2f9e44",
          },
        ],
      },
    };

    const [restored] = restore.restoreElements(
      [element],
      null,
    ) as ExcalidrawTextElement[];

    expect(restored.textRanges?.ranges.length).toBe(3);
    expect(restored.textRanges?.ranges).toEqual(element.textRanges.ranges);
  });

  it("an invalid origin is removed", () => {
    const element = {
      ...API.createElement({ type: "text", text: T }),
      textRanges: {
        textHash: hashString(T),
        ranges: [
          {
            id: "r1",
            start: 0,
            end: 3,
            z: 1,
            color: "#e03131",
            origin: { version: "x" } as any,
          },
        ],
      },
    };

    const [restored] = restore.restoreElements(
      [element],
      null,
    ) as ExcalidrawTextElement[];

    expect(restored.textRanges?.ranges[0]).toEqual({
      id: "r1",
      start: 0,
      end: 3,
      z: 1,
      color: "#e03131",
    });
    expect("origin" in (restored.textRanges?.ranges[0] ?? {})).toBe(false);
  });

  it("restore is idempotent", () => {
    const element = {
      ...API.createElement({ type: "text", text: T }),
      textRanges: {
        textHash: hashString(T),
        ranges: [
          {
            id: "r1",
            start: 0,
            end: 3,
            z: 1,
            color: "#e03131",
          },
        ],
      },
    };

    const [first] = restore.restoreElements(
      [element],
      null,
    ) as ExcalidrawTextElement[];
    const [second] = restore.restoreElements(
      [first],
      null,
    ) as ExcalidrawTextElement[];

    expect(second.textRanges).toBe(first.textRanges);
  });

  it.each([[123], [true], [{ a: 1 }]])(
    "an originalText of %j falls back to the text",
    (originalText) => {
      const element = {
        ...API.createElement({ type: "text", text: T }),
        originalText,
      } as unknown as ExcalidrawTextElement;
      const [restored] = restore.restoreElements(
        [element],
        null,
      ) as ExcalidrawTextElement[];
      expect(restored.originalText).toBe(T);
    },
  );

  it("a string originalText is kept, and an empty one falls back", () => {
    const element = API.createElement({ type: "text", text: T });
    const [kept, empty] = restore.restoreElements(
      [
        { ...element, originalText: "Bid\nrequest" },
        { ...element, id: "second", originalText: "" },
      ],
      null,
    ) as ExcalidrawTextElement[];
    expect(kept.originalText).toBe("Bid\nrequest");
    expect(empty.originalText).toBe(T);
  });

  describe("shared origins", () => {
    const holder = {
      id: "holder",
      start: 0,
      end: 3,
      z: 2,
      color: "#e03131",
      origin: {
        version: 1,
        versionNonce: 1,
        text: "old text",
        start: 0,
        end: 3,
      },
    };
    const shared = (textFrom: string, end = 3) => ({
      id: "shared",
      start: 0,
      end: 3,
      z: 1,
      color: "#e03131",
      origin: { version: 1, versionNonce: 1, textFrom, start: 0, end },
    });
    const withRanges = (ranges: unknown[]) =>
      restore.restoreElements(
        [
          {
            ...API.createElement({ type: "text", text: T }),
            textRanges: { textHash: hashString(T), ranges },
          } as unknown as ExcalidrawTextElement,
        ],
        null,
      )[0] as ExcalidrawTextElement;
    const originOf = (element: ExcalidrawTextElement, id: string) =>
      element.textRanges?.ranges.find((r) => r.id === id)?.origin;

    it("a shared origin survives restore as the same object", () => {
      const textRanges = {
        textHash: hashString(T),
        ranges: [shared("holder"), holder],
      };
      const element = {
        ...API.createElement({ type: "text", text: T }),
        textRanges,
      };

      const [restored] = restore.restoreElements(
        [element],
        null,
      ) as ExcalidrawTextElement[];

      expect(restored.textRanges).toBe(textRanges);
    });

    it("a shared origin with no holder is removed", () => {
      const restored = withRanges([shared("nobody"), holder]);
      expect(originOf(restored, "shared")).toBeUndefined();
      expect(originOf(restored, "holder")).toBeDefined();
    });

    it("a shared origin past the end of the text is removed", () => {
      const restored = withRanges([shared("holder", 9), holder]);
      expect(originOf(restored, "shared")).toBeUndefined();
    });

    it("a shared origin cannot point at another shared origin", () => {
      const second = { ...shared("holder"), id: "second", z: 3 };
      const restored = withRanges([shared("second"), second, holder]);
      expect(originOf(restored, "shared")).toBeUndefined();
      expect(originOf(restored, "second")).toBeDefined();
    });

    it("a holder the cap drops takes its shared origins with it", () => {
      const many = Array.from({ length: 1024 }, (_, i) => ({
        ...shared("holder"),
        id: `r${i}`,
        z: i + 10,
      }));
      const restored = withRanges([{ ...holder, z: 1 }, ...many]);
      expect(restored.textRanges?.ranges.length).toBe(1024);
      expect(
        restored.textRanges?.ranges.every((r) => r.origin === undefined),
      ).toBe(true);
    });

    it("equality tells a shared origin from a held one", () => {
      const textHash = hashString(T);
      const held = { ...shared("x"), origin: holder.origin };
      expect(
        areTextRangesEqual(
          { textHash, ranges: [shared("a")] },
          { textHash, ranges: [shared("b")] },
        ),
      ).toBe(false);
      expect(
        areTextRangesEqual(
          { textHash, ranges: [shared("a")] },
          { textHash, ranges: [held] },
        ),
      ).toBe(false);
      expect(
        areTextRangesEqual(
          { textHash, ranges: [shared("a")] },
          { textHash, ranges: [shared("a")] },
        ),
      ).toBe(true);
    });
  });
});
