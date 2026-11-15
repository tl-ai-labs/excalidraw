import { COLOR_PALETTE, isTransparent } from "@excalidraw/common";

import type { WrappedTextLine } from "./textWrapping";
import type { TextStyledRange } from "./types";

export type TextStyledRun = {
  text: string;
  start: number;
  end: number;
  color?: string;
  backgroundColor?: string;
};

const sanitizeStyleProps = (
  color: unknown,
  backgroundColor: unknown,
): { color?: string; backgroundColor?: string } => {
  const cleanColor =
    typeof color === "string" && color.length > 0 ? color : undefined;
  const cleanBg =
    typeof backgroundColor === "string" &&
    backgroundColor.length > 0 &&
    !isTransparent(backgroundColor)
      ? backgroundColor
      : undefined;

  return {
    ...(cleanColor ? { color: cleanColor } : {}),
    ...(cleanBg ? { backgroundColor: cleanBg } : {}),
  };
};

const mergeAdjacentRanges = (
  ranges: TextStyledRange[],
): TextStyledRange[] | undefined => {
  if (ranges.length === 0) {
    return undefined;
  }

  const merged: TextStyledRange[] = [];
  for (const range of ranges) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.end === range.start &&
      prev.color === range.color &&
      prev.backgroundColor === range.backgroundColor
    ) {
      merged[merged.length - 1] = {
        start: prev.start,
        end: range.end,
        ...(prev.color ? { color: prev.color } : {}),
        ...(prev.backgroundColor
          ? { backgroundColor: prev.backgroundColor }
          : {}),
      };
    } else {
      merged.push(range);
    }
  }

  return merged.length > 0 ? merged : undefined;
};

/**
 * Normalizes a list of styled ranges against `textLength`:
 * - clamps offsets to `[0, textLength]`
 * - drops empty or style-less ranges
 * - resolves overlaps (later range wins)
 * - sorts and merges adjacent ranges with identical styles
 */
export const normalizeStyledRanges = (
  ranges: readonly TextStyledRange[] | undefined | null,
  textLength: number,
): TextStyledRange[] | undefined => {
  if (!Array.isArray(ranges) || ranges.length === 0 || textLength <= 0) {
    return undefined;
  }

  const valid: TextStyledRange[] = [];
  const points = new Set<number>();

  for (const raw of ranges) {
    if (
      !raw ||
      typeof raw !== "object" ||
      !Number.isFinite(raw.start) ||
      !Number.isFinite(raw.end)
    ) {
      continue;
    }
    const start = Math.max(0, Math.min(textLength, Math.floor(raw.start)));
    const end = Math.max(0, Math.min(textLength, Math.floor(raw.end)));
    if (start >= end) {
      continue;
    }
    const style = sanitizeStyleProps(raw.color, raw.backgroundColor);
    if (!style.color && !style.backgroundColor) {
      continue;
    }
    valid.push({ start, end, ...style });
    points.add(start);
    points.add(end);
  }

  if (valid.length === 0) {
    return undefined;
  }

  const sortedPoints = Array.from(points).sort((a, b) => a - b);
  const segments: TextStyledRange[] = [];

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const a = sortedPoints[i];
    const b = sortedPoints[i + 1];
    if (a >= b) {
      continue;
    }
    let winner: TextStyledRange | undefined;
    for (let j = valid.length - 1; j >= 0; j--) {
      const r = valid[j];
      if (r.start <= a && r.end >= b) {
        winner = r;
        break;
      }
    }
    if (winner) {
      segments.push({
        start: a,
        end: b,
        ...(winner.color ? { color: winner.color } : {}),
        ...(winner.backgroundColor
          ? { backgroundColor: winner.backgroundColor }
          : {}),
      });
    }
  }

  return mergeAdjacentRanges(segments);
};

/**
 * Applies `style` (`color` and/or `backgroundColor`) to `[start, end)`.
 * Passing `null` (or `"transparent"` for `backgroundColor`) clears that property.
 */
export const applyStyleToRange = (
  ranges: readonly TextStyledRange[] | undefined,
  textLength: number,
  start: number,
  end: number,
  style: {
    color?: string | null;
    backgroundColor?: string | null;
  },
): TextStyledRange[] | undefined => {
  const normalized = normalizeStyledRanges(ranges, textLength) ?? [];
  const s = Math.max(0, Math.min(textLength, Math.floor(start)));
  const e = Math.max(0, Math.min(textLength, Math.floor(end)));

  if (s >= e) {
    return normalized.length > 0 ? normalized : undefined;
  }

  const points = new Set<number>([s, e]);
  for (const r of normalized) {
    points.add(r.start);
    points.add(r.end);
  }
  const sortedPoints = Array.from(points).sort((a, b) => a - b);

  const segments: TextStyledRange[] = [];

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const a = sortedPoints[i];
    const b = sortedPoints[i + 1];
    if (a >= b) {
      continue;
    }
    const existing = normalized.find((r) => r.start <= a && r.end >= b);
    const inTarget = a >= s && b <= e;

    const nextColor =
      inTarget && style.color !== undefined
        ? style.color || undefined
        : existing?.color;
    const nextBg =
      inTarget && style.backgroundColor !== undefined
        ? style.backgroundColor && !isTransparent(style.backgroundColor)
          ? style.backgroundColor
          : undefined
        : existing?.backgroundColor;

    if (nextColor || nextBg) {
      segments.push({
        start: a,
        end: b,
        ...(nextColor ? { color: nextColor } : {}),
        ...(nextBg ? { backgroundColor: nextBg } : {}),
      });
    }
  }

  return mergeAdjacentRanges(segments);
};

/**
 * Clears per-range `color` overrides (e.g. when recoloring the whole text element),
 * preserving any `backgroundColor` highlights.
 */
export const clearColorFromStyledRanges = (
  ranges: readonly TextStyledRange[] | undefined,
  textLength: number,
): TextStyledRange[] | undefined => {
  if (!ranges?.length) {
    return undefined;
  }
  const stripped = ranges.map(({ start, end, backgroundColor }) => ({
    start,
    end,
    ...(backgroundColor ? { backgroundColor } : {}),
  }));
  return normalizeStyledRanges(stripped, textLength);
};

/**
 * Shifts/clips/expands styled ranges for a single contiguous text edit at `editStart`
 * replacing `deletedLength` code units with `insertedLength` code units.
 */
export const applyTextEditToStyledRanges = (
  ranges: readonly TextStyledRange[] | undefined,
  editStart: number,
  deletedLength: number,
  insertedLength: number,
  newTextLength: number,
): TextStyledRange[] | undefined => {
  if (!ranges?.length || newTextLength <= 0) {
    return undefined;
  }

  const editEndOld = editStart + deletedLength;
  const delta = insertedLength - deletedLength;
  const shifted: TextStyledRange[] = [];

  for (const r of ranges) {
    let nextStart = r.start;
    let nextEnd = r.end;

    if (r.end <= editStart) {
      // Strictly before edit (or edit starts right after range): unchanged
    } else if (r.start >= editEndOld) {
      // Strictly after edit (or edit ends right at range start): shift
      nextStart = r.start + delta;
      nextEnd = r.end + delta;
    } else if (deletedLength === 0) {
      // Pure insertion strictly inside `(r.start, r.end)`: expand range
      nextEnd = r.end + insertedLength;
    } else if (r.start >= editStart && r.end <= editEndOld) {
      // Range completely inside deleted span -> dropped
      continue;
    } else if (r.start < editStart && r.end <= editEndOld) {
      nextStart = r.start;
      nextEnd = editStart;
    } else if (r.start >= editStart && r.end > editEndOld) {
      nextStart = editStart + insertedLength;
      nextEnd = r.end + delta;
    } else {
      // Range spans across `[editStart, editEndOld]`
      nextStart = r.start;
      nextEnd = r.end + delta;
    }

    if (nextStart < nextEnd) {
      shifted.push({
        start: nextStart,
        end: nextEnd,
        ...(r.color ? { color: r.color } : {}),
        ...(r.backgroundColor ? { backgroundColor: r.backgroundColor } : {}),
      });
    }
  }

  return normalizeStyledRanges(shifted, newTextLength);
};

/**
 * Shifts styled ranges when `oldText` changes to `newText`.
 * Optional `cursorAfterEdit` disambiguates repeated-character edits (e.g. `"aaa"` -> `"aaaa"`).
 */
export const shiftStyledRangesOnTextEdit = (
  ranges: readonly TextStyledRange[] | undefined,
  oldText: string,
  newText: string,
  cursorAfterEdit?: number,
): TextStyledRange[] | undefined => {
  if (!ranges?.length) {
    return undefined;
  }
  if (oldText === newText) {
    return normalizeStyledRanges(ranges, newText.length);
  }

  const minLen = Math.min(oldText.length, newText.length);
  let prefixLen = 0;
  while (prefixLen < minLen && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    oldText[oldText.length - 1 - suffixLen] ===
      newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  if (
    typeof cursorAfterEdit === "number" &&
    cursorAfterEdit >= 0 &&
    cursorAfterEdit <= newText.length
  ) {
    if (
      newText.length > oldText.length &&
      prefixLen + suffixLen === oldText.length
    ) {
      const inserted = newText.length - oldText.length;
      const candidateStart = cursorAfterEdit - inserted;
      if (candidateStart >= 0 && candidateStart < prefixLen) {
        const reconstructed =
          oldText.slice(0, candidateStart) +
          newText.slice(candidateStart, cursorAfterEdit) +
          oldText.slice(candidateStart);
        if (reconstructed === newText) {
          prefixLen = candidateStart;
          suffixLen = oldText.length - candidateStart;
        }
      }
    } else if (
      newText.length < oldText.length &&
      prefixLen + suffixLen === newText.length &&
      cursorAfterEdit < prefixLen
    ) {
      prefixLen = cursorAfterEdit;
      suffixLen = newText.length - cursorAfterEdit;
    }
  }

  const editStart = prefixLen;
  const deletedLength = oldText.length - prefixLen - suffixLen;
  const insertedLength = newText.length - prefixLen - suffixLen;

  return applyTextEditToStyledRanges(
    ranges,
    editStart,
    deletedLength,
    insertedLength,
    newText.length,
  );
};

/**
 * Maps each visual line of `wrappedText` back to its `[start, end)` UTF-16 code-unit
 * offsets in `originalText`.
 */
export const mapWrappedLinesToOriginalOffsets = (
  originalText: string,
  wrappedText: string,
): WrappedTextLine[] => {
  const normalizedWrapped = wrappedText.replace(/\r\n?/g, "\n");
  const lines = normalizedWrapped.split("\n");
  const result: WrappedTextLine[] = [];
  let cursor = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0 && originalText[cursor] === "\n") {
      cursor += 1;
    }

    if (line.length === 0) {
      result.push({ text: "", start: cursor, end: cursor });
      continue;
    }

    const idx = originalText.indexOf(line, cursor);
    if (idx !== -1) {
      const end = idx + line.length;
      result.push({ text: line, start: idx, end });
      cursor = end;
    } else {
      const start = cursor;
      const end = Math.min(originalText.length, cursor + line.length);
      result.push({ text: line, start, end });
      cursor = end;
    }
  }

  return result;
};

/**
 * Splits a visual line `[lineStart, lineEnd)` into contiguous styled runs.
 */
export const getLineStyledRuns = (
  lineText: string,
  lineStart: number,
  lineEnd: number,
  styledRanges: readonly TextStyledRange[] | undefined,
): TextStyledRun[] => {
  if (!lineText) {
    return [];
  }
  if (!styledRanges?.length) {
    return [{ text: lineText, start: lineStart, end: lineEnd }];
  }

  const runs: TextStyledRun[] = [];
  let pos = lineStart;

  for (const range of styledRanges) {
    if (range.end <= lineStart) {
      continue;
    }
    if (range.start >= lineEnd) {
      break;
    }

    const overlapStart = Math.max(pos, range.start);
    const overlapEnd = Math.min(lineEnd, range.end);

    if (overlapStart > pos) {
      runs.push({
        text: lineText.slice(pos - lineStart, overlapStart - lineStart),
        start: pos,
        end: overlapStart,
      });
    }

    if (overlapEnd > overlapStart) {
      runs.push({
        text: lineText.slice(overlapStart - lineStart, overlapEnd - lineStart),
        start: overlapStart,
        end: overlapEnd,
        ...(range.color ? { color: range.color } : {}),
        ...(range.backgroundColor
          ? { backgroundColor: range.backgroundColor }
          : {}),
      });
      pos = overlapEnd;
    }
  }

  if (pos < lineEnd) {
    runs.push({
      text: lineText.slice(pos - lineStart),
      start: pos,
      end: lineEnd,
    });
  }

  return runs;
};

/**
 * Returns the common `color` and `backgroundColor` across `[start, end)`,
 * or `null` for a property when the selection has mixed values.
 */
export const getCommonStyleInRange = (
  ranges: readonly TextStyledRange[] | undefined,
  start: number,
  end: number,
  defaultStrokeColor: string,
): { color: string | null; backgroundColor: string | null } => {
  if (start >= end) {
    return {
      color: defaultStrokeColor,
      backgroundColor: COLOR_PALETTE.transparent,
    };
  }
  if (!ranges?.length) {
    return {
      color: defaultStrokeColor,
      backgroundColor: COLOR_PALETTE.transparent,
    };
  }

  let commonColor: string | undefined;
  let commonBg: string | undefined;
  let colorMixed = false;
  let bgMixed = false;

  let pos = start;
  for (const range of ranges) {
    if (range.end <= start) {
      continue;
    }
    if (range.start >= end) {
      break;
    }

    if (range.start > pos) {
      // Unstyled gap
      const gapColor = defaultStrokeColor;
      const gapBg = COLOR_PALETTE.transparent;
      if (commonColor === undefined) {
        commonColor = gapColor;
      } else if (commonColor !== gapColor) {
        colorMixed = true;
      }
      if (commonBg === undefined) {
        commonBg = gapBg;
      } else if (commonBg !== gapBg) {
        bgMixed = true;
      }
    }

    const segEnd = Math.min(end, range.end);
    const segColor = range.color ?? defaultStrokeColor;
    const segBg = range.backgroundColor ?? COLOR_PALETTE.transparent;

    if (commonColor === undefined) {
      commonColor = segColor;
    } else if (commonColor !== segColor) {
      colorMixed = true;
    }
    if (commonBg === undefined) {
      commonBg = segBg;
    } else if (commonBg !== segBg) {
      bgMixed = true;
    }

    pos = segEnd;
  }

  if (pos < end) {
    const gapColor = defaultStrokeColor;
    const gapBg = COLOR_PALETTE.transparent;
    if (commonColor === undefined) {
      commonColor = gapColor;
    } else if (commonColor !== gapColor) {
      colorMixed = true;
    }
    if (commonBg === undefined) {
      commonBg = gapBg;
    } else if (commonBg !== gapBg) {
      bgMixed = true;
    }
  }

  return {
    color: colorMixed ? null : commonColor ?? defaultStrokeColor,
    backgroundColor: bgMixed ? null : commonBg ?? COLOR_PALETTE.transparent,
  };
};
