import { simplify } from "points-on-curve";

import {
  polygonFromPoints,
  lineSegment,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import { type Bounds } from "@excalidraw/common";

import {
  computeBoundTextPosition,
  doBoundsIntersect,
  getBoundTextElement,
  getElementBounds,
  getElementLineSegments,
  intersectElementWithLineSegment,
  isArrowElement,
  isBoundToContainer,
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
        const enclosed = containEnclosureTest(
          path,
          element,
          elementsMap,
          elementsSegments,
        );
        if (enclosed) {
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

  if (boxSelectionMode === "contain" && enclosedElements.size > 0) {
    const sceneElements = new Map<ExcalidrawElement["id"], ExcalidrawElement>();
    for (const sceneElement of elementsMap.values()) {
      sceneElements.set(sceneElement.id, sceneElement);
    }
    for (const sceneElement of elements) {
      sceneElements.set(sceneElement.id, sceneElement);
    }

    for (const id of [...enclosedElements]) {
      const element = sceneElements.get(id);
      const topGroupId = element?.groupIds.at(-1);
      if (topGroupId) {
        for (const sceneElement of sceneElements.values()) {
          if (
            !sceneElement.isDeleted &&
            !sceneElement.locked &&
            !isBoundToContainer(sceneElement) &&
            sceneElement.groupIds.includes(topGroupId) &&
            !enclosedElements.has(sceneElement.id)
          ) {
            enclosedElements.delete(id);
            break;
          }
        }
      }
    }
  }

  const results = [...intersectedElements, ...enclosedElements];

  return {
    selectedElementIds: results,
  };
};

const getLassoSegments = (lassoPath: GlobalPoint[]) =>
  lassoPath
    .slice(1)
    .map((point: GlobalPoint, index) => lineSegment(lassoPath[index], point))
    .concat([lineSegment(lassoPath[lassoPath.length - 1], lassoPath[0])]);

const containEnclosureTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  elementsSegments: ElementsSegmentsMap,
): boolean => {
  const lassoPolygon = polygonFromPoints(lassoPath);
  const segments = elementsSegments.get(element.id);
  if (!segments || segments.length === 0) {
    return false;
  }

  const allPointsInside = segments.every((segment) =>
    segment.every((point) => polygonIncludesPointNonZero(point, lassoPolygon)),
  );
  if (!allPointsInside) {
    return false;
  }

  const lassoSegments = getLassoSegments(lassoPath);
  const elementIntersectsLasso = lassoSegments.some(
    (lassoSegment) =>
      intersectElementWithLineSegment(
        element,
        elementsMap,
        lassoSegment,
        0,
        true,
      ).length > 0,
  );
  if (elementIntersectsLasso) {
    return false;
  }

  if (isArrowElement(element)) {
    const boundTextElement = getBoundTextElement(element, elementsMap);
    if (boundTextElement) {
      const positionedBoundText = {
        ...boundTextElement,
        ...computeBoundTextPosition(element, boundTextElement, elementsMap),
      };
      const boundTextSegments = getElementLineSegments(
        positionedBoundText,
        elementsMap,
      );
      if (
        boundTextSegments.length === 0 ||
        !boundTextSegments.every((segment) =>
          segment.every((point) =>
            polygonIncludesPointNonZero(point, lassoPolygon),
          ),
        )
      ) {
        return false;
      }

      const boundTextIntersectsLasso = lassoSegments.some(
        (lassoSegment) =>
          intersectElementWithLineSegment(
            positionedBoundText,
            elementsMap,
            lassoSegment,
            0,
            true,
          ).length > 0,
      );
      if (boundTextIntersectsLasso) {
        return false;
      }
    }
  }

  return true;
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

const intersectionTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): boolean => {
  const lassoSegments = getLassoSegments(lassoPath);

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
