import {
  ARROWHEAD_SIZE_SCALES,
  DEFAULT_ARROWHEAD_SIZE,
} from "@excalidraw/common";

import type { Arrowhead, AnyArrowhead, ArrowheadSize } from "./types";

export const normalizeArrowhead = (
  arrowhead: AnyArrowhead | null | undefined,
): Arrowhead | null => {
  switch (arrowhead) {
    case undefined:
    case null:
      return null;
    case "dot":
      return "circle";
    case "crowfoot_one":
      return "cardinality_one";
    case "crowfoot_many":
      return "cardinality_many";
    case "crowfoot_one_or_many":
      return "cardinality_one_or_many";
    default:
      return arrowhead;
  }
};

export const getArrowheadForPicker = (
  arrowhead: AnyArrowhead | null | undefined,
): Arrowhead | null => {
  const normalizedArrowhead = normalizeArrowhead(arrowhead);
  if (normalizedArrowhead === null) {
    return null;
  }

  return normalizedArrowhead;
};

/** Checks whether a value is a valid arrowhead size preset. */
export const isArrowheadSize = (value: unknown): value is ArrowheadSize => {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ARROWHEAD_SIZE_SCALES, value)
  );
};

/** Normalizes an arrowhead size; defaults or invalid sizes collapse to undefined. */
export const normalizeArrowheadSize = (
  value: unknown,
): ArrowheadSize | undefined => {
  if (isArrowheadSize(value) && value !== DEFAULT_ARROWHEAD_SIZE) {
    return value;
  }
  return undefined;
};

/** Returns the scale factor for an arrowhead size preset, defaulting to 1. */
export const getArrowheadSizeScale = (
  arrowheadSize: ArrowheadSize | undefined,
): number => {
  if (isArrowheadSize(arrowheadSize)) {
    return ARROWHEAD_SIZE_SCALES[arrowheadSize];
  }
  return 1;
};
