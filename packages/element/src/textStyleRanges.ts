import type {
  ExcalidrawTextElement,
  TextStyleProperty,
  TextStyleRange,
} from "./types";

/**
 * Styled ranges of a text element: parts of its `originalText` colored or
 * highlighted on their own (see `ExcalidrawTextElement["styleRanges"]`).
 *
 * The ranges are kept normalized — sorted, non-overlapping, non-empty, each
 * carrying some style, and adjacent ranges of the same style merged — so
 * that equal styling always serializes the same (which keeps collaboration
 * and history diffs quiet).
 */

export const TEXT_STYLE_PROPERTIES: readonly TextStyleProperty[] = [
  "strokeColor",
  "backgroundColor",
];

export type TextStyle = Partial<Record<TextStyleProperty, string>>;

/** a style to apply: a value sets the property, `null` clears it */
export type TextStylePatch = Partial<Record<TextStyleProperty, string | null>>;

const RANGE_KEYS = new Set<string>(["start", "end", ...TEXT_STYLE_PROPERTIES]);

const EMPTY_RANGES: readonly TextStyleRange[] = Object.freeze([]);

const isStyleValue = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const getStyle = (range: TextStyle): TextStyle => {
  const style: TextStyle = {};
  for (const property of TEXT_STYLE_PROPERTIES) {
    if (isStyleValue(range[property])) {
      style[property] = range[property];
    }
  }
  return style;
};

const hasStyle = (style: TextStyle) =>
  TEXT_STYLE_PROPERTIES.some((property) => isStyleValue(style[property]));

const isSameStyle = (a: TextStyle, b: TextStyle) =>
  TEXT_STYLE_PROPERTIES.every((property) => a[property] === b[property]);

const makeRange = (
  start: number,
  end: number,
  style: TextStyle,
): TextStyleRange => ({ start, end, ...getStyle(style) });

/**
 * The styled ranges of a text element, as they're stored (the same, frozen,
 * empty array if there are none).
 */
export const getTextStyleRanges = (
  element: Partial<Pick<ExcalidrawTextElement, "styleRanges">>,
): readonly TextStyleRange[] => element.styleRanges ?? EMPTY_RANGES;

export const hasTextStyleRanges = (
  element: Partial<Pick<ExcalidrawTextElement, "styleRanges">>,
) => !!element.styleRanges?.length;

const areRangesEqual = (
  a: readonly TextStyleRange[],
  b: readonly TextStyleRange[],
) =>
  a.length === b.length &&
  a.every(
    (range, index) =>
      range.start === b[index].start &&
      range.end === b[index].end &&
      isSameStyle(range, b[index]),
  );

/**
 * Brings ranges into their canonical form, from anything (e.g. a file or a
 * remote peer): drops malformed and empty ranges and styles, clamps to the
 * text, lets later ranges win where they overlap, and merges adjacent ranges
 * of the same style.
 *
 * Returns `ranges` itself if it's already normalized.
 */
export const normalizeTextStyleRanges = (
  ranges: unknown,
  textLength: number,
): readonly TextStyleRange[] => {
  if (!Array.isArray(ranges) || !ranges.length) {
    return EMPTY_RANGES;
  }

  let normalized: readonly TextStyleRange[] = EMPTY_RANGES;
  for (const range of ranges) {
    if (
      !range ||
      typeof range !== "object" ||
      !Number.isFinite(range.start) ||
      !Number.isFinite(range.end)
    ) {
      continue;
    }
    const style = getStyle(range);
    if (!hasStyle(style)) {
      continue;
    }
    const start = Math.max(0, Math.min(textLength, Math.floor(range.start)));
    const end = Math.max(0, Math.min(textLength, Math.floor(range.end)));
    if (start >= end) {
      continue;
    }
    // a later range overrides an earlier one where they overlap
    normalized = applyStyle(normalized, start, end, {
      strokeColor: style.strokeColor ?? null,
      backgroundColor: style.backgroundColor ?? null,
    });
  }

  return areRangesEqual(ranges as TextStyleRange[], normalized) &&
    ranges.every((range) =>
      Object.keys(range).every((key) => RANGE_KEYS.has(key)),
    )
    ? (ranges as TextStyleRange[])
    : normalized;
};

/** sorts, drops style-less and empty ranges, merges adjacent equal ones */
const compact = (ranges: TextStyleRange[]): readonly TextStyleRange[] => {
  const sorted = ranges
    .filter((range) => range.start < range.end && hasStyle(range))
    .sort((a, b) => a.start - b.start);
  const result: TextStyleRange[] = [];
  for (const range of sorted) {
    const last = result[result.length - 1];
    if (last && last.end === range.start && isSameStyle(last, range)) {
      result[result.length - 1] = makeRange(last.start, range.end, last);
    } else {
      result.push(range);
    }
  }
  return result.length ? result : EMPTY_RANGES;
};

const applyStyle = (
  ranges: readonly TextStyleRange[],
  start: number,
  end: number,
  patch: TextStylePatch,
): readonly TextStyleRange[] => {
  const patchStyle = (style: TextStyle): TextStyle => {
    const next = { ...getStyle(style) };
    for (const property of TEXT_STYLE_PROPERTIES) {
      const value = patch[property];
      if (value === null) {
        delete next[property];
      } else if (isStyleValue(value)) {
        next[property] = value;
      }
    }
    return next;
  };

  const next: TextStyleRange[] = [];
  // the parts of [start, end) not covered by any range yet
  let uncoveredFrom = start;

  for (const range of ranges) {
    if (range.end <= start || range.start >= end) {
      next.push(range);
      continue;
    }
    if (range.start < start) {
      next.push(makeRange(range.start, start, range));
    }
    const overlapStart = Math.max(range.start, start);
    const overlapEnd = Math.min(range.end, end);
    if (uncoveredFrom < overlapStart) {
      next.push(makeRange(uncoveredFrom, overlapStart, patchStyle({})));
    }
    next.push(makeRange(overlapStart, overlapEnd, patchStyle(range)));
    uncoveredFrom = overlapEnd;
    if (range.end > end) {
      next.push(makeRange(end, range.end, range));
    }
  }
  if (uncoveredFrom < end) {
    next.push(makeRange(uncoveredFrom, end, patchStyle({})));
  }

  return compact(next);
};

/**
 * Styles `[start, end)` of the text: sets the patch's values over the range,
 * and clears the properties it sets to `null`, leaving the rest of the
 * ranges' styles be.
 */
export const applyTextStyleToRange = (
  ranges: readonly TextStyleRange[] | undefined,
  start: number,
  end: number,
  patch: TextStylePatch,
  textLength: number,
): readonly TextStyleRange[] => {
  const from = Math.max(0, Math.min(start, end, textLength));
  const to = Math.min(textLength, Math.max(start, end, 0));
  const current = normalizeTextStyleRanges(ranges ?? EMPTY_RANGES, textLength);
  if (from >= to) {
    return current;
  }
  const next = applyStyle(current, from, to, patch);
  return areRangesEqual(current, next) ? current : next;
};

/**
 * Clears a style property everywhere — e.g. once the whole text is colored,
 * no part of it keeps a color of its own.
 */
export const clearTextStyleProperty = (
  ranges: readonly TextStyleRange[] | undefined,
  property: TextStyleProperty,
): readonly TextStyleRange[] => {
  if (!ranges?.length || !ranges.some((range) => range[property])) {
    return ranges ?? EMPTY_RANGES;
  }
  return compact(
    ranges.map((range) => {
      const style = { ...getStyle(range) };
      delete style[property];
      return makeRange(range.start, range.end, style);
    }),
  );
};

/**
 * The value of a style property over `[start, end)`: the value if all of it
 * has the same, `null` if none of it has any, `undefined` if it's mixed.
 */
export const getTextStyleOfRange = (
  ranges: readonly TextStyleRange[] | undefined,
  start: number,
  end: number,
  property: TextStyleProperty,
): string | null | undefined => {
  if (start >= end) {
    return null;
  }
  let value: string | null | undefined;
  let covered = start;
  for (const range of ranges ?? EMPTY_RANGES) {
    if (range.end <= start || range.start >= end) {
      continue;
    }
    const rangeValue = range[property] ?? null;
    if (range.start > covered) {
      // an unstyled gap
      if (value !== undefined && value !== null) {
        return undefined;
      }
      value = null;
    }
    if (value !== undefined && value !== rangeValue) {
      return undefined;
    }
    value = rangeValue;
    covered = Math.min(range.end, end);
  }
  if (covered < end) {
    if (value !== undefined && value !== null) {
      return undefined;
    }
    value = null;
  }
  return value ?? null;
};

// -----------------------------------------------------------------------------
// text edits
// -----------------------------------------------------------------------------

/**
 * A text edit, as a single splice: `deleteCount` code units at `index`
 * replaced by `insertCount` new ones.
 */
export type TextSplice = {
  index: number;
  deleteCount: number;
  insertCount: number;
};

/**
 * The splice that turns `prevText` into `nextText`.
 *
 * Where the edit is ambiguous (typing `a` into `aa`), `caret` — where the
 * caret is in `nextText` after the edit, i.e. at the end of what was typed
 * or pasted, or where text was deleted — tells where it happened.
 */
export const getTextSplice = (
  prevText: string,
  nextText: string,
  caret?: number | null,
): TextSplice | null => {
  if (prevText === nextText) {
    return null;
  }
  const delta = nextText.length - prevText.length;

  if (caret != null && Number.isInteger(caret)) {
    // typed / pasted ending at the caret
    if (delta > 0 && caret - delta >= 0 && caret <= nextText.length) {
      const index = caret - delta;
      if (
        prevText.slice(0, index) === nextText.slice(0, index) &&
        prevText.slice(index) === nextText.slice(caret)
      ) {
        return { index, deleteCount: 0, insertCount: delta };
      }
    }
    // deleted at the caret
    if (delta < 0 && caret >= 0 && caret - delta <= prevText.length) {
      if (
        prevText.slice(0, caret) === nextText.slice(0, caret) &&
        prevText.slice(caret - delta) === nextText.slice(caret)
      ) {
        return { index: caret, deleteCount: -delta, insertCount: 0 };
      }
    }
  }

  const maxCommon = Math.min(prevText.length, nextText.length);
  let prefix = 0;
  while (prefix < maxCommon && prevText[prefix] === nextText[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < maxCommon - prefix &&
    prevText[prevText.length - 1 - suffix] ===
      nextText[nextText.length - 1 - suffix]
  ) {
    suffix++;
  }
  return {
    index: prefix,
    deleteCount: prevText.length - prefix - suffix,
    insertCount: nextText.length - prefix - suffix,
  };
};

/**
 * Moves the ranges along with a text edit (see `TextSplice`).
 *
 * - text deleted takes its styling with it;
 * - text inserted takes the styling of what it's typed after (as in rich
 *   text editors: typing on at the end of a red word goes on in red), or of
 *   what it replaces;
 * - at the start of the text, inserted text is unstyled.
 */
export const adjustTextStyleRangesForSplice = (
  ranges: readonly TextStyleRange[] | undefined,
  { index, deleteCount, insertCount }: TextSplice,
): readonly TextStyleRange[] => {
  if (!ranges?.length || (!deleteCount && !insertCount)) {
    return ranges ?? EMPTY_RANGES;
  }
  const deleteEnd = index + deleteCount;

  // the range the inserted text continues
  const inheritFrom = !insertCount
    ? -1
    : deleteCount
    ? ranges.findIndex((range) => range.start <= index && index < range.end)
    : ranges.findIndex((range) => range.start < index && index <= range.end);

  const afterDeletion = (offset: number) =>
    offset <= index
      ? offset
      : offset >= deleteEnd
      ? offset - deleteCount
      : index;

  return compact(
    ranges.map((range, rangeIndex) => {
      let start = afterDeletion(range.start);
      let end = afterDeletion(range.end);
      if (rangeIndex === inheritFrom) {
        end += insertCount;
      } else if (start >= index) {
        start += insertCount;
        end += insertCount;
      }
      return makeRange(start, end, range);
    }),
  );
};

/**
 * Moves the ranges from `prevText` along to `nextText` (see `getTextSplice`
 * and `adjustTextStyleRangesForSplice`). Returns `ranges` itself if nothing
 * changed.
 */
export const shiftTextStyleRanges = (
  ranges: readonly TextStyleRange[] | undefined,
  prevText: string,
  nextText: string,
  caret?: number | null,
): readonly TextStyleRange[] => {
  if (!ranges?.length) {
    return ranges ?? EMPTY_RANGES;
  }
  const splice = getTextSplice(prevText, nextText, caret);
  if (!splice) {
    return ranges;
  }
  return normalizeTextStyleRanges(
    adjustTextStyleRangesForSplice(ranges, splice),
    nextText.length,
  );
};

// -----------------------------------------------------------------------------
// rendering
// -----------------------------------------------------------------------------

/**
 * Where each code unit of the (wrapped) `text` comes from in `originalText`:
 * its offset there, or -1 for the line breaks wrapping inserted.
 *
 * Wrapping only inserts line breaks and drops whitespace at them (see
 * `getWrappedTextLines`), so lining the two up needs no font metrics, and
 * holds whatever font or width the text was wrapped at.
 */
export const mapWrappedTextToOriginalText = (
  text: string,
  originalText: string,
): Int32Array => {
  const map = new Int32Array(text.length).fill(-1);
  let o = 0;
  for (let t = 0; t < text.length; ) {
    if (o >= originalText.length) {
      break;
    }
    if (text[t] === originalText[o]) {
      map[t++] = o++;
    } else if (originalText[o] !== "\n" && /\s/.test(originalText[o])) {
      // whitespace dropped at a soft break
      o++;
    } else if (text[t] === "\n") {
      // a soft break
      t++;
    } else {
      // out of sync (shouldn't happen) — keep going side by side
      map[t++] = o++;
    }
  }
  return map;
};

/** a part of a line in one style */
export type TextStyleRun = {
  text: string;
  /** null for the element's own color */
  strokeColor: string | null;
  backgroundColor: string | null;
};

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * The element's (wrapped) lines, each split into runs of the same style.
 *
 * Returns `null` if no part of the text is styled on its own, so callers can
 * keep drawing it as a whole.
 */
export const getTextStyleRunsByLine = (
  element: Pick<ExcalidrawTextElement, "text" | "originalText"> &
    Partial<Pick<ExcalidrawTextElement, "styleRanges">>,
): TextStyleRun[][] | null => {
  const ranges = element.styleRanges;
  if (!ranges?.length) {
    return null;
  }
  const text = element.text.replace(/\r\n?/g, "\n");
  const { originalText } = element;
  const map = mapWrappedTextToOriginalText(text, originalText);

  // which range styles each code unit of `originalText`
  const rangeAt = new Int32Array(originalText.length).fill(-1);
  ranges.forEach((range, rangeIndex) => {
    const end = Math.min(range.end, originalText.length);
    for (let offset = Math.max(0, range.start); offset < end; offset++) {
      rangeAt[offset] = rangeIndex;
    }
  });

  const lines: TextStyleRun[][] = [[]];
  let current: { from: number; rangeIndex: number } | null = null;
  const flush = (to: number) => {
    if (current && to > current.from) {
      const range = ranges[current.rangeIndex];
      lines[lines.length - 1].push({
        text: text.slice(current.from, to),
        strokeColor: range?.strokeColor ?? null,
        backgroundColor: range?.backgroundColor ?? null,
      });
    }
    current = null;
  };

  for (let t = 0; t < text.length; t++) {
    if (text[t] === "\n") {
      flush(t);
      lines.push([]);
      continue;
    }
    const rangeIndex = map[t] === -1 ? -1 : rangeAt[map[t]];
    if (!current) {
      current = { from: t, rangeIndex };
    } else if (
      current.rangeIndex !== rangeIndex &&
      // never split a surrogate pair
      !isLowSurrogate(text.charCodeAt(t))
    ) {
      flush(t);
      current = { from: t, rangeIndex };
    }
  }
  flush(text.length);

  return lines;
};
