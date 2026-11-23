import { simplify } from "points-on-curve";

import {
  polygonFromPoints,
  lineSegment,
  pointFrom,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import { type Bounds } from "@excalidraw/common";

import {
  computeBoundTextPosition,
  doBoundsIntersect,
  getBoundTextElement,
  getElementBounds,
  intersectElementWithLineSegment,
  isBoundToContainer,
  isFreeDrawElement,
} from "@excalidraw/element";

import type {
  ElementsSegmentsMap,
  GlobalPoint,
  LineSegment,
  Polygon,
} from "@excalidraw/math/types";
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
    boxSelectionMode = "contain",
  } = input;
  // simplify the path to reduce the number of points
  let path: GlobalPoint[] = lassoPath;
  if (simplifyDistance) {
    path = simplify(lassoPath, simplifyDistance) as GlobalPoint[];
  }
  // as the path might not enclose a shape anymore, clear before checking
  enclosedElements.clear();
  intersectedElements.clear();

  if (
    path.length === 0 ||
    (boxSelectionMode === "contain" && path.length < 3)
  ) {
    return {
      selectedElementIds: [],
    };
  }

  const unlockedElements = elements.filter(
    (el) =>
      !el.locked && (boxSelectionMode === "overlap" || !isBoundToContainer(el)),
  );
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

  const lassoPolygon = polygonFromPoints(path);
  const lassoSegments = getLassoSegments(path);

  for (const element of unlockedElements) {
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
        const enclosed = fullEnclosureTest(
          lassoPolygon,
          lassoSegments,
          element,
          elementsMap,
          elementsSegments,
        );
        if (enclosed) {
          enclosedElements.add(element.id);
        }
      } else {
        const enclosed = partialEnclosureTest(
          lassoPolygon,
          element,
          elementsSegments,
        );
        if (enclosed) {
          enclosedElements.add(element.id);
        } else {
          const intersects = intersectionTest(
            lassoSegments,
            element,
            elementsMap,
          );
          if (intersects) {
            intersectedElements.add(element.id);
          }
        }
      }
    }
  }

  if (boxSelectionMode === "contain") {
    const groups: Record<string, ExcalidrawElement[]> = {};
    for (const element of elementsMap.values()) {
      if (element.locked || isBoundToContainer(element)) {
        continue;
      }
      const groupId = element.groupIds.at(-1);
      if (groupId) {
        if (!groups[groupId]) {
          groups[groupId] = [];
        }
        groups[groupId].push(element);
      }
    }

    for (const id of enclosedElements) {
      const element = elementsMap.get(id);
      const groupId = element?.groupIds.at(-1);
      const group = groupId ? groups[groupId] : null;
      if (
        group &&
        !group.every((groupElement) => enclosedElements.has(groupElement.id))
      ) {
        enclosedElements.delete(id);
      }
    }
  }

  const results = [...intersectedElements, ...enclosedElements];

  return {
    selectedElementIds: results,
  };
};

const getLassoSegments = (
  lassoPath: GlobalPoint[],
): LineSegment<GlobalPoint>[] => {
  return lassoPath
    .slice(1)
    .map((point: GlobalPoint, index) => lineSegment(lassoPath[index], point))
    .concat([lineSegment(lassoPath[lassoPath.length - 1], lassoPath[0])]);
};

const partialEnclosureTest = (
  lassoPolygon: Polygon<GlobalPoint>,
  element: ExcalidrawElement,
  elementsSegments: ElementsSegmentsMap,
): boolean => {
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

const areSegmentsEnclosed = (
  lassoPolygon: Polygon<GlobalPoint>,
  segments: LineSegment<GlobalPoint>[] | undefined,
  element: ExcalidrawElement,
): boolean => {
  if (!segments) {
    return false;
  }

  if (segments.length === 0) {
    if (isFreeDrawElement(element) && element.points.length === 1) {
      const [px, py] = element.points[0];
      return polygonIncludesPointNonZero(
        pointFrom<GlobalPoint>(element.x + px, element.y + py),
        lassoPolygon,
      );
    }
    return false;
  }

  return segments.every((segment) =>
    segment.every((point) => polygonIncludesPointNonZero(point, lassoPolygon)),
  );
};

const fullEnclosureTest = (
  lassoPolygon: Polygon<GlobalPoint>,
  lassoSegments: LineSegment<GlobalPoint>[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  elementsSegments: ElementsSegmentsMap,
): boolean => {
  const segments = elementsSegments.get(element.id);
  if (!areSegmentsEnclosed(lassoPolygon, segments, element)) {
    return false;
  }

  const boundTextElement = getBoundTextElement(element, elementsMap);
  if (boundTextElement) {
    const boundTextSegments = elementsSegments.get(boundTextElement.id);
    if (
      boundTextSegments &&
      !areSegmentsEnclosed(lassoPolygon, boundTextSegments, boundTextElement)
    ) {
      return false;
    }
  }

  return !intersectionTest(lassoSegments, element, elementsMap);
};

const intersectionTest = (
  lassoSegments: LineSegment<GlobalPoint>[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): boolean => {
  const boundTextElement = getBoundTextElement(element, elementsMap);

  return lassoSegments.some(
    (lassoSegment) =>
      intersectElementWithLineSegment(
        element,
        elementsMap,
        lassoSegment,
        0,
        true,
      ).length > 0 ||
      (!!boundTextElement &&
        intersectElementWithLineSegment(
          {
            ...boundTextElement,
            ...computeBoundTextPosition(element, boundTextElement, elementsMap),
          },
          elementsMap,
          lassoSegment,
          0,
          true,
        ).length > 0),
  );
};
