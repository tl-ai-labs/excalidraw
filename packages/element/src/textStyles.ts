import { colorToHex, hasRTLChars, isTransparent } from "@excalidraw/common";

import { getLineWidth } from "./textMeasurements";
import { getWrappedTextLines } from "./textWrapping";

import type { RenderEnvironment } from "./renderEnvironment";
import type { WrappedTextLine } from "./textWrapping";
import type { FontString, TextAlign, TextRangeStyle } from "./types";

export type TextStyleSegment = Readonly<{
  text: string;
  start: number;
  end: number;
  color?: string;
  highlight?: string;
}>;

export type LineTextRun = Readonly<{
  text: string;
  start: number;
  end: number;
  color?: string;
  highlight?: string;
  x: number;
  width: number;
  direction: "ltr" | "rtl";
}>;

export type WrappedLineWithRuns = Readonly<{
  line: WrappedTextLine;
  runs: readonly LineTextRun[];
}>;

export const MAX_TEXT_RANGES = 2000;

const sanitizeStyleColor = (
  value: unknown,
  baseStrokeColor?: string,
): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64 || isTransparent(trimmed)) {
    return undefined;
  }
  const hex = colorToHex(trimmed);
  if (hex === null) {
    return undefined;
  }
  const baseHex =
    baseStrokeColor !== undefined ? colorToHex(baseStrokeColor.trim()) : null;
  if (baseHex !== null && hex === baseHex) {
    return undefined;
  }
  return hex;
};

const sanitizeStyleHighlight = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64 || isTransparent(trimmed)) {
    return undefined;
  }
  const hex = colorToHex(trimmed);
  if (hex === null) {
    return undefined;
  }
  return hex;
};

type RawNormalizedEntry = {
  start: number;
  end: number;
  hasColor: boolean;
  color: string | undefined;
  hasHighlight: boolean;
  highlight: string | undefined;
};

const buildNormalizedRanges = (
  entries: readonly RawNormalizedEntry[],
  textLength: number,
): readonly TextRangeStyle[] | undefined => {
  if (!entries.length || textLength <= 0) {
    return undefined;
  }

  const boundarySet = new Set<number>();
  for (const entry of entries) {
    if (entry.start < entry.end) {
      boundarySet.add(entry.start);
      boundarySet.add(entry.end);
    }
  }

  if (boundarySet.size < 2) {
    return undefined;
  }

  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);
  const merged: TextRangeStyle[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const segStart = boundaries[i];
    const segEnd = boundaries[i + 1];
    if (segStart >= segEnd) {
      continue;
    }

    let color: string | undefined;
    let highlight: string | undefined;

    for (const entry of entries) {
      if (entry.start <= segStart && entry.end >= segEnd) {
        if (entry.hasColor) {
          color = entry.color;
        }
        if (entry.hasHighlight) {
          highlight = entry.highlight;
        }
      }
    }

    if (color === undefined && highlight === undefined) {
      continue;
    }

    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.end === segStart &&
      prev.color === color &&
      prev.highlight === highlight
    ) {
      const nextItem: {
        start: number;
        end: number;
        color?: string;
        highlight?: string;
      } = {
        start: prev.start,
        end: segEnd,
      };
      if (color !== undefined) {
        nextItem.color = color;
      }
      if (highlight !== undefined) {
        nextItem.highlight = highlight;
      }
      merged[merged.length - 1] = nextItem;
    } else {
      const item: {
        start: number;
        end: number;
        color?: string;
        highlight?: string;
      } = {
        start: segStart,
        end: segEnd,
      };
      if (color !== undefined) {
        item.color = color;
      }
      if (highlight !== undefined) {
        item.highlight = highlight;
      }
      merged.push(item);
    }
  }

  return merged.length > 0 ? merged : undefined;
};

/**
 * Normalizes, clamps, resolves overlaps, strips invalid/redundant attributes,
 * and merges adjacent identical styled character ranges.
 * Returns `undefined` when no effective styled ranges remain.
 */
export const normalizeTextRanges = (
  ranges: unknown,
  textLength: number,
  baseStrokeColor?: string,
): readonly TextRangeStyle[] | undefined => {
  if (!Array.isArray(ranges) || textLength <= 0) {
    return undefined;
  }

  const maxLen = Math.max(0, Math.floor(textLength));
  if (maxLen <= 0) {
    return undefined;
  }

  const entries: RawNormalizedEntry[] = [];
  const limit = Math.min(ranges.length, MAX_TEXT_RANGES);

  for (let idx = 0; idx < limit; idx++) {
    const raw = ranges[idx];
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const record = raw as Record<string, unknown>;
    if (
      typeof record.start !== "number" ||
      typeof record.end !== "number" ||
      !Number.isFinite(record.start) ||
      !Number.isFinite(record.end)
    ) {
      continue;
    }

    const start = Math.max(0, Math.min(maxLen, Math.floor(record.start)));
    const end = Math.max(0, Math.min(maxLen, Math.floor(record.end)));
    if (start >= end) {
      continue;
    }

    const hasColorProp = record.color !== undefined;
    const hasHighlightProp = record.highlight !== undefined;
    const color = sanitizeStyleColor(record.color, baseStrokeColor);
    const highlight = sanitizeStyleHighlight(record.highlight);

    if (!hasColorProp && !hasHighlightProp) {
      continue;
    }

    entries.push({
      start,
      end,
      hasColor: hasColorProp && color !== undefined,
      color,
      hasHighlight: hasHighlightProp && highlight !== undefined,
      highlight,
    });
  }

  return buildNormalizedRanges(entries, maxLen);
};

/**
 * Applies a partial style (`color` and/or `highlight`) to `[selection.start, selection.end)`.
 * Passing `null`, `""`, `"transparent"`, or `color === baseStrokeColor` clears that attribute
 * on the selected span while preserving the other attribute.
 */
export const applyTextRangeStyle = (
  ranges: readonly TextRangeStyle[] | undefined,
  textLength: number,
  selection: { start: number; end: number },
  style: { color?: string | null; highlight?: string | null },
  baseStrokeColor?: string,
): readonly TextRangeStyle[] | undefined => {
  if (textLength <= 0) {
    return undefined;
  }

  const maxLen = Math.max(0, Math.floor(textLength));
  const normalized = normalizeTextRanges(ranges, maxLen, baseStrokeColor) ?? [];

  const selStart = Math.max(
    0,
    Math.min(maxLen, Math.floor(selection.start ?? 0)),
  );
  const selEnd = Math.max(0, Math.min(maxLen, Math.floor(selection.end ?? 0)));

  if (selStart >= selEnd) {
    return normalized.length > 0 ? normalized : undefined;
  }

  const entries: RawNormalizedEntry[] = normalized.map((r) => ({
    start: r.start,
    end: r.end,
    hasColor: r.color !== undefined,
    color: r.color,
    hasHighlight: r.highlight !== undefined,
    highlight: r.highlight,
  }));

  const hasColorChange = style.color !== undefined;
  const hasHighlightChange = style.highlight !== undefined;

  if (hasColorChange || hasHighlightChange) {
    const nextColor = hasColorChange
      ? sanitizeStyleColor(style.color, baseStrokeColor)
      : undefined;
    const nextHighlight = hasHighlightChange
      ? sanitizeStyleHighlight(style.highlight)
      : undefined;

    entries.push({
      start: selStart,
      end: selEnd,
      hasColor: hasColorChange,
      color: nextColor,
      hasHighlight: hasHighlightChange,
      highlight: nextHighlight,
    });
  }

  return buildNormalizedRanges(entries, maxLen);
};

/**
 * Returns the uniform style value (`color` or `highlight`) across `[start, end)`
 * if every code unit in the non-empty interval has the exact same value; otherwise `null`.
 */
export const getUniformTextRangeStyle = (
  ranges: readonly TextRangeStyle[] | undefined,
  start: number,
  end: number,
  key: "color" | "highlight",
): string | null => {
  const cappedRanges = ranges?.slice(0, MAX_TEXT_RANGES);
  if (!cappedRanges?.length) {
    return null;
  }
  const s = Math.floor(start);
  const e = Math.floor(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || s >= e) {
    return null;
  }

  const maxEnd = cappedRanges.reduce(
    (acc, r) => Math.max(acc, Math.min(r.end, e)),
    e,
  );
  const normalized = normalizeTextRanges(cappedRanges, Math.max(maxEnd, e));
  if (!normalized?.length) {
    return null;
  }

  let cursor = s;
  let uniformValue: string | null = null;

  for (const r of normalized) {
    if (r.end <= cursor) {
      continue;
    }
    if (r.start > cursor) {
      return null;
    }
    const val = r[key];
    if (!val) {
      return null;
    }
    if (uniformValue === null) {
      uniformValue = val;
    } else if (uniformValue !== val) {
      return null;
    }
    cursor = Math.min(e, r.end);
    if (cursor >= e) {
      break;
    }
  }

  return cursor >= e ? uniformValue : null;
};

/**
 * Shifts and adjusts styled ranges for an edit at `offset` that deletes `deletedLength`
 * code units and inserts `insertedLength` code units, producing text of `nextTextLength`.
 */
export const shiftTextRangesAtOffset = (
  ranges: readonly TextRangeStyle[] | undefined,
  offset: number,
  deletedLength: number,
  insertedLength: number,
  nextTextLength: number,
): readonly TextRangeStyle[] | undefined => {
  const cappedRanges = ranges?.slice(0, MAX_TEXT_RANGES);
  if (!cappedRanges?.length || nextTextLength <= 0) {
    return undefined;
  }

  const pos = Math.max(0, Math.floor(offset));
  const delLen = Math.max(0, Math.floor(deletedLength));
  const insLen = Math.max(0, Math.floor(insertedLength));

  const applyPureInsertion = (
    input: readonly TextRangeStyle[],
  ): TextRangeStyle[] => {
    if (insLen <= 0) {
      return [...input];
    }
    return input.map((r) => {
      if (r.start >= pos) {
        return {
          ...r,
          start: r.start + insLen,
          end: r.end + insLen,
        };
      }
      if (r.start < pos && pos <= r.end) {
        return {
          ...r,
          end: r.end + insLen,
        };
      }
      return r;
    });
  };

  if (delLen === 0) {
    const shifted = applyPureInsertion(cappedRanges);
    return normalizeTextRanges(shifted, nextTextLength);
  }

  const delEnd = pos + delLen;
  const mapPointAfterDelete = (x: number): number => {
    if (x <= pos) {
      return x;
    }
    if (x >= delEnd) {
      return x - delLen;
    }
    return pos;
  };

  const afterDelete: TextRangeStyle[] = [];

  for (const r of cappedRanges) {
    const newStart = mapPointAfterDelete(r.start);
    const newEnd = mapPointAfterDelete(r.end);

    if (newStart < newEnd) {
      afterDelete.push({
        ...r,
        start: newStart,
        end: newEnd,
      });
    } else if (insLen > 0 && r.start < pos && r.end > delEnd) {
      afterDelete.push({
        ...r,
        start: pos,
        end: pos,
      });
    }
  }

  const afterInsert =
    insLen > 0
      ? afterDelete.map((r) => {
          if (r.start === pos && r.end === pos) {
            return {
              ...r,
              start: pos,
              end: pos + insLen,
            };
          }
          if (r.start >= pos) {
            return {
              ...r,
              start: r.start + insLen,
              end: r.end + insLen,
            };
          }
          if (r.start < pos && pos <= r.end) {
            return {
              ...r,
              end: r.end + insLen,
            };
          }
          return r;
        })
      : afterDelete;

  return normalizeTextRanges(afterInsert, nextTextLength);
};

/**
 * Infers a single contiguous edit between `prevText` and `nextText` using
 * common prefix/suffix diffing and shifts `ranges` accordingly.
 */
export const shiftTextRanges = (
  ranges: readonly TextRangeStyle[] | undefined,
  prevText: string,
  nextText: string,
): readonly TextRangeStyle[] | undefined => {
  if (!ranges?.length) {
    return undefined;
  }

  const prev = prevText.replace(/\r\n?/g, "\n");
  const next = nextText.replace(/\r\n?/g, "\n");

  if (next.length === 0) {
    return undefined;
  }

  if (prev === next) {
    return normalizeTextRanges(ranges, next.length);
  }

  const minLen = Math.min(prev.length, next.length);
  let prefixLen = 0;
  while (prefixLen < minLen && prev[prefixLen] === next[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    prev[prev.length - 1 - suffixLen] === next[next.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const deletedLength = prev.length - prefixLen - suffixLen;
  const insertedLength = next.length - prefixLen - suffixLen;

  return shiftTextRangesAtOffset(
    ranges,
    prefixLen,
    deletedLength,
    insertedLength,
    next.length,
  );
};

/**
 * Splits `text` (representing `originalText.slice(offset, offset + text.length)`)
 * into contiguous styled segments with local `[start, end]` offsets in `[0, text.length]`.
 */
export const splitTextIntoStyledSegments = (
  text: string,
  ranges: readonly TextRangeStyle[] | undefined,
  offset: number = 0,
): readonly TextStyleSegment[] => {
  const cappedRanges = ranges?.slice(0, MAX_TEXT_RANGES);
  if (text.length === 0) {
    return [{ text: "", start: 0, end: 0 }];
  }

  const baseOffset = Math.max(0, Math.floor(offset));
  const textLen = text.length;

  if (!cappedRanges?.length) {
    return [{ text, start: 0, end: textLen }];
  }

  const localEntries: TextRangeStyle[] = [];
  for (const r of cappedRanges) {
    const start = Math.max(0, Math.min(textLen, r.start - baseOffset));
    const end = Math.max(0, Math.min(textLen, r.end - baseOffset));
    if (start < end && (r.color !== undefined || r.highlight !== undefined)) {
      localEntries.push({
        start,
        end,
        ...(r.color !== undefined ? { color: r.color } : null),
        ...(r.highlight !== undefined ? { highlight: r.highlight } : null),
      });
    }
  }

  const normalizedLocal = normalizeTextRanges(localEntries, textLen);
  if (!normalizedLocal?.length) {
    return [{ text, start: 0, end: textLen }];
  }

  const segments: TextStyleSegment[] = [];
  let cursor = 0;

  for (const r of normalizedLocal) {
    if (r.start > cursor) {
      segments.push({
        text: text.slice(cursor, r.start),
        start: cursor,
        end: r.start,
      });
    }
    const seg: {
      text: string;
      start: number;
      end: number;
      color?: string;
      highlight?: string;
    } = {
      text: text.slice(r.start, r.end),
      start: r.start,
      end: r.end,
    };
    if (r.color !== undefined) {
      seg.color = r.color;
    }
    if (r.highlight !== undefined) {
      seg.highlight = r.highlight;
    }
    segments.push(seg);
    cursor = r.end;
  }

  if (cursor < textLen) {
    segments.push({
      text: text.slice(cursor, textLen),
      start: cursor,
      end: textLen,
    });
  }

  return segments;
};

// RTL script characters (Hebrew, Arabic, Syriac, Thaana, NKo, etc.) + Arabic-Indic digits
const RE_RTL_STRONG_OR_DIGIT =
  /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC\u0660-\u0669\u06F0-\u06F9]/;

const RE_EUROPEAN_DIGIT = /[0-9]/;

const RE_LTR_STRONG =
  /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF]/;

type CharBidiClass = "R" | "L" | "EN" | "N";

const getCharBidiClass = (ch: string): CharBidiClass => {
  if (RE_RTL_STRONG_OR_DIGIT.test(ch)) {
    return "R";
  }
  if (RE_EUROPEAN_DIGIT.test(ch)) {
    return "EN";
  }
  if (RE_LTR_STRONG.test(ch)) {
    return "L";
  }
  return "N";
};

type ResolvedCharBidi = {
  direction: "ltr" | "rtl";
  level: number;
};

/**
 * Resolves per-character bidi direction ("ltr" | "rtl") and UAX#9 embedding level
 * across `lineText` relative to `baseDirection`.
 */
const resolveLineCharBidi = (
  lineText: string,
  baseDirection: "ltr" | "rtl",
): ResolvedCharBidi[] => {
  const len = lineText.length;
  const classes: CharBidiClass[] = new Array(len);
  for (let i = 0; i < len; i++) {
    classes[i] = getCharBidiClass(lineText[i]);
  }

  const baseClass: "L" | "R" = baseDirection === "rtl" ? "R" : "L";
  const baseLevel = baseDirection === "rtl" ? 1 : 0;

  // Effective strong context ("L" | "R") at each position for neutral resolution (W2/W7/N1):
  // when the preceding strong character is "R", weak "EN" acts like "R" for adjacent neutrals.
  const effectiveStrong: ("L" | "R" | "N")[] = new Array(len);
  const isENAfterR: boolean[] = new Array(len).fill(false);
  let lastStrong: "L" | "R" = baseClass;

  for (let i = 0; i < len; i++) {
    const cls = classes[i];
    if (cls === "R" || cls === "L") {
      lastStrong = cls;
      effectiveStrong[i] = cls;
    } else if (cls === "EN") {
      if (lastStrong === "R") {
        effectiveStrong[i] = "R";
        isENAfterR[i] = true;
      } else {
        effectiveStrong[i] = "L";
      }
    } else {
      effectiveStrong[i] = "N";
    }
  }

  const resolved: ResolvedCharBidi[] = new Array(len);

  let i = 0;
  while (i < len) {
    if (classes[i] !== "N") {
      if (classes[i] === "R") {
        resolved[i] = { direction: "rtl", level: 1 };
      } else if (classes[i] === "EN") {
        const level = baseDirection === "rtl" || isENAfterR[i] ? 2 : 0;
        resolved[i] = { direction: "ltr", level };
      } else {
        const level = baseDirection === "rtl" ? 2 : 0;
        resolved[i] = { direction: "ltr", level };
      }
      i++;
      continue;
    }

    let j = i + 1;
    while (j < len && classes[j] === "N") {
      j++;
    }

    const prevStrong: "L" | "R" =
      i > 0 ? (effectiveStrong[i - 1] === "R" ? "R" : "L") : baseClass;
    const nextStrong: "L" | "R" =
      j < len ? (effectiveStrong[j] === "R" ? "R" : "L") : baseClass;

    const neutralDir: "ltr" | "rtl" =
      prevStrong === nextStrong
        ? prevStrong === "R"
          ? "rtl"
          : "ltr"
        : baseDirection;

    const neutralLevel =
      neutralDir === "rtl" ? 1 : baseDirection === "rtl" ? 2 : baseLevel;

    for (let k = i; k < j; k++) {
      resolved[k] = { direction: neutralDir, level: neutralLevel };
    }
    i = j;
  }

  return resolved;
};

/**
 * Computes positioned `LineTextRun` items for a single wrapped visual line.
 * Pure-LTR lines use prefix `getLineWidth` measurement; lines containing RTL
 * characters split at directional boundaries and order runs visually via UAX#9
 * level reversal to compute each run's horizontal `x` and `width`.
 */
export const getLineTextRuns = (
  line: WrappedTextLine,
  ranges: readonly TextRangeStyle[] | undefined,
  opts: {
    font: FontString;
    elementWidth: number;
    textAlign: TextAlign;
    baseDirection: "ltr" | "rtl";
    renderEnvironment?: RenderEnvironment;
  },
): readonly LineTextRun[] => {
  const lineText = line.text;
  const segments = splitTextIntoStyledSegments(lineText, ranges, line.start);

  const lineWidth = getLineWidth(lineText, opts.font, opts.renderEnvironment);
  const lineLeftX =
    opts.textAlign === "center"
      ? (opts.elementWidth - lineWidth) / 2
      : opts.textAlign === "right"
      ? opts.elementWidth - lineWidth
      : 0;

  if (lineText.length === 0) {
    return [
      {
        text: "",
        start: 0,
        end: 0,
        x: lineLeftX,
        width: 0,
        direction: opts.baseDirection,
      },
    ];
  }

  if (!hasRTLChars(lineText)) {
    return segments.map((seg) => {
      const prefixWidth =
        seg.start > 0
          ? getLineWidth(
              lineText.slice(0, seg.start),
              opts.font,
              opts.renderEnvironment,
            )
          : 0;
      const width = getLineWidth(seg.text, opts.font, opts.renderEnvironment);
      const run: {
        text: string;
        start: number;
        end: number;
        color?: string;
        highlight?: string;
        x: number;
        width: number;
        direction: "ltr" | "rtl";
      } = {
        text: seg.text,
        start: seg.start,
        end: seg.end,
        x: lineLeftX + prefixWidth,
        width,
        direction: "ltr",
      };
      if (seg.color !== undefined) {
        run.color = seg.color;
      }
      if (seg.highlight !== undefined) {
        run.highlight = seg.highlight;
      }
      return run;
    });
  }

  const charBidi = resolveLineCharBidi(lineText, opts.baseDirection);

  type LogicalBidiPart = {
    logicalIndex: number;
    text: string;
    start: number;
    end: number;
    color?: string;
    highlight?: string;
    direction: "ltr" | "rtl";
    level: number;
    width: number;
    x: number;
  };

  const logicalParts: LogicalBidiPart[] = [];

  for (const seg of segments) {
    if (seg.start >= seg.end) {
      continue;
    }
    let subStart = seg.start;
    let currentDir = charBidi[subStart]?.direction ?? opts.baseDirection;
    let currentLevel =
      charBidi[subStart]?.level ?? (opts.baseDirection === "rtl" ? 1 : 0);

    for (let pos = seg.start + 1; pos <= seg.end; pos++) {
      const nextBidi = pos < seg.end ? charBidi[pos] : null;
      if (
        pos === seg.end ||
        nextBidi === null ||
        nextBidi.direction !== currentDir ||
        nextBidi.level !== currentLevel
      ) {
        const subText = lineText.slice(subStart, pos);
        const width = getLineWidth(subText, opts.font, opts.renderEnvironment);
        logicalParts.push({
          logicalIndex: logicalParts.length,
          text: subText,
          start: subStart,
          end: pos,
          ...(seg.color !== undefined ? { color: seg.color } : null),
          ...(seg.highlight !== undefined
            ? { highlight: seg.highlight }
            : null),
          direction: currentDir,
          level: currentLevel,
          width,
          x: 0,
        });
        subStart = pos;
        if (nextBidi !== null) {
          currentDir = nextBidi.direction;
          currentLevel = nextBidi.level;
        }
      }
    }
  }

  // UAX#9 L2 visual reordering: reverse contiguous sequences at level >= L
  // from highest level down to 1.
  const visualOrder = [...logicalParts];
  let maxLevel = 0;
  for (const part of visualOrder) {
    if (part.level > maxLevel) {
      maxLevel = part.level;
    }
  }

  for (let level = maxLevel; level >= 1; level--) {
    let i = 0;
    while (i < visualOrder.length) {
      if (visualOrder[i].level < level) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < visualOrder.length && visualOrder[j].level >= level) {
        j++;
      }
      // Reverse visualOrder[i..j-1]
      let left = i;
      let right = j - 1;
      while (left < right) {
        const tmp = visualOrder[left];
        visualOrder[left] = visualOrder[right];
        visualOrder[right] = tmp;
        left++;
        right--;
      }
      i = j;
    }
  }

  let cursorX = lineLeftX;
  for (const part of visualOrder) {
    part.x = cursorX;
    cursorX += part.width;
  }

  return logicalParts.map((part) => {
    const run: {
      text: string;
      start: number;
      end: number;
      color?: string;
      highlight?: string;
      x: number;
      width: number;
      direction: "ltr" | "rtl";
    } = {
      text: part.text,
      start: part.start,
      end: part.end,
      x: part.x,
      width: part.width,
      direction: part.direction,
    };
    if (part.color !== undefined) {
      run.color = part.color;
    }
    if (part.highlight !== undefined) {
      run.highlight = part.highlight;
    }
    return run;
  });
};

const matchWrappedLinesToOriginalText = (
  originalText: string,
  wrappedText: string,
): WrappedTextLine[] => {
  const normOriginal = originalText.replace(/\r\n?/g, "\n");
  const rawLines = wrappedText.replace(/\r\n?/g, "\n").split("\n");
  const result: WrappedTextLine[] = [];
  let cursor = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const lineText = rawLines[i];

    if (lineText.length === 0) {
      const start = Math.min(cursor, normOriginal.length);
      result.push({
        text: "",
        start,
        end: start,
      });
      if (cursor < normOriginal.length && normOriginal[cursor] === "\n") {
        cursor++;
      }
      continue;
    }

    if (normOriginal.startsWith(lineText, cursor)) {
      const start = cursor;
      const end = start + lineText.length;
      result.push({ text: lineText, start, end });
      cursor = end;
    } else {
      // Skip soft-wrap spaces that may have been trimmed at line boundaries
      let searchPos = cursor;
      while (
        searchPos < normOriginal.length &&
        normOriginal[searchPos] === " " &&
        !normOriginal.startsWith(lineText, searchPos)
      ) {
        searchPos++;
      }
      const foundIdx = normOriginal.indexOf(lineText, searchPos);
      if (foundIdx !== -1) {
        const start = foundIdx;
        const end = start + lineText.length;
        result.push({ text: lineText, start, end });
        cursor = end;
      } else {
        const start = Math.min(cursor, normOriginal.length);
        const end = Math.min(start + lineText.length, normOriginal.length);
        result.push({ text: lineText, start, end });
        cursor = end;
      }
    }

    // Consume trailing spaces stripped at a soft wrap or a single hard newline
    if (i < rawLines.length - 1) {
      if (cursor < normOriginal.length && normOriginal[cursor] === "\n") {
        cursor++;
      } else {
        while (
          cursor < normOriginal.length &&
          normOriginal[cursor] === " " &&
          !normOriginal.startsWith(rawLines[i + 1], cursor)
        ) {
          cursor++;
        }
        if (cursor < normOriginal.length && normOriginal[cursor] === "\n") {
          cursor++;
        }
      }
    }
  }

  return result;
};

/**
 * Projects `originalText` and `ranges` onto wrapped visual lines, returning each
 * `WrappedTextLine` together with its positioned `LineTextRun` items.
 */
export const projectTextRangesOntoLines = (
  originalText: string,
  ranges: readonly TextRangeStyle[] | undefined,
  opts: {
    font: FontString;
    maxWidth?: number;
    wrappedText?: string;
    elementWidth: number;
    textAlign: TextAlign;
    baseDirection: "ltr" | "rtl";
    renderEnvironment?: RenderEnvironment;
  },
): readonly WrappedLineWithRuns[] => {
  const normOriginal = originalText.replace(/\r\n?/g, "\n");
  const normalizedRanges = normalizeTextRanges(ranges, normOriginal.length);

  const lines =
    opts.wrappedText !== undefined
      ? matchWrappedLinesToOriginalText(normOriginal, opts.wrappedText)
      : getWrappedTextLines(
          normOriginal,
          opts.font,
          opts.maxWidth ?? Infinity,
          opts.renderEnvironment,
        );

  return lines.map((line) => ({
    line,
    runs: getLineTextRuns(line, normalizedRanges, opts),
  }));
};
