import {
  MAX_TEXT_RANGES,
  applyTextRangeStyle,
  getLineTextRuns,
  getUniformTextRangeStyle,
  normalizeTextRanges,
  projectTextRangesOntoLines,
  shiftTextRanges,
  shiftTextRangesAtOffset,
  splitTextIntoStyledSegments,
} from "../src/textStyles";

import type { FontString, TextRangeStyle } from "../src/types";

describe("textStyles", () => {
  const font = "10px Cascadia, Segoe UI Emoji" as FontString;

  describe("normalizeTextRanges", () => {
    it("normalizes, clamps, merges adjacent, and resolves overlapping ranges", () => {
      expect(normalizeTextRanges(null, 10, "#1e1e1e")).toBeUndefined();
      expect(normalizeTextRanges("invalid", 10, "#1e1e1e")).toBeUndefined();
      expect(
        normalizeTextRanges([{ start: 0, end: 5, color: "#ff0000" }], 0),
      ).toBeUndefined();

      const raw = [
        null,
        { start: NaN, end: 5, color: "#ff0000" },
        { start: 5, end: 5, color: "#ff0000" },
        { start: 8, end: 3, color: "#ff0000" },
        { start: 0, end: 4, color: "transparent" },
        { start: 0, end: 4, color: "#1E1E1E" },
        { start: -3, end: 3.9, color: " #ff0000 ", extra: "ignored" },
        { start: 3, end: 6, color: "#ff0000" },
        { start: 4, end: 8, highlight: "#ffff00" },
        { start: 7, end: 25, color: "#00ff00" },
      ];

      const normalized = normalizeTextRanges(raw, 10, "#1e1e1e");
      expect(normalized).toEqual([
        { start: 0, end: 4, color: "#ff0000" },
        { start: 4, end: 6, color: "#ff0000", highlight: "#ffff00" },
        { start: 6, end: 7, highlight: "#ffff00" },
        { start: 7, end: 8, color: "#00ff00", highlight: "#ffff00" },
        { start: 8, end: 10, color: "#00ff00" },
      ]);

      expect(
        normalizeTextRanges(
          [
            { start: 0, end: 5, color: "transparent" },
            { start: 2, end: 8, color: "#1e1e1e", highlight: "transparent" },
          ],
          10,
          "#1e1e1e",
        ),
      ).toBeUndefined();
    });

    it("rejects unsafe, overlong, or transparent colors and keeps valid CSS colors", () => {
      const overlongColor = `#${"a".repeat(64)}`;
      expect(overlongColor).toHaveLength(65);

      const normalized = normalizeTextRanges(
        [
          { start: 0, end: 2, color: "url(#x)" },
          { start: 2, end: 4, highlight: "url(https://example.com/a)" },
          { start: 4, end: 6, color: overlongColor },
          { start: 6, end: 8, highlight: "rgba(0,0,0,0)" },
          {
            start: 8,
            end: 10,
            color: "url(#x)",
            highlight: "#e03131",
          },
          {
            start: 10,
            end: 12,
            color: "red",
            highlight: "url(https://example.com/a)",
          },
          {
            start: 12,
            end: 14,
            color: "rgb(1,2,3)",
            highlight: "#e03131",
          },
        ],
        20,
        "#1e1e1e",
      );

      expect(normalized).toEqual([
        { start: 8, end: 10, highlight: "#e03131" },
        { start: 10, end: 12, color: "#ff0000" },
        { start: 12, end: 14, color: "#010203", highlight: "#e03131" },
      ]);

      expect(
        normalizeTextRanges(
          [
            { start: 0, end: 5, color: "url(#x)" },
            { start: 0, end: 5, highlight: "url(https://example.com/a)" },
            { start: 0, end: 5, color: overlongColor },
            { start: 0, end: 5, highlight: "rgba(0,0,0,0)" },
          ],
          10,
          "#1e1e1e",
        ),
      ).toBeUndefined();
    });

    it("caps processed ranges at MAX_TEXT_RANGES to prevent DoS on pathological inputs", () => {
      const total = 50000;
      const textLength = 100;
      const input = Array.from({ length: total }, (_, i) => ({
        start: i % 50,
        end: 50 + (i % 50),
        color: i % 2 ? "#e03131" : "#1971c2",
      }));

      const t0 = performance.now();
      const result = normalizeTextRanges(input, textLength, "#1e1e1e");
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(1000);
      expect(result).toBeDefined();
      expect(result).toEqual(
        normalizeTextRanges(
          input.slice(0, MAX_TEXT_RANGES),
          textLength,
          "#1e1e1e",
        ),
      );
    });

    it("canonicalizes colors containing extra tokens or payloads to hex via colorToHex", () => {
      expect(
        normalizeTextRanges(
          [
            { start: 0, end: 4, color: "url(#x) rgb(1,2,3)" },
            { start: 4, end: 8, highlight: 'rgb(1,2,3)" onload="x' },
          ],
          10,
          "#1e1e1e",
        ),
      ).toEqual([
        { start: 0, end: 4, color: "#010203" },
        { start: 4, end: 8, highlight: "#010203" },
      ]);
    });

    it("caps getUniformTextRangeStyle, shiftTextRangesAtOffset, and splitTextIntoStyledSegments at MAX_TEXT_RANGES", () => {
      const textLength = 100;
      const text = "a".repeat(textLength);
      const input = Array.from({ length: 50000 }, (_, i) => ({
        start: i % 50,
        end: 50 + (i % 50),
        color: i % 2 ? "#e03131" : "#1971c2",
      }));
      const sliced = input.slice(0, MAX_TEXT_RANGES);

      const t0Uniform = performance.now();
      const uniformRes = getUniformTextRangeStyle(input, 0, 100, "color");
      const elapsedUniform = performance.now() - t0Uniform;
      expect(elapsedUniform).toBeLessThan(1000);
      expect(uniformRes).toEqual(
        getUniformTextRangeStyle(sliced, 0, 100, "color"),
      );

      const t0Shift = performance.now();
      const shiftRes = shiftTextRangesAtOffset(input, 10, 0, 5, textLength + 5);
      const elapsedShift = performance.now() - t0Shift;
      expect(elapsedShift).toBeLessThan(1000);
      expect(shiftRes).toEqual(
        shiftTextRangesAtOffset(sliced, 10, 0, 5, textLength + 5),
      );

      const t0Split = performance.now();
      const splitRes = splitTextIntoStyledSegments(text, input, 0);
      const elapsedSplit = performance.now() - t0Split;
      expect(elapsedSplit).toBeLessThan(1000);
      expect(splitRes).toEqual(splitTextIntoStyledSegments(text, sliced, 0));
    });
  });

  describe("applyTextRangeStyle & getUniformTextRangeStyle", () => {
    it("applies and clears colour and highlight independently across overlapping spans", () => {
      const textLength = 10;
      const baseStroke = "#1e1e1e";

      let ranges = applyTextRangeStyle(
        undefined,
        textLength,
        { start: 0, end: 10 },
        { color: "#e03131" },
        baseStroke,
      );
      expect(ranges).toEqual([{ start: 0, end: 10, color: "#e03131" }]);
      expect(getUniformTextRangeStyle(ranges, 0, 10, "color")).toBe("#e03131");
      expect(getUniformTextRangeStyle(ranges, 0, 10, "highlight")).toBeNull();

      ranges = applyTextRangeStyle(
        ranges,
        textLength,
        { start: 3, end: 7 },
        { highlight: "#fff3bf" },
        baseStroke,
      );
      expect(ranges).toEqual([
        { start: 0, end: 3, color: "#e03131" },
        { start: 3, end: 7, color: "#e03131", highlight: "#fff3bf" },
        { start: 7, end: 10, color: "#e03131" },
      ]);
      expect(getUniformTextRangeStyle(ranges, 0, 10, "color")).toBe("#e03131");
      expect(getUniformTextRangeStyle(ranges, 3, 7, "highlight")).toBe(
        "#fff3bf",
      );
      expect(getUniformTextRangeStyle(ranges, 2, 7, "highlight")).toBeNull();

      // Clear color on [2, 5] using baseStrokeColor while preserving highlight
      ranges = applyTextRangeStyle(
        ranges,
        textLength,
        { start: 2, end: 5 },
        { color: "#1E1E1E" },
        baseStroke,
      );
      expect(ranges).toEqual([
        { start: 0, end: 2, color: "#e03131" },
        { start: 3, end: 5, highlight: "#fff3bf" },
        { start: 5, end: 7, color: "#e03131", highlight: "#fff3bf" },
        { start: 7, end: 10, color: "#e03131" },
      ]);
      expect(getUniformTextRangeStyle(ranges, 0, 10, "color")).toBeNull();
      expect(getUniformTextRangeStyle(ranges, 3, 7, "highlight")).toBe(
        "#fff3bf",
      );

      // Re-apply same color on [2, 5] to verify adjacent identical spans merge back
      ranges = applyTextRangeStyle(
        ranges,
        textLength,
        { start: 2, end: 5 },
        { color: "#e03131" },
        baseStroke,
      );
      expect(ranges).toEqual([
        { start: 0, end: 3, color: "#e03131" },
        { start: 3, end: 7, color: "#e03131", highlight: "#fff3bf" },
        { start: 7, end: 10, color: "#e03131" },
      ]);

      // Clear highlight via "transparent" and color via null
      ranges = applyTextRangeStyle(
        ranges,
        textLength,
        { start: 3, end: 7 },
        { highlight: "transparent" },
        baseStroke,
      );
      expect(ranges).toEqual([{ start: 0, end: 10, color: "#e03131" }]);

      ranges = applyTextRangeStyle(
        ranges,
        textLength,
        { start: 0, end: 10 },
        { color: null },
        baseStroke,
      );
      expect(ranges).toBeUndefined();
    });
  });

  describe("shiftTextRanges & shiftTextRangesAtOffset", () => {
    it("shifts ranges across insertions, deletions, replacements, and range-end boundary typing", () => {
      const initial: readonly TextRangeStyle[] = [
        { start: 2, end: 7, color: "#1971c2" },
      ];

      // Insertion before range (offset 0, +2) -> shifts start and end by +2
      expect(shiftTextRangesAtOffset(initial, 0, 0, 2, 12)).toEqual([
        { start: 4, end: 9, color: "#1971c2" },
      ]);

      // Insertion at range.start (offset 2, +3) -> shifts start and end by +3
      expect(shiftTextRangesAtOffset(initial, 2, 0, 3, 13)).toEqual([
        { start: 5, end: 10, color: "#1971c2" },
      ]);

      // Insertion strictly inside range (offset 4, +2) -> extends end by +2
      expect(shiftTextRangesAtOffset(initial, 4, 0, 2, 12)).toEqual([
        { start: 2, end: 9, color: "#1971c2" },
      ]);

      // Insertion at range.end (offset 7, +3) -> extends end by +3
      expect(shiftTextRangesAtOffset(initial, 7, 0, 3, 13)).toEqual([
        { start: 2, end: 10, color: "#1971c2" },
      ]);
      expect(shiftTextRanges(initial, "abHELLOcd", "abHELLOWORLDcd")).toEqual([
        { start: 2, end: 12, color: "#1971c2" },
      ]);

      // Insertion after range (offset 9, +2) -> unchanged
      expect(shiftTextRangesAtOffset(initial, 9, 0, 2, 12)).toEqual([
        { start: 2, end: 7, color: "#1971c2" },
      ]);

      // Deletion inside range [3, 5) -> shrinks end by 2
      expect(shiftTextRanges(initial, "abHELLOcd", "abHLOcd")).toEqual([
        { start: 2, end: 5, color: "#1971c2" },
      ]);

      // Replacement strictly enclosed by range
      expect(shiftTextRanges(initial, "abHELLOcd", "abHXYZLOcd")).toEqual([
        { start: 2, end: 8, color: "#1971c2" },
      ]);

      // Deletion covering entire range removes it
      expect(shiftTextRanges(initial, "abHELLOcd", "abcd")).toBeUndefined();
    });

    it("preserves UTF-16 code-unit offsets around astral-plane emoji surrogate pairs", () => {
      // "😀" is 2 UTF-16 code units
      const text = "Hi 😀 world";
      expect("😀".length).toBe(2);
      const worldStart = text.indexOf("world"); // 3 + 2 + 1 = 6
      const worldEnd = worldStart + "world".length; // 11

      const ranges = applyTextRangeStyle(
        undefined,
        text.length,
        { start: worldStart, end: worldEnd },
        { color: "#2f9e44", highlight: "#d3f9d8" },
      );
      expect(ranges).toEqual([
        {
          start: 6,
          end: 11,
          color: "#2f9e44",
          highlight: "#d3f9d8",
        },
      ]);
      expect(text.slice(ranges![0].start, ranges![0].end)).toBe("world");

      // Insert another emoji "🎉" (length 2) at the start of the text
      const nextText = `🎉${text}`;
      const shifted = shiftTextRanges(ranges, text, nextText);
      expect(shifted).toEqual([
        {
          start: 8,
          end: 13,
          color: "#2f9e44",
          highlight: "#d3f9d8",
        },
      ]);
      expect(nextText.slice(shifted![0].start, shifted![0].end)).toBe("world");

      // Style range containing an emoji directly and split into segments
      const emojiStyled = applyTextRangeStyle(
        shifted,
        nextText.length,
        { start: 0, end: 2 },
        { highlight: "#ffec99" },
      );
      const segments = splitTextIntoStyledSegments(nextText, emojiStyled, 0);
      expect(segments[0]).toEqual({
        text: "🎉",
        start: 0,
        end: 2,
        highlight: "#ffec99",
      });
      expect(segments[segments.length - 1]).toEqual({
        text: "world",
        start: 8,
        end: 13,
        color: "#2f9e44",
        highlight: "#d3f9d8",
      });
    });
  });

  describe("getLineTextRuns & projectTextRangesOntoLines", () => {
    it("computes accurate x and width for pure-LTR, pure-RTL, and LTR-first mixed-bidi lines", () => {
      // 1. Pure LTR line across left, center, and right alignments
      const ltrText = "Hello World";
      const ltrRanges: readonly TextRangeStyle[] = [
        { start: 0, end: 5, color: "#e03131" },
        { start: 6, end: 11, highlight: "#fff3bf" },
      ];
      const ltrLine = { text: ltrText, start: 0, end: 11 };

      const ltrLeftRuns = getLineTextRuns(ltrLine, ltrRanges, {
        font,
        elementWidth: 200,
        textAlign: "left",
        baseDirection: "ltr",
      });
      expect(ltrLeftRuns).toHaveLength(3);
      expect(ltrLeftRuns[0]).toMatchObject({
        text: "Hello",
        start: 0,
        end: 5,
        color: "#e03131",
        x: 0,
        direction: "ltr",
      });
      expect(ltrLeftRuns[0].width).toBeGreaterThan(0);
      expect(ltrLeftRuns[1].x).toBeCloseTo(ltrLeftRuns[0].width);
      expect(ltrLeftRuns[2].x).toBeCloseTo(
        ltrLeftRuns[0].width + ltrLeftRuns[1].width,
      );

      const totalLtrWidth = ltrLeftRuns.reduce((sum, r) => sum + r.width, 0);

      const ltrCenterRuns = getLineTextRuns(ltrLine, ltrRanges, {
        font,
        elementWidth: 200,
        textAlign: "center",
        baseDirection: "ltr",
      });
      expect(ltrCenterRuns[0].x).toBeCloseTo((200 - totalLtrWidth) / 2);

      const ltrRightRuns = getLineTextRuns(ltrLine, ltrRanges, {
        font,
        elementWidth: 200,
        textAlign: "right",
        baseDirection: "ltr",
      });
      expect(ltrRightRuns[0].x).toBeCloseTo(200 - totalLtrWidth);

      // 2. Pure Arabic RTL line
      const rtlText = "مرحبا بالعالم";
      const rtlRanges: readonly TextRangeStyle[] = [
        { start: 0, end: 5, color: "#1971c2" },
        { start: 6, end: 13, highlight: "#ffec99" },
      ];
      const rtlLine = { text: rtlText, start: 0, end: rtlText.length };
      const rtlRuns = getLineTextRuns(rtlLine, rtlRanges, {
        font,
        elementWidth: 200,
        textAlign: "right",
        baseDirection: "rtl",
      });
      expect(rtlRuns.every((r) => r.direction === "rtl")).toBe(true);
      expect(rtlRuns.every((r) => r.width > 0)).toBe(true);
      // In RTL visual order, logical first word "مرحبا" is on the right of "بالعالم"
      const firstWordRun = rtlRuns.find((r) => r.text === "مرحبا")!;
      const secondWordRun = rtlRuns.find((r) => r.text === "بالعالم")!;
      expect(firstWordRun.x).toBeGreaterThan(secondWordRun.x);

      // 3. LTR-first mixed-bidi line containing Arabic-Indic digits and Arabic script
      const mixedText = "Price: ١٢٠ درهم";
      const mixedRanges: readonly TextRangeStyle[] = [
        { start: 0, end: 6, color: "#2f9e44" },
        { start: 7, end: 10, highlight: "#fff3bf" },
        { start: 11, end: 15, color: "#e03131" },
      ];
      const projected = projectTextRangesOntoLines(mixedText, mixedRanges, {
        font,
        elementWidth: 300,
        textAlign: "left",
        baseDirection: "ltr",
      });
      expect(projected).toHaveLength(1);
      const mixedRuns = projected[0].runs;
      expect(mixedRuns.length).toBeGreaterThanOrEqual(3);

      const priceRun = mixedRuns.find((r) => r.text.startsWith("Price:"))!;
      const digitsRun = mixedRuns.find((r) => r.text.includes("١٢٠"))!;
      const currencyRun = mixedRuns.find((r) => r.text.includes("درهم"))!;

      expect(priceRun.direction).toBe("ltr");
      expect(digitsRun.direction).toBe("rtl");
      expect(currencyRun.direction).toBe("rtl");

      // Base direction is LTR: "Price: " is leftmost, and the RTL segment reverses visually
      expect(priceRun.x).toBe(0);
      expect(currencyRun.x).toBeGreaterThanOrEqual(priceRun.x + priceRun.width);
      expect(digitsRun.x).toBeGreaterThan(currencyRun.x);

      const sumWidths = mixedRuns.reduce((sum, r) => sum + r.width, 0);
      expect(sumWidths).toBeGreaterThan(0);

      // 4. LTR-RTL-LTR line with neutrals between opposite-direction runs
      const sandwichText = "Hello مرحبا بالعالم World";
      const sandwichRanges: readonly TextRangeStyle[] = [
        { start: 0, end: 5, color: "#2f9e44" },
        { start: 6, end: 11, color: "#1971c2" },
        { start: 12, end: 19, highlight: "#ffec99" },
        { start: 20, end: 25, color: "#e03131" },
      ];
      const sandwichRuns = getLineTextRuns(
        { text: sandwichText, start: 0, end: sandwichText.length },
        sandwichRanges,
        {
          font,
          elementWidth: 400,
          textAlign: "left",
          baseDirection: "ltr",
        },
      );
      const helloRun = sandwichRuns.find((r) => r.text === "Hello")!;
      const marhabaRun = sandwichRuns.find((r) => r.text === "مرحبا")!;
      const bilalamRun = sandwichRuns.find((r) => r.text === "بالعالم")!;
      const worldRun = sandwichRuns.find((r) => r.text === "World")!;
      const ltrToRtlSpace = sandwichRuns.find(
        (r) => r.start === 5 && r.end === 6,
      )!;
      const rtlToLtrSpace = sandwichRuns.find(
        (r) => r.start === 19 && r.end === 20,
      )!;

      // Visual order on LTR base: "Hello" -> space -> "بالعالم" -> " " -> "مرحبا" -> space -> "World"
      expect(helloRun.x).toBe(0);
      expect(ltrToRtlSpace.x).toBeGreaterThan(helloRun.x);
      expect(bilalamRun.x).toBeGreaterThan(ltrToRtlSpace.x);
      expect(marhabaRun.x).toBeGreaterThan(bilalamRun.x);
      expect(rtlToLtrSpace.x).toBeGreaterThan(marhabaRun.x);
      expect(worldRun.x).toBeGreaterThan(rtlToLtrSpace.x);

      // 5. European digits (0-9) embedded inside RTL runs on RTL-base and LTR-base lines
      const euroInRtlText = "المجموع 123 ريال";
      const euroInRtlRanges: readonly TextRangeStyle[] = [
        { start: 0, end: 7, color: "#1971c2" },
        { start: 8, end: 11, highlight: "#fff3bf" },
        { start: 12, end: 16, color: "#e03131" },
      ];
      const rtlBaseEuroRuns = getLineTextRuns(
        { text: euroInRtlText, start: 0, end: euroInRtlText.length },
        euroInRtlRanges,
        {
          font,
          elementWidth: 300,
          textAlign: "right",
          baseDirection: "rtl",
        },
      );
      const amountRtlBase = rtlBaseEuroRuns.find((r) => r.text === "المجموع")!;
      const euroDigitsRtlBase = rtlBaseEuroRuns.find((r) => r.text === "123")!;
      const riyalRtlBase = rtlBaseEuroRuns.find((r) => r.text === "ريال")!;

      // Visual order on RTL base (left to right): "ريال" < "123" < "المجموع"
      expect(riyalRtlBase.x).toBeLessThan(euroDigitsRtlBase.x);
      expect(euroDigitsRtlBase.x).toBeLessThan(amountRtlBase.x);

      const ltrBaseEuroText = "Total: المجموع 123 ريال";
      const ltrBaseEuroRanges: readonly TextRangeStyle[] = [
        { start: 0, end: 6, color: "#2f9e44" },
        { start: 7, end: 14, color: "#1971c2" },
        { start: 15, end: 18, highlight: "#fff3bf" },
        { start: 19, end: 23, color: "#e03131" },
      ];
      const ltrBaseEuroRuns = getLineTextRuns(
        { text: ltrBaseEuroText, start: 0, end: ltrBaseEuroText.length },
        ltrBaseEuroRanges,
        {
          font,
          elementWidth: 400,
          textAlign: "left",
          baseDirection: "ltr",
        },
      );
      const totalRun = ltrBaseEuroRuns.find((r) =>
        r.text.startsWith("Total:"),
      )!;
      const amountLtrBase = ltrBaseEuroRuns.find((r) => r.text === "المجموع")!;
      const euroDigitsLtrBase = ltrBaseEuroRuns.find((r) => r.text === "123")!;
      const riyalLtrBase = ltrBaseEuroRuns.find((r) => r.text === "ريال")!;

      expect(totalRun.x).toBe(0);
      expect(amountLtrBase.x).toBeGreaterThan(totalRun.x);
      expect(euroDigitsLtrBase.x).toBeGreaterThan(totalRun.x);
      expect(riyalLtrBase.x).toBeGreaterThan(totalRun.x);
      // European digits (0-9) inside RTL spans stay distinct from both surrounding RTL words
      expect(euroDigitsLtrBase.x).not.toBe(amountLtrBase.x);
      expect(euroDigitsLtrBase.x).not.toBe(riyalLtrBase.x);
    });
  });
});
