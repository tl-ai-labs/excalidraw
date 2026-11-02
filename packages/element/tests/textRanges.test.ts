import {
  MAX_DIFF_WORK,
  diffText,
  mapSpanThroughHunks,
  mapTextSpan,
} from "../src/textDiff";
import {
  applyTextRangeStyle,
  canonicalizeTextRanges,
  getTextRangesUpdate,
  getTextStyleRuns,
  shiftTextRanges,
} from "../src/textRanges";
import { hashString } from "../src/index";

import type { TextHunk } from "../src/textDiff";
import type { ExcalidrawTextRange, ExcalidrawTextRanges } from "../src/types";

describe("textRanges", () => {
  const T = "Bid request timeout 120ms";
  const RED = "#e03131";
  const BLUE = "#1971c2";
  const YELLOW = "#ffec99";

  describe("diffText", () => {
    it("returns no hunks for equal texts", () => {
      expect(diffText(T, T)).toEqual([]);
    });

    it("finds both ends of a text changed", () => {
      expect(diffText(T, `Urgent: ${T}!`)).toEqual([
        { oldStart: 0, oldEnd: 0, newStart: 0, newEnd: 8 },
        { oldStart: 25, oldEnd: 25, newStart: 33, newEnd: 34 },
      ]);
    });

    it("never splits a surrogate pair", () => {
      expect(diffText("a😀b", "a😁b")).toEqual([
        { oldStart: 1, oldEnd: 3, newStart: 1, newEnd: 3 },
      ]);
    });

    it("drops matches shorter than three", () => {
      expect(diffText("abcdef", "axcyef")).toEqual([
        { oldStart: 1, oldEnd: 4, newStart: 1, newEnd: 4 },
      ]);
    });

    it("a repeating middle keeps both ends", () => {
      const a = `a${"bc".repeat(1000)}d`;
      const b = `e${"bc".repeat(1000)}f`;
      expect(diffText(a, b)).toEqual([
        { oldStart: 0, oldEnd: 1, newStart: 0, newEnd: 1 },
        {
          oldStart: a.length - 1,
          oldEnd: a.length,
          newStart: b.length - 1,
          newEnd: b.length,
        },
      ]);
    });

    it("an empty meter returns the trimmed hunk", () => {
      const a = `a${"bc".repeat(1000)}d`;
      const b = `e${"bc".repeat(1000)}f`;
      const meter = { left: 0 };
      expect(diffText(a, b, meter)).toEqual([
        { oldStart: 0, oldEnd: a.length, newStart: 0, newEnd: b.length },
      ]);
      expect(meter.left).toBe(0);
    });
  });

  describe("diffText on long edits", () => {
    const PROSE =
      "Bid request timeout 120ms applies to every exchange in the primary region. When the auction server misses that window the request is dropped and the slot is sold through the fallback path. Review the latency dashboard before changing this value, and tell the on-call engineer about any change that touches the pricing service.";
    const ADDED =
      "Before the next release the team agreed to review every setting that controls how long a request may wait, and to write down who owns each one. The list below is the current state of that work, and it will change as the review goes on through the rest of the quarter, so please read it again before you rely on any of these numbers. ";
    const DIGITS = Array.from({ length: 2500 }, (_, i) =>
      String(i).padStart(4, "0"),
    ).join("");
    const seeded = (length: number, seed: number) => {
      let state = seed;
      let out = "";
      for (let i = 0; i < length; i++) {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        out += String.fromCharCode(97 + ((state >>> 16) % 26));
      }
      return out;
    };
    const W = seeded(10_000, 12345);

    const repeatTo = (text: string, length: number) => {
      let out = "";
      while (out.length < length) {
        out += `${text} `;
      }
      return out.slice(0, length);
    };
    const proseNote = (lineCount: number) => {
      const lines: string[] = [];
      let at = 0;
      while (lines.length < lineCount) {
        lines.push(PROSE.slice(at, at + 58).trim());
        at = (at + 58) % (PROSE.length - 60);
      }
      return lines.join("\n");
    };
    const digitNote = (lineCount: number) =>
      Array.from({ length: lineCount }, (_, i) =>
        DIGITS.slice(i * 60, i * 60 + 58),
      ).join("\n");
    const indentAll = (text: string) =>
      text
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");
    const spansOf = (text: string): [number, number][] =>
      [...text.matchAll(/[^\s]+/g)].map((match) => [
        match.index!,
        match.index! + match[0].length,
      ]);
    const applyHunks = (
      oldText: string,
      newText: string,
      hunks: readonly TextHunk[],
    ) => {
      let out = "";
      let at = 0;
      for (const hunk of hunks) {
        out +=
          oldText.slice(at, hunk.oldStart) +
          newText.slice(hunk.newStart, hunk.newEnd);
        at = hunk.oldEnd;
      }
      return out + oldText.slice(at);
    };

    it("a word changed at each end of 1,100 characters of prose keeps every word", () => {
      const oldText = repeatTo(PROSE, 1100);
      const lastThe = oldText.lastIndexOf("the ");
      const newText = `Ad${oldText.slice(3, lastThe)}our${oldText.slice(
        lastThe + 3,
      )}`;
      const hunks = diffText(oldText, newText);
      expect(hunks).toEqual([
        { oldStart: 0, oldEnd: 2, newStart: 0, newEnd: 1 },
        {
          oldStart: lastThe,
          oldEnd: lastThe + 3,
          newStart: lastThe - 1,
          newEnd: lastThe + 2,
        },
      ]);
      for (const [start, end] of spansOf(oldText.slice(0, lastThe)).slice(1)) {
        expect(mapSpanThroughHunks(hunks, start, end)).toEqual({
          start: start - 1,
          end: end - 1,
        });
        expect(newText.slice(start - 1, end - 1)).toBe(
          oldText.slice(start, end),
        );
      }
    });

    it("a change at each end of 1,100 generated characters keeps the middle", () => {
      const oldText = seeded(1100, 77);
      const newText = `QQ${oldText.slice(1, 1099)}ZZ`;
      expect(diffText(oldText, newText)).toEqual([
        { oldStart: 0, oldEnd: 1, newStart: 0, newEnd: 2 },
        { oldStart: 1099, oldEnd: 1100, newStart: 1100, newEnd: 1102 },
      ]);
      expect(mapTextSpan(oldText, newText, 500, 510)).toEqual({
        start: 501,
        end: 511,
      });
    });

    it("an exact substring lands at its true position", () => {
      expect(mapTextSpan(DIGITS.slice(5000, 5100), DIGITS, 10, 20)).toEqual({
        start: 5010,
        end: 5020,
      });
      expect(mapTextSpan(W.slice(5000, 5100), W, 10, 20)).toEqual({
        start: 5010,
        end: 5020,
      });
    });

    it("text added at both ends of 10,000 characters keeps the middle", () => {
      expect(mapTextSpan(W, `NEW${W}END`, 5010, 5020)).toEqual({
        start: 5013,
        end: 5023,
      });
    });

    it("long generated additions keep a short text", () => {
      expect(
        mapTextSpan(
          W.slice(0, 100),
          `${W.slice(200, 3200)}${W.slice(0, 100)}${W.slice(3200, 6200)}`,
          10,
          20,
        ),
      ).toEqual({ start: 3010, end: 3020 });
    });

    it("long prose additions on both sides keep the label's words", () => {
      for (const size of [100, 333]) {
        const added = ADDED.slice(0, size);
        const newText = `${added}${T} ${added}`;
        const hunks = diffText(T, newText);
        for (const [start, end] of spansOf(T)) {
          expect(mapSpanThroughHunks(hunks, start, end)).toEqual({
            start: start + size,
            end: end + size,
          });
          expect(newText.slice(start + size, end + size)).toBe(
            T.slice(start, end),
          );
        }
      }
    });

    it("long prose additions on both sides keep a paragraph's words", () => {
      const newText = `${ADDED}${PROSE} ${ADDED}`;
      const hunks = diffText(PROSE, newText);
      for (const [start, end] of spansOf(PROSE)) {
        expect(mapSpanThroughHunks(hunks, start, end)).toEqual({
          start: start + ADDED.length,
          end: end + ADDED.length,
        });
      }
    });

    it("a word added in front that starts with the same letter", () => {
      expect(mapTextSpan("Bid", "Before Bid", 0, 3)).toEqual({
        start: 7,
        end: 10,
      });
      expect(mapTextSpan("Bid", "Bold Bid", 0, 3)).toEqual({
        start: 5,
        end: 8,
      });
      expect(mapTextSpan("Bid", "Before Bid after", 0, 3)).toEqual({
        start: 7,
        end: 10,
      });
    });

    it("text removed around a word keeps the word", () => {
      expect(mapTextSpan("Before Bid", "Bid", 7, 10)).toEqual({
        start: 0,
        end: 3,
      });
    });

    it("a repeat of the whole text stays behind the original", () => {
      expect(diffText("abc", "abcabc")).toEqual([
        { oldStart: 3, oldEnd: 3, newStart: 3, newEnd: 6 },
      ]);
    });

    it("a typed character is the trimmed hunk", () => {
      expect(diffText("ab", "abb")).toEqual([
        { oldStart: 2, oldEnd: 2, newStart: 2, newEnd: 3 },
      ]);
      expect(diffText("Bid request", "Bid requests")).toEqual([
        { oldStart: 11, oldEnd: 11, newStart: 11, newEnd: 12 },
      ]);
    });

    it("indenting every line keeps a range on prose and on digits", () => {
      for (const oldText of [proseNote(24), digitNote(24)]) {
        const at = 1003;
        const lineIndex = oldText.slice(0, at).split("\n").length;
        const newText = indentAll(oldText);
        const ranges = applyTextRangeStyle(
          { originalText: oldText },
          { start: at, end: at + 5 },
          { color: RED },
        );
        const shifted = shiftTextRanges(oldText, newText, ranges);
        const trueStart = at + 4 * lineIndex;
        expect(
          getTextStyleRuns({ originalText: newText, textRanges: shifted }),
        ).toEqual([
          { start: trueStart, end: trueStart + 5, color: RED, highlight: null },
        ]);
        expect(newText.slice(trueStart, trueStart + 5)).toBe(
          oldText.slice(at, at + 5),
        );
      }
    });

    it("outdenting every line keeps a range on prose and on digits", () => {
      for (const oldText of [proseNote(24), digitNote(24)]) {
        const at = 1003;
        const newText = indentAll(oldText);
        const ranges = applyTextRangeStyle(
          { originalText: oldText },
          { start: at, end: at + 5 },
          { color: RED },
        );
        const shifted = shiftTextRanges(oldText, newText, ranges);
        const back = shiftTextRanges(newText, oldText, shifted);
        expect(back?.ranges[0].start).toBe(at);
        expect(back?.ranges[0].end).toBe(at + 5);
      }
    });

    it("indenting 100 identical lines keeps a range on its own line", () => {
      const line = "the same line of text here";
      const oldText = Array(100).fill(line).join("\n");
      const newText = indentAll(oldText);
      const start = 50 * (line.length + 1) + 4;
      expect(mapTextSpan(oldText, newText, start, start + 4)).toEqual({
        start: start + 204,
        end: start + 208,
      });
      expect(newText.slice(start + 204, start + 208)).toBe("same");
    });

    it("a block never starts inside a surrogate pair", () => {
      expect(diffText("q😀defghq", "zz\u{1FA00}defghzz")).toEqual([
        { oldStart: 0, oldEnd: 3, newStart: 0, newEnd: 4 },
        { oldStart: 8, oldEnd: 9, newStart: 9, newEnd: 11 },
      ]);
    });

    it("a meter that runs out keeps what it found", () => {
      const a = `Q${W}Z`;
      const b = `R${W}Y`;
      expect(diffText(a, b, { left: 60_000 })).toEqual([
        { oldStart: 0, oldEnd: 1, newStart: 0, newEnd: 1 },
        { oldStart: 10001, oldEnd: 10002, newStart: 10001, newEnd: 10002 },
      ]);
    });

    it("hostile text stops at the budget", () => {
      const hostileOld = seeded(100_000, 21)
        .replace(/[n-z]/g, "a")
        .replace(/[b-m]/g, "b");
      const hostileNew = seeded(100_000, 22)
        .replace(/[n-z]/g, "a")
        .replace(/[b-m]/g, "b");
      const meter = { left: MAX_DIFF_WORK };
      const hunks = diffText(hostileOld, hostileNew, meter);
      expect(meter.left).toBeLessThanOrEqual(0);
      expect(meter.left).toBeGreaterThanOrEqual(-200_002);
      expect(applyHunks(hostileOld, hostileNew, hunks)).toBe(hostileNew);
    });

    it("a text the meter cannot index is one hunk and costs nothing", () => {
      const meter = { left: 1000 };
      expect(diffText(`Q${W}Z`, `R${W}Y`, meter)).toEqual([
        { oldStart: 0, oldEnd: 10002, newStart: 0, newEnd: 10002 },
      ]);
      expect(meter.left).toBe(1000);
    });
  });

  describe("shifting with text changes", () => {
    it("insertion before a range shifts it", () => {
      const textRanges = applyTextRangeStyle(
        { originalText: T },
        { start: 20, end: 25 },
        { color: RED },
      );
      const nextText = "Bid very request timeout 120ms";
      const shifted = shiftTextRanges(T, nextText, textRanges);
      expect(shifted?.ranges[0].start).toBe(25);
      expect(shifted?.ranges[0].end).toBe(30);
      expect(
        getTextStyleRuns({ originalText: nextText, textRanges: shifted }),
      ).toEqual([{ start: 25, end: 30, color: RED, highlight: null }]);
    });

    it("insertion inside a range extends it", () => {
      const textRanges = applyTextRangeStyle(
        { originalText: T },
        { start: 20, end: 25 },
        { color: RED },
      );
      const nextText = "Bid request timeout 12x0ms";
      const shifted = shiftTextRanges(T, nextText, textRanges);
      expect(shifted?.ranges[0].start).toBe(20);
      expect(shifted?.ranges[0].end).toBe(26);
      expect(
        getTextStyleRuns({ originalText: nextText, textRanges: shifted }),
      ).toEqual([{ start: 20, end: 26, color: RED, highlight: null }]);
    });

    it("deletion before a range shifts it", () => {
      const textRanges = applyTextRangeStyle(
        { originalText: T },
        { start: 20, end: 25 },
        { color: RED },
      );
      const nextText = "request timeout 120ms";
      const shifted = shiftTextRanges(T, nextText, textRanges);
      expect(shifted?.ranges[0].start).toBe(16);
      expect(shifted?.ranges[0].end).toBe(21);
      expect(
        getTextStyleRuns({ originalText: nextText, textRanges: shifted }),
      ).toEqual([{ start: 16, end: 21, color: RED, highlight: null }]);
    });

    it("deletion inside a range shrinks it", () => {
      const textRanges = applyTextRangeStyle(
        { originalText: T },
        { start: 20, end: 25 },
        { color: RED },
      );
      const nextText = "Bid request timeout 1ms";
      const shifted = shiftTextRanges(T, nextText, textRanges);
      expect(shifted?.ranges[0].start).toBe(20);
      expect(shifted?.ranges[0].end).toBe(23);
      expect(
        getTextStyleRuns({ originalText: nextText, textRanges: shifted }),
      ).toEqual([{ start: 20, end: 23, color: RED, highlight: null }]);
    });

    it("a range whose characters are all deleted styles nothing", () => {
      const textRanges = applyTextRangeStyle(
        { originalText: T },
        { start: 20, end: 25 },
        { color: RED },
      );
      const nextText = "Bid request timeout ";
      const shifted = shiftTextRanges(T, nextText, textRanges);
      expect(shifted?.ranges.length).toBe(1);
      expect(shifted?.ranges[0].start).toBe(20);
      expect(shifted?.ranges[0].end).toBe(20);
      expect(shifted?.ranges[0].origin).toBeUndefined();
      expect(shifted?.textHash).toBe(hashString(nextText));
      expect(
        getTextStyleRuns({ originalText: nextText, textRanges: shifted }),
      ).toEqual([]);
    });

    it("retyping deleted text does not reopen its range", () => {
      const textRanges = applyTextRangeStyle(
        { originalText: T },
        { start: 20, end: 25 },
        { color: RED },
      );
      const deletedText = "Bid request timeout ";
      const shifted1 = shiftTextRanges(T, deletedText, textRanges);
      const shifted2 = shiftTextRanges(deletedText, T, shifted1);

      expect(shifted2?.ranges.length).toBe(1);
      expect(shifted2?.ranges[0].start).toBe(25);
      expect(shifted2?.ranges[0].end).toBe(25);
      expect(
        getTextStyleRuns({ originalText: T, textRanges: shifted2 }),
      ).toEqual([]);
    });

    it("insertion at a range's start does not extend it", () => {
      const textRanges = applyTextRangeStyle(
        { originalText: T },
        { start: 20, end: 25 },
        { color: RED },
      );
      const nextText = "Bid request timeout x120ms";
      const shifted = shiftTextRanges(T, nextText, textRanges);
      expect(shifted?.ranges[0].start).toBe(21);
      expect(shifted?.ranges[0].end).toBe(26);
    });

    it("insertion at a range's end does not extend it", () => {
      const textRanges = applyTextRangeStyle(
        { originalText: T },
        { start: 20, end: 25 },
        { color: RED },
      );
      const nextText = `${T}x`;
      const shifted = shiftTextRanges(T, nextText, textRanges);
      expect(shifted?.ranges[0].start).toBe(20);
      expect(shifted?.ranges[0].end).toBe(25);
    });

    it("replacing a selection inside a range keeps it", () => {
      const textRanges = applyTextRangeStyle(
        { originalText: T },
        { start: 20, end: 25 },
        { color: RED },
      );
      const nextText = "Bid request timeout 1999ms";
      const shifted = shiftTextRanges(T, nextText, textRanges);
      expect(shifted?.ranges[0].start).toBe(20);
      expect(shifted?.ranges[0].end).toBe(26);
    });

    it("shiftTextRanges with equal texts is the identity", () => {
      const textRanges = applyTextRangeStyle(
        { originalText: T },
        { start: 20, end: 25 },
        { color: RED },
      );
      expect(shiftTextRanges(T, T, textRanges)).toBe(textRanges);
    });

    it("shiftTextRanges leaves a stale container alone", () => {
      const staleContainer: ExcalidrawTextRanges = {
        textHash: 999999,
        ranges: [{ id: "r1", start: 20, end: 25, z: 1, color: RED }],
      };
      expect(shiftTextRanges(T, "other text", staleContainer)).toBe(
        staleContainer,
      );
    });

    it("shiftTextRanges does not mutate its input", () => {
      const textRanges = applyTextRangeStyle(
        { originalText: T },
        { start: 20, end: 25 },
        { color: RED },
      );
      const clone = JSON.parse(JSON.stringify(textRanges));
      shiftTextRanges(T, "Bid request timeout 12x0ms", textRanges);
      expect(textRanges).toEqual(clone);
    });

    it("a retired range survives deletion of its characters", () => {
      const retiredContainer: ExcalidrawTextRanges = {
        textHash: hashString(T),
        ranges: [
          {
            id: "r1",
            start: 20,
            end: 25,
            z: 1,
            color: RED,
            retired: true,
          },
        ],
      };
      const nextText = "Bid request timeout ";
      const shifted = shiftTextRanges(T, nextText, retiredContainer);
      expect(shifted?.ranges).toEqual([
        {
          id: "r1",
          start: 20,
          end: 20,
          z: 1,
          color: RED,
          retired: true,
        },
      ]);
    });

    it("shifting drops origin", () => {
      const containerWithOrigin: ExcalidrawTextRanges = {
        textHash: hashString(T),
        ranges: [
          {
            id: "r1",
            start: 20,
            end: 25,
            z: 1,
            color: RED,
            origin: {
              version: 1,
              versionNonce: 123,
              text: T,
              start: 20,
              end: 25,
            },
          },
        ],
      };
      const shifted = shiftTextRanges(
        T,
        "Bid request timeout 120ms!",
        containerWithOrigin,
      );
      expect(shifted?.ranges.some((r) => "origin" in r)).toBe(false);
    });

    it("getTextRangesUpdate is empty with no ranges", () => {
      expect(getTextRangesUpdate({ originalText: T }, "Next text")).toEqual({});
    });
  });

  describe("style operations", () => {
    it("a colour over part of a range wins there", () => {
      const base = applyTextRangeStyle(
        { originalText: T },
        { start: 0, end: 10 },
        { color: RED },
      );
      const next = applyTextRangeStyle(
        { originalText: T, textRanges: base },
        { start: 3, end: 5 },
        { color: BLUE },
      );
      expect(getTextStyleRuns({ originalText: T, textRanges: next })).toEqual([
        { start: 0, end: 3, color: RED, highlight: null },
        { start: 3, end: 5, color: BLUE, highlight: null },
        { start: 5, end: 10, color: RED, highlight: null },
      ]);
    });

    it("colour and highlight are independent", () => {
      const base = applyTextRangeStyle(
        { originalText: T },
        { start: 0, end: 5 },
        { color: RED },
      );
      const next = applyTextRangeStyle(
        { originalText: T, textRanges: base },
        { start: 3, end: 8 },
        { highlight: YELLOW },
      );
      expect(getTextStyleRuns({ originalText: T, textRanges: next })).toEqual([
        { start: 0, end: 3, color: RED, highlight: null },
        { start: 3, end: 5, color: RED, highlight: YELLOW },
        { start: 5, end: 8, color: null, highlight: YELLOW },
      ]);
    });

    it("removing a style splits a range", () => {
      const base = applyTextRangeStyle(
        { originalText: T },
        { start: 0, end: 10 },
        { color: RED },
      );
      const next = applyTextRangeStyle(
        { originalText: T, textRanges: base },
        { start: 3, end: 5 },
        { color: null, highlight: null },
      );
      expect(getTextStyleRuns({ originalText: T, textRanges: next })).toEqual([
        { start: 0, end: 3, color: RED, highlight: null },
        { start: 5, end: 10, color: RED, highlight: null },
      ]);
    });

    it("a removal retires what it fully covers", () => {
      const base = applyTextRangeStyle(
        { originalText: T },
        { start: 20, end: 25 },
        { color: RED },
      );
      const next = applyTextRangeStyle(
        { originalText: T, textRanges: base },
        { start: 20, end: 25 },
        { color: null, highlight: null },
      );
      expect(next?.ranges.length).toBe(2);
      expect(next?.ranges[0].start).toBe(20);
      expect(next?.ranges[0].end).toBe(25);
      expect(next?.ranges[0].color).toBe(RED);
      expect(next?.ranges[0].retired).toBe(true);
      expect(next?.ranges[1].start).toBe(20);
      expect(next?.ranges[1].end).toBe(25);
      expect(next?.ranges[1].color).toBeNull();
      expect(next?.ranges[1].highlight).toBeNull();
      expect(next?.ranges[1].z).toBe(2);
      expect(getTextStyleRuns({ originalText: T, textRanges: next })).toEqual(
        [],
      );
    });

    it("a partial removal retires the record and keeps its remainder", () => {
      const base = applyTextRangeStyle(
        { originalText: T },
        { start: 0, end: 10 },
        { color: RED },
      );
      const originalId = base?.ranges[0].id;
      const next = applyTextRangeStyle(
        { originalText: T, textRanges: base },
        { start: 3, end: 5 },
        { color: null, highlight: null },
      );

      expect(next?.ranges.length).toBe(4);
      const originalRecord = next?.ranges.find((r) => r.id === originalId);
      expect(originalRecord).toBeDefined();
      expect(originalRecord?.retired).toBe(true);

      const keptParts = next?.ranges.filter(
        (r) => r.color === RED && !r.retired,
      );
      expect(keptParts?.length).toBe(2);
      expect(keptParts?.[0].start).toBe(0);
      expect(keptParts?.[0].end).toBe(3);
      expect(keptParts?.[0].z).toBe(1);
      expect(keptParts?.[0].id).not.toBe(originalId);
      expect(keptParts?.[0].retired).toBeUndefined();

      expect(keptParts?.[1].start).toBe(5);
      expect(keptParts?.[1].end).toBe(10);
      expect(keptParts?.[1].z).toBe(1);
      expect(keptParts?.[1].id).not.toBe(originalId);
      expect(keptParts?.[1].retired).toBeUndefined();

      const clearRecord = next?.ranges.find(
        (r) => r.color === null && r.highlight === null,
      );
      expect(clearRecord).toBeDefined();
      expect(clearRecord?.start).toBe(3);
      expect(clearRecord?.end).toBe(5);
      expect(clearRecord?.z).toBe(2);
    });

    it("a removal leaves an attribute it does not clear", () => {
      const r1 = applyTextRangeStyle(
        { originalText: T },
        { start: 0, end: 5 },
        { color: RED },
      );
      const r2 = applyTextRangeStyle(
        { originalText: T, textRanges: r1 },
        { start: 0, end: 5 },
        { highlight: YELLOW },
      );
      const next = applyTextRangeStyle(
        { originalText: T, textRanges: r2 },
        { start: 0, end: 5 },
        { highlight: null },
      );

      const redRecord = next?.ranges.find(
        (r) => r.color === RED && r.highlight === undefined,
      );
      expect(redRecord?.retired).toBeUndefined();

      const yellowRecord = next?.ranges.find((r) => r.highlight === YELLOW);
      expect(yellowRecord?.retired).toBe(true);

      expect(getTextStyleRuns({ originalText: T, textRanges: next })).toEqual([
        { start: 0, end: 5, color: RED, highlight: null },
      ]);
    });

    it("a removal does not retire a record it does not touch", () => {
      const r1 = applyTextRangeStyle(
        { originalText: T },
        { start: 0, end: 3 },
        { color: RED },
      );
      const r2 = applyTextRangeStyle(
        { originalText: T, textRanges: r1 },
        { start: 5, end: 8 },
        { color: BLUE },
      );
      const next = applyTextRangeStyle(
        { originalText: T, textRanges: r2 },
        { start: 0, end: 3 },
        { color: null, highlight: null },
      );

      const blueRecord = next?.ranges.find((r) => r.color === BLUE);
      expect(blueRecord?.retired).toBeUndefined();
      expect(getTextStyleRuns({ originalText: T, textRanges: next })).toEqual([
        { start: 5, end: 8, color: BLUE, highlight: null },
      ]);
    });

    it("a colour pick retires nothing", () => {
      const r1 = applyTextRangeStyle(
        { originalText: T },
        { start: 0, end: 10 },
        { color: RED },
      );
      const r2 = applyTextRangeStyle(
        { originalText: T, textRanges: r1 },
        { start: 0, end: 10 },
        { color: BLUE },
      );
      expect(r2?.ranges.some((r) => r.retired)).toBe(false);
    });

    it("a clear beats a colour at equal z", () => {
      const crafted: ExcalidrawTextRanges = {
        textHash: hashString(T),
        ranges: [
          { id: "a", start: 0, end: 5, z: 1, color: RED },
          { id: "b", start: 0, end: 5, z: 1, color: null },
        ],
      };
      expect(
        getTextStyleRuns({ originalText: T, textRanges: crafted }),
      ).toEqual([]);
    });

    it("higher id wins at equal z", () => {
      const crafted: ExcalidrawTextRanges = {
        textHash: hashString(T),
        ranges: [
          { id: "a", start: 0, end: 5, z: 1, color: RED },
          { id: "b", start: 0, end: 5, z: 1, color: BLUE },
        ],
      };
      expect(
        getTextStyleRuns({ originalText: T, textRanges: crafted }),
      ).toEqual([{ start: 0, end: 5, color: BLUE, highlight: null }]);
    });

    it("a no-op leaves an element with no ranges without the key", () => {
      const res = applyTextRangeStyle(
        { originalText: T },
        { start: 0, end: 5 },
        { color: null, highlight: null },
      );
      expect(res).toBeUndefined();
    });

    it("the same colour again adds nothing", () => {
      const base = applyTextRangeStyle(
        { originalText: T },
        { start: 0, end: 5 },
        { color: RED },
      );
      const next = applyTextRangeStyle(
        { originalText: T, textRanges: base },
        { start: 0, end: 5 },
        { color: RED },
      );
      expect(next).toBe(base);
    });

    it("a transparent highlight is stored as a clear", () => {
      const base = applyTextRangeStyle(
        { originalText: T },
        { start: 0, end: 5 },
        { highlight: YELLOW },
      );
      const next = applyTextRangeStyle(
        { originalText: T, textRanges: base },
        { start: 0, end: 5 },
        { highlight: "transparent" },
      );
      const clearRecord = next?.ranges.find((r) => r.z === 2);
      expect(clearRecord?.highlight).toBeNull();
      expect(getTextStyleRuns({ originalText: T, textRanges: next })).toEqual(
        [],
      );
    });

    it("a style operation drops origin", () => {
      const containerWithOrigin: ExcalidrawTextRanges = {
        textHash: hashString(T),
        ranges: [
          {
            id: "r1",
            start: 0,
            end: 5,
            z: 1,
            color: RED,
            origin: {
              version: 1,
              versionNonce: 123,
              text: T,
              start: 0,
              end: 5,
            },
          },
        ],
      };
      const next = applyTextRangeStyle(
        { originalText: T, textRanges: containerWithOrigin },
        { start: 10, end: 15 },
        { color: BLUE },
      );
      expect(next?.ranges.some((r) => "origin" in r)).toBe(false);
    });
  });

  describe("canonicalizeTextRanges", () => {
    it("canonicalizeTextRanges keeps the top of the stack", () => {
      const records: ExcalidrawTextRange[] = [];
      for (let i = 1; i <= 1100; i++) {
        records.push({
          id: `id-${i}`,
          start: 0,
          end: 5,
          z: i,
          color: RED,
        });
      }
      // Shuffle records
      for (let i = records.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [records[i], records[j]] = [records[j], records[i]];
      }

      const canonicalized = canonicalizeTextRanges(records);
      expect(canonicalized.length).toBe(1024);
      expect(canonicalized[0].z).toBe(77);
      expect(canonicalized[canonicalized.length - 1].z).toBe(1100);
      for (let i = 0; i < canonicalized.length - 1; i++) {
        expect(canonicalized[i].z).toBeLessThanOrEqual(canonicalized[i + 1].z);
      }
    });
  });
});
