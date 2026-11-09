import type { TextStyleRange } from "./types";

/**
 * Describes an update to apply to a styled range. Keys that are omitted are
 * left unchanged on existing ranges, `null` clears the style property, and a
 * non-empty string sets it. Offsets index `originalText`.
 */
export type TextStyleUpdate = {
  color?: string | null;
  backgroundColor?: string | null;
};

/**
 * A contiguous slice of text inside a line with a uniform style applied.
 * `color` and `backgroundColor` are `null` when unset.
 */
export type TextStyleRun = {
  text: string;
  color: string | null;
  backgroundColor: string | null;
};

const isValidColorString = (value: unknown): value is string => {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 64 &&
    /^[#a-z0-9(),.%\s/-]+$/i.test(value) &&
    !/url\s*\(/i.test(value)
  );
};

const hasSetStyle = (
  range: Partial<TextStyleRange>,
): range is TextStyleRange => {
  return (
    (typeof range.color === "string" && range.color.length > 0) ||
    (typeof range.backgroundColor === "string" &&
      range.backgroundColor.length > 0)
  );
};

const createRange = (
  start: number,
  end: number,
  color?: string | null,
  backgroundColor?: string | null,
): TextStyleRange | null => {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return null;
  }
  const next: {
    start: number;
    end: number;
    color?: string;
    backgroundColor?: string;
  } = {
    start,
    end,
  };
  if (typeof color === "string" && color.length > 0) {
    next.color = color;
  }
  if (typeof backgroundColor === "string" && backgroundColor.length > 0) {
    next.backgroundColor = backgroundColor;
  }
  return hasSetStyle(next) ? next : null;
};

/**
 * The fraction of a line's width to subtract from the aligned x to get the line's left edge (shared by canvas and SVG styled-run drawing).
 */
export const getTextAlignFactor = (textAlign: string): number =>
  textAlign === "center" ? 0.5 : textAlign === "right" ? 1 : 0;

/**
 * Normalises a list of style ranges indexing `originalText`. Drops invalid or
 * empty ranges, resolves overlaps by trimming later ranges against earlier
 * ones, merges adjacent ranges with identical styles, and never stores empty
 * style keys.
 */
export const normalizeRanges = (
  ranges: readonly TextStyleRange[],
): TextStyleRange[] => {
  const valid: TextStyleRange[] = [];
  for (const range of ranges) {
    if (
      !range ||
      !Number.isFinite(range.start) ||
      !Number.isFinite(range.end) ||
      range.start >= range.end
    ) {
      continue;
    }
    const created = createRange(
      range.start,
      range.end,
      range.color,
      range.backgroundColor,
    );
    if (created) {
      valid.push(created);
    }
  }

  valid.sort((a, b) => a.start - b.start || a.end - b.end);

  const result: TextStyleRange[] = [];
  for (const entry of valid) {
    let currentStart = entry.start;
    const currentEnd = entry.end;

    if (result.length > 0) {
      const prev = result[result.length - 1];
      if (currentStart < prev.end) {
        currentStart = prev.end;
      }
      if (currentStart >= currentEnd) {
        continue;
      }

      if (
        prev.end === currentStart &&
        prev.color === entry.color &&
        prev.backgroundColor === entry.backgroundColor
      ) {
        result[result.length - 1] = {
          start: prev.start,
          end: currentEnd,
          ...(prev.color ? { color: prev.color } : {}),
          ...(prev.backgroundColor
            ? { backgroundColor: prev.backgroundColor }
            : {}),
        };
        continue;
      }
    }

    const created = createRange(
      currentStart,
      currentEnd,
      entry.color,
      entry.backgroundColor,
    );
    if (created) {
      result.push(created);
    }
  }

  return result;
};

/**
 * Clamps style range offsets to `[0, textLength]` indexing `originalText` and
 * returns a normalised list of ranges.
 */
export const clampRanges = (
  ranges: readonly TextStyleRange[],
  textLength: number,
): TextStyleRange[] => {
  const maxLen = Math.max(0, textLength);
  const clamped: TextStyleRange[] = [];

  for (const range of ranges) {
    const start = Math.min(Math.max(range.start, 0), maxLen);
    const end = Math.min(Math.max(range.end, 0), maxLen);
    const created = createRange(start, end, range.color, range.backgroundColor);
    if (created) {
      clamped.push(created);
    }
  }

  return normalizeRanges(clamped);
};

/**
 * Shifts style ranges indexing `originalText` after a splice operation at
 * `offset` deleting `deletedCount` characters and inserting `insertedCount`.
 * Boundaries follow splice rules: inserts at range start shift the range,
 * inserts at range end do not extend it, and inserts strictly inside grow it.
 */
export const shiftRangesForSplice = (
  ranges: readonly TextStyleRange[],
  offset: number,
  deletedCount: number,
  insertedCount: number,
): TextStyleRange[] => {
  const o = offset;
  const d = deletedCount;
  const i = insertedCount;

  const shifted: TextStyleRange[] = [];

  for (const range of ranges) {
    const nextStart =
      range.start < o
        ? range.start
        : range.start >= o + d
        ? range.start - d + i
        : o + i;

    const nextEnd =
      range.end <= o ? range.end : range.end >= o + d ? range.end - d + i : o;

    if (nextStart >= nextEnd) {
      continue;
    }

    const created = createRange(
      nextStart,
      nextEnd,
      range.color,
      range.backgroundColor,
    );
    if (created) {
      shifted.push(created);
    }
  }

  return normalizeRanges(shifted);
};

/**
 * Shifts style ranges indexing `originalText` when editing from `prevText` to
 * `nextText`. Returns the same array reference if ranges is undefined, empty,
 * or the text is unchanged; otherwise calculates the diff and applies splice
 * boundary shifts.
 */
export const shiftRangesForEdit = (
  ranges: readonly TextStyleRange[] | undefined,
  prevText: string,
  nextText: string,
): readonly TextStyleRange[] | undefined => {
  if (!ranges || ranges.length === 0 || prevText === nextText) {
    return ranges;
  }

  let p = 0;
  const minLength = Math.min(prevText.length, nextText.length);
  while (p < minLength && prevText.charCodeAt(p) === nextText.charCodeAt(p)) {
    p++;
  }

  let s = 0;
  const maxSuffix = minLength - p;
  while (
    s < maxSuffix &&
    prevText.charCodeAt(prevText.length - 1 - s) ===
      nextText.charCodeAt(nextText.length - 1 - s)
  ) {
    s++;
  }

  const deletedCount = prevText.length - p - s;
  const insertedCount = nextText.length - p - s;

  return shiftRangesForSplice(ranges, p, deletedCount, insertedCount);
};

/**
 * Applies a partial style update across `[start, end)` indexing `originalText`.
 * Splits intersecting ranges, overrides or clears matching keys, introduces
 * new styled ranges over unstyled gaps, and merges adjacent identical styles.
 */
export const applyStyleToRange = (
  ranges: readonly TextStyleRange[],
  start: number,
  end: number,
  style: TextStyleUpdate,
): TextStyleRange[] => {
  const effectiveStart = Math.max(0, start);
  if (effectiveStart >= end) {
    return normalizeRanges(ranges);
  }

  const normalized = normalizeRanges(ranges);
  const pieces: TextStyleRange[] = [];

  let cursor = effectiveStart;

  for (const range of normalized) {
    if (range.end <= effectiveStart || range.start >= end) {
      pieces.push(range);
      continue;
    }

    if (range.start > cursor) {
      const gapPiece = createRange(
        cursor,
        Math.min(range.start, end),
        style.color,
        style.backgroundColor,
      );
      if (gapPiece) {
        pieces.push(gapPiece);
      }
    }

    if (range.start < effectiveStart) {
      const beforePiece = createRange(
        range.start,
        effectiveStart,
        range.color,
        range.backgroundColor,
      );
      if (beforePiece) {
        pieces.push(beforePiece);
      }
    }

    const overlapStart = Math.max(range.start, effectiveStart);
    const overlapEnd = Math.min(range.end, end);

    const mergedColor =
      style.color === undefined
        ? range.color
        : style.color === null
        ? undefined
        : style.color;

    const mergedBg =
      style.backgroundColor === undefined
        ? range.backgroundColor
        : style.backgroundColor === null
        ? undefined
        : style.backgroundColor;

    const overlapPiece = createRange(
      overlapStart,
      overlapEnd,
      mergedColor,
      mergedBg,
    );
    if (overlapPiece) {
      pieces.push(overlapPiece);
    }

    if (range.end > end) {
      const afterPiece = createRange(
        end,
        range.end,
        range.color,
        range.backgroundColor,
      );
      if (afterPiece) {
        pieces.push(afterPiece);
      }
    }

    cursor = Math.max(cursor, range.end);
  }

  if (cursor < end) {
    const trailingGap = createRange(
      cursor,
      end,
      style.color,
      style.backgroundColor,
    );
    if (trailingGap) {
      pieces.push(trailingGap);
    }
  }

  return normalizeRanges(pieces);
};

/**
 * Validates and sanitises untrusted style ranges from external or persisted
 * input. All offsets index `originalText`. Drops malformed entries, ensures
 * valid CSS colour strings, and returns clamped, normalised ranges.
 */
export const sanitizeTextStyleRanges = (
  input: unknown,
  textLength: number,
): TextStyleRange[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  const kept: TextStyleRange[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const raw = item as Record<string, unknown>;
    const start = raw.start;
    const end = raw.end;

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      (start as number) >= (end as number)
    ) {
      continue;
    }

    const color = raw.color;
    const backgroundColor = raw.backgroundColor;

    if (color !== undefined && color !== null && !isValidColorString(color)) {
      continue;
    }

    if (
      backgroundColor !== undefined &&
      backgroundColor !== null &&
      !isValidColorString(backgroundColor)
    ) {
      continue;
    }

    const colorStr = typeof color === "string" ? color : undefined;
    const bgStr =
      typeof backgroundColor === "string" ? backgroundColor : undefined;

    const created = createRange(
      start as number,
      end as number,
      colorStr,
      bgStr,
    );
    if (created) {
      kept.push(created);
    }
  }

  return clampRanges(kept, textLength);
};

/**
 * Maps styled ranges indexing `originalText` onto wrapped lines of `text`.
 * Returns an array of visual runs per line, or `null` if ranges is empty or
 * wrapped lines fail to align with `originalText`.
 */
export const getTextStyleLineRuns = (
  text: string,
  originalText: string,
  ranges: readonly TextStyleRange[] | undefined,
): TextStyleRun[][] | null => {
  if (!ranges || ranges.length === 0) {
    return null;
  }

  const clamped = clampRanges(ranges, originalText.length);
  if (clamped.length === 0) {
    return null;
  }

  const lines = text.split("\n");
  const lineBounds: Array<{ start: number; end: number; text: string }> = [];

  let prevEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let lineStart: number;

    if (i === 0) {
      lineStart = 0;
    } else {
      const c = prevEnd;
      const nl = originalText.indexOf("\n", c);
      if (nl !== -1 && /^\s*$/.test(originalText.slice(c, nl))) {
        lineStart = nl + 1;
      } else {
        let firstNonWs = c;
        while (
          firstNonWs < originalText.length &&
          /\s/.test(originalText[firstNonWs])
        ) {
          firstNonWs++;
        }
        lineStart = firstNonWs;
      }
    }

    if (!originalText.startsWith(line, lineStart)) {
      return null;
    }

    const lineEnd = lineStart + line.length;
    lineBounds.push({ start: lineStart, end: lineEnd, text: line });
    prevEnd = lineEnd;
  }

  const result: TextStyleRun[][] = [];
  let rangeIdx = 0;

  for (const line of lineBounds) {
    if (line.text.length === 0) {
      result.push([{ text: "", color: null, backgroundColor: null }]);
      continue;
    }

    while (rangeIdx < clamped.length && clamped[rangeIdx].end <= line.start) {
      rangeIdx++;
    }

    const segments: TextStyleRun[] = [];
    let lineCursor = line.start;
    let localRangeIdx = rangeIdx;

    while (lineCursor < line.end && localRangeIdx < clamped.length) {
      const r = clamped[localRangeIdx];
      if (r.start >= line.end) {
        break;
      }

      if (r.start > lineCursor) {
        const gapEnd = Math.min(r.start, line.end);
        segments.push({
          text: line.text.slice(lineCursor - line.start, gapEnd - line.start),
          color: null,
          backgroundColor: null,
        });
        lineCursor = gapEnd;
      }

      if (lineCursor >= line.end) {
        break;
      }

      const runEnd = Math.min(r.end, line.end);
      if (runEnd > lineCursor) {
        segments.push({
          text: line.text.slice(lineCursor - line.start, runEnd - line.start),
          color: r.color ?? null,
          backgroundColor: r.backgroundColor ?? null,
        });
        lineCursor = runEnd;
      }

      if (r.end <= line.end) {
        localRangeIdx++;
      } else {
        break;
      }
    }

    if (lineCursor < line.end) {
      segments.push({
        text: line.text.slice(lineCursor - line.start),
        color: null,
        backgroundColor: null,
      });
    }

    const mergedRuns: TextStyleRun[] = [];
    for (const segment of segments) {
      if (segment.text.length === 0) {
        continue;
      }
      if (mergedRuns.length > 0) {
        const prev = mergedRuns[mergedRuns.length - 1];
        if (
          prev.color === segment.color &&
          prev.backgroundColor === segment.backgroundColor
        ) {
          prev.text += segment.text;
          continue;
        }
      }
      mergedRuns.push({ ...segment });
    }

    if (mergedRuns.length === 0) {
      result.push([{ text: line.text, color: null, backgroundColor: null }]);
    } else {
      result.push(mergedRuns);
    }
  }

  return result;
};

/**
 * Returns a shallow copy of an element with its `styleRanges` property omitted
 * when present, or returns the original element reference unchanged. Stored
 * `styleRanges` is never empty (`[]`), respecting the omit-when-empty rule.
 */
export const withoutStyleRanges = <
  T extends { styleRanges?: readonly TextStyleRange[] },
>(
  element: T,
): T => {
  if (!Object.prototype.hasOwnProperty.call(element, "styleRanges")) {
    return element;
  }
  const { styleRanges: _, ...rest } = element;
  return rest as T;
};
