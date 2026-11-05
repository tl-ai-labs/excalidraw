import { getFontString } from "@excalidraw/common";

import { getWrappedTextLines, type WrappedTextLine } from "./textWrapping";

import type { RenderEnvironment } from "./renderEnvironment";
import type { ExcalidrawTextElement, TextStyleRange } from "./types";

export type { TextStyleRange } from "./types";

export type TextStyleRun = {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly strokeColor?: string;
  readonly backgroundColor?: string;
};

const clampOffset = (value: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(max, Math.floor(value)));
};

const normalizeStrokeColor = (
  strokeColor: string | undefined,
  elementStrokeColor: string | undefined,
): string | undefined => {
  if (
    !strokeColor ||
    strokeColor === "transparent" ||
    (elementStrokeColor !== undefined && strokeColor === elementStrokeColor)
  ) {
    return undefined;
  }
  return strokeColor;
};

const normalizeBackgroundColor = (
  backgroundColor: string | undefined,
): string | undefined => {
  if (!backgroundColor || backgroundColor === "transparent") {
    return undefined;
  }
  return backgroundColor;
};

const mergeAdjacentRanges = (ranges: TextStyleRange[]): TextStyleRange[] => {
  if (ranges.length <= 1) {
    return ranges;
  }

  const merged: TextStyleRange[] = [];
  for (const range of ranges) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.end === range.start &&
      prev.strokeColor === range.strokeColor &&
      prev.backgroundColor === range.backgroundColor
    ) {
      merged[merged.length - 1] = {
        ...prev,
        end: range.end,
      };
    } else {
      merged.push(range);
    }
  }

  return merged;
};

const buildStyledRange = (
  start: number,
  end: number,
  strokeColor: string | undefined,
  backgroundColor: string | undefined,
): TextStyleRange | null => {
  if (start >= end || (!strokeColor && !backgroundColor)) {
    return null;
  }

  const range: {
    start: number;
    end: number;
    strokeColor?: string;
    backgroundColor?: string;
  } = { start, end };

  if (strokeColor) {
    range.strokeColor = strokeColor;
  }
  if (backgroundColor) {
    range.backgroundColor = backgroundColor;
  }

  return range;
};

export const normalizeTextStyleRanges = (
  ranges: readonly TextStyleRange[] | null | undefined,
  textLength: number,
  elementStrokeColor?: string,
): TextStyleRange[] => {
  if (
    !Array.isArray(ranges) ||
    ranges.length === 0 ||
    !Number.isFinite(textLength) ||
    textLength <= 0
  ) {
    return [];
  }

  const maxLen = Math.floor(textLength);
  const clampedRanges: {
    start: number;
    end: number;
    strokeColor?: string;
    backgroundColor?: string;
  }[] = [];
  const boundaries = new Set<number>();

  for (const item of ranges) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const start = clampOffset(item.start, maxLen);
    const end = clampOffset(item.end, maxLen);
    if (start >= end) {
      continue;
    }

    const strokeColor = normalizeStrokeColor(
      item.strokeColor,
      elementStrokeColor,
    );
    const backgroundColor = normalizeBackgroundColor(item.backgroundColor);

    if (!strokeColor && !backgroundColor) {
      continue;
    }

    clampedRanges.push({
      start,
      end,
      strokeColor,
      backgroundColor,
    });
    boundaries.add(start);
    boundaries.add(end);
  }

  if (clampedRanges.length === 0) {
    return [];
  }

  const points = Array.from(boundaries).sort((a, b) => a - b);
  const elementary: TextStyleRange[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i];
    const segEnd = points[i + 1];
    if (segStart >= segEnd) {
      continue;
    }

    let strokeColor: string | undefined;
    let backgroundColor: string | undefined;

    for (const r of clampedRanges) {
      if (r.start <= segStart && r.end >= segEnd) {
        if (r.strokeColor !== undefined) {
          strokeColor = r.strokeColor;
        }
        if (r.backgroundColor !== undefined) {
          backgroundColor = r.backgroundColor;
        }
      }
    }

    const built = buildStyledRange(
      segStart,
      segEnd,
      strokeColor,
      backgroundColor,
    );
    if (built) {
      elementary.push(built);
    }
  }

  return mergeAdjacentRanges(elementary);
};

export const applyTextStyleRange = (
  ranges: readonly TextStyleRange[] | null | undefined,
  textLength: number,
  selection: { readonly start: number; readonly end: number },
  style: { readonly strokeColor?: string; readonly backgroundColor?: string },
  elementStrokeColor?: string,
): TextStyleRange[] => {
  const normalized = normalizeTextStyleRanges(
    ranges,
    textLength,
    elementStrokeColor,
  );

  if (
    !Number.isFinite(textLength) ||
    textLength <= 0 ||
    !selection ||
    !Number.isFinite(selection.start) ||
    !Number.isFinite(selection.end)
  ) {
    return normalized;
  }

  const maxLen = Math.floor(textLength);
  const selStart = clampOffset(selection.start, maxLen);
  const selEnd = clampOffset(selection.end, maxLen);

  if (selStart >= selEnd) {
    return normalized;
  }

  const hasStrokeUpdate =
    "strokeColor" in style && style.strokeColor !== undefined;
  const hasBackgroundUpdate =
    "backgroundColor" in style && style.backgroundColor !== undefined;

  if (!hasStrokeUpdate && !hasBackgroundUpdate) {
    return normalized;
  }

  const nextStrokeColor = hasStrokeUpdate
    ? normalizeStrokeColor(style.strokeColor, elementStrokeColor)
    : undefined;
  const nextBackgroundColor = hasBackgroundUpdate
    ? normalizeBackgroundColor(style.backgroundColor)
    : undefined;

  const boundaries = new Set<number>([selStart, selEnd]);
  for (const r of normalized) {
    boundaries.add(r.start);
    boundaries.add(r.end);
  }

  const points = Array.from(boundaries).sort((a, b) => a - b);
  const elementary: TextStyleRange[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i];
    const segEnd = points[i + 1];
    if (segStart >= segEnd) {
      continue;
    }

    let strokeColor: string | undefined;
    let backgroundColor: string | undefined;

    for (const r of normalized) {
      if (r.start <= segStart && r.end >= segEnd) {
        if (r.strokeColor !== undefined) {
          strokeColor = r.strokeColor;
        }
        if (r.backgroundColor !== undefined) {
          backgroundColor = r.backgroundColor;
        }
      }
    }

    if (segStart >= selStart && segEnd <= selEnd) {
      if (hasStrokeUpdate) {
        strokeColor = nextStrokeColor;
      }
      if (hasBackgroundUpdate) {
        backgroundColor = nextBackgroundColor;
      }
    }

    const built = buildStyledRange(
      segStart,
      segEnd,
      strokeColor,
      backgroundColor,
    );
    if (built) {
      elementary.push(built);
    }
  }

  return mergeAdjacentRanges(elementary);
};

export const shiftTextStyleRangesOnEdit = (
  ranges: readonly TextStyleRange[] | null | undefined,
  prevText: string,
  nextText: string,
): TextStyleRange[] => {
  const normalized = normalizeTextStyleRanges(ranges, prevText.length);
  if (prevText === nextText) {
    return normalized;
  }
  if (normalized.length === 0 || nextText.length === 0) {
    return [];
  }

  const prevLen = prevText.length;
  const nextLen = nextText.length;
  const minLen = Math.min(prevLen, nextLen);

  let changeStart = 0;
  while (
    changeStart < minLen &&
    prevText.charCodeAt(changeStart) === nextText.charCodeAt(changeStart)
  ) {
    changeStart++;
  }

  let prevEnd = prevLen;
  let nextEnd = nextLen;
  while (
    prevEnd > changeStart &&
    nextEnd > changeStart &&
    prevText.charCodeAt(prevEnd - 1) === nextText.charCodeAt(nextEnd - 1)
  ) {
    prevEnd--;
    nextEnd--;
  }

  const changeEnd = prevEnd;
  const insertedLength = nextEnd - changeStart;
  const deletedLength = changeEnd - changeStart;
  const delta = insertedLength - deletedLength;

  const shifted: TextStyleRange[] = [];

  for (const range of normalized) {
    const { start, end } = range;

    if (end <= changeStart) {
      shifted.push(range);
      continue;
    }

    if (start >= changeEnd) {
      shifted.push({
        ...range,
        start: start + delta,
        end: end + delta,
      });
      continue;
    }

    if (changeEnd > changeStart && start >= changeStart && end <= changeEnd) {
      continue;
    }

    const newStart =
      start < changeStart
        ? start
        : start === changeStart && end > changeEnd && insertedLength > 0
        ? changeStart
        : changeStart + insertedLength;

    const newEnd = end > changeEnd ? end + delta : changeStart;

    if (newStart < newEnd) {
      shifted.push({
        ...range,
        start: newStart,
        end: newEnd,
      });
    }
  }

  return normalizeTextStyleRanges(shifted, nextText.length);
};

export const getWrappedLineTextRuns = (
  line: WrappedTextLine,
  ranges: readonly TextStyleRange[] | null | undefined,
): TextStyleRun[] => {
  const lineStart = line.start;
  const lineEnd = line.end;

  if (lineEnd <= lineStart || !ranges || ranges.length === 0) {
    return [
      {
        text: line.text,
        start: lineStart,
        end: lineEnd,
      },
    ];
  }

  const normalized = normalizeTextStyleRanges(ranges, lineEnd);
  const overlapping = normalized.filter(
    (range) => range.end > lineStart && range.start < lineEnd,
  );

  if (overlapping.length === 0) {
    return [
      {
        text: line.text,
        start: lineStart,
        end: lineEnd,
      },
    ];
  }

  const runs: TextStyleRun[] = [];
  let cursor = lineStart;

  for (const range of overlapping) {
    const segStart = Math.max(lineStart, range.start);
    const segEnd = Math.min(lineEnd, range.end);

    if (segStart > cursor) {
      runs.push({
        text: line.text.slice(cursor - lineStart, segStart - lineStart),
        start: cursor,
        end: segStart,
      });
    }

    if (segEnd > segStart) {
      const run: {
        text: string;
        start: number;
        end: number;
        strokeColor?: string;
        backgroundColor?: string;
      } = {
        text: line.text.slice(segStart - lineStart, segEnd - lineStart),
        start: segStart,
        end: segEnd,
      };
      if (range.strokeColor) {
        run.strokeColor = range.strokeColor;
      }
      if (range.backgroundColor) {
        run.backgroundColor = range.backgroundColor;
      }
      runs.push(run);
      cursor = segEnd;
    }
  }

  if (cursor < lineEnd) {
    runs.push({
      text: line.text.slice(cursor - lineStart, lineEnd - lineStart),
      start: cursor,
      end: lineEnd,
    });
  }

  return runs;
};

const alignVisualLinesToOriginalText = (
  visualLines: readonly string[],
  originalText: string,
): WrappedTextLine[] => {
  const aligned: WrappedTextLine[] = [];
  let offset = 0;

  for (let i = 0; i < visualLines.length; i++) {
    const lineText = visualLines[i];
    if (i > 0) {
      if (originalText[offset] === "\n") {
        offset += 1;
      } else {
        while (
          offset < originalText.length &&
          originalText[offset] !== "\n" &&
          !originalText.startsWith(lineText, offset) &&
          (originalText[offset] === " " || originalText[offset] === "\t")
        ) {
          offset += 1;
        }
      }
    }

    if (originalText.startsWith(lineText, offset)) {
      const start = offset;
      const end = start + lineText.length;
      aligned.push({ text: lineText, start, end });
      offset = end;
    } else {
      const foundIdx = originalText.indexOf(lineText, offset);
      if (foundIdx !== -1) {
        const start = foundIdx;
        const end = start + lineText.length;
        aligned.push({ text: lineText, start, end });
        offset = end;
      } else {
        const start = Math.min(offset, originalText.length);
        const end = Math.min(start + lineText.length, originalText.length);
        aligned.push({ text: lineText, start, end });
        offset = end;
      }
    }
  }

  return aligned;
};

export const getWrappedTextLinesForElement = (
  element: Pick<
    ExcalidrawTextElement,
    "text" | "originalText" | "fontSize" | "fontFamily" | "width" | "autoResize"
  >,
  maxWidth?: number,
  env?: RenderEnvironment,
): WrappedTextLine[] => {
  const normalizedOriginalText = (element.originalText ?? element.text).replace(
    /\r\n?/g,
    "\n",
  );
  const normalizedText = element.text.replace(/\r\n?/g, "\n");
  const font = getFontString(element);

  if (maxWidth !== undefined) {
    return getWrappedTextLines(normalizedOriginalText, font, maxWidth, env);
  }

  if (normalizedText === normalizedOriginalText) {
    return getWrappedTextLines(normalizedOriginalText, font, Infinity, env);
  }

  const wrappedLines = getWrappedTextLines(
    normalizedOriginalText,
    font,
    element.width,
    env,
  );
  const visualLines = normalizedText.split("\n");

  if (
    wrappedLines.length === visualLines.length &&
    wrappedLines.every((line, idx) => line.text === visualLines[idx])
  ) {
    return wrappedLines;
  }

  return alignVisualLinesToOriginalText(visualLines, normalizedOriginalText);
};

export const getTextElementLineRuns = (
  element: Pick<
    ExcalidrawTextElement,
    | "text"
    | "originalText"
    | "fontSize"
    | "fontFamily"
    | "width"
    | "autoResize"
    | "textStyleRanges"
    | "strokeColor"
  >,
  env?: RenderEnvironment,
  maxWidth?: number,
): TextStyleRun[][] => {
  const normalizedOriginalText = (element.originalText ?? element.text).replace(
    /\r\n?/g,
    "\n",
  );
  const lines = getWrappedTextLinesForElement(element, maxWidth, env);
  const normalizedRanges = normalizeTextStyleRanges(
    element.textStyleRanges,
    normalizedOriginalText.length,
    element.strokeColor,
  );

  return lines.map((line) => getWrappedLineTextRuns(line, normalizedRanges));
};

export const getSelectionTextStyle = (
  element: Pick<
    ExcalidrawTextElement,
    "originalText" | "strokeColor" | "textStyleRanges"
  >,
  selection: { readonly start: number; readonly end: number },
): { strokeColor: string | null; backgroundColor: string | null } => {
  const text = (element.originalText ?? "").replace(/\r\n?/g, "\n");
  const maxLen = text.length;
  const selStart = clampOffset(selection.start, maxLen);
  const selEnd = clampOffset(selection.end, maxLen);

  if (selStart >= selEnd) {
    return {
      strokeColor: element.strokeColor,
      backgroundColor: "transparent",
    };
  }

  const normalizedRanges = normalizeTextStyleRanges(
    element.textStyleRanges,
    maxLen,
    element.strokeColor,
  );

  const runs = getWrappedLineTextRuns(
    {
      text: text.slice(selStart, selEnd),
      start: selStart,
      end: selEnd,
    },
    normalizedRanges,
  );

  let commonStrokeColor: string | null | undefined;
  let commonBackgroundColor: string | null | undefined;

  for (const run of runs) {
    if (run.end <= run.start) {
      continue;
    }
    const runStroke = run.strokeColor ?? element.strokeColor;
    const runBackground = run.backgroundColor ?? "transparent";

    if (commonStrokeColor === undefined) {
      commonStrokeColor = runStroke;
    } else if (commonStrokeColor !== null && commonStrokeColor !== runStroke) {
      commonStrokeColor = null;
    }

    if (commonBackgroundColor === undefined) {
      commonBackgroundColor = runBackground;
    } else if (
      commonBackgroundColor !== null &&
      commonBackgroundColor !== runBackground
    ) {
      commonBackgroundColor = null;
    }
  }

  return {
    strokeColor:
      commonStrokeColor === undefined ? element.strokeColor : commonStrokeColor,
    backgroundColor:
      commonBackgroundColor === undefined
        ? "transparent"
        : commonBackgroundColor,
  };
};

export const areTextStyleRangesEqual = (
  a: readonly TextStyleRange[] | null | undefined,
  b: readonly TextStyleRange[] | null | undefined,
): boolean => {
  const listA = a ?? [];
  const listB = b ?? [];
  if (listA === listB) {
    return true;
  }
  if (listA.length !== listB.length) {
    return false;
  }
  for (let i = 0; i < listA.length; i++) {
    const itemA = listA[i];
    const itemB = listB[i];
    if (
      itemA.start !== itemB.start ||
      itemA.end !== itemB.end ||
      itemA.strokeColor !== itemB.strokeColor ||
      itemA.backgroundColor !== itemB.backgroundColor
    ) {
      return false;
    }
  }
  return true;
};
