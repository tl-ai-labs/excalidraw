import { hasRTLChars } from "@excalidraw/common";

import { getTextStyleRuns } from "./textRanges";

import type { ExcalidrawTextElement, TextAlign } from "./types";

export type TextLineRun = {
  start: number;
  end: number;
  text: string;
  color: string | null;
  highlight: string | null;
};

export type TextLinePiece = {
  text: string;
  x: number;
  width: number;
  color: string | null;
  highlight: string | null;
  direction: "ltr" | "rtl";
};

export type TextLineLayout = {
  width: number;
  pieces: TextLinePiece[];
};

/**
 * Maps rendered line code units to originalText code-unit offsets.
 *
 * For each line of text, returns an array with one source offset per code unit
 * plus one final entry for the line's end. Returns null if rendered text cannot
 * be aligned with originalText.
 */
export const getRenderedLineOffsets = (
  text: string,
  originalText: string,
): number[][] | null => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const result: number[][] = [];
  let p = 0;

  for (const line of lines) {
    const lineOffsets: number[] = [];
    let j = 0;

    outer: while (j < line.length) {
      while (p < originalText.length && originalText[p] !== line[j]) {
        const clusterMatch = /^[\s\S]\p{M}+/u.exec(
          originalText.slice(p, p + 32),
        );
        if (clusterMatch) {
          const cluster = clusterMatch[0];
          const normalized = cluster.normalize("NFC");
          if (line.startsWith(normalized, j)) {
            for (let k = 0; k < normalized.length; k += 1) {
              lineOffsets.push(p);
            }
            j += normalized.length;
            p += cluster.length;
            continue outer;
          }
        }

        if (/\s/.test(originalText[p])) {
          p += 1;
        } else {
          return null;
        }
      }

      if (j >= line.length) {
        break;
      }

      if (p >= originalText.length) {
        return null;
      }

      lineOffsets.push(p);
      p += 1;
      j += 1;
    }

    lineOffsets.push(p);
    result.push(lineOffsets);
  }

  return result;
};

/**
 * Returns style runs broken down per rendered line.
 * Lines with no active styling (all null or empty) are represented as null.
 * Returns null if the element has no styled runs or if offset mapping fails.
 */
export const getTextLineRuns = (
  element: Pick<ExcalidrawTextElement, "text" | "originalText" | "textRanges">,
): (TextLineRun[] | null)[] | null => {
  const runs = getTextStyleRuns(element);
  if (runs.length === 0) {
    return null;
  }

  const lineOffsets = getRenderedLineOffsets(
    element.text,
    element.originalText,
  );
  if (!lineOffsets) {
    return null;
  }

  const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
  const result: (TextLineRun[] | null)[] = [];
  let hasAnyStyledLine = false;

  for (let lineIndex = 0; lineIndex < lineOffsets.length; lineIndex += 1) {
    const offsets = lineOffsets[lineIndex];
    const lineLength = offsets.length - 1;

    if (lineLength === 0) {
      result.push(null);
      continue;
    }

    type UnitStyle = {
      color: string | null;
      highlight: string | null;
    };

    const unitStyles: UnitStyle[] = [];
    let runIndex = 0;

    for (let j = 0; j < lineLength; j += 1) {
      const sourceOffset = offsets[j];

      while (runIndex < runs.length && runs[runIndex].end <= sourceOffset) {
        runIndex += 1;
      }

      if (
        runIndex < runs.length &&
        runs[runIndex].start <= sourceOffset &&
        runs[runIndex].end > sourceOffset
      ) {
        unitStyles.push({
          color: runs[runIndex].color,
          highlight: runs[runIndex].highlight,
        });
      } else {
        unitStyles.push({
          color: null,
          highlight: null,
        });
      }
    }

    const lineText = lines[lineIndex];
    const groups: TextLineRun[] = [];

    let groupStart = 0;
    let currentColor = unitStyles[0].color;
    let currentHighlight = unitStyles[0].highlight;

    for (let j = 1; j < lineLength; j += 1) {
      const code = lineText.charCodeAt(j);
      const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff;

      const style = unitStyles[j];
      const sameStyle =
        style.color === currentColor && style.highlight === currentHighlight;

      if (!sameStyle && !isLowSurrogate) {
        groups.push({
          start: groupStart,
          end: j,
          text: lineText.slice(groupStart, j),
          color: currentColor,
          highlight: currentHighlight,
        });
        groupStart = j;
        currentColor = style.color;
        currentHighlight = style.highlight;
      }
    }

    groups.push({
      start: groupStart,
      end: lineLength,
      text: lineText.slice(groupStart, lineLength),
      color: currentColor,
      highlight: currentHighlight,
    });

    const isAllNull = groups.every(
      (g) => g.color === null && g.highlight === null,
    );

    if (isAllNull) {
      result.push(null);
    } else {
      hasAnyStyledLine = true;
      result.push(groups);
    }
  }

  if (!hasAnyStyledLine) {
    return null;
  }

  return result;
};

type DirectionalSegment = {
  start: number;
  end: number;
  direction: "ltr" | "rtl";
  x?: number;
  width?: number;
};

/**
 * Lays out one rendered line's styled runs as positioned pieces for canvas and SVG.
 */
export const layoutTextLine = (
  line: string,
  runs: readonly TextLineRun[],
  direction: "ltr" | "rtl",
  measure: (text: string) => number,
): TextLineLayout => {
  const segments: DirectionalSegment[] = [];

  if (direction === "ltr" && !hasRTLChars(line)) {
    segments.push({ start: 0, end: line.length, direction: "ltr" });
  } else {
    type CharClass = "ltr" | "rtl" | "neutral";
    const charClasses: CharClass[] = [];

    for (const char of line) {
      const cls: CharClass = hasRTLChars(char)
        ? "rtl"
        : /[\p{L}\p{N}]/u.test(char)
        ? "ltr"
        : "neutral";
      for (let k = 0; k < char.length; k += 1) {
        charClasses.push(cls);
      }
    }

    let i = 0;
    while (i < line.length) {
      if (charClasses[i] === "neutral") {
        const neutralStart = i;
        while (i < line.length && charClasses[i] === "neutral") {
          i += 1;
        }
        const neutralEnd = i;

        const leftStrong =
          neutralStart > 0 ? charClasses[neutralStart - 1] : direction;
        const rightStrong =
          neutralEnd < line.length ? charClasses[neutralEnd] : direction;

        const resolvedDirection: "ltr" | "rtl" =
          leftStrong === rightStrong
            ? (leftStrong as "ltr" | "rtl")
            : direction;

        for (let k = neutralStart; k < neutralEnd; k += 1) {
          charClasses[k] = resolvedDirection;
        }
      } else {
        i += 1;
      }
    }

    let segStart = 0;
    let segDir = charClasses[0] as "ltr" | "rtl";

    for (let j = 1; j < line.length; j += 1) {
      const cls = charClasses[j] as "ltr" | "rtl";
      if (cls !== segDir) {
        segments.push({
          start: segStart,
          end: j,
          direction: segDir,
        });
        segStart = j;
        segDir = cls;
      }
    }

    if (line.length > 0) {
      segments.push({
        start: segStart,
        end: line.length,
        direction: segDir,
      });
    }
  }

  const visualSegments =
    direction === "rtl" ? [...segments].reverse() : segments;

  let currentX = 0;
  for (const segment of visualSegments) {
    const width = measure(line.slice(segment.start, segment.end));
    segment.x = currentX;
    segment.width = width;
    currentX += width;
  }

  const totalWidth = currentX;
  const pieces: TextLinePiece[] = [];

  for (const run of runs) {
    for (const segment of segments) {
      const a = Math.max(run.start, segment.start);
      const b = Math.min(run.end, segment.end);

      if (a < b) {
        const segX = segment.x ?? 0;
        const segWidth = segment.width ?? 0;

        let pieceX = 0;
        if (segment.direction === "ltr") {
          pieceX = segX + measure(line.slice(segment.start, a));
        } else {
          pieceX = segX + segWidth - measure(line.slice(segment.start, b));
        }

        pieces.push({
          text: line.slice(a, b),
          x: pieceX,
          width: measure(line.slice(a, b)),
          color: run.color,
          highlight: run.highlight,
          direction: segment.direction,
        });
      }
    }
  }

  return {
    width: totalWidth,
    pieces,
  };
};

/**
 * Computes horizontal offset of a line based on text alignment and container width.
 */
export const getTextLineLeft = (
  textAlign: TextAlign,
  elementWidth: number,
  lineWidth: number,
): number => {
  if (textAlign === "center") {
    return (elementWidth - lineWidth) / 2;
  }
  if (textAlign === "right") {
    return elementWidth - lineWidth;
  }
  return 0;
};
