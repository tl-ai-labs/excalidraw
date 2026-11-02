import { colorToHex, isTransparent, randomId } from "@excalidraw/common";

import { diffText, mapSpanThroughHunks } from "./textDiff";

import { hashString } from ".";

import type {
  ExcalidrawTextElement,
  ExcalidrawTextRange,
  ExcalidrawTextRangeOrigin,
  ExcalidrawTextRangeSharedOrigin,
  ExcalidrawTextRanges,
} from "./types";

export const MAX_TEXT_RANGES = 1024;
const MAX_TEXT_RANGE_ID_LENGTH = 64;
const MAX_TEXT_RANGE_COLOR_LENGTH = 64;

export type TextRangeStyle = {
  color?: string | null;
  highlight?: string | null;
};

export type TextStyleRun = {
  start: number;
  end: number;
  color: string | null;
  highlight: string | null;
};

export const createTextRange = (
  entry: ExcalidrawTextRange,
): ExcalidrawTextRange => {
  const record: {
    id: string;
    start: number;
    end: number;
    z: number;
    color?: string | null;
    highlight?: string | null;
    retired?: true;
    origin?: ExcalidrawTextRange["origin"];
  } = {
    id: entry.id,
    start: entry.start,
    end: entry.end,
    z: entry.z,
  };

  if (entry.color !== undefined) {
    record.color = entry.color;
  }
  if (entry.highlight !== undefined) {
    record.highlight = entry.highlight;
  }
  if (entry.retired !== undefined) {
    record.retired = entry.retired;
  }
  if (entry.origin !== undefined) {
    record.origin = entry.origin;
  }

  return record as ExcalidrawTextRange;
};

export const isValidTextRangeColor = (value: unknown): value is string => {
  return (
    typeof value === "string" &&
    value.length <= MAX_TEXT_RANGE_COLOR_LENGTH &&
    colorToHex(value) !== null
  );
};

export const canonicalizeTextRanges = (
  ranges: readonly ExcalidrawTextRange[],
): ExcalidrawTextRange[] => {
  const sorted = [...ranges].sort((a, b) => {
    if (a.z !== b.z) {
      return a.z - b.z;
    }
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });

  if (sorted.length > MAX_TEXT_RANGES) {
    return sorted.slice(sorted.length - MAX_TEXT_RANGES);
  }
  return sorted;
};

const isSameOriginText = (
  a: ExcalidrawTextRangeOrigin | ExcalidrawTextRangeSharedOrigin,
  b: ExcalidrawTextRangeOrigin | ExcalidrawTextRangeSharedOrigin,
): boolean =>
  "text" in a
    ? "text" in b && a.text === b.text
    : "textFrom" in b && a.textFrom === b.textFrom;

export const areTextRangesEqual = (
  a: ExcalidrawTextRanges | undefined,
  b: ExcalidrawTextRanges | undefined,
): boolean => {
  if (a === undefined && b === undefined) {
    return true;
  }
  if (a === undefined || b === undefined) {
    return false;
  }
  if (a.textHash !== b.textHash) {
    return false;
  }
  if (a.ranges.length !== b.ranges.length) {
    return false;
  }

  for (let i = 0; i < a.ranges.length; i++) {
    const ra = a.ranges[i];
    const rb = b.ranges[i];
    if (
      ra.id !== rb.id ||
      ra.start !== rb.start ||
      ra.end !== rb.end ||
      ra.z !== rb.z ||
      ra.color !== rb.color ||
      ra.highlight !== rb.highlight ||
      ra.retired !== rb.retired
    ) {
      return false;
    }

    if (ra.origin !== rb.origin) {
      if (!ra.origin || !rb.origin) {
        return false;
      }
      if (
        ra.origin.version !== rb.origin.version ||
        ra.origin.versionNonce !== rb.origin.versionNonce ||
        !isSameOriginText(ra.origin, rb.origin) ||
        ra.origin.start !== rb.origin.start ||
        ra.origin.end !== rb.origin.end
      ) {
        return false;
      }
    }
  }

  return true;
};

export const getOriginTexts = (
  ranges: readonly ExcalidrawTextRange[],
): Map<string, string> => {
  const texts = new Map<string, string>();
  for (const r of ranges) {
    if (r.origin && "text" in r.origin) {
      texts.set(r.id, r.origin.text);
    }
  }
  return texts;
};

// Runs after the cap, because the cap can drop a record another one refers to.
const dropUnresolvedOrigins = (
  ranges: readonly ExcalidrawTextRange[],
): ExcalidrawTextRange[] => {
  const texts = getOriginTexts(ranges);
  return ranges.map((r) => {
    if (!r.origin || "text" in r.origin) {
      return r;
    }
    const text = texts.get(r.origin.textFrom);
    return text !== undefined && r.origin.end <= text.length
      ? r
      : createTextRange({ ...r, origin: undefined });
  });
};

export const sanitizeTextRanges = (
  raw: unknown,
  originalText: string,
): ExcalidrawTextRanges | undefined => {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("ranges" in raw) ||
    !Array.isArray((raw as { ranges: unknown }).ranges)
  ) {
    return undefined;
  }

  const candidate = raw as { textHash?: unknown; ranges: unknown[] };
  if (candidate.textHash !== hashString(originalText)) {
    return undefined;
  }

  const seenIds = new Set<string>();
  const sanitizedRanges: ExcalidrawTextRange[] = [];

  const maxRead = Math.min(candidate.ranges.length, MAX_TEXT_RANGES * 16);

  for (let i = 0; i < maxRead; i++) {
    const entry = candidate.ranges[i];
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const item = entry as Partial<ExcalidrawTextRange> &
      Record<string, unknown>;

    if (
      typeof item.id !== "string" ||
      item.id.length < 1 ||
      item.id.length > MAX_TEXT_RANGE_ID_LENGTH ||
      seenIds.has(item.id)
    ) {
      continue;
    }

    if (
      !Number.isInteger(item.start) ||
      !Number.isInteger(item.end) ||
      !Number.isInteger(item.z) ||
      (item.z as number) < 0 ||
      (item.end as number) < (item.start as number)
    ) {
      continue;
    }

    const hasValidColor =
      item.color === null || isValidTextRangeColor(item.color);
    const hasValidHighlight =
      item.highlight === null || isValidTextRangeColor(item.highlight);

    const keepColor = hasValidColor ? item.color : undefined;
    const keepHighlight = hasValidHighlight ? item.highlight : undefined;

    if (keepColor === undefined && keepHighlight === undefined) {
      continue;
    }

    seenIds.add(item.id);

    const clampedStart = Math.max(
      0,
      Math.min(originalText.length, item.start as number),
    );
    const clampedEnd = Math.max(
      0,
      Math.min(originalText.length, item.end as number),
    );

    const keepRetired = item.retired === true ? true : undefined;

    const origin = item.origin as
      | (ExcalidrawTextRangeOrigin & { textFrom?: unknown })
      | undefined;
    let keepOrigin: ExcalidrawTextRange["origin"] = undefined;
    if (
      origin &&
      typeof origin === "object" &&
      Number.isInteger(origin.version) &&
      Number.isInteger(origin.versionNonce) &&
      Number.isInteger(origin.start) &&
      Number.isInteger(origin.end) &&
      0 <= origin.start &&
      origin.start <= origin.end
    ) {
      const { version, versionNonce, text, textFrom, start, end } = origin;
      if (typeof text === "string") {
        if (end <= text.length) {
          keepOrigin = { version, versionNonce, text, start, end };
        }
      } else if (typeof textFrom === "string") {
        keepOrigin = { version, versionNonce, textFrom, start, end };
      }
    }

    sanitizedRanges.push(
      createTextRange({
        id: item.id,
        start: clampedStart,
        end: clampedEnd,
        z: item.z as number,
        color: keepColor,
        highlight: keepHighlight,
        retired: keepRetired,
        origin: keepOrigin,
      }),
    );
  }

  const canonical = dropUnresolvedOrigins(
    canonicalizeTextRanges(sanitizedRanges),
  );
  if (canonical.length === 0) {
    return undefined;
  }

  const result: ExcalidrawTextRanges = {
    textHash: candidate.textHash as number,
    ranges: canonical,
  };

  if (areTextRangesEqual(result, raw as ExcalidrawTextRanges)) {
    return raw as ExcalidrawTextRanges;
  }

  return result;
};

export const getTextStyleRuns = (
  element: Pick<ExcalidrawTextElement, "originalText" | "textRanges">,
): TextStyleRun[] => {
  const textRanges = sanitizeTextRanges(
    element.textRanges,
    element.originalText,
  );
  if (!textRanges) {
    return [];
  }

  const usableRecords = textRanges.ranges.filter(
    (r) => !r.retired && r.start < r.end,
  );

  if (usableRecords.length === 0) {
    return [];
  }

  const compareAttrRecords = (
    a: ExcalidrawTextRange,
    b: ExcalidrawTextRange,
    attr: "color" | "highlight",
  ) => {
    if (a.z !== b.z) {
      return b.z - a.z;
    }
    const valA = a[attr];
    const valB = b[attr];
    const aIsNull = valA === null;
    const bIsNull = valB === null;
    if (aIsNull && !bIsNull) {
      return -1;
    }
    if (!aIsNull && bIsNull) {
      return 1;
    }
    if (a.id > b.id) {
      return -1;
    }
    if (a.id < b.id) {
      return 1;
    }
    return 0;
  };

  const colorRecords = usableRecords
    .filter((r) => r.color !== undefined)
    .sort((a, b) => compareAttrRecords(a, b, "color"));

  const highlightRecords = usableRecords
    .filter((r) => r.highlight !== undefined)
    .sort((a, b) => compareAttrRecords(a, b, "highlight"));

  const boundarySet = new Set<number>();
  for (const r of usableRecords) {
    boundarySet.add(r.start);
    boundarySet.add(r.end);
  }
  const bounds = [...boundarySet].sort((a, b) => a - b);

  const rawRuns: TextStyleRun[] = [];

  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];

    let color: string | null = null;
    for (const r of colorRecords) {
      if (r.start <= a && r.end >= b) {
        color = r.color ?? null;
        break;
      }
    }

    let highlight: string | null = null;
    for (const r of highlightRecords) {
      if (r.start <= a && r.end >= b) {
        highlight = r.highlight ?? null;
        break;
      }
    }

    if (color === null && highlight === null) {
      continue;
    }

    const last = rawRuns[rawRuns.length - 1];
    if (
      last &&
      last.color === color &&
      last.highlight === highlight &&
      last.end === a
    ) {
      last.end = b;
    } else {
      rawRuns.push({ start: a, end: b, color, highlight });
    }
  }

  return rawRuns;
};

export const applyTextRangeStyle = (
  element: Pick<ExcalidrawTextElement, "originalText" | "textRanges">,
  span: { start: number; end: number },
  style: TextRangeStyle,
): ExcalidrawTextRanges | undefined => {
  const start = Math.max(
    0,
    Math.min(element.originalText.length, Math.min(span.start, span.end)),
  );
  const end = Math.max(
    0,
    Math.min(element.originalText.length, Math.max(span.start, span.end)),
  );

  if (start >= end) {
    return element.textRanges;
  }

  let normalizedColor: string | null | undefined = undefined;
  if (style.color !== undefined) {
    if (style.color === null || isTransparent(style.color)) {
      normalizedColor = null;
    } else if (isValidTextRangeColor(style.color)) {
      normalizedColor = style.color;
    }
  }

  let normalizedHighlight: string | null | undefined = undefined;
  if (style.highlight !== undefined) {
    if (style.highlight === null || isTransparent(style.highlight)) {
      normalizedHighlight = null;
    } else if (isValidTextRangeColor(style.highlight)) {
      normalizedHighlight = style.highlight;
    }
  }

  if (normalizedColor === undefined && normalizedHighlight === undefined) {
    return element.textRanges;
  }

  const current =
    sanitizeTextRanges(element.textRanges, element.originalText)?.ranges ?? [];

  let maxZ = 0;
  for (const r of current) {
    if (r.z > maxZ) {
      maxZ = r.z;
    }
  }
  const nextZ = current.length > 0 ? maxZ + 1 : 1;

  const normalizedStyle: TextRangeStyle = {};
  if (normalizedColor !== undefined) {
    normalizedStyle.color = normalizedColor;
  }
  if (normalizedHighlight !== undefined) {
    normalizedStyle.highlight = normalizedHighlight;
  }

  const resultRecords: ExcalidrawTextRange[] = [];

  for (const r of current) {
    const withoutOrigin = createTextRange({
      id: r.id,
      start: r.start,
      end: r.end,
      z: r.z,
      color: r.color,
      highlight: r.highlight,
      retired: r.retired,
    });

    const hasStringAttr =
      typeof r.color === "string" || typeof r.highlight === "string";

    let stringAttrsAllCleared = true;
    if (typeof r.color === "string" && normalizedStyle.color !== null) {
      stringAttrsAllCleared = false;
    }
    if (typeof r.highlight === "string" && normalizedStyle.highlight !== null) {
      stringAttrsAllCleared = false;
    }

    const isRemoved =
      !r.retired &&
      r.start < end &&
      r.end > start &&
      hasStringAttr &&
      stringAttrsAllCleared;

    if (isRemoved) {
      const retiredRecord = createTextRange({
        ...withoutOrigin,
        retired: true,
      });
      resultRecords.push(retiredRecord);

      if (r.start < start) {
        resultRecords.push(
          createTextRange({
            id: randomId(),
            start: r.start,
            end: start,
            z: r.z,
            color: r.color,
            highlight: r.highlight,
          }),
        );
      }

      if (r.end > end) {
        resultRecords.push(
          createTextRange({
            id: randomId(),
            start: end,
            end: r.end,
            z: r.z,
            color: r.color,
            highlight: r.highlight,
          }),
        );
      }
    } else {
      resultRecords.push(withoutOrigin);
    }
  }

  resultRecords.push(
    createTextRange({
      id: randomId(),
      start,
      end,
      z: nextZ,
      color: normalizedStyle.color,
      highlight: normalizedStyle.highlight,
    }),
  );

  const next: ExcalidrawTextRanges = {
    textHash: hashString(element.originalText),
    ranges: canonicalizeTextRanges(resultRecords),
  };

  const oldRuns = getTextStyleRuns(element);
  const nextRuns = getTextStyleRuns({
    originalText: element.originalText,
    textRanges: next,
  });

  let runsEqual = oldRuns.length === nextRuns.length;
  if (runsEqual) {
    for (let i = 0; i < oldRuns.length; i++) {
      if (
        oldRuns[i].start !== nextRuns[i].start ||
        oldRuns[i].end !== nextRuns[i].end ||
        oldRuns[i].color !== nextRuns[i].color ||
        oldRuns[i].highlight !== nextRuns[i].highlight
      ) {
        runsEqual = false;
        break;
      }
    }
  }

  if (runsEqual) {
    return element.textRanges;
  }

  return next;
};

export const shiftTextRanges = (
  oldText: string,
  newText: string,
  textRanges: ExcalidrawTextRanges | undefined,
): ExcalidrawTextRanges | undefined => {
  if (textRanges === undefined || oldText === newText) {
    return textRanges;
  }

  const current = sanitizeTextRanges(textRanges, oldText);
  if (current === undefined) {
    return textRanges;
  }

  const hunks = diffText(oldText, newText);

  const mapped: ExcalidrawTextRange[] = current.ranges.map((r) => {
    const nextSpan = mapSpanThroughHunks(hunks, r.start, r.end);
    return createTextRange({
      id: r.id,
      start: nextSpan.start,
      end: nextSpan.end,
      z: r.z,
      color: r.color,
      highlight: r.highlight,
      retired: r.retired,
    });
  });

  return {
    textHash: hashString(newText),
    ranges: canonicalizeTextRanges(mapped),
  };
};

export const getTextRangesUpdate = (
  element: Pick<ExcalidrawTextElement, "originalText" | "textRanges">,
  nextOriginalText: string,
): { textRanges?: ExcalidrawTextRanges } => {
  if (
    element.textRanges === undefined ||
    nextOriginalText === element.originalText
  ) {
    return {};
  }

  return {
    textRanges: shiftTextRanges(
      element.originalText,
      nextOriginalText,
      element.textRanges,
    ),
  };
};
