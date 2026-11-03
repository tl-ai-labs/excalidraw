import { simplify } from "points-on-curve";

import {
  polygonFromPoints,
  lineSegment,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import { type Bounds } from "@excalidraw/common";

import {
  boundsContainBounds,
  computeBoundTextPosition,
  doBoundsIntersect,
  getBoundTextElement,
  getElementBounds,
  getElementLineSegments,
  intersectElementWithLineSegment,
  isBoundToContainer,
} from "@excalidraw/element";

import type { ElementsSegmentsMap, GlobalPoint } from "@excalidraw/math/types";
import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import type { AppState } from "../types";

export const getLassoSelectedElementIds = (input: {
  lassoPath: GlobalPoint[];
  elements: readonly ExcalidrawElement[];
  elementsMap: ElementsMap;
  elementsSegments: ElementsSegmentsMap;
  intersectedElements: Set<ExcalidrawElement["id"]>;
  enclosedElements: Set<ExcalidrawElement["id"]>;
  simplifyDistance?: number;
  boxSelectionMode?: AppState["boxSelectionMode"];
  editingGroupId?: AppState["editingGroupId"];
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
    editingGroupId = null,
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

  if (boxSelectionMode === "contain") {
    const lassoPolygon = polygonFromPoints(path);
    for (const element of unlockedElements) {
      if (element.isDeleted || isBoundToContainer(element)) {
        continue;
      }
      const elementBounds = getElementBounds(element, elementsMap);
      if (
        boundsContainBounds(lassoBounds, elementBounds) &&
        wrapTest(path, lassoPolygon, element, elementsMap, elementsSegments)
      ) {
        enclosedElements.add(element.id);
      }
    }

    filterIncompleteGroups(enclosedElements, elementsMap, editingGroupId);

    return {
      selectedElementIds: [...enclosedElements],
    };
  }

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

  const results = [...intersectedElements, ...enclosedElements];

  return {
    selectedElementIds: results,
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

const intersectionTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): boolean => {
  const lassoSegments = lassoPath
    .slice(1)
    .map((point: GlobalPoint, index) => lineSegment(lassoPath[index], point))
    .concat([lineSegment(lassoPath[lassoPath.length - 1], lassoPath[0])]);

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

const wrapTest = (
  lassoPath: GlobalPoint[],
  lassoPolygon: GlobalPoint[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  elementsSegments: ElementsSegmentsMap,
): boolean => {
  const segments = elementsSegments.get(element.id);
  if (!segments || segments.length === 0) {
    return false;
  }

  const allInside = segments.every((segment) =>
    segment.every((point) => polygonIncludesPointNonZero(point, lassoPolygon)),
  );
  if (!allInside) {
    return false;
  }

  const boundTextElement = getBoundTextElement(element, elementsMap);
  if (boundTextElement) {
    const textSegments =
      elementsSegments.get(boundTextElement.id) ??
      getElementLineSegments(boundTextElement, elementsMap);
    const textInside = textSegments.every((segment) =>
      segment.every((point) =>
        polygonIncludesPointNonZero(point, lassoPolygon),
      ),
    );
    if (!textInside) {
      return false;
    }
  }

  return !intersectionTest(lassoPath, element, elementsMap);
};

const getOuterGroupId = (
  groupIds: readonly string[],
  editingGroupId: AppState["editingGroupId"],
): string | null => {
  if (editingGroupId !== null) {
    const i = groupIds.indexOf(editingGroupId);
    if (i > -1) {
      return i > 0 ? groupIds[i - 1] : null;
    }
  }
  return groupIds.at(-1) ?? null;
};

const filterIncompleteGroups = (
  enclosedElements: Set<ExcalidrawElement["id"]>,
  elementsMap: ElementsMap,
  editingGroupId: AppState["editingGroupId"],
): void => {
  const missing = new Map<string, number>();
  for (const id of enclosedElements) {
    const element = elementsMap.get(id);
    if (!element) {
      continue;
    }
    const key = getOuterGroupId(element.groupIds, editingGroupId);
    if (key !== null) {
      missing.set(key, (missing.get(key) ?? 0) + 1);
    }
  }

  if (missing.size === 0) {
    return;
  }

  for (const member of elementsMap.values()) {
    if (member.isDeleted || member.locked || isBoundToContainer(member)) {
      continue;
    }
    const key = getOuterGroupId(member.groupIds, editingGroupId);
    if (key !== null) {
      const count = missing.get(key);
      if (count !== undefined) {
        missing.set(key, count - 1);
      }
    }
  }

  for (const id of enclosedElements) {
    const element = elementsMap.get(id);
    if (!element) {
      continue;
    }
    const key = getOuterGroupId(element.groupIds, editingGroupId);
    if (key !== null && missing.get(key) !== 0) {
      enclosedElements.delete(id);
    }
  }
};
