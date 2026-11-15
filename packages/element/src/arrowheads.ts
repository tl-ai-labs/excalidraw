import type { Arrowhead, AnyArrowhead, ArrowheadSize } from "./types";

export const normalizeArrowheadSize = (
  arrowheadSize: unknown,
): ArrowheadSize | undefined => {
  if (
    arrowheadSize === "small" ||
    arrowheadSize === "medium" ||
    arrowheadSize === "large"
  ) {
    return arrowheadSize;
  }
  return undefined;
};

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
