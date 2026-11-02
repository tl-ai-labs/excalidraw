const MIN_MATCH_LENGTH = 3;
const MAX_MATCH_CANDIDATES = 16;
const GRAM_INDEX_WORK = 4;
const MIN_GRAM_TABLE_SIZE = 256;
export const MAX_DIFF_WORK = 2_000_000;

const WORD_CHARACTER = /[\p{L}\p{N}]/u;

export type TextHunk = {
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
};

export type DiffMeter = { left: number };
type TextBlock = { oldStart: number; newStart: number; length: number };
type GramIndex = {
  mask: number;
  starts: Int32Array;
  positions: Int32Array;
};

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

const getGramHash = (text: string, at: number, mask: number) =>
  (Math.imul(
    (text.charCodeAt(at) << 11) ^
      (text.charCodeAt(at + 1) << 5) ^
      text.charCodeAt(at + 2),
    0x9e3779b1,
  ) >>>
    12) &
  mask;

const buildGramIndex = (text: string): GramIndex => {
  const count = text.length - MIN_MATCH_LENGTH + 1;
  let size = MIN_GRAM_TABLE_SIZE;
  while (size < count * 2) {
    size *= 2;
  }
  const mask = size - 1;

  const starts = new Int32Array(size + 1);
  for (let at = 0; at < count; at++) {
    starts[getGramHash(text, at, mask) + 1]++;
  }
  for (let slot = 0; slot < size; slot++) {
    starts[slot + 1] += starts[slot];
  }

  const positions = new Int32Array(count);
  const filled = starts.slice(0, size);
  for (let at = 0; at < count; at++) {
    positions[filled[getGramHash(text, at, mask)]++] = at;
  }

  return { mask, starts, positions };
};

const getFirstAtOrAfter = (
  positions: Int32Array,
  from: number,
  to: number,
  value: number,
): number => {
  let low = from;
  let high = to;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (positions[middle] < value) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

const getLongerBlock = (
  oldText: string,
  newText: string,
  gap: TextHunk,
  oldAt: number,
  newAt: number,
  best: TextBlock | null,
  meter: DiffMeter,
): TextBlock | null => {
  let back = 0;
  while (
    oldAt - back > gap.oldStart &&
    newAt - back > gap.newStart &&
    oldText.charCodeAt(oldAt - back - 1) ===
      newText.charCodeAt(newAt - back - 1)
  ) {
    back++;
  }
  meter.left -= back + 1;

  let oldStart = oldAt - back;
  let newStart = newAt - back;
  const bestLength = best ? best.length : MIN_MATCH_LENGTH - 1;

  if (
    oldStart + bestLength >= gap.oldEnd ||
    newStart + bestLength >= gap.newEnd ||
    oldText.charCodeAt(oldStart + bestLength) !==
      newText.charCodeAt(newStart + bestLength)
  ) {
    return best;
  }

  let length = back;
  while (
    oldStart + length < gap.oldEnd &&
    newStart + length < gap.newEnd &&
    oldText.charCodeAt(oldStart + length) ===
      newText.charCodeAt(newStart + length)
  ) {
    length++;
  }
  meter.left -= length;

  if (isLowSurrogate(oldText.charCodeAt(oldStart))) {
    oldStart++;
    newStart++;
    length--;
  }
  if (
    length > 0 &&
    isHighSurrogate(oldText.charCodeAt(oldStart + length - 1))
  ) {
    length--;
  }

  return length > bestLength ? { oldStart, newStart, length } : best;
};

const searchAt = (
  oldText: string,
  newText: string,
  gap: TextHunk,
  index: GramIndex,
  newAt: number,
  found: TextBlock | null,
  meter: DiffMeter,
): TextBlock | null => {
  meter.left -= 1;
  const { mask, starts, positions } = index;
  const slot = getGramHash(newText, newAt, mask);
  const first = starts[slot];
  const end = starts[slot + 1];
  if (first === end) {
    return found;
  }

  const target =
    gap.oldStart +
    Math.floor(
      ((newAt - gap.newStart) * (gap.oldEnd - gap.oldStart)) /
        (gap.newEnd - gap.newStart),
    );
  let right = getFirstAtOrAfter(positions, first, end, target);
  let left = right - 1;
  let best = found;

  for (let tries = 0; tries < MAX_MATCH_CANDIDATES && meter.left > 0; tries++) {
    const hasRight =
      right < end && positions[right] + MIN_MATCH_LENGTH <= gap.oldEnd;
    const hasLeft = left >= first && positions[left] >= gap.oldStart;
    if (!hasRight && !hasLeft) {
      break;
    }
    const takeRight =
      hasRight &&
      (!hasLeft || positions[right] - target <= target - positions[left]);
    const oldAt = takeRight ? positions[right++] : positions[left--];
    best = getLongerBlock(oldText, newText, gap, oldAt, newAt, best, meter);
  }

  return best;
};

const getStride = (best: TextBlock | null) => (best ? best.length - 1 : 1);

const findLongestBlock = (
  oldText: string,
  newText: string,
  gap: TextHunk,
  index: GramIndex,
  seed: TextBlock | null,
  meter: DiffMeter,
): TextBlock | null => {
  let best = seed;
  const lastAt = gap.newEnd - MIN_MATCH_LENGTH;
  let right = Math.min(lastAt, (gap.newStart + gap.newEnd) >>> 1);
  let left = right - 1;

  while ((right <= lastAt || left >= gap.newStart) && meter.left > 0) {
    if (right <= lastAt) {
      best = searchAt(oldText, newText, gap, index, right, best, meter);
      right += getStride(best);
    }
    if (left >= gap.newStart) {
      best = searchAt(oldText, newText, gap, index, left, best, meter);
      left -= getStride(best);
    }
  }

  return best;
};

const trimHunk = (
  oldText: string,
  newText: string,
  hunk: TextHunk,
  atStart: boolean,
  atEnd: boolean,
): TextHunk => {
  let { oldStart, oldEnd, newStart, newEnd } = hunk;
  if (atStart) {
    while (
      oldStart < oldEnd &&
      newStart < newEnd &&
      oldText[oldStart] === newText[newStart]
    ) {
      oldStart++;
      newStart++;
    }
    if (
      oldStart > hunk.oldStart &&
      isHighSurrogate(oldText.charCodeAt(oldStart - 1))
    ) {
      oldStart--;
      newStart--;
    }
  }
  if (atEnd) {
    while (
      oldStart < oldEnd &&
      newStart < newEnd &&
      oldText[oldEnd - 1] === newText[newEnd - 1]
    ) {
      oldEnd--;
      newEnd--;
    }
    if (oldEnd < hunk.oldEnd && isLowSurrogate(oldText.charCodeAt(oldEnd))) {
      oldEnd++;
      newEnd++;
    }
  }
  return { oldStart, oldEnd, newStart, newEnd };
};

const isInsideWord = (text: string, at: number): boolean =>
  at > 0 &&
  at < text.length &&
  WORD_CHARACTER.test(text[at - 1]) &&
  WORD_CHARACTER.test(text[at]);

const splitsSurrogatePair = (text: string, at: number): boolean =>
  at > 0 &&
  at < text.length &&
  isHighSurrogate(text.charCodeAt(at - 1)) &&
  isLowSurrogate(text.charCodeAt(at));

const alignLines = (
  oldText: string,
  newText: string,
  hunk: TextHunk,
): TextHunk[] | null => {
  const oldLines = oldText.slice(hunk.oldStart, hunk.oldEnd).split("\n");
  const newLines = newText.slice(hunk.newStart, hunk.newEnd).split("\n");
  if (oldLines.length < 2 || oldLines.length !== newLines.length) {
    return null;
  }
  const result: TextHunk[] = [];
  let oldAt = hunk.oldStart;
  let newAt = hunk.newStart;
  for (let i = 0; i < oldLines.length; i++) {
    const oldEnd = oldAt + oldLines[i].length;
    const newEnd = newAt + newLines[i].length;
    result.push(
      trimHunk(
        oldText,
        newText,
        { oldStart: oldAt, oldEnd, newStart: newAt, newEnd },
        true,
        true,
      ),
    );
    oldAt = oldEnd + 1;
    newAt = newEnd + 1;
  }
  return result;
};

const alignToken = (
  oldText: string,
  newText: string,
  hunk: TextHunk,
): TextHunk[] | null => {
  const length = hunk.oldEnd - hunk.oldStart;
  if (
    length < 1 ||
    length >= MIN_MATCH_LENGTH ||
    hunk.newEnd - hunk.newStart <= length ||
    isInsideWord(oldText, hunk.oldStart) ||
    isInsideWord(oldText, hunk.oldEnd)
  ) {
    return null;
  }
  const token = oldText.slice(hunk.oldStart, hunk.oldEnd);
  if (token.trim() === "") {
    return null;
  }
  for (let at = hunk.newStart; at + length <= hunk.newEnd; at++) {
    if (
      newText.startsWith(token, at) &&
      !isInsideWord(newText, at) &&
      !isInsideWord(newText, at + length) &&
      !splitsSurrogatePair(newText, at) &&
      !splitsSurrogatePair(newText, at + length)
    ) {
      return [
        {
          oldStart: hunk.oldStart,
          oldEnd: hunk.oldStart,
          newStart: hunk.newStart,
          newEnd: at,
        },
        {
          oldStart: hunk.oldEnd,
          oldEnd: hunk.oldEnd,
          newStart: at + length,
          newEnd: hunk.newEnd,
        },
      ];
    }
  }
  return null;
};

const getSlide = (
  changed: string,
  other: string,
  start: number,
  end: number,
  at: number,
  lower: number,
  upper: number,
): number => {
  if (!isInsideWord(other, at)) {
    return 0;
  }
  let canLeft = true;
  let canRight = true;
  for (let step = 1; step <= end - start; step++) {
    canLeft =
      canLeft &&
      start - step >= lower &&
      changed[start - step] === changed[end - step];
    if (
      canLeft &&
      !isInsideWord(other, at - step) &&
      !splitsSurrogatePair(changed, start - step) &&
      !splitsSurrogatePair(changed, end - step)
    ) {
      return -step;
    }
    canRight =
      canRight &&
      end + step <= upper &&
      changed[start + step - 1] === changed[end + step - 1];
    if (
      canRight &&
      !isInsideWord(other, at + step) &&
      !splitsSurrogatePair(changed, start + step) &&
      !splitsSurrogatePair(changed, end + step)
    ) {
      return step;
    }
    if (!canLeft && !canRight) {
      break;
    }
  }
  return 0;
};

const refineHunks = (
  oldText: string,
  newText: string,
  hunks: readonly TextHunk[],
  meter: DiffMeter,
): TextHunk[] => {
  const aligned: TextHunk[] = [];
  for (const hunk of hunks) {
    const oldLength = hunk.oldEnd - hunk.oldStart;
    const newLength = hunk.newEnd - hunk.newStart;
    if (meter.left <= 0 || oldLength === 0 || newLength === 0) {
      aligned.push(hunk);
      continue;
    }
    meter.left -= oldLength + newLength;
    const lines = alignLines(oldText, newText, hunk);
    if (lines !== null) {
      for (const line of lines) {
        aligned.push(line);
      }
      continue;
    }
    const token = alignToken(oldText, newText, hunk);
    if (token !== null) {
      aligned.push(...token);
      continue;
    }
    aligned.push(hunk);
  }

  const parts = aligned.filter(
    (hunk) => hunk.oldStart < hunk.oldEnd || hunk.newStart < hunk.newEnd,
  );

  for (let i = 0; i < parts.length; i++) {
    const hunk = parts[i];
    const isInsertion = hunk.oldStart === hunk.oldEnd;
    const isDeletion = hunk.newStart === hunk.newEnd;
    if (meter.left <= 0 || (!isInsertion && !isDeletion)) {
      continue;
    }
    const previous = parts[i - 1];
    const next = parts[i + 1];
    meter.left -= hunk.oldEnd - hunk.oldStart + (hunk.newEnd - hunk.newStart);
    const slide = isInsertion
      ? getSlide(
          newText,
          oldText,
          hunk.newStart,
          hunk.newEnd,
          hunk.oldStart,
          previous ? previous.newEnd : 0,
          next ? next.newStart : newText.length,
        )
      : getSlide(
          oldText,
          newText,
          hunk.oldStart,
          hunk.oldEnd,
          hunk.newStart,
          previous ? previous.oldEnd : 0,
          next ? next.oldStart : oldText.length,
        );
    if (slide !== 0) {
      parts[i] = {
        oldStart: hunk.oldStart + slide,
        oldEnd: hunk.oldEnd + slide,
        newStart: hunk.newStart + slide,
        newEnd: hunk.newEnd + slide,
      };
    }
  }

  return parts;
};

export const diffText = (
  oldText: string,
  newText: string,
  meter: DiffMeter = { left: MAX_DIFF_WORK },
): TextHunk[] => {
  if (oldText === newText) {
    return [];
  }

  const whole: TextHunk = {
    oldStart: 0,
    oldEnd: oldText.length,
    newStart: 0,
    newEnd: newText.length,
  };
  const trimmed = trimHunk(oldText, newText, whole, true, true);
  const indexWork = oldText.length * GRAM_INDEX_WORK + newText.length;

  if (
    trimmed.oldEnd - trimmed.oldStart + (trimmed.newEnd - trimmed.newStart) <
    MIN_MATCH_LENGTH
  ) {
    return refineHunks(oldText, newText, [trimmed], meter);
  }
  if (oldText.length < MIN_MATCH_LENGTH || newText.length < MIN_MATCH_LENGTH) {
    return refineHunks(oldText, newText, [trimmed], meter);
  }
  if (indexWork > meter.left) {
    return [trimmed];
  }

  meter.left -= indexWork;
  const index = buildGramIndex(oldText);
  const prefix = trimmed.oldStart;
  const suffix = oldText.length - trimmed.oldEnd;
  let seed: TextBlock | null = null;
  if (prefix >= MIN_MATCH_LENGTH && prefix >= suffix) {
    seed = { oldStart: 0, newStart: 0, length: prefix };
  } else if (suffix >= MIN_MATCH_LENGTH) {
    seed = {
      oldStart: trimmed.oldEnd,
      newStart: trimmed.newEnd,
      length: suffix,
    };
  }

  const blocks: TextBlock[] = [];
  const queue: TextHunk[] = [whole];
  for (let head = 0; head < queue.length && meter.left > 0; head++) {
    const gap = queue[head];
    const block = findLongestBlock(
      oldText,
      newText,
      gap,
      index,
      head === 0 ? seed : null,
      meter,
    );
    if (!block) {
      continue;
    }
    blocks.push(block);

    if (
      block.oldStart - gap.oldStart >= MIN_MATCH_LENGTH &&
      block.newStart - gap.newStart >= MIN_MATCH_LENGTH
    ) {
      queue.push({
        oldStart: gap.oldStart,
        oldEnd: block.oldStart,
        newStart: gap.newStart,
        newEnd: block.newStart,
      });
    }

    const oldAfter = block.oldStart + block.length;
    const newAfter = block.newStart + block.length;
    if (
      gap.oldEnd - oldAfter >= MIN_MATCH_LENGTH &&
      gap.newEnd - newAfter >= MIN_MATCH_LENGTH
    ) {
      queue.push({
        oldStart: oldAfter,
        oldEnd: gap.oldEnd,
        newStart: newAfter,
        newEnd: gap.newEnd,
      });
    }
  }

  if (blocks.length === 0) {
    return refineHunks(oldText, newText, [trimmed], meter);
  }
  blocks.sort((a, b) => a.oldStart - b.oldStart);

  const gaps: TextHunk[] = [];
  let oldAt = 0;
  let newAt = 0;
  for (const block of blocks) {
    gaps.push({
      oldStart: oldAt,
      oldEnd: block.oldStart,
      newStart: newAt,
      newEnd: block.newStart,
    });
    oldAt = block.oldStart + block.length;
    newAt = block.newStart + block.length;
  }
  gaps.push({
    oldStart: oldAt,
    oldEnd: oldText.length,
    newStart: newAt,
    newEnd: newText.length,
  });

  gaps[0] = trimHunk(oldText, newText, gaps[0], true, false);
  gaps[gaps.length - 1] = trimHunk(
    oldText,
    newText,
    gaps[gaps.length - 1],
    false,
    true,
  );

  return refineHunks(
    oldText,
    newText,
    gaps.filter(
      (gap) => gap.oldStart < gap.oldEnd || gap.newStart < gap.newEnd,
    ),
    meter,
  );
};

// Hunks are sorted, and a merge maps up to 1,024 records through one list,
// so finding the hunk a position falls in must not walk the list.
const findHunkEndingAtOrAfter = (
  hunks: readonly TextHunk[],
  p: number,
): number => {
  let low = 0;
  let high = hunks.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (hunks[middle].oldEnd < p) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

const getDeltaBefore = (hunks: readonly TextHunk[], at: number): number =>
  at > 0 ? hunks[at - 1].newEnd - hunks[at - 1].oldEnd : 0;

const mapStart = (hunks: readonly TextHunk[], p: number): number => {
  const at = findHunkEndingAtOrAfter(hunks, p);
  if (at < hunks.length && p >= hunks[at].oldStart) {
    return hunks[at].newEnd;
  }
  return p + getDeltaBefore(hunks, at);
};

const mapEnd = (hunks: readonly TextHunk[], p: number): number => {
  const at = findHunkEndingAtOrAfter(hunks, p);
  if (at < hunks.length && p > hunks[at].oldStart) {
    return hunks[at].newStart;
  }
  return p + getDeltaBefore(hunks, at);
};

export const mapSpanThroughHunks = (
  hunks: readonly TextHunk[],
  start: number,
  end: number,
): { start: number; end: number } => {
  const nextStart = mapStart(hunks, start);
  const nextEnd = mapEnd(hunks, end);
  return {
    start: nextStart,
    end: Math.max(nextStart, nextEnd),
  };
};

export const mapTextSpan = (
  oldText: string,
  newText: string,
  start: number,
  end: number,
): { start: number; end: number } => {
  return mapSpanThroughHunks(diffText(oldText, newText), start, end);
};
