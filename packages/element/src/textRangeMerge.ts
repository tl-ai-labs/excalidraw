import { randomId } from "@excalidraw/common";

import { MAX_DIFF_WORK, diffText, mapSpanThroughHunks } from "./textDiff";

import {
  areTextRangesEqual,
  canonicalizeTextRanges,
  getOriginTexts,
  sanitizeTextRanges,
  shiftTextRanges,
} from "./textRanges";
import { isTextElement } from "./typeChecks";

import { hashString } from ".";

import type { DiffMeter, TextHunk } from "./textDiff";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawTextRange,
  ExcalidrawTextRangeOrigin,
  ExcalidrawTextRanges,
} from "./types";

const getRegister = (
  record: ExcalidrawTextRange,
  element: ExcalidrawTextElement,
  originTexts: ReadonlyMap<string, string>,
): ExcalidrawTextRangeOrigin => {
  const { origin } = record;
  if (!origin) {
    return {
      version: element.version,
      versionNonce: element.versionNonce,
      text: element.originalText,
      start: record.start,
      end: record.end,
    };
  }
  if ("text" in origin) {
    return origin;
  }
  const { version, versionNonce, textFrom, start, end } = origin;
  return {
    version,
    versionNonce,
    text: originTexts.get(textFrom)!,
    start,
    end,
  };
};

const pickNewerRegister = (
  a: ExcalidrawTextRangeOrigin,
  b: ExcalidrawTextRangeOrigin,
): ExcalidrawTextRangeOrigin => {
  if (a.version !== b.version) {
    return a.version > b.version ? a : b;
  }
  if (a.versionNonce !== b.versionNonce) {
    return a.versionNonce < b.versionNonce ? a : b;
  }
  if (a.text !== b.text) {
    return a.text < b.text ? a : b;
  }
  if (a.start !== b.start) {
    return a.start < b.start ? a : b;
  }
  if (a.end !== b.end) {
    return a.end < b.end ? a : b;
  }
  return a;
};

// The highest record holding a text keeps it, so the 1,024 cap, which cuts from
// the lowest, never drops a text a kept record refers to.
const shareOriginTexts = (
  ranges: readonly ExcalidrawTextRange[],
): ExcalidrawTextRange[] => {
  const holders = new Map<string, string>();
  const shared = [...ranges];
  for (let i = shared.length - 1; i >= 0; i--) {
    const record = shared[i];
    if (!record.origin || !("text" in record.origin)) {
      continue;
    }
    const { version, versionNonce, text, start, end } = record.origin;
    const holder = holders.get(text);
    if (holder === undefined) {
      holders.set(text, record.id);
    } else {
      shared[i] = {
        ...record,
        origin: { version, versionNonce, textFrom: holder, start, end },
      };
    }
  }
  return shared;
};

export function mergeTextRanges<T extends ExcalidrawElement>(
  base: T,
  other: ExcalidrawElement,
): T {
  if (
    !isTextElement(base) ||
    !isTextElement(other) ||
    typeof base.originalText !== "string" ||
    typeof other.originalText !== "string" ||
    (!base.textRanges && !other.textRanges)
  ) {
    return base;
  }

  const baseRanges =
    sanitizeTextRanges(base.textRanges, base.originalText)?.ranges ?? [];
  const otherRanges =
    sanitizeTextRanges(other.textRanges, other.originalText)?.ranges ?? [];

  if (otherRanges.length === 0) {
    return base;
  }

  const baseTexts = getOriginTexts(baseRanges);
  const otherTexts = getOriginTexts(otherRanges);

  const baseMap = new Map<string, ExcalidrawTextRange>();
  for (const r of baseRanges) {
    baseMap.set(r.id, r);
  }

  const otherMap = new Map<string, ExcalidrawTextRange>();
  for (const r of otherRanges) {
    otherMap.set(r.id, r);
  }

  const allIds = new Set<string>([...baseMap.keys(), ...otherMap.keys()]);
  const survivors = canonicalizeTextRanges(
    [...allIds].map((id) => (baseMap.get(id) ?? otherMap.get(id))!),
  ).reverse();
  const mergedRecords: ExcalidrawTextRange[] = [];

  const meter: DiffMeter = { left: MAX_DIFF_WORK };
  const hunksByText = new Map<string, readonly TextHunk[]>();

  for (const { id } of survivors) {
    const bRec = baseMap.get(id);
    const oRec = otherMap.get(id);

    const template = (bRec ?? oRec)!;
    const isRetired = bRec?.retired === true || oRec?.retired === true;

    let start: number;
    let end: number;
    let origin: ExcalidrawTextRangeOrigin | undefined = undefined;

    if (bRec && !bRec.origin) {
      start = bRec.start;
      end = bRec.end;
    } else {
      let reg: ExcalidrawTextRangeOrigin;
      if (bRec && oRec) {
        reg = pickNewerRegister(
          getRegister(bRec, base, baseTexts),
          getRegister(oRec, other, otherTexts),
        );
      } else if (bRec) {
        reg = getRegister(bRec, base, baseTexts);
      } else {
        reg = getRegister(oRec!, other, otherTexts);
      }

      if (
        reg.version === base.version &&
        reg.versionNonce === base.versionNonce &&
        reg.text === base.originalText
      ) {
        start = reg.start;
        end = reg.end;
      } else {
        let hunks = hunksByText.get(reg.text);
        if (!hunks) {
          hunks = diffText(reg.text, base.originalText, meter);
          hunksByText.set(reg.text, hunks);
        }
        const mapped = mapSpanThroughHunks(hunks, reg.start, reg.end);
        start = mapped.start;
        end = mapped.end;
        origin = reg;
      }
    }

    const mergedRecord: {
      id: string;
      start: number;
      end: number;
      z: number;
      color?: string | null;
      highlight?: string | null;
      retired?: true;
      origin?: ExcalidrawTextRangeOrigin;
    } = {
      id: template.id,
      start,
      end,
      z: template.z,
    };

    if (template.color !== undefined) {
      mergedRecord.color = template.color;
    }
    if (template.highlight !== undefined) {
      mergedRecord.highlight = template.highlight;
    }
    if (isRetired) {
      mergedRecord.retired = true;
    }
    if (origin !== undefined) {
      mergedRecord.origin = origin;
    }

    mergedRecords.push(mergedRecord as ExcalidrawTextRange);
  }

  const ranges = shareOriginTexts(canonicalizeTextRanges(mergedRecords));
  const next: ExcalidrawTextRanges = {
    textHash: hashString(base.originalText),
    ranges,
  };

  if (areTextRangesEqual(next, base.textRanges)) {
    return base;
  }

  return {
    ...base,
    textRanges: next,
  };
}

export function applyTextRangesDelta(
  element: ExcalidrawTextElement,
  deleted: Partial<ExcalidrawTextElement>,
  inserted: Partial<ExcalidrawTextElement>,
): ExcalidrawTextRanges | undefined {
  const holdsText = typeof inserted.originalText === "string";
  const nextText = holdsText ? inserted.originalText : element.originalText;
  const prior =
    sanitizeTextRanges(element.textRanges, element.originalText)?.ranges ?? [];

  const shifted =
    nextText !== element.originalText
      ? prior.length === 0
        ? []
        : shiftTextRanges(element.originalText, nextText, {
            textHash: hashString(element.originalText),
            ranges: prior,
          })?.ranges ?? []
      : prior;

  const recordsMap = new Map<string, ExcalidrawTextRange>();
  for (const r of shifted) {
    recordsMap.set(r.id, r);
  }

  const deletedRanges = Array.isArray(deleted.textRanges?.ranges)
    ? deleted.textRanges!.ranges
    : [];
  const insertedRanges = Array.isArray(inserted.textRanges?.ranges)
    ? inserted.textRanges!.ranges
    : [];

  const priorAlive = new Set<string>();
  for (const r of deletedRanges) {
    if (r && !r.retired) {
      priorAlive.add(r.id);
    }
  }

  const targetAlive = new Set<string>();
  for (const r of insertedRanges) {
    if (r && !r.retired) {
      targetAlive.add(r.id);
    }
  }

  for (const id of priorAlive) {
    if (!targetAlive.has(id)) {
      const rec = recordsMap.get(id);
      if (rec) {
        const retiredCopy: ExcalidrawTextRange = {
          ...rec,
          retired: true,
        };
        recordsMap.set(id, retiredCopy);
      }
    }
  }

  for (const t of insertedRanges) {
    if (!t || t.retired || priorAlive.has(t.id)) {
      continue;
    }

    const c = recordsMap.get(t.id);
    if (c && !c.retired) {
      continue;
    }

    let spanStart: number;
    let spanEnd: number;

    if (holdsText) {
      spanStart = t.start;
      spanEnd = t.end;
    } else if (c) {
      spanStart = c.start;
      spanEnd = c.end;
    } else {
      spanStart = t.start;
      spanEnd = t.end;
    }

    const clampedStart = Math.max(0, Math.min(nextText.length, spanStart));
    const clampedEnd = Math.max(0, Math.min(nextText.length, spanEnd));

    if (c && c.retired) {
      const newRec: {
        id: string;
        start: number;
        end: number;
        z: number;
        color?: string | null;
        highlight?: string | null;
      } = {
        id: randomId(),
        start: clampedStart,
        end: clampedEnd,
        z: t.z,
      };
      if (t.color !== undefined) {
        newRec.color = t.color;
      }
      if (t.highlight !== undefined) {
        newRec.highlight = t.highlight;
      }
      recordsMap.set(newRec.id, newRec as ExcalidrawTextRange);
    } else if (!c) {
      const addRec: {
        id: string;
        start: number;
        end: number;
        z: number;
        color?: string | null;
        highlight?: string | null;
      } = {
        id: t.id,
        start: clampedStart,
        end: clampedEnd,
        z: t.z,
      };
      if (t.color !== undefined) {
        addRec.color = t.color;
      }
      if (t.highlight !== undefined) {
        addRec.highlight = t.highlight;
      }
      recordsMap.set(t.id, addRec as ExcalidrawTextRange);
    }
  }

  const exact = holdsText && deleted.originalText === element.originalText;
  const addressed = inserted.textRanges?.textHash === hashString(nextText);

  for (const t of insertedRanges) {
    if (!t || t.retired) {
      continue;
    }

    const entry = recordsMap.get(t.id);
    if (!entry || entry.retired) {
      continue;
    }

    const deletedRec = deletedRanges.find((d) => d && d.id === t.id);
    const bothCollapsed =
      addressed &&
      entry.start === entry.end &&
      deletedRec !== undefined &&
      deletedRec.start === deletedRec.end;

    if (exact || bothCollapsed) {
      const clampedStart = Math.max(0, Math.min(nextText.length, t.start));
      const clampedEnd = Math.max(0, Math.min(nextText.length, t.end));
      const updated: ExcalidrawTextRange = {
        ...entry,
        start: clampedStart,
        end: clampedEnd,
      };
      recordsMap.set(t.id, updated);
    }
  }

  const ranges = canonicalizeTextRanges(Array.from(recordsMap.values()));

  if (element.textRanges === undefined && ranges.length === 0) {
    return undefined;
  }

  const next: ExcalidrawTextRanges = {
    textHash: hashString(nextText),
    ranges,
  };

  if (areTextRangesEqual(next, element.textRanges)) {
    return element.textRanges;
  }

  return next;
}
