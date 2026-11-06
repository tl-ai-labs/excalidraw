import { simplify } from "points-on-curve";

import {
  polygonFromPoints,
  lineSegment,
  lineSegmentIntersectionPoints,
  pointFrom,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import { type Bounds } from "@excalidraw/common";

import {
  computeBoundTextPosition,
  doBoundsIntersect,
  elementOverlapsWithFrame,
  getBoundTextElement,
  getContainingFrame,
  getElementBounds,
  getElementLineSegments,
  intersectElementWithLineSegment,
  isBoundToContainer,
  pointInsideBoundsInclusive,
} from "@excalidraw/element";

import type {
  ElementsSegmentsMap,
  GlobalPoint,
  LineSegment,
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
    // Bound text is evaluated together with its container in contain mode so
    // enclosing only the bound text never selects a partially enclosed container
    if (boxSelectionMode === "contain" && isBoundToContainer(element)) {
      continue;
    }

    // First check if the lasso segment intersects the element's axis-aligned
    // bounding box as it is much faster than checking intersection against
    // the element's shape
    let elementBounds = getElementBounds(element, elementsMap);
    let frameBounds: Bounds | null = null;

    if (boxSelectionMode === "contain") {
      const associatedFrame = getContainingFrame(element, elementsMap);
      if (
        associatedFrame &&
        elementOverlapsWithFrame(element, associatedFrame, elementsMap)
      ) {
        frameBounds = getElementBounds(associatedFrame, elementsMap);
        elementBounds = [
          Math.max(elementBounds[0], frameBounds[0]),
          Math.max(elementBounds[1], frameBounds[1]),
          Math.min(elementBounds[2], frameBounds[2]),
          Math.min(elementBounds[3], frameBounds[3]),
        ] as Bounds;
      }
    }

    if (
      doBoundsIntersect(lassoBounds, elementBounds) &&
      !intersectedElements.has(element.id) &&
      !enclosedElements.has(element.id)
    ) {
      if (boxSelectionMode === "contain") {
        const enclosed =
          enclosureTest(
            path,
            element,
            elementsSegments,
            elementsMap,
            "contain",
            frameBounds,
            elementBounds,
          ) &&
          !intersectionTest(
            path,
            element,
            elementsMap,
            elementsSegments.get(element.id),
            frameBounds,
          );
        if (enclosed) {
          enclosedElements.add(element.id);
        }
      } else {
        const enclosed = enclosureTest(
          path,
          element,
          elementsSegments,
          elementsMap,
          "overlap",
        );
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

  const results = [...intersectedElements, ...enclosedElements];

  return {
    selectedElementIds: results,
  };
};

const clipSegmentToBounds = (
  [p0, p1]: LineSegment<GlobalPoint>,
  [minX, minY, maxX, maxY]: Bounds,
): LineSegment<GlobalPoint> | null => {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  let t0 = 0;
  let t1 = 1;

  const checks: [number, number][] = [
    [-dx, p0[0] - minX],
    [dx, maxX - p0[0]],
    [-dy, p0[1] - minY],
    [dy, maxY - p0[1]],
  ];

  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) {
        return null;
      }
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) {
          return null;
        }
        if (r > t0) {
          t0 = r;
        }
      } else {
        if (r < t0) {
          return null;
        }
        if (r < t1) {
          t1 = r;
        }
      }
    }
  }

  if (t0 > t1) {
    return null;
  }

  return lineSegment(
    pointFrom<GlobalPoint>(p0[0] + t0 * dx, p0[1] + t0 * dy),
    pointFrom<GlobalPoint>(p0[0] + t1 * dx, p0[1] + t1 * dy),
  );
};

const clipSegmentsToBounds = (
  segments: LineSegment<GlobalPoint>[],
  bounds: Bounds,
): LineSegment<GlobalPoint>[] => {
  const clipped: LineSegment<GlobalPoint>[] = [];
  for (const seg of segments) {
    const c = clipSegmentToBounds(seg, bounds);
    if (c) {
      clipped.push(c);
    }
  }
  return clipped;
};

const enclosureTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsSegments: ElementsSegmentsMap,
  elementsMap: ElementsMap,
  mode: BoxSelectionMode = "overlap",
  frameBounds: Bounds | null = null,
  clippedElementBounds?: Bounds,
): boolean => {
  const lassoPolygon = polygonFromPoints(lassoPath);
  const rawSegments =
    elementsSegments.get(element.id) ??
    getElementLineSegments(element, elementsMap);
  if (!rawSegments || rawSegments.length === 0) {
    return false;
  }

  if (mode === "overlap") {
    return rawSegments.some((segment) => {
      return segment.some((point) =>
        polygonIncludesPointNonZero(point, lassoPolygon),
      );
    });
  }

  let segments = frameBounds
    ? clipSegmentsToBounds(rawSegments, frameBounds)
    : rawSegments;

  // If the element's outline segments lie completely outside the frame
  // (e.g. a shape larger than the frame that contains the frame), fall back
  // to the clipped visible bounds of the element inside the frame.
  if (frameBounds && segments.length === 0 && clippedElementBounds) {
    const [x1, y1, x2, y2] = clippedElementBounds;
    segments = [
      lineSegment(
        pointFrom<GlobalPoint>(x1, y1),
        pointFrom<GlobalPoint>(x2, y1),
      ),
      lineSegment(
        pointFrom<GlobalPoint>(x2, y1),
        pointFrom<GlobalPoint>(x2, y2),
      ),
      lineSegment(
        pointFrom<GlobalPoint>(x2, y2),
        pointFrom<GlobalPoint>(x1, y2),
      ),
      lineSegment(
        pointFrom<GlobalPoint>(x1, y2),
        pointFrom<GlobalPoint>(x1, y1),
      ),
    ];
  }

  if (segments.length === 0) {
    return false;
  }

  const allElementPointsInside = segments.every((segment) =>
    segment.every((point) => polygonIncludesPointNonZero(point, lassoPolygon)),
  );
  if (!allElementPointsInside) {
    return false;
  }

  const boundTextElement = getBoundTextElement(element, elementsMap);
  if (boundTextElement) {
    const positionedBoundText = {
      ...boundTextElement,
      ...computeBoundTextPosition(element, boundTextElement, elementsMap),
    };
    const rawBoundTextSegments = getElementLineSegments(
      positionedBoundText,
      elementsMap,
    );
    const boundTextSegments = frameBounds
      ? clipSegmentsToBounds(rawBoundTextSegments, frameBounds)
      : rawBoundTextSegments;
    if (
      boundTextSegments.length > 0 &&
      !boundTextSegments.every((segment) =>
        segment.every((point) =>
          polygonIncludesPointNonZero(point, lassoPolygon),
        ),
      )
    ) {
      return false;
    }
    if (!frameBounds && boundTextSegments.length === 0) {
      return false;
    }
  }

  return true;
};

const intersectionTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  elementSegments?: LineSegment<GlobalPoint>[],
  frameBounds: Bounds | null = null,
): boolean => {
  const lassoSegments = lassoPath
    .slice(1)
    .map((point: GlobalPoint, index) => lineSegment(lassoPath[index], point))
    .concat([lineSegment(lassoPath[lassoPath.length - 1], lassoPath[0])]);

  const boundTextElement = getBoundTextElement(element, elementsMap);
  const positionedBoundText = boundTextElement
    ? {
        ...boundTextElement,
        ...computeBoundTextPosition(element, boundTextElement, elementsMap),
      }
    : null;

  const clippedElementSegments =
    elementSegments && frameBounds
      ? clipSegmentsToBounds(elementSegments, frameBounds)
      : elementSegments;

  return lassoSegments.some((lassoSegment) => {
    const elementHits = intersectElementWithLineSegment(
      element,
      elementsMap,
      lassoSegment,
      0,
      !frameBounds,
    );
    if (
      frameBounds
        ? elementHits.some((hit) =>
            pointInsideBoundsInclusive(hit, frameBounds),
          )
        : elementHits.length > 0
    ) {
      return true;
    }

    if (positionedBoundText) {
      const textHits = intersectElementWithLineSegment(
        positionedBoundText,
        elementsMap,
        lassoSegment,
        0,
        !frameBounds,
      );
      if (
        frameBounds
          ? textHits.some((hit) => pointInsideBoundsInclusive(hit, frameBounds))
          : textHits.length > 0
      ) {
        return true;
      }
    }

    if (
      clippedElementSegments &&
      clippedElementSegments.some(
        (seg) => lineSegmentIntersectionPoints(lassoSegment, seg) !== null,
      )
    ) {
      return true;
    }

    return false;
  });
};
