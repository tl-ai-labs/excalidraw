import { simplify } from "points-on-curve";

import {
  polygonFromPoints,
  lineSegment,
  polygonIncludesPointNonZero,
  pointFrom,
} from "@excalidraw/math";

import { type Bounds } from "@excalidraw/common";

import {
  computeBoundTextPosition,
  doBoundsIntersect,
  elementOverlapsWithFrame,
  getBoundTextElement,
  getContainingFrame,
  getElementBounds,
  intersectElementWithLineSegment,
  isBoundToContainer,
  pointInsideBounds,
} from "@excalidraw/element";

import type { ElementsSegmentsMap, GlobalPoint } from "@excalidraw/math/types";
import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import type { BoxSelectionMode } from "../types";

export const getLassoSelectedElementIds = (input: {
  lassoPath: GlobalPoint[];
  elements: readonly ExcalidrawElement[];
  elementsMap: ElementsMap;
  elementsSegments: ElementsSegmentsMap;
  intersectedElements: Set<ExcalidrawElement["id"]>;
  enclosedElements: Set<ExcalidrawElement["id"]>;
  simplifyDistance?: number;
  boxSelectionMode?: BoxSelectionMode;
}): {
  selectedElementIds: string[];
} => {
  const {
    lassoPath,
    elements,
    elementsMap,
    elementsSegments,
    intersectedElements,
    enclosedElements,
    simplifyDistance,
    boxSelectionMode = "overlap",
  } = input;
  // simplify the path to reduce the number of points
  let path: GlobalPoint[] = lassoPath;
  if (simplifyDistance) {
    path = simplify(lassoPath, simplifyDistance) as GlobalPoint[];
  }
  const unlockedElements = elements.filter((el) => !el.locked);
  // as the path might not enclose a shape anymore, clear before checking
  enclosedElements.clear();
  intersectedElements.clear();
  const lassoBounds = lassoPath.reduce(
    (acc, item) => {
      return [
        Math.min(acc[0], item[0]),
        Math.min(acc[1], item[1]),
        Math.max(acc[2], item[0]),
        Math.max(acc[3], item[1]),
      ];
    },
    [Infinity, Infinity, -Infinity, -Infinity],
  ) as Bounds;
  for (const element of unlockedElements) {
    if (boxSelectionMode === "contain" && isBoundToContainer(element)) {
      continue;
    }
    // First check if the lasso segment intersects the element's axis-aligned
    // bounding box as it is much faster than checking intersection against
    // the element's shape
    const elementBounds = getElementBounds(element, elementsMap);

    if (
      doBoundsIntersect(lassoBounds, elementBounds) &&
      !intersectedElements.has(element.id) &&
      !enclosedElements.has(element.id)
    ) {
      if (boxSelectionMode === "contain") {
        const frame = getContainingFrame(element, elementsMap);
        const clipBounds =
          frame && elementOverlapsWithFrame(element, frame, elementsMap)
            ? getElementBounds(frame, elementsMap)
            : null;
        if (
          fullEnclosureTest(path, element, elementsSegments, clipBounds) &&
          !intersectionTest(path, element, elementsMap, clipBounds)
        ) {
          enclosedElements.add(element.id);
        }
      } else {
        const enclosed = enclosureTest(path, element, elementsSegments);
        if (enclosed) {
          enclosedElements.add(element.id);
        } else {
          const intersects = intersectionTest(path, element, elementsMap);
          if (intersects) {
            intersectedElements.add(element.id);
          }
        }
      }
    }
  }

  if (boxSelectionMode === "contain") {
    const groupIds = new Set<string>();
    for (const id of enclosedElements) {
      const groupId = elementsMap.get(id)?.groupIds.at(-1);
      if (groupId) {
        groupIds.add(groupId);
      }
    }
    if (groupIds.size > 0) {
      const failingGroups = new Set<string>();
      for (const el of elementsMap.values()) {
        const groupId = el.groupIds.at(-1);
        if (
          groupId &&
          groupIds.has(groupId) &&
          !el.isDeleted &&
          !el.locked &&
          !isBoundToContainer(el) &&
          !enclosedElements.has(el.id)
        ) {
          failingGroups.add(groupId);
        }
      }
      if (failingGroups.size > 0) {
        for (const id of [...enclosedElements]) {
          const groupId = elementsMap.get(id)?.groupIds.at(-1);
          if (groupId && failingGroups.has(groupId)) {
            enclosedElements.delete(id);
          }
        }
      }
    }
  }

  return {
    selectedElementIds: [...intersectedElements, ...enclosedElements],
  };
};

const enclosureTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsSegments: ElementsSegmentsMap,
): boolean => {
  const lassoPolygon = polygonFromPoints(lassoPath);
  const segments = elementsSegments.get(element.id);
  if (!segments) {
    return false;
  }

  return segments.some((segment) => {
    return segment.some((point) =>
      polygonIncludesPointNonZero(point, lassoPolygon),
    );
  });
};

const fullEnclosureTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsSegments: ElementsSegmentsMap,
  clipBounds: Bounds | null,
): boolean => {
  const lassoPolygon = polygonFromPoints(lassoPath);
  const segments = elementsSegments.get(element.id);
  if (!segments || segments.length === 0) {
    return false;
  }

  return segments.every((segment) => {
    return segment.every((point) => {
      const p = clipBounds
        ? pointFrom<GlobalPoint>(
            Math.min(Math.max(point[0], clipBounds[0]), clipBounds[2]),
            Math.min(Math.max(point[1], clipBounds[1]), clipBounds[3]),
          )
        : point;
      return polygonIncludesPointNonZero(p, lassoPolygon);
    });
  });
};

const intersectionTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  clipBounds: Bounds | null = null,
): boolean => {
  const lassoSegments = lassoPath
    .slice(1)
    .map((point: GlobalPoint, index) => lineSegment(lassoPath[index], point))
    .concat([lineSegment(lassoPath[lassoPath.length - 1], lassoPath[0])]);

  const boundTextElement = getBoundTextElement(element, elementsMap);

  const hits = (
    target: ExcalidrawElement,
    lassoSegment: typeof lassoSegments[number],
  ) => {
    if (!clipBounds) {
      return (
        intersectElementWithLineSegment(
          target,
          elementsMap,
          lassoSegment,
          0,
          true,
        ).length > 0
      );
    }
    return intersectElementWithLineSegment(
      target,
      elementsMap,
      lassoSegment,
      0,
      false,
    ).some((point) => pointInsideBounds(point, clipBounds));
  };

  return lassoSegments.some(
    (lassoSegment) =>
      hits(element, lassoSegment) ||
      (!!boundTextElement &&
        hits(
          {
            ...boundTextElement,
            ...computeBoundTextPosition(element, boundTextElement, elementsMap),
          },
          lassoSegment,
        )),
  );
};
