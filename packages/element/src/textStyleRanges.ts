import { isTransparent } from "@excalidraw/common";

import type { TextStyleRange } from "./types";

export type TextStyleRun = {
  text: string;
  strokeColor?: string;
  backgroundColor?: string;
};

/**
 * Normalises a set of style ranges by clamping boundaries into [0, textLength],
 * resolving overlapping properties with later entries in array order winning,
 * dropping unstyled segments, and merging touching segments that share styling.
 */
export const normalizeStyleRanges = (
  ranges: readonly TextStyleRange[] | null | undefined,
  textLength: number,
): readonly TextStyleRange[] | undefined => {
  if (!Array.isArray(ranges) || ranges.length === 0 || textLength <= 0) {
    return undefined;
  }

  // Filter and clamp valid ranges
  type ClampedRange = {
    start: number;
    end: number;
    strokeColor?: string;
    backgroundColor?: string;
  };
  const validRanges: ClampedRange[] = [];
  const points = new Set<number>();

  for (const range of ranges) {
    if (!range) {
      continue;
    }
    if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
      continue;
    }
    const start = Math.max(0, Math.min(Math.trunc(range.start), textLength));
    const end = Math.max(0, Math.min(Math.trunc(range.end), textLength));
    if (start >= end) {
      continue;
    }
    const strokeColor =
      typeof range.strokeColor === "string" && range.strokeColor.length > 0
        ? range.strokeColor
        : undefined;
    const backgroundColor =
      typeof range.backgroundColor === "string" &&
      range.backgroundColor.length > 0
        ? range.backgroundColor
        : undefined;
    if (!strokeColor && !backgroundColor) {
      continue;
    }
    validRanges.push({
      start,
      end,
      ...(strokeColor ? { strokeColor } : {}),
      ...(backgroundColor ? { backgroundColor } : {}),
    });
    points.add(start);
    points.add(end);
  }

  if (validRanges.length === 0) {
    return undefined;
  }

  const sortedPoints = Array.from(points).sort((a, b) => a - b);
  const segments: TextStyleRange[] = [];

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const segStart = sortedPoints[i];
    const segEnd = sortedPoints[i + 1];
    if (segStart >= segEnd) {
      continue;
    }

    let strokeColor: string | undefined;
    let backgroundColor: string | undefined;

    // Later entries in array order win per property
    for (const r of validRanges) {
      if (r.start <= segStart && r.end >= segEnd) {
        if (r.strokeColor !== undefined) {
          strokeColor = r.strokeColor;
        }
        if (r.backgroundColor !== undefined) {
          backgroundColor = r.backgroundColor;
        }
      }
    }

    if (strokeColor !== undefined || backgroundColor !== undefined) {
      segments.push({
        start: segStart,
        end: segEnd,
        ...(strokeColor ? { strokeColor } : {}),
        ...(backgroundColor ? { backgroundColor } : {}),
      });
    }
  }

  if (segments.length === 0) {
    return undefined;
  }

  // Merge touching segments with identical styles
  const merged: TextStyleRange[] = [segments[0]];
  for (let i = 1; i < segments.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = segments[i];
    if (
      prev.end === curr.start &&
      prev.strokeColor === curr.strokeColor &&
      prev.backgroundColor === curr.backgroundColor
    ) {
      merged[merged.length - 1] = {
        start: prev.start,
        end: curr.end,
        ...(prev.strokeColor ? { strokeColor: prev.strokeColor } : {}),
        ...(prev.backgroundColor
          ? { backgroundColor: prev.backgroundColor }
          : {}),
      };
    } else {
      merged.push(curr);
    }
  }

  return merged;
};

/**
 * Validates and sanitises untrusted style range input into a normalised array,
 * stripping unexpected properties and invalid offsets.
 */
export const sanitizeStyleRanges = (
  value: unknown,
  textLength: number,
): readonly TextStyleRange[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const kept: TextStyleRange[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const candidate = item as Record<string, unknown>;
    if (
      !Number.isInteger(candidate.start) ||
      !Number.isInteger(candidate.end)
    ) {
      continue;
    }
    const start = candidate.start as number;
    const end = candidate.end as number;
    const strokeColor =
      typeof candidate.strokeColor === "string" &&
      candidate.strokeColor.length > 0
        ? candidate.strokeColor
        : undefined;
    const backgroundColor =
      typeof candidate.backgroundColor === "string" &&
      candidate.backgroundColor.length > 0
        ? candidate.backgroundColor
        : undefined;

    if (!strokeColor && !backgroundColor) {
      continue;
    }

    kept.push({
      start,
      end,
      ...(strokeColor ? { strokeColor } : {}),
      ...(backgroundColor ? { backgroundColor } : {}),
    });
  }

  return normalizeStyleRanges(kept, textLength);
};

/**
 * Determines whether two style range sets represent identical styling by
 * comparing element counts and per-range start, end and color values.
 */
export const areStyleRangesEqual = (
  a: readonly TextStyleRange[] | null | undefined,
  b: readonly TextStyleRange[] | null | undefined,
): boolean => {
  const emptyA = !a || a.length === 0;
  const emptyB = !b || b.length === 0;
  if (emptyA && emptyB) {
    return true;
  }
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const r1 = a[i];
    const r2 = b[i];
    if (
      r1.start !== r2.start ||
      r1.end !== r2.end ||
      r1.strokeColor !== r2.strokeColor ||
      r1.backgroundColor !== r2.backgroundColor
    ) {
      return false;
    }
  }
  return true;
};

/**
 * Applies or clears stroke and background colors over the [start, end) range,
 * splitting existing ranges and clearing colours matching defaults or transparent.
 */
export const applyStyleToRange = (
  ranges: readonly TextStyleRange[] | null | undefined,
  start: number,
  end: number,
  style: { strokeColor?: string | null; backgroundColor?: string | null },
  textLength: number,
  baseStrokeColor: string | undefined,
): readonly TextStyleRange[] | undefined => {
  const clampedStart = Math.max(0, Math.min(start, textLength));
  const clampedEnd = Math.max(0, Math.min(end, textLength));
  if (clampedStart >= clampedEnd) {
    return normalizeStyleRanges(ranges, textLength);
  }

  const shouldClearStroke =
    "strokeColor" in style &&
    (style.strokeColor === null || style.strokeColor === baseStrokeColor);
  const shouldSetStroke =
    "strokeColor" in style &&
    style.strokeColor !== null &&
    style.strokeColor !== baseStrokeColor;

  const styleBg = style.backgroundColor;
  const shouldClearBackground =
    "backgroundColor" in style &&
    (styleBg === null || (styleBg !== undefined && isTransparent(styleBg)));
  const shouldSetBackground =
    "backgroundColor" in style &&
    styleBg !== null &&
    styleBg !== undefined &&
    !isTransparent(styleBg);

  // Collect all boundary points to split intervals
  const points = new Set<number>();
  points.add(clampedStart);
  points.add(clampedEnd);
  if (ranges) {
    for (const r of ranges) {
      const s = Math.max(0, Math.min(r.start, textLength));
      const e = Math.max(0, Math.min(r.end, textLength));
      if (s < e) {
        points.add(s);
        points.add(e);
      }
    }
  }

  const sortedPoints = Array.from(points).sort((a, b) => a - b);
  const normalizedRanges = ranges
    ? normalizeStyleRanges(ranges, textLength)
    : undefined;
  const newRanges: TextStyleRange[] = [];

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const segStart = sortedPoints[i];
    const segEnd = sortedPoints[i + 1];
    if (segStart >= segEnd) {
      continue;
    }

    const insideSelection = segStart >= clampedStart && segEnd <= clampedEnd;
    let strokeColor: string | undefined;
    let backgroundColor: string | undefined;

    if (normalizedRanges) {
      for (const r of normalizedRanges) {
        if (r.start <= segStart && r.end >= segEnd) {
          strokeColor = r.strokeColor;
          backgroundColor = r.backgroundColor;
          break;
        }
      }
    }

    if (insideSelection) {
      if (shouldClearStroke) {
        strokeColor = undefined;
      } else if (shouldSetStroke) {
        strokeColor = style.strokeColor!;
      }

      if (shouldClearBackground) {
        backgroundColor = undefined;
      } else if (shouldSetBackground) {
        backgroundColor = style.backgroundColor!;
      }
    }

    if (strokeColor !== undefined || backgroundColor !== undefined) {
      newRanges.push({
        start: segStart,
        end: segEnd,
        ...(strokeColor ? { strokeColor } : {}),
        ...(backgroundColor ? { backgroundColor } : {}),
      });
    }
  }

  return normalizeStyleRanges(newRanges, textLength);
};

/**
 * Shifts style range offsets in response to text editing (insertion/deletion),
 * preserving styles strictly inside ranges and not expanding when typing at borders.
 */
export const shiftStyleRangesForEdit = (
  ranges: readonly TextStyleRange[] | null | undefined,
  prevText: string,
  nextText: string,
  caret: number | undefined,
): readonly TextStyleRange[] | undefined => {
  if (!ranges || ranges.length === 0 || prevText === nextText) {
    return ranges ?? undefined;
  }

  const minLength = Math.min(prevText.length, nextText.length);
  let prefix = 0;
  while (
    prefix < minLength &&
    prevText.charCodeAt(prefix) === nextText.charCodeAt(prefix)
  ) {
    prefix++;
  }

  if (typeof caret === "number" && Number.isFinite(caret)) {
    const maxGrowth = Math.max(0, nextText.length - prevText.length);
    prefix = Math.min(prefix, Math.max(0, caret - maxGrowth));
  }

  let suffix = 0;
  const maxSuffix = minLength - prefix;
  while (
    suffix < maxSuffix &&
    prevText.charCodeAt(prevText.length - 1 - suffix) ===
      nextText.charCodeAt(nextText.length - 1 - suffix)
  ) {
    suffix++;
  }

  const offset = prefix;
  const deleted = prevText.length - prefix - suffix;
  const inserted = nextText.length - prefix - suffix;

  const mapPosition = (p: number): number => {
    if (p <= offset) {
      return p;
    }
    if (p >= offset + deleted) {
      return p - deleted;
    }
    return offset;
  };

  const mapped: TextStyleRange[] = [];
  for (const r of ranges) {
    const s = mapPosition(r.start);
    const e = mapPosition(r.end);

    const newStart = s >= offset ? s + inserted : s;
    const newEnd = e > offset ? e + inserted : e;

    if (newStart < newEnd) {
      mapped.push({
        start: newStart,
        end: newEnd,
        ...(r.strokeColor ? { strokeColor: r.strokeColor } : {}),
        ...(r.backgroundColor ? { backgroundColor: r.backgroundColor } : {}),
      });
    }
  }

  return normalizeStyleRanges(mapped, nextText.length);
};

/**
 * Splits wrapped text lines into contiguous runs with their matching text colors
 * and highlight backgrounds by mapping them back to originalText offsets.
 */
export const getStyleRunsForLines = (
  originalText: string,
  wrappedText: string,
  ranges: readonly TextStyleRange[] | null | undefined,
): TextStyleRun[][] => {
  const lines = wrappedText.split("\n");
  const normalizedRanges = ranges
    ? normalizeStyleRanges(ranges, originalText.length)
    : undefined;

  let cursor = 0;
  const result: TextStyleRun[][] = [];

  for (const line of lines) {
    if (line.length === 0) {
      result.push([]);
      continue;
    }

    let pos = cursor;
    let found = false;
    while (pos <= originalText.length - line.length) {
      if (originalText.startsWith(line, pos)) {
        found = true;
        break;
      }
      const ch = originalText.charAt(pos);
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
        pos++;
      } else {
        break;
      }
    }

    if (!found) {
      result.push([{ text: line }]);
      continue;
    }

    const lineStart = pos;
    const lineEnd = pos + line.length;
    cursor = lineEnd;

    if (!normalizedRanges || normalizedRanges.length === 0) {
      result.push([{ text: line }]);
      continue;
    }

    // Collect split boundaries inside [lineStart, lineEnd)
    const cutPoints = new Set<number>();
    cutPoints.add(lineStart);
    cutPoints.add(lineEnd);

    for (const r of normalizedRanges) {
      if (r.start > lineStart && r.start < lineEnd) {
        cutPoints.add(r.start);
      }
      if (r.end > lineStart && r.end < lineEnd) {
        cutPoints.add(r.end);
      }
    }

    const sortedCuts = Array.from(cutPoints).sort((a, b) => a - b);
    const lineRuns: TextStyleRun[] = [];

    for (let i = 0; i < sortedCuts.length - 1; i++) {
      const segStart = sortedCuts[i];
      const segEnd = sortedCuts[i + 1];
      const segText = originalText.slice(segStart, segEnd);

      let strokeColor: string | undefined;
      let backgroundColor: string | undefined;

      for (const r of normalizedRanges) {
        if (r.start <= segStart && r.end >= segEnd) {
          strokeColor = r.strokeColor;
          backgroundColor = r.backgroundColor;
          break;
        }
      }

      lineRuns.push({
        text: segText,
        ...(strokeColor ? { strokeColor } : {}),
        ...(backgroundColor ? { backgroundColor } : {}),
      });
    }

    result.push(lineRuns);
  }

  return result;
};
