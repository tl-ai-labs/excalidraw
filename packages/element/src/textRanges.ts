import { isTransparent } from "@excalidraw/common";

import type { WrappedTextLine } from "./textWrapping";
import type { TextStyleRange } from "./types";

export type StyledTextRun = {
  text: string;
  /** Inclusive code-unit offset in `originalText`. */
  start: number;
  /** Exclusive code-unit offset in `originalText`. */
  end: number;
  color?: string;
  highlight?: string;
};

type RangeStyle = {
  color?: string;
  highlight?: string;
};

const hasStyle = (style: RangeStyle): boolean =>
  Boolean(style.color || style.highlight);

const stylesEqual = (a: RangeStyle, b: RangeStyle): boolean =>
  a.color === b.color && a.highlight === b.highlight;

const buildRange = (
  start: number,
  end: number,
  style: RangeStyle,
): TextStyleRange => {
  const range: {
    start: number;
    end: number;
    color?: string;
    highlight?: string;
  } = { start, end };
  if (style.color) {
    range.color = style.color;
  }
  if (style.highlight) {
    range.highlight = style.highlight;
  }
  return range;
};

const cleanColor = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const cleanHighlight = (value: unknown): string | undefined => {
  const color = cleanColor(value);
  if (!color || isTransparent(color)) {
    return undefined;
  }
  return color;
};

/**
 * Normalizes an array of style ranges:
 * - Clamps offsets to `[0, textLength]` (when `textLength` is provided) and floors to integers.
 * - Drops empty (`start >= end`) or style-less ranges.
 * - Resolves overlaps by splitting into atomic segments where later ranges win per-property.
 * - Merges adjacent segments with identical styles.
 */
export const normalizeTextRanges = (
  ranges: readonly TextStyleRange[] | undefined,
  textLength?: number,
): TextStyleRange[] => {
  if (!ranges || ranges.length === 0) {
    return [];
  }

  const maxLen =
    textLength !== undefined ? Math.max(0, Math.floor(textLength)) : Infinity;

  const cleaned: TextStyleRange[] = [];
  for (const raw of ranges) {
    if (!Number.isFinite(raw.start) || !Number.isFinite(raw.end)) {
      continue;
    }
    const start = Math.max(0, Math.min(maxLen, Math.floor(raw.start)));
    const end = Math.max(0, Math.min(maxLen, Math.floor(raw.end)));
    if (start >= end) {
      continue;
    }
    const color = cleanColor(raw.color);
    const highlight = cleanHighlight(raw.highlight);
    if (!color && !highlight) {
      continue;
    }
    cleaned.push(buildRange(start, end, { color, highlight }));
  }

  if (cleaned.length === 0) {
    return [];
  }

  // Collect all unique boundary points to resolve any overlaps deterministically
  const pointSet = new Set<number>();
  for (const r of cleaned) {
    pointSet.add(r.start);
    pointSet.add(r.end);
  }
  const points = Array.from(pointSet).sort((a, b) => a - b);

  const merged: TextStyleRange[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i];
    const segEnd = points[i + 1];
    if (segStart >= segEnd) {
      continue;
    }

    let color: string | undefined;
    let highlight: string | undefined;
    for (const r of cleaned) {
      if (r.start <= segStart && r.end >= segEnd) {
        if (r.color !== undefined) {
          color = r.color;
        }
        if (r.highlight !== undefined) {
          highlight = r.highlight;
        }
      }
    }

    if (!color && !highlight) {
      continue;
    }

    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.end === segStart &&
      stylesEqual(prev, { color, highlight })
    ) {
      merged[merged.length - 1] = buildRange(prev.start, segEnd, {
        color,
        highlight,
      });
    } else {
      merged.push(buildRange(segStart, segEnd, { color, highlight }));
    }
  }

  return merged;
};

/**
 * Validates and clamps untrusted/persisted `ranges` data (e.g. from JSON files or
 * remote collaborators). Returns `undefined` when empty or invalid so legacy/unstyled
 * elements carry no `ranges` property.
 */
export const sanitizeTextRanges = (
  rawRanges: unknown,
  textLength: number,
): TextStyleRange[] | undefined => {
  if (!Array.isArray(rawRanges) || rawRanges.length === 0) {
    return undefined;
  }

  const candidates: TextStyleRange[] = [];
  for (const item of rawRanges) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const { start, end, color, highlight } = item as Record<string, unknown>;
    if (typeof start !== "number" || typeof end !== "number") {
      continue;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      continue;
    }
    candidates.push({
      start,
      end,
      color: typeof color === "string" ? color : undefined,
      highlight: typeof highlight === "string" ? highlight : undefined,
    });
  }

  const normalized = normalizeTextRanges(candidates, textLength);
  return normalized.length > 0 ? normalized : undefined;
};

/**
 * Applies a color and/or highlight style to `[start, end)`.
 * Pass `null` (or `"transparent"` for highlight) to clear a specific property
 * on `[start, end)` while keeping the other property intact.
 */
export const applyStyleToRange = (
  ranges: readonly TextStyleRange[] | undefined,
  start: number,
  end: number,
  style: {
    color?: string | null;
    highlight?: string | null;
  },
  textLength?: number,
): TextStyleRange[] => {
  const maxLen =
    textLength !== undefined ? Math.max(0, Math.floor(textLength)) : Infinity;
  const clampedStart = Math.max(0, Math.min(maxLen, Math.floor(start)));
  const clampedEnd = Math.max(0, Math.min(maxLen, Math.floor(end)));

  const existing = normalizeTextRanges(ranges, textLength);
  if (clampedStart >= clampedEnd) {
    return existing;
  }

  const hasColorUpdate = style.color !== undefined;
  const hasHighlightUpdate = style.highlight !== undefined;
  if (!hasColorUpdate && !hasHighlightUpdate) {
    return existing;
  }

  const nextColor = hasColorUpdate ? cleanColor(style.color) : undefined;
  const nextHighlight = hasHighlightUpdate
    ? cleanHighlight(style.highlight)
    : undefined;

  // Gather all boundary points including the target [clampedStart, clampedEnd]
  const pointSet = new Set<number>([clampedStart, clampedEnd]);
  for (const r of existing) {
    pointSet.add(r.start);
    pointSet.add(r.end);
  }
  const points = Array.from(pointSet).sort((a, b) => a - b);

  const result: TextStyleRange[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i];
    const segEnd = points[i + 1];
    if (segStart >= segEnd) {
      continue;
    }

    const covering = existing.find(
      (r) => r.start <= segStart && r.end >= segEnd,
    );
    const inTarget = segStart >= clampedStart && segEnd <= clampedEnd;

    let color = covering?.color;
    let highlight = covering?.highlight;

    if (inTarget) {
      if (hasColorUpdate) {
        color = nextColor;
      }
      if (hasHighlightUpdate) {
        highlight = nextHighlight;
      }
    }

    if (!hasStyle({ color, highlight })) {
      continue;
    }

    const prev = result[result.length - 1];
    if (
      prev &&
      prev.end === segStart &&
      stylesEqual(prev, { color, highlight })
    ) {
      result[result.length - 1] = buildRange(prev.start, segEnd, {
        color,
        highlight,
      });
    } else {
      result.push(buildRange(segStart, segEnd, { color, highlight }));
    }
  }

  return result;
};

/**
 * Shifts ranges in response to a splice at `editStart` that deletes
 * `deletedCount` code units and inserts `insertedCount` code units.
 */
export const shiftTextRanges = (
  ranges: readonly TextStyleRange[] | undefined,
  editStart: number,
  deletedCount: number,
  insertedCount: number,
): TextStyleRange[] => {
  if (!ranges || ranges.length === 0) {
    return [];
  }
  if (deletedCount === 0 && insertedCount === 0) {
    return normalizeTextRanges(ranges);
  }

  const deleteEnd = editStart + deletedCount;
  const delta = insertedCount - deletedCount;
  const shifted: TextStyleRange[] = [];

  for (const r of ranges) {
    let nextStart: number;
    let nextEnd: number;

    if (r.end <= editStart) {
      // Strictly before edit (or pure insertion right at end of range)
      nextStart = r.start;
      nextEnd = r.end;
    } else if (r.start >= deleteEnd) {
      // Strictly after deleted region
      nextStart = r.start + delta;
      nextEnd = r.end + delta;
    } else if (r.start < editStart && r.end > deleteEnd) {
      // Edit is strictly inside the range -> expand/shrink range
      nextStart = r.start;
      nextEnd = r.end + delta;
    } else if (r.start >= editStart && r.end > deleteEnd) {
      // Range head was deleted, tail survives after inserted text
      nextStart = editStart + insertedCount;
      nextEnd = r.end + delta;
    } else if (r.start < editStart && r.end <= deleteEnd) {
      // Range tail was deleted, head survives before edit
      nextStart = r.start;
      nextEnd = editStart;
    } else {
      // Entire range was inside [editStart, deleteEnd) -> dropped
      continue;
    }

    if (nextStart < nextEnd) {
      shifted.push(
        buildRange(nextStart, nextEnd, {
          color: r.color,
          highlight: r.highlight,
        }),
      );
    }
  }

  return normalizeTextRanges(shifted);
};

/**
 * Computes the minimal contiguous edit between `prevText` and `nextText`
 * and shifts `ranges` accordingly.
 */
export const shiftTextRangesOnEdit = (
  ranges: readonly TextStyleRange[] | undefined,
  prevText: string,
  nextText: string,
): TextStyleRange[] => {
  if (!ranges || ranges.length === 0) {
    return [];
  }
  if (prevText === nextText) {
    return normalizeTextRanges(ranges, nextText.length);
  }

  const prevLen = prevText.length;
  const nextLen = nextText.length;

  let prefixLen = 0;
  const minLen = Math.min(prevLen, nextLen);
  while (
    prefixLen < minLen &&
    prevText.charCodeAt(prefixLen) === nextText.charCodeAt(prefixLen)
  ) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    prevText.charCodeAt(prevLen - 1 - suffixLen) ===
      nextText.charCodeAt(nextLen - 1 - suffixLen)
  ) {
    suffixLen++;
  }

  const editStart = prefixLen;
  const deletedCount = prevLen - prefixLen - suffixLen;
  const insertedCount = nextLen - prefixLen - suffixLen;

  return normalizeTextRanges(
    shiftTextRanges(ranges, editStart, deletedCount, insertedCount),
    nextLen,
  );
};

/**
 * Maps visual lines (from `element.text`, which may contain soft-wrap newlines
 * and trimmed trailing whitespace) back to end-exclusive code-unit offsets in
 * `element.originalText`.
 */
export const mapWrappedLinesToOriginalOffsets = (
  text: string,
  originalText: string,
): WrappedTextLine[] => {
  const normalizedText = text.replace(/\r\n?/g, "\n");
  const normalizedOriginal = originalText.replace(/\r\n?/g, "\n");
  const visualLines = normalizedText.split("\n");

  const result: WrappedTextLine[] = [];
  let cursor = 0;

  for (let i = 0; i < visualLines.length; i++) {
    const lineText = visualLines[i];
    if (lineText.length === 0) {
      const start = Math.min(cursor, normalizedOriginal.length);
      result.push({ text: "", start, end: start });
      if (normalizedOriginal.charCodeAt(cursor) === 10 /* \n */) {
        cursor++;
      }
      continue;
    }

    let idx = normalizedOriginal.indexOf(lineText, cursor);
    if (idx === -1) {
      // Fallback if NFC normalization during wrapping changed code-unit length
      const nfcOrig = normalizedOriginal.normalize("NFC");
      idx = nfcOrig.indexOf(lineText, cursor);
    }

    if (idx !== -1) {
      const start = idx;
      const end = idx + lineText.length;
      result.push({ text: lineText, start, end });
      cursor = end;
      if (normalizedOriginal.charCodeAt(cursor) === 10 /* \n */) {
        cursor++;
      }
    } else {
      const start = Math.min(cursor, normalizedOriginal.length);
      const end = Math.min(start + lineText.length, normalizedOriginal.length);
      result.push({ text: lineText, start, end });
      cursor = end;
    }
  }

  return result;
};

/**
 * Splits a single visual line (with `originalText` offsets) into consecutive
 * styled runs covering the entire line.
 */
export const getStyledRunsForLine = (
  line: WrappedTextLine,
  ranges: readonly TextStyleRange[] | undefined,
): StyledTextRun[] => {
  if (!line.text.length || !ranges || ranges.length === 0) {
    return [{ text: line.text, start: line.start, end: line.end }];
  }

  const runs: StyledTextRun[] = [];
  let pos = line.start;

  for (const r of ranges) {
    if (r.end <= line.start) {
      continue;
    }
    if (r.start >= line.end) {
      break;
    }

    const overlapStart = Math.max(r.start, line.start);
    const overlapEnd = Math.min(r.end, line.end);

    if (overlapStart > pos) {
      const sliceStart = pos - line.start;
      const sliceEnd = overlapStart - line.start;
      runs.push({
        text: line.text.slice(sliceStart, sliceEnd),
        start: pos,
        end: overlapStart,
      });
    }

    if (overlapEnd > overlapStart) {
      const sliceStart = overlapStart - line.start;
      const sliceEnd = overlapEnd - line.start;
      const run: StyledTextRun = {
        text: line.text.slice(sliceStart, sliceEnd),
        start: overlapStart,
        end: overlapEnd,
      };
      if (r.color) {
        run.color = r.color;
      }
      if (r.highlight) {
        run.highlight = r.highlight;
      }
      runs.push(run);
      pos = overlapEnd;
    }
  }

  if (pos < line.end) {
    runs.push({
      text: line.text.slice(pos - line.start),
      start: pos,
      end: line.end,
    });
  }

  return runs;
};

/**
 * Projects `ranges` (in `originalText` offsets) onto each visual line of `text`.
 */
export const getStyledTextLines = (
  text: string,
  originalText: string,
  ranges: readonly TextStyleRange[] | undefined,
): StyledTextRun[][] => {
  const lines = mapWrappedLinesToOriginalOffsets(text, originalText);
  return lines.map((line) => getStyledRunsForLine(line, ranges));
};

/**
 * Returns the uniform color / highlight across `[start, end)`, or `null` when
 * mixed across that span (for populating color picker UI).
 */
export const getUniformRangeStyle = (
  ranges: readonly TextStyleRange[] | undefined,
  start: number,
  end: number,
  baseStrokeColor: string,
): { color: string | null; highlight: string | null } => {
  if (start >= end) {
    return { color: baseStrokeColor, highlight: "transparent" };
  }
  if (!ranges || ranges.length === 0) {
    return { color: baseStrokeColor, highlight: "transparent" };
  }

  const runs = getStyledRunsForLine(
    { text: " ".repeat(end - start), start, end },
    ranges,
  );
  if (runs.length === 0) {
    return { color: baseStrokeColor, highlight: "transparent" };
  }

  const firstColor = runs[0].color ?? baseStrokeColor;
  const firstHighlight = runs[0].highlight ?? "transparent";
  let uniformColor: string | null = firstColor;
  let uniformHighlight: string | null = firstHighlight;

  for (let i = 1; i < runs.length; i++) {
    const runColor = runs[i].color ?? baseStrokeColor;
    const runHighlight = runs[i].highlight ?? "transparent";
    if (runColor !== uniformColor) {
      uniformColor = null;
    }
    if (runHighlight !== uniformHighlight) {
      uniformHighlight = null;
    }
  }

  return { color: uniformColor, highlight: uniformHighlight };
};
