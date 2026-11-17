import type { TextStyleRange } from "./types";

/**
 * Model of the per-range colour / highlight of a text element.
 *
 * Offsets are UTF-16 indices into `originalText` (not the wrapped `text`),
 * half-open `[start, end)`. The canonical form is: sorted, non-overlapping,
 * non-empty, clamped to the text, no range without `color` and `highlight`,
 * and no two adjacent ranges with an identical style.
 */

export type TextStylePatch = {
  /** `undefined` or "transparent" clears the property */
  color?: string | undefined;
  /** `undefined` or "transparent" clears the property */
  highlight?: string | undefined;
};

/** a single replace: `deletedLength` chars at `start` become `insertedText` */
export type TextEdit = {
  start: number;
  deletedLength: number;
  insertedText: string;
};

type Style = { color?: string; highlight?: string };

const isColor = (value: unknown): value is string =>
  typeof value === "string" && value !== "" && value !== "transparent";

const sameStyle = (a: Style, b: Style) =>
  a.color === b.color && a.highlight === b.highlight;

/** builds a range, leaving out the properties that are not set */
const makeRange = (start: number, end: number, style: Style) => {
  const range: TextStyleRange = { start, end };
  if (style.color !== undefined) {
    range.color = style.color;
  }
  if (style.highlight !== undefined) {
    range.highlight = style.highlight;
  }
  return range;
};

/**
 * Brings (possibly invalid or foreign) ranges to canonical form. Invalid
 * entries are dropped. Where ranges overlap, later ones win per property.
 * Never throws.
 */
export const normalizeTextStyles = (
  styles: unknown,
  textLength: number,
): TextStyleRange[] => {
  if (!Array.isArray(styles) || !(textLength > 0)) {
    return [];
  }
  const max = Math.floor(textLength);

  const valid: TextStyleRange[] = [];
  for (const range of styles) {
    if (!range || typeof range !== "object") {
      continue;
    }
    const { start, end, color, highlight } = range as Record<string, unknown>;
    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      Number.isNaN(start) ||
      Number.isNaN(end)
    ) {
      continue;
    }
    const clampedStart = Math.max(0, Math.min(max, Math.trunc(start)));
    const clampedEnd = Math.max(0, Math.min(max, Math.trunc(end)));
    if (clampedEnd <= clampedStart) {
      continue;
    }
    const style: Style = {};
    if (isColor(color)) {
      style.color = color;
    }
    if (isColor(highlight)) {
      style.highlight = highlight;
    }
    if (style.color === undefined && style.highlight === undefined) {
      continue;
    }
    valid.push(makeRange(clampedStart, clampedEnd, style));
  }

  if (!valid.length) {
    return [];
  }

  const points = [
    ...new Set(valid.flatMap((range) => [range.start, range.end])),
  ].sort((a, b) => a - b);

  const result: TextStyleRange[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const style: Style = {};
    for (const range of valid) {
      if (range.start <= start && range.end >= end) {
        if (range.color !== undefined) {
          style.color = range.color;
        }
        if (range.highlight !== undefined) {
          style.highlight = range.highlight;
        }
      }
    }
    if (style.color === undefined && style.highlight === undefined) {
      continue;
    }
    const prev = result[result.length - 1];
    if (prev && prev.end === start && sameStyle(prev, style)) {
      result[result.length - 1] = makeRange(prev.start, end, style);
    } else {
      result.push(makeRange(start, end, style));
    }
  }
  return result;
};

/** `undefined` for no ranges, so that the element prop can be omitted */
export const toTextStylesProp = (
  styles: readonly TextStyleRange[] | undefined,
): readonly TextStyleRange[] | undefined =>
  styles && styles.length ? styles : undefined;

/**
 * Applies a style to `[start, end)`, splitting / overwriting the existing
 * ranges. A patch property that is `undefined` or "transparent" clears it;
 * a property missing from the patch is left alone.
 */
export const applyTextStyle = (
  styles: readonly TextStyleRange[] | undefined,
  textLength: number,
  start: number,
  end: number,
  patch: TextStylePatch,
): TextStyleRange[] => {
  const existing = normalizeTextStyles(styles, textLength);
  const from = Math.max(0, Math.min(textLength, Math.trunc(start)));
  const to = Math.max(0, Math.min(textLength, Math.trunc(end)));
  if (to <= from) {
    return existing;
  }

  const pieces: { start: number; end: number; style: Style }[] = [];
  const push = (s: number, e: number, style: Style) => {
    if (e > s) {
      pieces.push({ start: s, end: e, style });
    }
  };

  // cut the existing ranges (and the gaps between them) at from / to
  let cursor = 0;
  const sliceInto = (s: number, e: number, style: Style) => {
    push(s, Math.min(e, from), style);
    const innerStart = Math.max(s, from);
    const innerEnd = Math.min(e, to);
    if (innerEnd > innerStart) {
      const next: Style = { ...style };
      if ("color" in patch) {
        if (isColor(patch.color)) {
          next.color = patch.color;
        } else {
          delete next.color;
        }
      }
      if ("highlight" in patch) {
        if (isColor(patch.highlight)) {
          next.highlight = patch.highlight;
        } else {
          delete next.highlight;
        }
      }
      push(innerStart, innerEnd, next);
    }
    push(Math.max(s, to), e, style);
  };
  for (const range of existing) {
    sliceInto(cursor, range.start, {});
    sliceInto(range.start, range.end, range);
    cursor = range.end;
  }
  sliceInto(cursor, textLength, {});

  return normalizeTextStyles(
    pieces.map(({ start, end, style }) => makeRange(start, end, style)),
    textLength,
  );
};

/**
 * Moves the ranges along with a text edit. Text inserted strictly inside a
 * range, or exactly at its end, extends it (it inherits the preceding
 * character's style); inserted at a range's start it does not. Deleted text
 * shrinks / removes ranges.
 */
export const shiftTextStyles = (
  styles: readonly TextStyleRange[] | undefined,
  { start, deletedLength, insertedText }: TextEdit,
): TextStyleRange[] => {
  const ranges = normalizeTextStyles(styles, 2 ** 31);
  if (!ranges.length) {
    return [];
  }
  const deleteEnd = start + deletedLength;
  const inserted = insertedText.length;

  const mapAfterDelete = (p: number) =>
    p <= start ? p : p >= deleteEnd ? p - deletedLength : start;

  const result: TextStyleRange[] = [];
  for (const range of ranges) {
    let s = mapAfterDelete(range.start);
    let e = mapAfterDelete(range.end);
    if (e <= s) {
      continue;
    }
    if (inserted) {
      if (s >= start) {
        // at (or after) the insertion point: moves, does not extend
        s += inserted;
        e += inserted;
      } else if (e >= start) {
        // strictly inside, or exactly at the end
        e += inserted;
      }
    }
    result.push(makeRange(s, e, range));
  }
  return normalizeTextStyles(result, 2 ** 31);
};

/**
 * The single replace that turns `prev` into `next`, by common prefix and
 * suffix. `caret` (the caret after the edit) settles where a pure insertion
 * or deletion happened inside a run of equal characters.
 */
export const diffText = (
  prev: string,
  next: string,
  caret?: number | null,
): TextEdit => {
  let prefix = 0;
  const minLength = Math.min(prev.length, next.length);
  while (prefix < minLength && prev[prefix] === next[prefix]) {
    prefix++;
  }

  if (caret !== undefined && caret !== null && prev !== next) {
    if (next.length > prev.length) {
      const inserted = next.length - prev.length;
      const at = caret - inserted;
      if (
        at >= 0 &&
        at <= prefix &&
        prev.slice(0, at) + next.slice(at, caret) + prev.slice(at) === next
      ) {
        return {
          start: at,
          deletedLength: 0,
          insertedText: next.slice(at, caret),
        };
      }
    } else if (next.length < prev.length) {
      const deleted = prev.length - next.length;
      const at = caret;
      if (
        at >= 0 &&
        at <= prefix &&
        prev.slice(0, at) + prev.slice(at + deleted) === next
      ) {
        return { start: at, deletedLength: deleted, insertedText: "" };
      }
    }
  }

  let suffix = 0;
  const maxSuffix = minLength - prefix;
  while (
    suffix < maxSuffix &&
    prev[prev.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++;
  }
  return {
    start: prefix,
    deletedLength: prev.length - prefix - suffix,
    insertedText: next.slice(prefix, next.length - suffix),
  };
};

/**
 * Styles of an element after its `originalText` changed from `prev` to
 * `next`. Returns the same reference when nothing changed.
 */
export const shiftTextStylesForTextChange = (
  styles: readonly TextStyleRange[] | undefined,
  prev: string,
  next: string,
  opts?: { edit?: TextEdit | null; caret?: number | null },
): readonly TextStyleRange[] | undefined => {
  if (!styles || !styles.length || prev === next) {
    return styles;
  }
  let edit = opts?.edit;
  // an edit that is not the one from `prev` to `next` is stale
  if (
    !edit ||
    prev.slice(0, edit.start) +
      edit.insertedText +
      prev.slice(edit.start + edit.deletedLength) !==
      next
  ) {
    edit = diffText(prev, next, opts?.caret);
  }
  return toTextStylesProp(
    normalizeTextStyles(shiftTextStyles(styles, edit), next.length),
  );
};

export const getTextStyleAt = (
  styles: readonly TextStyleRange[] | undefined,
  index: number,
): TextStyleRange | null => {
  if (!styles) {
    return null;
  }
  for (const range of styles) {
    if (index >= range.start && index < range.end) {
      return range;
    }
  }
  return null;
};

export type TextStyleRun = {
  text: string;
  color?: string;
  highlight?: string;
};

/**
 * Maps each line of the wrapped `text` to runs of equally styled characters,
 * by walking the wrapped text and `originalText` together: wrapping inserts
 * "\n" and may drop whitespace at the breaks. Out-of-range or stale
 * `textStyles` are clamped; never throws.
 *
 * Lines without any text have no runs.
 */
export const getTextStyleRunsByLine = (
  text: string,
  originalText: string,
  textStyles: readonly TextStyleRange[] | undefined,
): TextStyleRun[][] => {
  const ranges = normalizeTextStyles(textStyles, originalText.length);
  const lines: TextStyleRun[][] = [[]];
  let rangeIndex = 0;
  let i = 0;

  const isSoftWhitespace = (char: string | undefined) =>
    char !== undefined && char !== "\n" && /\s/.test(char);

  const styleAt = (index: number): Style => {
    while (rangeIndex < ranges.length && ranges[rangeIndex].end <= index) {
      rangeIndex++;
    }
    const range = ranges[rangeIndex];
    return range && range.start <= index ? range : {};
  };

  for (let j = 0; j < text.length; j++) {
    const char = text[j];
    if (char === "\n") {
      let k = i;
      while (isSoftWhitespace(originalText[k])) {
        k++;
      }
      if (originalText[k] === "\n") {
        i = k + 1;
      }
      lines.push([]);
      continue;
    }

    // whitespace dropped at a wrap boundary
    if (originalText[i] !== char) {
      let k = i;
      while (isSoftWhitespace(originalText[k])) {
        k++;
      }
      if (originalText[k] === char) {
        i = k;
      }
    }

    const matched = originalText[i] === char;
    const style: Style = matched ? styleAt(i) : {};
    if (matched) {
      i++;
    }

    const line = lines[lines.length - 1];
    const last = line[line.length - 1];
    if (last && sameStyle(last, style)) {
      last.text += char;
    } else {
      const run: TextStyleRun = { text: char };
      if (style.color !== undefined) {
        run.color = style.color;
      }
      if (style.highlight !== undefined) {
        run.highlight = style.highlight;
      }
      line.push(run);
    }
  }

  return lines;
};
