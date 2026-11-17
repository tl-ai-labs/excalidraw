import { isTransparent } from "@excalidraw/common";

import type { TextStyleRange } from "./types";

export type TextStylePatch = {
  color?: string | null;
  highlight?: string | null;
};

export type MappedTextLine = {
  text: string;
  start: number;
  end: number;
};

export type StyledTextRun = {
  text: string;
  start: number;
  end: number;
  color?: string;
  highlight?: string;
};

const makeRange = (
  start: number,
  end: number,
  color?: string,
  highlight?: string,
): TextStyleRange => ({
  start,
  end,
  ...(color !== undefined ? { color } : {}),
  ...(highlight !== undefined ? { highlight } : {}),
});

const sanitizeColor = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const sanitizeHighlight = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 && !isTransparent(value)
    ? value
    : undefined;

const mergeAdjacentRanges = (
  ranges: readonly TextStyleRange[],
): TextStyleRange[] => {
  const merged: TextStyleRange[] = [];
  for (const range of ranges) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.end === range.start &&
      prev.color === range.color &&
      prev.highlight === range.highlight
    ) {
      merged[merged.length - 1] = makeRange(
        prev.start,
        range.end,
        prev.color,
        prev.highlight,
      );
    } else {
      merged.push(range);
    }
  }
  return merged;
};

/**
 * Normalizes style ranges against `textLength`:
 * - clamps offsets to `[0, textLength]`
 * - drops invalid, empty, or style-less ranges
 * - splits overlaps so later ranges in the input win
 * - sorts ascending by `start` and merges adjacent ranges with identical styles
 */
export const normalizeTextStyleRanges = (
  ranges: readonly TextStyleRange[] | undefined,
  textLength: number,
): TextStyleRange[] => {
  if (!ranges || ranges.length === 0 || textLength <= 0) {
    return [];
  }

  type IndexedRange = {
    start: number;
    end: number;
    color?: string;
    highlight?: string;
    order: number;
  };

  const valid: IndexedRange[] = [];
  const pointSet = new Set<number>();

  for (let i = 0; i < ranges.length; i++) {
    const raw = ranges[i];
    if (!raw || !Number.isFinite(raw.start) || !Number.isFinite(raw.end)) {
      continue;
    }
    const start = Math.max(0, Math.min(textLength, Math.trunc(raw.start)));
    const end = Math.max(0, Math.min(textLength, Math.trunc(raw.end)));
    if (start >= end) {
      continue;
    }
    const color = sanitizeColor(raw.color);
    const highlight = sanitizeHighlight(raw.highlight);
    if (!color && !highlight) {
      continue;
    }
    valid.push({ start, end, color, highlight, order: i });
    pointSet.add(start);
    pointSet.add(end);
  }

  if (valid.length === 0) {
    return [];
  }

  const points = Array.from(pointSet).sort((a, b) => a - b);
  const split: TextStyleRange[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    let winner: IndexedRange | null = null;
    for (const r of valid) {
      if (r.start <= a && r.end >= b) {
        if (!winner || r.order > winner.order) {
          winner = r;
        }
      }
    }
    if (winner) {
      split.push(makeRange(a, b, winner.color, winner.highlight));
    }
  }

  return mergeAdjacentRanges(split);
};

/**
 * Applies a style patch (`color` and/or `highlight`, where `null` removes the
 * property) to `[start, end)` while preserving orthogonal properties.
 */
export const applyTextStyleRange = (
  ranges: readonly TextStyleRange[] | undefined,
  textLength: number,
  start: number,
  end: number,
  patch: TextStylePatch,
): TextStyleRange[] => {
  const normalized = normalizeTextStyleRanges(ranges, textLength);
  if (textLength <= 0 || !Number.isFinite(start) || !Number.isFinite(end)) {
    return normalized;
  }

  const clampedStart = Math.max(0, Math.min(textLength, Math.trunc(start)));
  const clampedEnd = Math.max(0, Math.min(textLength, Math.trunc(end)));
  if (clampedStart >= clampedEnd) {
    return normalized;
  }

  const pointSet = new Set<number>([clampedStart, clampedEnd]);
  for (const r of normalized) {
    pointSet.add(r.start);
    pointSet.add(r.end);
  }

  const points = Array.from(pointSet).sort((a, b) => a - b);
  const result: TextStyleRange[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const existing = normalized.find((r) => r.start <= a && r.end >= b);
    const inPatch = a >= clampedStart && b <= clampedEnd;

    let color = existing?.color;
    let highlight = existing?.highlight;

    if (inPatch) {
      if (patch.color !== undefined) {
        color = patch.color === null ? undefined : sanitizeColor(patch.color);
      }
      if (patch.highlight !== undefined) {
        highlight =
          patch.highlight === null
            ? undefined
            : sanitizeHighlight(patch.highlight);
      }
    }

    if (color || highlight) {
      result.push(makeRange(a, b, color, highlight));
    }
  }

  return mergeAdjacentRanges(result);
};

/**
 * Adjusts `ranges` for a text change from `oldText` to `newText` using a
 * common-prefix/common-suffix diff:
 * - deleted parts are removed from ranges
 * - text inserted strictly inside a range or at its end inherits that range's style
 * - text inserted at a range's start does not inherit its style
 */
export const adjustTextStyleRangesForTextChange = (
  ranges: readonly TextStyleRange[] | undefined,
  oldText: string,
  newText: string,
): TextStyleRange[] => {
  if (oldText === newText) {
    return normalizeTextStyleRanges(ranges, newText.length);
  }
  const normalized = normalizeTextStyleRanges(ranges, oldText.length);
  if (normalized.length === 0 || newText.length === 0) {
    return [];
  }

  const minLen = Math.min(oldText.length, newText.length);
  let prefix = 0;
  while (
    prefix < minLen &&
    oldText.charCodeAt(prefix) === newText.charCodeAt(prefix)
  ) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    oldText.charCodeAt(oldText.length - 1 - suffix) ===
      newText.charCodeAt(newText.length - 1 - suffix)
  ) {
    suffix++;
  }

  const editStart = prefix;
  const oldEditEnd = oldText.length - suffix;
  const newEditEnd = newText.length - suffix;
  const insertedLen = newEditEnd - editStart;
  const deletedLen = oldEditEnd - editStart;
  const delta = insertedLen - deletedLen;

  const next: TextStyleRange[] = [];

  for (const r of normalized) {
    if (r.start < editStart) {
      next.push(
        makeRange(r.start, Math.min(r.end, editStart), r.color, r.highlight),
      );
    }

    if (insertedLen > 0 && r.start < editStart && editStart <= r.end) {
      next.push(
        makeRange(editStart, editStart + insertedLen, r.color, r.highlight),
      );
    }

    if (r.end > oldEditEnd) {
      next.push(
        makeRange(
          Math.max(r.start, oldEditEnd) + delta,
          r.end + delta,
          r.color,
          r.highlight,
        ),
      );
    }
  }

  return normalizeTextStyleRanges(next, newText.length);
};

/**
 * Maps each visual line of wrapped `wrappedText` back to `[start, end)` UTF-16
 * code-unit offsets in `originalText` by walking both strings.
 */
export const mapWrappedLinesToOriginalOffsets = (
  originalText: string,
  wrappedText: string,
): MappedTextLine[] => {
  const lines = wrappedText.replace(/\r\n?/g, "\n").split("\n");
  const result: MappedTextLine[] = [];
  let origIdx = 0;
  const origLen = originalText.length;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    if (lineIdx > 0) {
      // Skip whitespace trimmed at a soft wrap point (do not cross hard breaks)
      while (
        origIdx < origLen &&
        originalText[origIdx] !== "\n" &&
        originalText[origIdx] !== "\r" &&
        /\s/.test(originalText[origIdx])
      ) {
        origIdx++;
      }
      if (origIdx < origLen && originalText[origIdx] === "\r") {
        origIdx++;
        if (origIdx < origLen && originalText[origIdx] === "\n") {
          origIdx++;
        }
      } else if (origIdx < origLen && originalText[origIdx] === "\n") {
        origIdx++;
      }
    }

    const start = origIdx;
    for (let j = 0; j < line.length && origIdx < origLen; j++) {
      if (originalText[origIdx] === line[j]) {
        origIdx++;
      } else {
        const found = originalText.indexOf(line[j], origIdx);
        if (found !== -1 && found - origIdx < 16) {
          origIdx = found + 1;
        }
      }
    }
    const end = origIdx;

    result.push({ text: line, start, end });
  }

  return result;
};

/**
 * Splits a single line (`lineText`, starting at `lineStart` in `originalText`)
 * into contiguous `StyledTextRun`s according to normalized `ranges`.
 */
export const splitLineIntoStyledRuns = (
  lineText: string,
  lineStart: number,
  ranges: readonly TextStyleRange[] | undefined,
): StyledTextRun[] => {
  const lineEnd = lineStart + lineText.length;
  if (!ranges || ranges.length === 0 || lineText.length === 0) {
    return [{ text: lineText, start: lineStart, end: lineEnd }];
  }

  const runs: StyledTextRun[] = [];
  let pos = lineStart;

  for (const r of ranges) {
    if (r.end <= lineStart) {
      continue;
    }
    if (r.start >= lineEnd) {
      break;
    }
    if (r.start > pos) {
      runs.push({
        text: lineText.slice(pos - lineStart, r.start - lineStart),
        start: pos,
        end: r.start,
      });
    }
    const runStart = Math.max(pos, r.start);
    const runEnd = Math.min(lineEnd, r.end);
    if (runStart < runEnd) {
      runs.push({
        text: lineText.slice(runStart - lineStart, runEnd - lineStart),
        start: runStart,
        end: runEnd,
        ...(r.color !== undefined ? { color: r.color } : {}),
        ...(r.highlight !== undefined ? { highlight: r.highlight } : {}),
      });
      pos = runEnd;
    }
  }

  if (pos < lineEnd) {
    runs.push({
      text: lineText.slice(pos - lineStart, lineEnd - lineStart),
      start: pos,
      end: lineEnd,
    });
  }

  return runs;
};
