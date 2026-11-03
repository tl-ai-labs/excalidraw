import {
  getFontString,
  getUpdatedTimestamp,
  isRTL,
  randomInteger,
} from "@excalidraw/common";

import { getLineWidth } from "./textMeasurements";

import type { RenderEnvironment } from "./renderEnvironment";
import type { ExcalidrawTextElement, TextStyleRange } from "./types";

/**
 * Pure range model for styled text runs.
 *
 * Ranges are UTF-16 offsets into `originalText` (start inclusive, end
 * exclusive). Every helper returns new arrays/objects and never mutates its
 * inputs.
 */

export type StyledTextRun = {
  text: string;
  color?: string;
  highlight?: string;
};

export type StyledTextLine = { runs: StyledTextRun[] };

export type LaidOutTextRun = StyledTextRun & { x: number; width: number };

export type TextStylePatch = {
  color?: string | null;
  highlight?: string | null;
};

type Attrs = { color?: string; highlight?: string };

const EMPTY_RANGES: readonly TextStyleRange[] = Object.freeze([]);

const isInt = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isInteger(value);

/** Maximum number of style ranges accepted from input; extra entries are dropped. */
export const MAX_STYLE_RANGES = 1000;

/** Maximum length of a color/highlight value. */
export const MAX_STYLE_COLOR_LENGTH = 64;

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL_COLOR_RE = /^(?:rgba?|hsla?)\([0-9a-z.,%\s/+-]*\)$/i;
const NAMED_COLOR_RE = /^[a-z]+$/i;

/**
 * True for a string of length 1..MAX_STYLE_COLOR_LENGTH that looks like a CSS
 * colour: hex, rgb()/rgba()/hsl()/hsla(), or a plain alphabetic name.
 */
export const isPlausibleStyleColor = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= MAX_STYLE_COLOR_LENGTH &&
  (HEX_COLOR_RE.test(value) ||
    FUNCTIONAL_COLOR_RE.test(value) ||
    NAMED_COLOR_RE.test(value));

const makeRange = (
  start: number,
  end: number,
  attrs: Attrs,
): TextStyleRange => ({
  start,
  end,
  ...(attrs.color !== undefined ? { color: attrs.color } : {}),
  ...(attrs.highlight !== undefined ? { highlight: attrs.highlight } : {}),
});

const hasAttrs = (attrs: Attrs) =>
  attrs.color !== undefined || attrs.highlight !== undefined;

/**
 * Clamp, de-overlap (later entries win per attribute), sort and merge ranges.
 */
export const normalizeStyleRanges = (
  ranges: readonly TextStyleRange[],
  textLength: number,
): TextStyleRange[] => {
  const length = Math.max(0, Math.floor(textLength) || 0);
  const valid: { start: number; end: number; attrs: Attrs }[] = [];
  for (const range of ranges.slice(0, MAX_STYLE_RANGES)) {
    if (!range || !isInt(range.start) || !isInt(range.end)) {
      continue;
    }
    const attrs: Attrs = {};
    if (isPlausibleStyleColor(range.color)) {
      attrs.color = range.color;
    }
    if (isPlausibleStyleColor(range.highlight)) {
      attrs.highlight = range.highlight;
    }
    if (!hasAttrs(attrs)) {
      continue;
    }
    const start = Math.min(Math.max(range.start, 0), length);
    const end = Math.min(Math.max(range.end, 0), length);
    if (end <= start) {
      continue;
    }
    valid.push({ start, end, attrs });
  }
  if (!valid.length) {
    return [];
  }

  const boundaries = Array.from(
    new Set(valid.flatMap((r) => [r.start, r.end])),
  ).sort((a, b) => a - b);
  const segments: Attrs[] = boundaries.slice(0, -1).map(() => ({}));
  const indexOf = new Map(boundaries.map((b, i) => [b, i]));

  for (const range of valid) {
    const from = indexOf.get(range.start)!;
    const to = indexOf.get(range.end)!;
    for (let i = from; i < to; i++) {
      if (range.attrs.color !== undefined) {
        segments[i].color = range.attrs.color;
      }
      if (range.attrs.highlight !== undefined) {
        segments[i].highlight = range.attrs.highlight;
      }
    }
  }

  const result: TextStyleRange[] = [];
  for (let i = 0; i < segments.length; i++) {
    const attrs = segments[i];
    if (!hasAttrs(attrs)) {
      continue;
    }
    const prev = result[result.length - 1];
    if (
      prev &&
      prev.end === boundaries[i] &&
      prev.color === attrs.color &&
      prev.highlight === attrs.highlight
    ) {
      result[result.length - 1] = makeRange(
        prev.start,
        boundaries[i + 1],
        attrs,
      );
    } else {
      result.push(makeRange(boundaries[i], boundaries[i + 1], attrs));
    }
  }
  return result;
};

/**
 * Apply a style patch to [start, end). String values set an attribute, null
 * clears it, absent keys keep it.
 */
export const applyStyle = (
  ranges: readonly TextStyleRange[],
  start: number,
  end: number,
  patch: TextStylePatch,
  textLength: number,
): readonly TextStyleRange[] => {
  if (end <= start) {
    return ranges;
  }
  const existing = normalizeStyleRanges(ranges, textLength);
  const boundaries = Array.from(
    new Set([start, end, ...existing.flatMap((r) => [r.start, r.end])]),
  ).sort((a, b) => a - b);

  const result: TextStyleRange[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const segStart = boundaries[i];
    const segEnd = boundaries[i + 1];
    const covering = existing.find(
      (r) => r.start <= segStart && r.end >= segEnd,
    );
    const attrs: Attrs = covering
      ? {
          ...(covering.color !== undefined ? { color: covering.color } : {}),
          ...(covering.highlight !== undefined
            ? { highlight: covering.highlight }
            : {}),
        }
      : {};
    if (segStart >= start && segEnd <= end) {
      if (typeof patch.color === "string") {
        attrs.color = patch.color;
      } else if (patch.color === null) {
        delete attrs.color;
      }
      if (typeof patch.highlight === "string") {
        attrs.highlight = patch.highlight;
      } else if (patch.highlight === null) {
        delete attrs.highlight;
      }
    }
    if (hasAttrs(attrs)) {
      result.push(makeRange(segStart, segEnd, attrs));
    }
  }
  return normalizeStyleRanges(result, textLength);
};

/**
 * Shift ranges after a single contiguous edit from oldText to newText.
 */
export const shiftRangesForEdit = (
  ranges: readonly TextStyleRange[],
  oldText: string,
  newText: string,
): readonly TextStyleRange[] => {
  if (oldText === newText) {
    return ranges;
  }
  const minLength = Math.min(oldText.length, newText.length);
  let p = 0;
  while (p < minLength && oldText[p] === newText[p]) {
    p++;
  }
  let s = 0;
  while (
    s < minLength - p &&
    oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]
  ) {
    s++;
  }
  const oldEnd = oldText.length - s;
  const ins = newText.length - p - s;
  const delta = ins - (oldEnd - p);

  const mapStart = (x: number) => {
    if (x < p) {
      return x;
    }
    if (x >= oldEnd) {
      return x + delta;
    }
    return p;
  };

  const mapEnd = (x: number, start: number) => {
    if (x < p) {
      return x;
    }
    if (x === p && start < p) {
      return p;
    }
    if (x >= oldEnd) {
      return x + delta;
    }
    return p;
  };

  const shifted: TextStyleRange[] = [];
  for (const range of ranges) {
    const start = mapStart(range.start);
    const end = mapEnd(range.end, range.start);
    if (end > start) {
      shifted.push({ ...range, start, end });
    }
  }
  return normalizeStyleRanges(shifted, newText.length);
};

/**
 * Validate untrusted styleRanges from saved/imported data.
 */
export const restoreStyleRanges = (
  value: unknown,
  originalText: string,
): TextStyleRange[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const kept: TextStyleRange[] = [];
  for (const entry of value.slice(0, MAX_STYLE_RANGES)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const { start, end, color, highlight } = entry as Record<string, unknown>;
    if (!isInt(start) || !isInt(end)) {
      continue;
    }
    const attrs: Attrs = {
      ...(isPlausibleStyleColor(color) ? { color } : {}),
      ...(isPlausibleStyleColor(highlight) ? { highlight } : {}),
    };
    if (!hasAttrs(attrs)) {
      continue;
    }
    kept.push(makeRange(start, end, attrs));
  }
  const normalized = normalizeStyleRanges(kept, originalText.length);
  return normalized.length ? normalized : undefined;
};

export const getStyleRanges = (
  element: ExcalidrawTextElement,
): readonly TextStyleRange[] =>
  Array.isArray(element.styleRanges) && element.styleRanges.length > 0
    ? element.styleRanges
    : EMPTY_RANGES;

export const hasStyleRanges = (element: ExcalidrawTextElement): boolean =>
  getStyleRanges(element).length > 0;

const rangesEqual = (
  a: readonly TextStyleRange[],
  b: readonly TextStyleRange[],
) =>
  a.length === b.length &&
  a.every(
    (r, i) =>
      r.start === b[i].start &&
      r.end === b[i].end &&
      r.color === b[i].color &&
      r.highlight === b[i].highlight,
  );

/**
 * Return a new element carrying the normalized ranges (key absent when
 * empty), or the same element when nothing changes.
 */
export const withStyleRanges = <T extends ExcalidrawTextElement>(
  element: T,
  ranges: readonly TextStyleRange[],
  textLength: number = element.originalText.length,
): T => {
  const normalized = normalizeStyleRanges(ranges, textLength);
  if (rangesEqual(normalized, getStyleRanges(element))) {
    return element;
  }
  const next: T = { ...element };
  delete (next as { styleRanges?: readonly TextStyleRange[] }).styleRanges;
  return {
    ...next,
    ...(normalized.length ? { styleRanges: normalized } : {}),
    version: element.version + 1,
    versionNonce: randomInteger(),
    updated: getUpdatedTimestamp(),
  };
};

/**
 * Split ranges over the wrapped lines, aligning wrapped text back to
 * originalText. Never throws; unmatched chars become unstyled.
 */
export const splitRangesIntoLines = (
  originalText: string,
  wrappedText: string,
  ranges: readonly TextStyleRange[],
): StyledTextLine[] => {
  const original = originalText.replace(/\r\n?/g, "\n");
  const normalized = normalizeStyleRanges(ranges, original.length);
  const lines = wrappedText.replace(/\r\n?/g, "\n").split("\n");

  // Matched offsets only increase, so walk the sorted ranges with a pointer.
  let rangeIndex = 0;
  const rangeAt = (offset: number): TextStyleRange | undefined => {
    if (offset < 0) {
      return undefined;
    }
    while (
      rangeIndex < normalized.length &&
      normalized[rangeIndex].end <= offset
    ) {
      rangeIndex++;
    }
    const range = normalized[rangeIndex];
    return range && range.start <= offset ? range : undefined;
  };

  let cursor = 0;
  return lines.map((line) => {
    if (line.length > 0) {
      while (
        cursor < original.length &&
        original[cursor] !== line[0] &&
        (original[cursor] === " " || original[cursor] === "\n")
      ) {
        cursor++;
      }
    }

    const runs: { text: string; range: TextStyleRange | undefined }[] = [];
    for (const char of line.split("")) {
      let offset = -1;
      while (cursor < original.length) {
        if (original[cursor] === char) {
          offset = cursor;
          cursor++;
          break;
        }
        if (original[cursor] === "\n") {
          break;
        }
        cursor++;
      }
      const range = rangeAt(offset);
      const last = runs[runs.length - 1];
      if (last && last.range === range) {
        last.text += char;
      } else {
        runs.push({ text: char, range });
      }
    }

    if (original[cursor] === "\n") {
      cursor++;
    }

    if (!runs.length) {
      return { runs: [{ text: "" }] };
    }
    return {
      runs: runs.map(({ text, range }) => ({
        text,
        ...(range?.color !== undefined ? { color: range.color } : {}),
        ...(range?.highlight !== undefined
          ? { highlight: range.highlight }
          : {}),
      })),
    };
  });
};

/**
 * Lay out styled runs per wrapped line (absolute x and width per run), or
 * null when the element has no style ranges.
 */
export const getStyledTextLines = (
  element: ExcalidrawTextElement,
  env: RenderEnvironment | undefined,
): { runs: LaidOutTextRun[] }[] | null => {
  if (!hasStyleRanges(element)) {
    return null;
  }
  const font = getFontString(element);
  const lines = splitRangesIntoLines(
    element.originalText,
    element.text,
    getStyleRanges(element),
  );
  return lines.map((line) => {
    const widths = line.runs.map((run) => getLineWidth(run.text, font, env));
    const lineWidth = widths.reduce((sum, w) => sum + w, 0);
    const lineStart =
      element.textAlign === "center"
        ? (element.width - lineWidth) / 2
        : element.textAlign === "right"
        ? element.width - lineWidth
        : 0;
    const rtl = isRTL(line.runs.map((run) => run.text).join(""));
    let x = rtl ? lineStart + lineWidth : lineStart;
    const runs = line.runs.map((run, i): LaidOutTextRun => {
      const width = widths[i];
      let runX: number;
      if (rtl) {
        x -= width;
        runX = x;
      } else {
        runX = x;
        x += width;
      }
      return { ...run, x: runX, width };
    });
    return { runs };
  });
};
