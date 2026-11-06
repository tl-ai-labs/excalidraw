import type { TextRangeStyle } from "./types";

export type TextLineRun = Readonly<{
  text: string;
  start: number;
  end: number;
  color?: string;
  highlightColor?: string;
}>;

export type TextEditDelta = Readonly<{
  start: number;
  deleteCount: number;
  insertLength: number;
}>;

export const MAX_TEXT_RANGES = 512;

const SAFE_CSS_COLOR_RE =
  /^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgba?|hsla?)\(\s*(?:[0-9.%,/\s]|deg)+\)|[a-zA-Z]+)$/;

export const isValidRangeColor = (color: unknown): color is string => {
  if (typeof color !== "string") {
    return false;
  }
  const trimmed = color.trim();
  if (trimmed.length === 0 || trimmed.length > 64) {
    return false;
  }
  if (trimmed.toLowerCase() === "transparent") {
    return false;
  }
  return SAFE_CSS_COLOR_RE.test(trimmed);
};

export const normalizeTextRanges = (
  ranges: unknown,
  textLength: number,
): readonly TextRangeStyle[] | undefined => {
  if (!Array.isArray(ranges) || textLength <= 0 || ranges.length === 0) {
    return undefined;
  }

  // Filter and clamp valid entries
  type InternalEntry = {
    start: number;
    end: number;
    color?: string;
    highlightColor?: string;
  };

  const parsed: InternalEntry[] = [];
  const boundaries = new Set<number>();

  const limit = Math.min(ranges.length, MAX_TEXT_RANGES);
  for (let idx = 0; idx < limit; idx++) {
    const entry = ranges[idx];
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const rawStart = Number(entry.start);
    const rawEnd = Number(entry.end);
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) {
      continue;
    }

    const start = Math.max(0, Math.min(textLength, Math.floor(rawStart)));
    const end = Math.max(0, Math.min(textLength, Math.floor(rawEnd)));
    if (start >= end) {
      continue;
    }

    const color = isValidRangeColor(entry.color) ? entry.color : undefined;
    const highlightColor = isValidRangeColor(entry.highlightColor)
      ? entry.highlightColor
      : undefined;

    if (!color && !highlightColor) {
      continue;
    }

    parsed.push({ start, end, color, highlightColor });
    boundaries.add(start);
    boundaries.add(end);
  }

  if (parsed.length === 0 || boundaries.size < 2) {
    return undefined;
  }

  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
  const segments: TextRangeStyle[] = [];

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const segStart = sortedBoundaries[i];
    const segEnd = sortedBoundaries[i + 1];

    let color: string | undefined;
    let highlightColor: string | undefined;

    for (const entry of parsed) {
      if (entry.start <= segStart && entry.end >= segEnd) {
        if (entry.color !== undefined) {
          color = entry.color;
        }
        if (entry.highlightColor !== undefined) {
          highlightColor = entry.highlightColor;
        }
      }
    }

    if (color !== undefined || highlightColor !== undefined) {
      const seg: {
        start: number;
        end: number;
        color?: string;
        highlightColor?: string;
      } = {
        start: segStart,
        end: segEnd,
      };
      if (color !== undefined) {
        seg.color = color;
      }
      if (highlightColor !== undefined) {
        seg.highlightColor = highlightColor;
      }
      segments.push(seg);
    }
  }

  if (segments.length === 0) {
    return undefined;
  }

  // Merge adjacent segments with identical styles
  const merged: TextRangeStyle[] = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.end === seg.start &&
      prev.color === seg.color &&
      prev.highlightColor === seg.highlightColor
    ) {
      const updatedPrev: {
        start: number;
        end: number;
        color?: string;
        highlightColor?: string;
      } = {
        start: prev.start,
        end: seg.end,
      };
      if (prev.color !== undefined) {
        updatedPrev.color = prev.color;
      }
      if (prev.highlightColor !== undefined) {
        updatedPrev.highlightColor = prev.highlightColor;
      }
      merged[merged.length - 1] = updatedPrev;
    } else {
      merged.push(seg);
    }
  }

  return merged.length > 0 ? merged : undefined;
};

export const areTextRangesEqual = (
  a: readonly TextRangeStyle[] | undefined,
  b: readonly TextRangeStyle[] | undefined,
): boolean => {
  const normA = a && a.length > 0 ? a : undefined;
  const normB = b && b.length > 0 ? b : undefined;

  if (!normA && !normB) {
    return true;
  }
  if (!normA || !normB || normA.length !== normB.length) {
    return false;
  }

  for (let i = 0; i < normA.length; i++) {
    const itemA = normA[i];
    const itemB = normB[i];
    if (
      itemA.start !== itemB.start ||
      itemA.end !== itemB.end ||
      itemA.color !== itemB.color ||
      itemA.highlightColor !== itemB.highlightColor
    ) {
      return false;
    }
  }

  return true;
};

export const applyTextRangeStyle = (
  ranges: readonly TextRangeStyle[] | undefined,
  textLength: number,
  start: number,
  end: number,
  style: { color?: string | null; highlightColor?: string | null },
  baseStrokeColor: string | undefined,
): readonly TextRangeStyle[] | undefined => {
  const s = Math.max(0, Math.min(textLength, Math.floor(start)));
  const e = Math.max(0, Math.min(textLength, Math.floor(end)));

  if (s >= e || textLength <= 0) {
    return normalizeTextRanges(ranges, textLength);
  }

  const normalized = normalizeTextRanges(ranges, textLength) || [];

  // Split existing normalized ranges at s and e
  const boundaries = new Set<number>([s, e]);
  for (const r of normalized) {
    boundaries.add(r.start);
    boundaries.add(r.end);
  }

  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
  const segments: TextRangeStyle[] = [];

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const segStart = sortedBoundaries[i];
    const segEnd = sortedBoundaries[i + 1];

    // Find style from existing ranges covering [segStart, segEnd)
    let color: string | undefined;
    let highlightColor: string | undefined;

    for (const r of normalized) {
      if (r.start <= segStart && r.end >= segEnd) {
        if (r.color !== undefined) {
          color = r.color;
        }
        if (r.highlightColor !== undefined) {
          highlightColor = r.highlightColor;
        }
      }
    }

    // Apply new style if interval is within [s, e)
    if (segStart >= s && segEnd <= e) {
      if ("color" in style) {
        const isBaseColor =
          baseStrokeColor &&
          isValidRangeColor(style.color) &&
          style.color.trim().toLowerCase() ===
            baseStrokeColor.trim().toLowerCase();

        if (isValidRangeColor(style.color) && !isBaseColor) {
          color = style.color;
        } else {
          color = undefined;
        }
      }

      if ("highlightColor" in style) {
        if (isValidRangeColor(style.highlightColor)) {
          highlightColor = style.highlightColor;
        } else {
          highlightColor = undefined;
        }
      }
    }

    if (color !== undefined || highlightColor !== undefined) {
      const seg: {
        start: number;
        end: number;
        color?: string;
        highlightColor?: string;
      } = {
        start: segStart,
        end: segEnd,
      };
      if (color !== undefined) {
        seg.color = color;
      }
      if (highlightColor !== undefined) {
        seg.highlightColor = highlightColor;
      }
      segments.push(seg);
    }
  }

  return normalizeTextRanges(segments, textLength);
};

export const computeTextEditDelta = (
  prevText: string,
  nextText: string,
): TextEditDelta => {
  let start = 0;
  const maxPrefix = Math.min(prevText.length, nextText.length);
  while (start < maxPrefix && prevText[start] === nextText[start]) {
    start++;
  }

  let suffixLen = 0;
  const maxSuffix = Math.min(prevText.length - start, nextText.length - start);
  while (
    suffixLen < maxSuffix &&
    prevText[prevText.length - 1 - suffixLen] ===
      nextText[nextText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  return {
    start,
    deleteCount: prevText.length - start - suffixLen,
    insertLength: nextText.length - start - suffixLen,
  };
};

export const shiftTextRangesOnEdit = (
  ranges: readonly TextRangeStyle[] | undefined,
  prevText: string,
  nextText: string,
): readonly TextRangeStyle[] | undefined => {
  if (!ranges?.length || nextText.length === 0) {
    return undefined;
  }
  if (prevText === nextText) {
    return normalizeTextRanges(ranges, nextText.length);
  }

  const { start, deleteCount, insertLength } = computeTextEditDelta(
    prevText,
    nextText,
  );
  const dStart = start;
  const dEnd = start + deleteCount;
  const dLen = deleteCount;
  const k = insertLength;

  const shifted: TextRangeStyle[] = [];

  for (const r of ranges) {
    // Step 1: Delete [dStart, dEnd)
    const s1 =
      r.start <= dStart ? r.start : r.start >= dEnd ? r.start - dLen : dStart;
    const e1 = r.end <= dStart ? r.end : r.end >= dEnd ? r.end - dLen : dStart;

    if (s1 >= e1) {
      continue;
    }

    // Step 2: Insert k at dStart
    const s2 = s1 >= dStart ? s1 + k : s1;
    const e2 = e1 > dStart ? e1 + k : e1;

    if (s2 >= e2) {
      continue;
    }

    shifted.push({
      start: s2,
      end: e2,
      ...(r.color !== undefined ? { color: r.color } : {}),
      ...(r.highlightColor !== undefined
        ? { highlightColor: r.highlightColor }
        : {}),
    });
  }

  return normalizeTextRanges(shifted, nextText.length);
};

export const getStyleForTextRange = (
  ranges: readonly TextRangeStyle[] | undefined,
  start: number,
  end: number,
  defaultStrokeColor: string,
): { color: string; highlightColor: string } => {
  if (start >= end || !ranges?.length) {
    return { color: defaultStrokeColor, highlightColor: "transparent" };
  }

  let maxEnd = end;
  const limit = Math.min(ranges.length, MAX_TEXT_RANGES);
  for (let i = 0; i < limit; i++) {
    const r = ranges[i];
    if (
      r &&
      typeof r.end === "number" &&
      Number.isFinite(r.end) &&
      r.end > maxEnd
    ) {
      maxEnd = r.end;
    }
  }

  const normalized = normalizeTextRanges(ranges, maxEnd);
  if (!normalized || normalized.length === 0) {
    return { color: defaultStrokeColor, highlightColor: "transparent" };
  }

  // Check uniform color: ranges completely cover [start, end) with the same color
  let uniformColor: string | null = null;
  let currentColorCoveredTo = start;

  for (const r of normalized) {
    if (r.end <= start || r.start >= end) {
      continue;
    }
    if (r.color === undefined) {
      break;
    }
    if (r.start > currentColorCoveredTo) {
      break;
    }
    if (uniformColor === null) {
      uniformColor = r.color;
    } else if (uniformColor !== r.color) {
      uniformColor = null;
      break;
    }
    currentColorCoveredTo = Math.max(currentColorCoveredTo, r.end);
    if (currentColorCoveredTo >= end) {
      break;
    }
  }

  const finalColor =
    uniformColor !== null && currentColorCoveredTo >= end
      ? uniformColor
      : defaultStrokeColor;

  // Check uniform highlightColor: ranges completely cover [start, end) with the same highlightColor
  let uniformHighlight: string | null = null;
  let currentHighlightCoveredTo = start;

  for (const r of normalized) {
    if (r.end <= start || r.start >= end) {
      continue;
    }
    if (r.highlightColor === undefined) {
      break;
    }
    if (r.start > currentHighlightCoveredTo) {
      break;
    }
    if (uniformHighlight === null) {
      uniformHighlight = r.highlightColor;
    } else if (uniformHighlight !== r.highlightColor) {
      uniformHighlight = null;
      break;
    }
    currentHighlightCoveredTo = Math.max(currentHighlightCoveredTo, r.end);
    if (currentHighlightCoveredTo >= end) {
      break;
    }
  }

  const finalHighlight =
    uniformHighlight !== null && currentHighlightCoveredTo >= end
      ? uniformHighlight
      : "transparent";

  return { color: finalColor, highlightColor: finalHighlight };
};

export const projectTextRangesToLines = (
  originalText: string,
  wrappedText: string,
  ranges: readonly TextRangeStyle[] | undefined,
): readonly (readonly TextLineRun[])[] => {
  const normOriginal = originalText.replace(/\r\n?/g, "\n");
  const normWrapped = wrappedText.replace(/\r\n?/g, "\n");

  const normalizedRanges =
    normalizeTextRanges(ranges, normOriginal.length) || [];
  const lines = normWrapped.split("\n");
  const result: (readonly TextLineRun[])[] = [];

  let pos = 0;

  for (const lineText of lines) {
    if (lineText.length === 0) {
      result.push([]);
      if (pos < normOriginal.length && normOriginal[pos] === "\n") {
        pos += 1;
      }
      continue;
    }

    const lineStart = normOriginal.indexOf(lineText, pos);
    const actualLineStart = lineStart !== -1 ? lineStart : pos;
    const lineEnd = actualLineStart + lineText.length;
    pos = lineEnd;

    if (pos < normOriginal.length && normOriginal[pos] === "\n") {
      pos += 1;
    }

    // Slice [actualLineStart, lineEnd) against normalizedRanges
    const boundaries = new Set<number>([actualLineStart, lineEnd]);
    for (const r of normalizedRanges) {
      if (r.end > actualLineStart && r.start < lineEnd) {
        if (r.start > actualLineStart) {
          boundaries.add(r.start);
        }
        if (r.end < lineEnd) {
          boundaries.add(r.end);
        }
      }
    }

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
    const lineRuns: TextLineRun[] = [];

    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const segStart = sortedBoundaries[i];
      const segEnd = sortedBoundaries[i + 1];
      const segText = normOriginal.slice(segStart, segEnd);

      let color: string | undefined;
      let highlightColor: string | undefined;

      for (const r of normalizedRanges) {
        if (r.start <= segStart && r.end >= segEnd) {
          if (r.color !== undefined) {
            color = r.color;
          }
          if (r.highlightColor !== undefined) {
            highlightColor = r.highlightColor;
          }
        }
      }

      lineRuns.push({
        text: segText,
        start: segStart,
        end: segEnd,
        ...(color ? { color } : {}),
        ...(highlightColor ? { highlightColor } : {}),
      });
    }

    result.push(lineRuns);
  }

  return result;
};
