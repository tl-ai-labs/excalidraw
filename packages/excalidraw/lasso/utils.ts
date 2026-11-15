import { simplify } from "points-on-curve";

import {
  polygonFromPoints,
  lineSegment,
  pointFrom,
  pointRotateRads,
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
  /**
   * Same preference as box selection (`appState.boxSelectionMode`):
   * - contain (Wrap): the element must be fully enclosed by the lasso
   * - overlap: touching (intersecting or partially enclosing) is enough
   */
  boxSelectionMode: BoxSelectionMode;
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
    boxSelectionMode,
  } = input;
  // simplify the path to reduce the number of points
  let path: GlobalPoint[] = lassoPath;
  if (simplifyDistance) {
    path = simplify(lassoPath, simplifyDistance) as GlobalPoint[];
  }
  // In Wrap mode, bound text is selected through its container (which must be
  // enclosed itself), mirroring box selection which ignores bound text.
  const candidateElements = elements.filter(
    (el) =>
      !el.locked && (boxSelectionMode === "overlap" || !isBoundToContainer(el)),
  );
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
  const lassoPolygon = polygonFromPoints(path);
  const lassoSegments = getLassoSegments(path);

  for (const element of candidateElements) {
    // First check if the lasso segment intersects the element's axis-aligned
    // bounding box as it is much faster than checking intersection against
    // the element's shape
    const elementBounds = getElementBounds(element, elementsMap);

    if (
      !doBoundsIntersect(lassoBounds, elementBounds) ||
      intersectedElements.has(element.id) ||
      enclosedElements.has(element.id)
    ) {
      continue;
    }

    if (boxSelectionMode === "contain") {
      if (
        fullEnclosureTest(
          lassoPolygon,
          lassoSegments,
          element,
          elementsMap,
          elementsSegments,
        )
      ) {
        enclosedElements.add(element.id);
      }
      continue;
    }

    const enclosed = enclosureTest(lassoPolygon, element, elementsSegments);
    if (enclosed) {
      enclosedElements.add(element.id);
    } else {
      const intersects = intersectionTest(lassoSegments, element, elementsMap);
      if (intersects) {
        intersectedElements.add(element.id);
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

/**
 * Whether at least one point of the element's outline is inside the lasso
 * (i.e. the element is at least partially enclosed).
 */
const enclosureTest = (
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

/**
 * Whether the element (and its bound text, if any) lies entirely inside the
 * lasso: every sampled outline point is enclosed and no lasso segment crosses
 * the element's actual outline (catches concave lassos cutting between
 * sampled points).
 */
const fullEnclosureTest = (
  lassoPolygon: Polygon<GlobalPoint>,
  lassoSegments: LineSegment<GlobalPoint>[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  elementsSegments: ElementsSegmentsMap,
): boolean => {
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

  const boundTextElement = getBoundTextElement(element, elementsMap);
  if (boundTextElement) {
    const { x, y } = computeBoundTextPosition(
      element,
      boundTextElement,
      elementsMap,
    );
    const { width, height, angle } = boundTextElement;
    const center = pointFrom<GlobalPoint>(x + width / 2, y + height / 2);
    const corners = [
      pointFrom<GlobalPoint>(x, y),
      pointFrom<GlobalPoint>(x + width, y),
      pointFrom<GlobalPoint>(x + width, y + height),
      pointFrom<GlobalPoint>(x, y + height),
    ].map((corner) => pointRotateRads(corner, center, angle));
    if (
      !corners.every((corner) =>
        polygonIncludesPointNonZero(corner, lassoPolygon),
      )
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
