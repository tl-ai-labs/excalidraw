import type { ExcalidrawTextElement, TextAlign, TextStyleRange } from "./types";

/**
 * Maximum number of style ranges allowed per text element.
 */
export const MAX_STYLE_RANGES = 1000;

/**
 * Represents a text edit operation.
 */
export type TextEdit = {
  from: number;
  to: number;
  insertLength: number;
};

/**
 * Style updates applied across a text range.
 * Setting a property to null clears it, undefined leaves it untouched.
 */
export type TextStyleUpdate = {
  color?: string | null;
  highlight?: string | null;
};

/**
 * A single visual run of styled text within a rendered line.
 */
export type StyledTextRun = {
  text: string;
  start: number;
  color: string | null;
  highlight: string | null;
};

const isNonEmptyString = (val: unknown): val is string =>
  typeof val === "string" && val.length > 0;

const CSS_COLOR_REGEX =
  /^(?:#(?:[0-9a-fA-F]{3,4}){1,2}|(?:rgb|hsl)a?\([0-9.,%\s/+-]+\)|transparent|currentColor|[a-zA-Z]+)$/;

const isValidCssColor = (val: unknown): val is string =>
  typeof val === "string" &&
  val.length > 0 &&
  val.length <= 64 &&
  !val.includes("url(") &&
  CSS_COLOR_REGEX.test(val.trim());

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

/**
 * Normalises style ranges: clamps into [0, textLength], drops empty ranges or ranges
 * with no valid colour, resolves overlaps via sweep-line with later ranges taking precedence,
 * and merges adjacent ranges with identical styles.
 */
export const normalizeStyleRanges = (
  ranges: readonly TextStyleRange[],
  textLength: number,
): TextStyleRange[] => {
  if (!ranges.length || textLength <= 0) {
    return [];
  }

  // Filter and clamp valid ranges
  const validRanges: TextStyleRange[] = [];
  for (const range of ranges) {
    const start = Math.max(0, Math.min(textLength, Math.floor(range.start)));
    const end = Math.max(0, Math.min(textLength, Math.floor(range.end)));
    if (start >= end) {
      continue;
    }
    const hasColor = isNonEmptyString(range.color);
    const hasHighlight = isNonEmptyString(range.highlight);
    if (!hasColor && !hasHighlight) {
      continue;
    }
    validRanges.push(
      makeRange(
        start,
        end,
        hasColor ? range.color : undefined,
        hasHighlight ? range.highlight : undefined,
      ),
    );
  }

  if (!validRanges.length) {
    return [];
  }

  type Event = {
    x: number;
    isStart: boolean;
    rangeIndex: number;
  };

  const events: Event[] = [];
  for (let i = 0; i < validRanges.length; i++) {
    events.push({ x: validRanges[i].start, isStart: true, rangeIndex: i });
    events.push({ x: validRanges[i].end, isStart: false, rangeIndex: i });
  }

  events.sort((a, b) => {
    if (a.x !== b.x) {
      return a.x - b.x;
    }
    if (a.isStart !== b.isStart) {
      return a.isStart ? 1 : -1;
    }
    return a.rangeIndex - b.rangeIndex;
  });

  const activeColorIndices: number[] = [];
  const activeHighlightIndices: number[] = [];
  const segments: TextStyleRange[] = [];

  let lastX = events[0].x;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.x > lastX) {
      const activeColor = activeColorIndices.length
        ? validRanges[activeColorIndices[activeColorIndices.length - 1]].color
        : undefined;
      const activeHighlight = activeHighlightIndices.length
        ? validRanges[activeHighlightIndices[activeHighlightIndices.length - 1]]
            .highlight
        : undefined;

      if (activeColor !== undefined || activeHighlight !== undefined) {
        segments.push(makeRange(lastX, event.x, activeColor, activeHighlight));
      }
      lastX = event.x;
    }

    const r = validRanges[event.rangeIndex];
    if (event.isStart) {
      if (r.color !== undefined) {
        // Keep sorted by original index for precedence
        let ins = activeColorIndices.length;
        while (ins > 0 && activeColorIndices[ins - 1] > event.rangeIndex) {
          ins--;
        }
        activeColorIndices.splice(ins, 0, event.rangeIndex);
      }
      if (r.highlight !== undefined) {
        let ins = activeHighlightIndices.length;
        while (ins > 0 && activeHighlightIndices[ins - 1] > event.rangeIndex) {
          ins--;
        }
        activeHighlightIndices.splice(ins, 0, event.rangeIndex);
      }
    } else {
      if (r.color !== undefined) {
        const idx = activeColorIndices.indexOf(event.rangeIndex);
        if (idx !== -1) {
          activeColorIndices.splice(idx, 1);
        }
      }
      if (r.highlight !== undefined) {
        const idx = activeHighlightIndices.indexOf(event.rangeIndex);
        if (idx !== -1) {
          activeHighlightIndices.splice(idx, 1);
        }
      }
    }
  }

  // Merge contiguous neighbours with matching styles
  const merged: TextStyleRange[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.end === seg.start &&
      last.color === seg.color &&
      last.highlight === seg.highlight
    ) {
      merged[merged.length - 1] = makeRange(
        last.start,
        seg.end,
        last.color,
        last.highlight,
      );
    } else {
      merged.push(seg);
    }
  }

  return merged;
};

/**
 * Applies a style update across a span [start, end), overriding or clearing
 * properties and returning normalised style ranges.
 */
export const applyTextStyle = (
  ranges: readonly TextStyleRange[],
  start: number,
  end: number,
  style: TextStyleUpdate,
  textLength: number,
): TextStyleRange[] => {
  const normalized = normalizeStyleRanges(ranges, textLength);
  const spanStart = Math.max(0, Math.min(textLength, Math.floor(start)));
  const spanEnd = Math.max(0, Math.min(textLength, Math.floor(end)));

  if (spanStart >= spanEnd) {
    return normalized;
  }

  const newRanges: TextStyleRange[] = [];

  for (const r of normalized) {
    if (r.end <= spanStart || r.start >= spanEnd) {
      // Completely outside the update span
      newRanges.push(r);
      continue;
    }

    // Part before the span
    if (r.start < spanStart) {
      newRanges.push(makeRange(r.start, spanStart, r.color, r.highlight));
    }

    // Part inside the span
    const overlapStart = Math.max(r.start, spanStart);
    const overlapEnd = Math.min(r.end, spanEnd);
    if (overlapStart < overlapEnd) {
      let newColor = r.color;
      if (style.color === null) {
        newColor = undefined;
      } else if (isNonEmptyString(style.color)) {
        newColor = style.color;
      }

      let newHighlight = r.highlight;
      if (style.highlight === null) {
        newHighlight = undefined;
      } else if (isNonEmptyString(style.highlight)) {
        newHighlight = style.highlight;
      }

      if (newColor !== undefined || newHighlight !== undefined) {
        newRanges.push(
          makeRange(overlapStart, overlapEnd, newColor, newHighlight),
        );
      }
    }

    // Part after the span
    if (r.end > spanEnd) {
      newRanges.push(makeRange(spanEnd, r.end, r.color, r.highlight));
    }
  }

  // Add a newly styled range covering uncovered portions inside the span
  const addedColor = isNonEmptyString(style.color) ? style.color : undefined;
  const addedHighlight = isNonEmptyString(style.highlight)
    ? style.highlight
    : undefined;

  if (addedColor !== undefined || addedHighlight !== undefined) {
    newRanges.push(makeRange(spanStart, spanEnd, addedColor, addedHighlight));
  }

  return normalizeStyleRanges(newRanges, textLength);
};

/**
 * Computes single contiguous edit between prevText and nextText.
 * Returns null when strings are identical.
 */
export const diffText = (
  prevText: string,
  nextText: string,
): TextEdit | null => {
  if (prevText === nextText) {
    return null;
  }

  let p = 0;
  const minLen = Math.min(prevText.length, nextText.length);
  while (p < minLen && prevText[p] === nextText[p]) {
    p++;
  }

  let s = 0;
  const maxSuffix = minLen - p;
  while (
    s < maxSuffix &&
    prevText[prevText.length - 1 - s] === nextText[nextText.length - 1 - s]
  ) {
    s++;
  }

  return {
    from: p,
    to: prevText.length - s,
    insertLength: nextText.length - s - p,
  };
};

/**
 * Shifts style ranges across a text edit operation.
 * Text inserted strictly inside a range inherits its style; text inserted
 * at a boundary does not.
 */
export const shiftStyleRanges = (
  ranges: readonly TextStyleRange[],
  edit: TextEdit,
  nextTextLength: number,
): TextStyleRange[] => {
  const { from, to, insertLength } = edit;
  const delta = insertLength - (to - from);

  const shifted: TextStyleRange[] = ranges.map((range) => {
    const start =
      range.start < from
        ? range.start
        : range.start >= to
        ? range.start + delta
        : from + insertLength;

    const end =
      range.end <= from
        ? range.end
        : range.end >= to
        ? range.end + delta
        : from;

    return makeRange(start, end, range.color, range.highlight);
  });

  return normalizeStyleRanges(shifted, nextTextLength);
};

/**
 * Aligns wrapped text lines with originalText and splits lines into styled runs.
 */
export const getStyledLines = (
  originalText: string,
  text: string,
  ranges: readonly TextStyleRange[],
): StyledTextRun[][] => {
  const maxLen = originalText.length || Number.POSITIVE_INFINITY;
  const clampedRanges: TextStyleRange[] = [];
  for (const r of ranges) {
    const start = Math.max(0, Math.min(maxLen, Math.floor(r.start)));
    const end = Math.max(0, Math.min(maxLen, Math.floor(r.end)));
    if (start < end && (r.color !== undefined || r.highlight !== undefined)) {
      clampedRanges.push(makeRange(start, end, r.color, r.highlight));
    }
  }

  const lines = text.split("\n");
  const result: StyledTextRun[][] = [];
  let p = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    if (lineIndex > 0) {
      if (p < originalText.length && originalText[p] === "\n") {
        p++;
      } else {
        while (
          p < originalText.length &&
          /\s/.test(originalText[p]) &&
          originalText[p] !== "\n" &&
          !originalText.startsWith(line, p)
        ) {
          p++;
        }
      }
    }

    if (line.length === 0) {
      result.push([]);
      continue;
    }

    const matched = originalText.startsWith(line, p);
    const lineStart = p;
    const lineEnd = lineStart + line.length;

    if (!matched) {
      result.push([
        {
          text: line,
          start: lineStart,
          color: null,
          highlight: null,
        },
      ]);
      p += line.length;
      continue;
    }

    // Find range cut points within [lineStart, lineEnd)
    const cutPoints = new Set<number>([lineStart, lineEnd]);
    for (const r of clampedRanges) {
      if (r.start > lineStart && r.start < lineEnd) {
        cutPoints.add(r.start);
      }
      if (r.end > lineStart && r.end < lineEnd) {
        cutPoints.add(r.end);
      }
    }

    const sortedCuts = Array.from(cutPoints).sort((a, b) => a - b);
    const runs: StyledTextRun[] = [];

    for (let i = 0; i < sortedCuts.length - 1; i++) {
      const runStart = sortedCuts[i];
      const runEnd = sortedCuts[i + 1];
      const runText = line.slice(runStart - lineStart, runEnd - lineStart);
      const covering = clampedRanges.find(
        (r) => r.start <= runStart && r.end >= runEnd,
      );

      runs.push({
        text: runText,
        start: runStart,
        color: covering?.color ?? null,
        highlight: covering?.highlight ?? null,
      });
    }

    result.push(runs);
    p = lineEnd;
  }

  return result;
};

/**
 * Computes x-coordinates for styled text runs based on alignment and run widths.
 */
export const getStyledRunPositions = (
  widths: readonly number[],
  textAlign: TextAlign,
  boxWidth: number,
  rtl: boolean,
): number[] => {
  let total = 0;
  for (const w of widths) {
    total += w;
  }

  let lineLeft = 0;
  if (textAlign === "center") {
    lineLeft = (boxWidth - total) / 2;
  } else if (textAlign === "right") {
    lineLeft = boxWidth - total;
  }

  const positions: number[] = new Array(widths.length);
  let accumulated = 0;

  for (let i = 0; i < widths.length; i++) {
    if (rtl) {
      accumulated += widths[i];
      positions[i] = lineLeft + total - accumulated;
    } else {
      positions[i] = lineLeft + accumulated;
      accumulated += widths[i];
    }
  }

  return positions;
};

/**
 * Returns a style property value if uniformly present across [start, end), otherwise null.
 */
export const getUniformRangeStyle = (
  ranges: readonly TextStyleRange[],
  start: number,
  end: number,
  property: "color" | "highlight",
): string | null => {
  const spanStart = Math.floor(start);
  const spanEnd = Math.floor(end);
  if (spanStart >= spanEnd) {
    return null;
  }

  const normalized = normalizeStyleRanges(ranges, spanEnd);
  let current = spanStart;
  let uniformValue: string | null = null;

  for (const r of normalized) {
    if (r.end <= current) {
      continue;
    }
    if (r.start > current) {
      return null;
    }

    const val = r[property] ?? null;
    if (!val) {
      return null;
    }

    if (uniformValue === null) {
      uniformValue = val;
    } else if (uniformValue !== val) {
      return null;
    }

    current = Math.min(spanEnd, r.end);
    if (current >= spanEnd) {
      break;
    }
  }

  return current >= spanEnd ? uniformValue : null;
};

/**
 * Validates and sanitises untrusted style range inputs.
 * Returns null if invalid or resulting in an empty array.
 */
export const sanitizeStyleRanges = (
  value: unknown,
  textLength: number,
): TextStyleRange[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const valid: TextStyleRange[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const raw = item as Record<string, unknown>;
    if (!Number.isInteger(raw.start) || !Number.isInteger(raw.end)) {
      continue;
    }

    const color = isValidCssColor(raw.color) ? raw.color : undefined;
    const highlight = isValidCssColor(raw.highlight)
      ? raw.highlight
      : undefined;
    if (color === undefined && highlight === undefined) {
      continue;
    }

    valid.push(
      makeRange(raw.start as number, raw.end as number, color, highlight),
    );
  }

  valid.sort((a, b) => a.start - b.start || a.end - b.end);
  const capped = valid.slice(0, MAX_STYLE_RANGES);

  const normalized = normalizeStyleRanges(capped, textLength);
  return normalized.length > 0 ? normalized : null;
};

/**
 * Compares two style range lists for exact element-wise equality.
 */
export const areStyleRangesEqual = (
  a: readonly TextStyleRange[],
  b: readonly TextStyleRange[],
): boolean => {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    const rA = a[i];
    const rB = b[i];
    if (
      rA.start !== rB.start ||
      rA.end !== rB.end ||
      rA.color !== rB.color ||
      rA.highlight !== rB.highlight
    ) {
      return false;
    }
  }

  return true;
};

/**
 * Returns an update object if the element's style ranges need clamping or normalising,
 * otherwise an empty object.
 */
export const getStyleRangesClampUpdate = (
  element: Pick<ExcalidrawTextElement, "styleRanges">,
  textLength: number,
): Partial<Pick<ExcalidrawTextElement, "styleRanges">> => {
  if (!element.styleRanges) {
    return {};
  }
  const normalized = normalizeStyleRanges(element.styleRanges, textLength);
  if (areStyleRangesEqual(element.styleRanges, normalized)) {
    return {};
  }
  return { styleRanges: normalized };
};
