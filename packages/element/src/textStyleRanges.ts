import {
  MAX_CLEARED_TEXT_STYLE_RANGES,
  MAX_MERGED_TEXT_STYLE_RECORDS,
  MAX_TEXT_STYLE_RANGES,
  MAX_TEXT_STYLE_SEQ,
  getFontString,
  hasRTLChars,
  randomId,
} from "@excalidraw/common";

import type { Mutable } from "@excalidraw/common/utility-types";

import { getLineWidth } from "./textMeasurements";

import type { RenderEnvironment } from "./renderEnvironment";
import type {
  ClearedTextStyleRange,
  ExcalidrawTextElement,
  TextStyleRange,
} from "./types";

export type TextStyleState = {
  ranges: readonly TextStyleRange[];
  cleared: readonly ClearedTextStyleRange[];
};

export type TextStyleAttribute = "color" | "highlight";

export type TextStyleRun = {
  /** offset into the text the run was built from, not into originalText */
  start: number;
  end: number;
  color?: string;
  highlight?: string;
};

export type TextStyleRangeInput = Pick<
  TextStyleRange,
  "start" | "end" | "color" | "highlight"
> &
  Partial<Pick<TextStyleRange, "id" | "seq">>;

/** past this LCS table size the changed middle counts as replaced */
const MAX_TEXT_ALIGN_CELLS = 1_000_000;

/** a shorter matched block is likely a stray shared letter, not kept text */
const MIN_ALIGNED_BLOCK_LENGTH = 2;

const MAX_RANGE_ID_LENGTH = 64;
const MAX_COLOR_LENGTH = 64;

const HEX_COLOR_REGEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const NAMED_COLOR_REGEX = /^[a-z]{3,30}$/i;
const FUNCTIONAL_COLOR_REGEX = /^(?:rgb|hsl)a?\([\d\s.,%/]+\)$/i;

/**
 * The store's snapshot compares versions, so it cannot see a merge that keeps
 * version. Maps an element and a range id whose presence a merge changed to
 * the local element's version at that time, so that undo can leave that change
 * alone. Bounded, as the ids come from peers: an evicted record only means
 * that merged change can land in a local undo step, which is safe.
 */
const mergedRangeVersions = new Map<string, number>();

/** the length prefix keeps two (element, range) pairs from sharing a key */
const getMergedRangeKey = (elementId: string, rangeId: string) =>
  `${elementId.length}:${elementId}${rangeId}`;

const recordMergedRange = (
  elementId: string,
  rangeId: string,
  version: number,
) => {
  const key = getMergedRangeKey(elementId, rangeId);
  // delete first, so that the newest records stay last in insertion order
  mergedRangeVersions.delete(key);
  mergedRangeVersions.set(key, version);
  while (mergedRangeVersions.size > MAX_MERGED_TEXT_STYLE_RECORDS) {
    const oldest = mergedRangeVersions.keys().next();
    if (oldest.done) {
      break;
    }
    mergedRangeVersions.delete(oldest.value);
  }
};

const compareBySeqThenId = (
  a: ClearedTextStyleRange,
  b: ClearedTextStyleRange,
) => {
  if (a.seq !== b.seq) {
    return a.seq - b.seq;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? -1 : 1;
};

/** the one canonicaliser, so that equal sets always compare equal */
const resolveState = (
  ranges: readonly TextStyleRange[],
  cleared: readonly ClearedTextStyleRange[],
): TextStyleState => {
  const clearedById = new Map<string, ClearedTextStyleRange>();
  for (const entry of cleared) {
    const current = clearedById.get(entry.id);
    if (!current || entry.seq > current.seq) {
      clearedById.set(entry.id, entry);
    }
  }

  const rangesById = new Map<string, TextStyleRange>();
  for (const range of ranges) {
    const current = rangesById.get(range.id);
    if (!current || range.seq > current.seq) {
      rangesById.set(range.id, range);
    }
  }

  const nextRanges: TextStyleRange[] = [];
  for (const range of rangesById.values()) {
    const entry = clearedById.get(range.id);
    if (!entry || entry.seq < range.seq) {
      nextRanges.push(range);
    }
  }

  const nextCleared: ClearedTextStyleRange[] = [];
  for (const entry of clearedById.values()) {
    const range = rangesById.get(entry.id);
    if (!range || range.seq <= entry.seq) {
      nextCleared.push(entry);
    }
  }

  nextRanges.sort(compareBySeqThenId);
  nextCleared.sort(compareBySeqThenId);

  // keeps the highest (seq, then id), with no tombstone for an evicted range
  return {
    ranges: nextRanges.slice(-MAX_TEXT_STYLE_RANGES),
    cleared: nextCleared.slice(-MAX_CLEARED_TEXT_STYLE_RANGES),
  };
};

const getTextStyleState = (element: ExcalidrawTextElement): TextStyleState => ({
  ranges: element.textStyleRanges ?? [],
  cleared: element.clearedTextStyleRanges ?? [],
});

const isValidColor = (value: unknown) =>
  typeof value === "string" &&
  value.length <= MAX_COLOR_LENGTH &&
  (HEX_COLOR_REGEX.test(value) ||
    NAMED_COLOR_REGEX.test(value) ||
    FUNCTIONAL_COLOR_REGEX.test(value));

const isValidId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= MAX_RANGE_ID_LENGTH;

const isValidSeq = (value: unknown): value is number =>
  Number.isSafeInteger(value) &&
  (value as number) > 0 &&
  (value as number) <= MAX_TEXT_STYLE_SEQ;

const clampOffset = (offset: number, length: number) =>
  Math.min(Math.max(offset, 0), length);

/** rebuilds the range, so that unknown keys never pass through */
const sanitizeRange = (
  value: unknown,
  textLength: number,
): TextStyleRange | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { id, seq, start, end, color, highlight } = value as Partial<
    Record<keyof TextStyleRange, unknown>
  >;
  if (
    !isValidId(id) ||
    !isValidSeq(seq) ||
    typeof start !== "number" ||
    typeof end !== "number" ||
    !Number.isInteger(start) ||
    !Number.isInteger(end)
  ) {
    return null;
  }

  const nextStart = clampOffset(start, textLength);
  const nextEnd = clampOffset(end, textLength);
  if (nextStart >= nextEnd) {
    return null;
  }
  if (
    (color !== undefined && !isValidColor(color)) ||
    (highlight !== undefined && !isValidColor(highlight)) ||
    (color === undefined && highlight === undefined)
  ) {
    return null;
  }

  const range: Mutable<TextStyleRange> = {
    id,
    seq,
    start: nextStart,
    end: nextEnd,
  };
  if (color !== undefined) {
    range.color = color as string;
  }
  if (highlight !== undefined) {
    range.highlight = highlight as string;
  }
  return range;
};

const getCommonSuffixLength = (prev: string, next: string, cap: number) => {
  let length = 0;
  while (
    length < cap &&
    prev.charCodeAt(prev.length - 1 - length) ===
      next.charCodeAt(next.length - 1 - length)
  ) {
    length++;
  }
  return length;
};

const getCommonPrefixLength = (prev: string, next: string, cap: number) => {
  let length = 0;
  while (length < cap && prev.charCodeAt(length) === next.charCodeAt(length)) {
    length++;
  }
  return length;
};

/**
 * Maps each code unit of `prev` to its index in `next`, or -1. The suffix is
 * capped at the text after the caret, which places an insert correctly inside
 * a run of repeated characters.
 */
const alignText = (prev: string, next: string, caret?: number) => {
  const map = new Int32Array(prev.length).fill(-1);
  const maxCommon = Math.min(prev.length, next.length);
  const suffix = getCommonSuffixLength(
    prev,
    next,
    caret === undefined
      ? maxCommon
      : Math.max(Math.min(maxCommon, next.length - caret), 0),
  );
  const prefix = getCommonPrefixLength(prev, next, maxCommon - suffix);

  for (let index = 0; index < prefix; index++) {
    map[index] = index;
  }
  for (let index = 1; index <= suffix; index++) {
    map[prev.length - index] = next.length - index;
  }

  const m = prev.length - prefix - suffix;
  const n = next.length - prefix - suffix;
  if (m <= 0 || n <= 0 || m * n > MAX_TEXT_ALIGN_CELLS) {
    return map;
  }

  // the cell cap keeps the shorter side at 1000, well within 16 bits
  const width = n + 1;
  const table = new Uint16Array((m + 1) * width);
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      table[i * width + j] =
        prev.charCodeAt(prefix + i) === next.charCodeAt(prefix + j)
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  let blockLength = 0;

  const commitBlock = () => {
    if (blockLength >= MIN_ALIGNED_BLOCK_LENGTH) {
      for (let offset = 1; offset <= blockLength; offset++) {
        map[prefix + i - offset] = prefix + j - offset;
      }
    }
    blockLength = 0;
  };

  while (i < m && j < n) {
    if (
      prev.charCodeAt(prefix + i) === next.charCodeAt(prefix + j) &&
      table[i * width + j] === table[(i + 1) * width + j + 1] + 1
    ) {
      blockLength++;
      i++;
      j++;
    } else {
      commitBlock();
      if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
        i++;
      } else {
        j++;
      }
    }
  }
  commitBlock();

  return map;
};

/**
 * Characters inserted between survivors join the range, while inserts at its
 * edges stay outside it.
 */
const mapRange = (
  range: TextStyleRange,
  map: Int32Array,
): TextStyleRange | null => {
  let first = range.start;
  while (first < range.end && map[first] < 0) {
    first++;
  }
  if (first >= range.end) {
    return null;
  }
  let last = range.end - 1;
  while (map[last] < 0) {
    last--;
  }
  return { ...range, start: map[first], end: map[last] + 1 };
};

const isInsideSurrogatePair = (text: string, index: number) => {
  if (index <= 0 || index >= text.length) {
    return false;
  }
  const before = text.charCodeAt(index - 1);
  const after = text.charCodeAt(index);
  return (
    before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff
  );
};

const snapStart = (text: string, index: number) =>
  isInsideSurrogatePair(text, index) ? index - 1 : index;

const snapEnd = (text: string, index: number) =>
  isInsideSurrogatePair(text, index) ? index + 1 : index;

const resolveSelection = (
  text: string,
  selection: { start: number; end: number },
) => ({
  start: snapStart(text, clampOffset(selection.start, text.length)),
  end: snapEnd(text, clampOffset(selection.end, text.length)),
});

const nextSeq = (state: TextStyleState) => {
  let highest = 0;
  for (const range of state.ranges) {
    highest = Math.max(highest, range.seq);
  }
  for (const entry of state.cleared) {
    highest = Math.max(highest, entry.seq);
  }
  // saturates, so that the next seq never fails validation
  return Math.min(highest + 1, MAX_TEXT_STYLE_SEQ);
};

/**
 * Writes both fields in place, deleting an empty one. Only for fresh copies
 * and elements being mutated.
 */
export const withTextStyles = <T extends ExcalidrawTextElement>(
  element: T,
  state: TextStyleState,
): T => {
  const mutable = element as Mutable<ExcalidrawTextElement>;
  if (state.ranges.length) {
    mutable.textStyleRanges = state.ranges;
  } else {
    delete mutable.textStyleRanges;
  }
  if (state.cleared.length) {
    mutable.clearedTextStyleRanges = state.cleared;
  } else {
    delete mutable.clearedTextStyleRanges;
  }
  return element;
};

export const createTextStyleRanges = (
  inputs: readonly TextStyleRangeInput[] | undefined,
  originalText: string,
): readonly TextStyleRange[] | undefined => {
  if (!inputs?.length) {
    return undefined;
  }
  const ranges: TextStyleRange[] = [];
  inputs.forEach((input, index) => {
    const range = sanitizeRange(
      {
        ...input,
        id: input.id ?? randomId(),
        seq: input.seq ?? Math.min(index + 1, MAX_TEXT_STYLE_SEQ),
      },
      originalText.length,
    );
    if (range) {
      ranges.push(range);
    }
  });
  const state = resolveState(ranges, []);
  return state.ranges.length ? state.ranges : undefined;
};

export const applyTextStyle = (
  element: ExcalidrawTextElement,
  selection: { start: number; end: number },
  style: Pick<TextStyleRange, "color" | "highlight">,
): TextStyleState => {
  const state = getTextStyleState(element);
  const { start, end } = resolveSelection(element.originalText, selection);
  // a range must set at least one colour
  if (
    start >= end ||
    (style.color === undefined && style.highlight === undefined)
  ) {
    return state;
  }

  const seq = nextSeq(state);
  const ranges: TextStyleRange[] = [];
  const cleared = [...state.cleared];

  for (const range of state.ranges) {
    const isReplaced =
      range.start >= start &&
      range.end <= end &&
      (range.color === undefined || style.color !== undefined) &&
      (range.highlight === undefined || style.highlight !== undefined);
    if (isReplaced) {
      cleared.push({ id: range.id, seq: range.seq });
    } else {
      ranges.push(range);
    }
  }

  const range: Mutable<TextStyleRange> = { id: randomId(), seq, start, end };
  if (style.color !== undefined) {
    range.color = style.color;
  }
  if (style.highlight !== undefined) {
    range.highlight = style.highlight;
  }
  ranges.push(range);

  return resolveState(ranges, cleared);
};

/** pieces keep the cleared range's seq, so that paint order holds */
export const clearTextStyle = (
  element: ExcalidrawTextElement,
  selection: { start: number; end: number },
  attribute: TextStyleAttribute,
): TextStyleState => {
  const state = getTextStyleState(element);
  const { start, end } = resolveSelection(element.originalText, selection);
  if (start >= end) {
    return state;
  }

  const otherAttribute = attribute === "color" ? "highlight" : "color";
  const ranges: TextStyleRange[] = [];
  const cleared = [...state.cleared];

  for (const range of state.ranges) {
    if (
      range.start >= end ||
      range.end <= start ||
      range[attribute] === undefined
    ) {
      ranges.push(range);
      continue;
    }

    cleared.push({ id: range.id, seq: range.seq });
    if (range.start < start) {
      ranges.push({ ...range, id: randomId(), end: start });
    }
    if (end < range.end) {
      ranges.push({ ...range, id: randomId(), start: end });
    }
    const otherValue = range[otherAttribute];
    if (otherValue !== undefined) {
      ranges.push({
        id: randomId(),
        seq: range.seq,
        start: Math.max(range.start, start),
        end: Math.min(range.end, end),
        [otherAttribute]: otherValue,
      });
    }
  }

  return resolveState(ranges, cleared);
};

/**
 * Moves ranges onto new text. A range that loses all its characters is dropped
 * with no tombstone, so a winning text that kept them keeps the range.
 */
export const remapTextStyles = (
  element: ExcalidrawTextElement,
  nextOriginalText: string,
  opts?: { caret?: number; replace?: boolean },
): TextStyleState | null => {
  const ranges = element.textStyleRanges;
  const prev = element.originalText;
  if (!ranges || nextOriginalText === prev) {
    return null;
  }

  const mapped: TextStyleRange[] = [];

  if (opts?.replace) {
    const maxCommon = Math.min(prev.length, nextOriginalText.length);
    const suffix = getCommonSuffixLength(prev, nextOriginalText, maxCommon);
    const prefix = getCommonPrefixLength(
      prev,
      nextOriginalText,
      maxCommon - suffix,
    );
    const prevEnd = prev.length - suffix;
    const nextEnd = nextOriginalText.length - suffix;
    const delta = nextOriginalText.length - prev.length;

    const mapOffset = (offset: number, inside: number) => {
      if (offset <= prefix) {
        return offset;
      }
      return offset >= prevEnd ? offset + delta : inside;
    };

    for (const range of ranges) {
      const start = mapOffset(range.start, prefix);
      const end = mapOffset(range.end, nextEnd);
      if (start < end) {
        mapped.push({ ...range, start, end });
      }
    }
  } else {
    const map = alignText(prev, nextOriginalText, opts?.caret);
    for (const range of ranges) {
      const next = mapRange(range, map);
      if (next) {
        mapped.push(next);
      }
    }
  }

  return resolveState(mapped, element.clearedTextStyleRanges ?? []);
};

export const sanitizeTextStyles = <T extends ExcalidrawTextElement>(
  element: T,
): T => {
  const rawRanges: unknown = element.textStyleRanges;
  const rawCleared: unknown = element.clearedTextStyleRanges;
  if (rawRanges === undefined && rawCleared === undefined) {
    return element;
  }

  const ranges: TextStyleRange[] = [];
  if (Array.isArray(rawRanges)) {
    for (const value of rawRanges) {
      const range = sanitizeRange(value, element.originalText.length);
      if (range) {
        ranges.push(range);
      }
    }
  }

  const cleared: ClearedTextStyleRange[] = [];
  if (Array.isArray(rawCleared)) {
    for (const value of rawCleared) {
      if (typeof value === "object" && value !== null) {
        const { id, seq } = value as Partial<
          Record<keyof ClearedTextStyleRange, unknown>
        >;
        if (isValidId(id) && isValidSeq(seq)) {
          cleared.push({ id, seq });
        }
      }
    }
  }

  return withTextStyles({ ...element }, resolveState(ranges, cleared));
};

const isSameRange = (a: TextStyleRange, b: TextStyleRange) =>
  a.id === b.id &&
  a.seq === b.seq &&
  a.start === b.start &&
  a.end === b.end &&
  a.color === b.color &&
  a.highlight === b.highlight;

const isSameCleared = (a: ClearedTextStyleRange, b: ClearedTextStyleRange) =>
  a.id === b.id && a.seq === b.seq;

const isSameList = <T>(
  a: readonly T[],
  b: readonly T[],
  isSame: (a: T, b: T) => boolean,
) =>
  a.length === b.length && a.every((value, index) => isSame(value, b[index]));

/**
 * Joins both sides' styles onto the winner. Keeps version, versionNonce and
 * updated, as a merge must not start a broadcast. Returns a new object on any
 * change, because the canvas cache is keyed by object identity.
 */
export const mergeTextStyles = <T extends ExcalidrawTextElement>(
  winner: T,
  loser: ExcalidrawTextElement,
): T => {
  if (winner === loser) {
    return winner;
  }
  const winnerState = getTextStyleState(winner);
  const loserState = getTextStyleState(loser);
  if (
    !winnerState.ranges.length &&
    !winnerState.cleared.length &&
    !loserState.ranges.length &&
    !loserState.cleared.length
  ) {
    return winner;
  }

  const loserRanges = new Map(
    loserState.ranges.map((range) => [range.id, range]),
  );
  const winnerIds = new Set<string>();
  const ranges: TextStyleRange[] = [];

  for (const range of winnerState.ranges) {
    winnerIds.add(range.id);
    const loserSeq = loserRanges.get(range.id)?.seq ?? 0;
    ranges.push(loserSeq > range.seq ? { ...range, seq: loserSeq } : range);
  }

  const isSameText = winner.originalText === loser.originalText;
  let map: Int32Array | null = null;

  for (const range of loserState.ranges) {
    if (winnerIds.has(range.id)) {
      continue;
    }
    if (isSameText) {
      ranges.push(range);
      continue;
    }
    map = map ?? alignText(loser.originalText, winner.originalText);
    const mapped = mapRange(range, map);
    if (mapped) {
      ranges.push(mapped);
    }
  }

  const state = resolveState(ranges, [
    ...winnerState.cleared,
    ...loserState.cleared,
  ]);

  if (
    isSameList(state.ranges, winnerState.ranges, isSameRange) &&
    isSameList(state.cleared, winnerState.cleared, isSameCleared)
  ) {
    return winner;
  }
  return withTextStyles({ ...winner }, state);
};

export const noteMergedTextStyles = (
  local: ExcalidrawTextElement,
  merged: ExcalidrawTextElement,
): void => {
  if (!local.textStyleRanges && !merged.textStyleRanges) {
    return;
  }
  const localRanges = local.textStyleRanges ?? [];
  const mergedRanges = merged.textStyleRanges ?? [];
  const localIds = new Set(localRanges.map((range) => range.id));
  const mergedIds = new Set(mergedRanges.map((range) => range.id));

  for (const { id } of localRanges) {
    if (!mergedIds.has(id)) {
      recordMergedRange(local.id, id, local.version);
    }
  }
  for (const { id } of mergedRanges) {
    if (!localIds.has(id)) {
      recordMergedRange(local.id, id, local.version);
    }
  }
};

/** keeps a merge's range changes out of a delta, so undo reverts local steps */
export const omitMergedTextStyleChanges = (
  elementId: string,
  deleted: Partial<ExcalidrawTextElement>,
  inserted: Partial<ExcalidrawTextElement>,
): void => {
  const baseVersion = deleted.version;
  const deletedRanges = deleted.textStyleRanges;
  const insertedRanges = inserted.textStyleRanges;
  if (typeof baseVersion !== "number" || (!deletedRanges && !insertedRanges)) {
    return;
  }

  const deletedIds = new Set(deletedRanges?.map((range) => range.id));
  const insertedIds = new Set(insertedRanges?.map((range) => range.id));

  const isOmitted = (id: string, otherIds: Set<string>) =>
    !otherIds.has(id) &&
    (mergedRangeVersions.get(getMergedRangeKey(elementId, id)) ?? -1) >=
      baseVersion;

  const nextDeleted = (deletedRanges ?? []).filter(
    (range) => !isOmitted(range.id, insertedIds),
  );
  const nextInserted = (insertedRanges ?? []).filter(
    (range) => !isOmitted(range.id, deletedIds),
  );

  const mutableDeleted = deleted as Mutable<Partial<ExcalidrawTextElement>>;
  const mutableInserted = inserted as Mutable<Partial<ExcalidrawTextElement>>;

  if (!nextDeleted.length && !nextInserted.length) {
    delete mutableDeleted.textStyleRanges;
    delete mutableInserted.textStyleRanges;
    return;
  }
  if (deletedRanges) {
    mutableDeleted.textStyleRanges = nextDeleted;
  }
  if (insertedRanges) {
    mutableInserted.textStyleRanges = nextInserted;
  }
};

/**
 * Applies an id-keyed diff to the current ranges, so that undo leaves ranges it
 * did not touch, including those peers added after the step.
 */
export const applyTextStyleDelta = (
  element: ExcalidrawTextElement,
  nextOriginalText: string,
  removed: readonly TextStyleRange[] | undefined,
  added: readonly TextStyleRange[] | undefined,
): TextStyleState | null => {
  if (
    !removed?.length &&
    !added?.length &&
    nextOriginalText === element.originalText
  ) {
    return null;
  }

  const current =
    remapTextStyles(element, nextOriginalText)?.ranges ??
    element.textStyleRanges ??
    [];
  const rangesById = new Map(current.map((range) => [range.id, range]));
  const clearedById = new Map(
    (element.clearedTextStyleRanges ?? []).map((entry) => [entry.id, entry]),
  );
  const addedIds = new Set(added?.map((range) => range.id));
  const removedIds = new Set(removed?.map((range) => range.id));

  for (const { id } of removed ?? []) {
    const range = rangesById.get(id);
    if (range && !addedIds.has(id)) {
      rangesById.delete(id);
      clearedById.set(id, { id, seq: range.seq });
    }
  }

  for (const entry of added ?? []) {
    const tombstone = clearedById.get(entry.id);
    // an id in both lists is an offset change, not an undo of a clear, so a
    // peer's tombstone for it must stand
    if (
      tombstone &&
      removedIds.has(entry.id) &&
      !rangesById.has(entry.id) &&
      tombstone.seq >= entry.seq
    ) {
      continue;
    }
    const isReAdd = !!tombstone && tombstone.seq >= entry.seq;
    const seq =
      tombstone && isReAdd
        ? Math.min(tombstone.seq + 1, MAX_TEXT_STYLE_SEQ)
        : entry.seq;
    const start = clampOffset(entry.start, nextOriginalText.length);
    const end = clampOffset(entry.end, nextOriginalText.length);
    if (start < end) {
      if (isReAdd) {
        clearedById.delete(entry.id);
      }
      rangesById.set(entry.id, { ...entry, seq, start, end });
    }
  }

  return resolveState(
    Array.from(rangesById.values()),
    Array.from(clearedById.values()),
  );
};

/**
 * Splits text into runs of one resolved style. Colour and highlight resolve
 * independently: walking the canonical list, the last range to set one wins.
 */
export const getTextStyleRuns = (
  text: string,
  textStart: number,
  ranges: readonly TextStyleRange[],
): TextStyleRun[] => {
  if (!text) {
    return [];
  }

  const spans: { start: number; end: number; range: TextStyleRange }[] = [];
  const edges = new Set([0, text.length]);

  for (const range of ranges) {
    const start = snapStart(
      text,
      clampOffset(range.start - textStart, text.length),
    );
    const end = snapEnd(text, clampOffset(range.end - textStart, text.length));
    if (start < end) {
      spans.push({ start, end, range });
      edges.add(start);
      edges.add(end);
    }
  }

  const offsets = Array.from(edges).sort((a, b) => a - b);
  const runs: TextStyleRun[] = [];

  for (let index = 0; index < offsets.length - 1; index++) {
    const start = offsets[index];
    const end = offsets[index + 1];
    let color: string | undefined;
    let highlight: string | undefined;

    for (const span of spans) {
      if (span.start <= start && span.end >= end) {
        color = span.range.color ?? color;
        highlight = span.range.highlight ?? highlight;
      }
    }

    const previous = runs[runs.length - 1];
    if (
      previous &&
      previous.color === color &&
      previous.highlight === highlight
    ) {
      previous.end = end;
      continue;
    }

    const run: TextStyleRun = { start, end };
    if (color !== undefined) {
      run.color = color;
    }
    if (highlight !== undefined) {
      run.highlight = highlight;
    }
    runs.push(run);
  }

  return runs;
};

/**
 * Runs per line of element.text, with null for a line that draws plain. Null
 * for the whole element when a line can't be located in originalText, so a
 * stale text never misplaces colour. Lines with RTL characters draw plain, as
 * a logical run can't be placed in a bidi line without a layout engine.
 */
export const getStyledTextLines = (
  element: ExcalidrawTextElement,
): (readonly TextStyleRun[] | null)[] | null => {
  const ranges = element.textStyleRanges;
  if (ranges === undefined) {
    return null;
  }

  const { originalText } = element;
  const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
  const styledLines: (readonly TextStyleRun[] | null)[] = [];
  let cursor = 0;

  for (const line of lines) {
    if (!line) {
      styledLines.push(null);
      continue;
    }

    const start = originalText.indexOf(line, cursor);
    // only the whitespace wrapping removes may sit between two lines
    if (start === -1 || originalText.slice(cursor, start).trim()) {
      return null;
    }
    cursor = start + line.length;

    if (hasRTLChars(line)) {
      styledLines.push(null);
      continue;
    }
    const runs = getTextStyleRuns(line, start, ranges);
    styledLines.push(
      runs.some((run) => run.color !== undefined || run.highlight !== undefined)
        ? runs
        : null,
    );
  }

  return styledLines;
};

/** measures prefixes of the line, so that kerning across a run edge stays */
export const layoutTextStyleRuns = (
  element: ExcalidrawTextElement,
  lineText: string,
  runs: readonly TextStyleRun[],
  renderEnvironment: RenderEnvironment | undefined,
): { run: TextStyleRun; x: number; width: number }[] => {
  const font = getFontString(element);
  const lineWidth = getLineWidth(lineText, font, renderEnvironment);

  let lineStart = 0;
  if (element.textAlign === "center") {
    lineStart = (element.width - lineWidth) / 2;
  } else if (element.textAlign === "right") {
    lineStart = element.width - lineWidth;
  }

  const measurePrefix = (end: number) =>
    end === 0
      ? 0
      : getLineWidth(lineText.slice(0, end), font, renderEnvironment);

  return runs.map((run) => {
    const prefixWidth = measurePrefix(run.start);
    return {
      run,
      x: lineStart + prefixWidth,
      width: measurePrefix(run.end) - prefixWidth,
    };
  });
};
