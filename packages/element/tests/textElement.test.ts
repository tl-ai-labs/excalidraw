import {
  applyDarkModeFilter,
  FONT_FAMILY,
  getLineHeight,
  TEXT_ALIGN,
  THEME,
  VERTICAL_ALIGN,
} from "@excalidraw/common";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import {
  advanceDuplicatedListMarkers,
  applyListMarkerAdvances,
  newElementWith,
  redrawTextBoundingBox,
  renderElement,
  Scene,
} from "../src";
import {
  computeContainerDimensionForBoundText,
  getContainerCoords,
  getBoundTextMaxWidth,
  getBoundTextMaxHeight,
  computeBoundTextPosition,
} from "../src/textElement";
import { detectLineHeight, getLineHeightInPx } from "../src/textMeasurements";

import type { ExcalidrawTextElementWithContainer } from "../src/types";

describe("Test measureText", () => {
  describe("Test getContainerCoords", () => {
    const params = { width: 200, height: 100, x: 10, y: 20 };

    it("should compute coords correctly when ellipse", () => {
      const element = API.createElement({
        type: "ellipse",
        ...params,
      });
      expect(getContainerCoords(element)).toEqual({
        x: 44.2893218813452455,
        y: 39.64466094067262,
      });
    });

    it("should compute coords correctly when rectangle", () => {
      const element = API.createElement({
        type: "rectangle",
        ...params,
      });
      expect(getContainerCoords(element)).toEqual({
        x: 15,
        y: 25,
      });
    });

    it("should compute coords correctly when diamond", () => {
      const element = API.createElement({
        type: "diamond",
        ...params,
      });
      expect(getContainerCoords(element)).toEqual({
        x: 65,
        y: 50,
      });
    });
  });

  describe("Test computeContainerDimensionForBoundText", () => {
    const params = {
      width: 178,
      height: 194,
    };

    it("should compute container height correctly for rectangle", () => {
      const element = API.createElement({
        type: "rectangle",
        ...params,
      });
      expect(computeContainerDimensionForBoundText(150, element.type)).toEqual(
        160,
      );
    });

    it("should compute container height correctly for ellipse", () => {
      const element = API.createElement({
        type: "ellipse",
        ...params,
      });
      expect(computeContainerDimensionForBoundText(150, element.type)).toEqual(
        226,
      );
    });

    it("should compute container height correctly for diamond", () => {
      const element = API.createElement({
        type: "diamond",
        ...params,
      });
      expect(computeContainerDimensionForBoundText(150, element.type)).toEqual(
        320,
      );
    });
  });

  describe("Test getBoundTextMaxWidth", () => {
    const params = {
      width: 178,
      height: 194,
    };

    it("should return max width when container is rectangle", () => {
      const container = API.createElement({ type: "rectangle", ...params });
      expect(getBoundTextMaxWidth(container, null)).toBe(168);
    });

    it("should return max width when container is ellipse", () => {
      const container = API.createElement({ type: "ellipse", ...params });
      expect(getBoundTextMaxWidth(container, null)).toBe(116);
    });

    it("should return max width when container is diamond", () => {
      const container = API.createElement({ type: "diamond", ...params });
      expect(getBoundTextMaxWidth(container, null)).toBe(79);
    });
  });

  describe("Test getBoundTextMaxHeight", () => {
    const params = {
      width: 178,
      height: 194,
      id: '"container-id',
    };

    const boundTextElement = API.createElement({
      type: "text",
      id: "text-id",
      x: 560.51171875,
      y: 202.033203125,
      width: 154,
      height: 175,
      fontSize: 20,
      fontFamily: 1,
      text: "Excalidraw is a\nvirtual \nopensource \nwhiteboard for \nsketching \nhand-drawn like\ndiagrams",
      textAlign: "center",
      verticalAlign: "middle",
      containerId: params.id,
    }) as ExcalidrawTextElementWithContainer;

    it("should return max height when container is rectangle", () => {
      const container = API.createElement({ type: "rectangle", ...params });
      expect(getBoundTextMaxHeight(container, boundTextElement)).toBe(184);
    });

    it("should return max height when container is ellipse", () => {
      const container = API.createElement({ type: "ellipse", ...params });
      expect(getBoundTextMaxHeight(container, boundTextElement)).toBe(127);
    });

    it("should return max height when container is diamond", () => {
      const container = API.createElement({ type: "diamond", ...params });
      expect(getBoundTextMaxHeight(container, boundTextElement)).toBe(87);
    });

    it("should return max height when container is arrow", () => {
      const container = API.createElement({
        type: "arrow",
        ...params,
      });
      expect(getBoundTextMaxHeight(container, boundTextElement)).toBe(194);
    });

    it("should return max height when container is arrow and height is less than threshold", () => {
      const container = API.createElement({
        type: "arrow",
        ...params,
        height: 70,
        boundElements: [{ type: "text", id: "text-id" }],
      });

      expect(getBoundTextMaxHeight(container, boundTextElement)).toBe(
        boundTextElement.height,
      );
    });
  });
});

const textElement = API.createElement({
  type: "text",
  text: "Excalidraw is a\nvirtual \nopensource \nwhiteboard for \nsketching \nhand-drawn like\ndiagrams",
  fontSize: 20,
  fontFamily: 1,
  height: 175,
});

describe("Test detectLineHeight", () => {
  it("should return correct line height", () => {
    expect(detectLineHeight(textElement)).toBe(1.25);
  });
});

describe("Test getLineHeightInPx", () => {
  it("should return correct line height", () => {
    expect(
      getLineHeightInPx(textElement.fontSize, textElement.lineHeight),
    ).toBe(25);
  });
});

describe("Test getDefaultLineHeight", () => {
  it("should return line height using default font family when not passed", () => {
    //@ts-ignore
    expect(getLineHeight()).toBe(1.25);
  });

  it("should return line height using default font family for unknown font", () => {
    const UNKNOWN_FONT = 5;
    expect(getLineHeight(UNKNOWN_FONT)).toBe(1.25);
  });

  it("should return correct line height", () => {
    expect(getLineHeight(FONT_FAMILY.Cascadia)).toBe(1.2);
  });
});

describe("Test computeBoundTextPosition", () => {
  const createMockElementsMap = () => new Map();

  // Helper function to create rectangle test case with 90-degree rotation
  const createRotatedRectangleTestCase = (
    textAlign: string,
    verticalAlign: string,
  ) => {
    const container = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      angle: (Math.PI / 2) as any, // 90 degrees
    });

    const boundTextElement = API.createElement({
      type: "text",
      width: 80,
      height: 40,
      text: "hello darkness my old friend",
      textAlign: textAlign as any,
      verticalAlign: verticalAlign as any,
      containerId: container.id,
    }) as ExcalidrawTextElementWithContainer;

    const elementsMap = createMockElementsMap();

    return { container, boundTextElement, elementsMap };
  };

  describe("90-degree rotation with all alignment combinations", () => {
    // Test all 9 combinations of horizontal (left, center, right) and vertical (top, middle, bottom) alignment

    it("should position text with LEFT + TOP alignment at 90-degree rotation", () => {
      const { container, boundTextElement, elementsMap } =
        createRotatedRectangleTestCase(TEXT_ALIGN.LEFT, VERTICAL_ALIGN.TOP);

      const result = computeBoundTextPosition(
        container,
        boundTextElement,
        elementsMap,
      );

      expect(result.x).toBeCloseTo(185, 1);
      expect(result.y).toBeCloseTo(75, 1);
    });

    it("should position text with LEFT + MIDDLE alignment at 90-degree rotation", () => {
      const { container, boundTextElement, elementsMap } =
        createRotatedRectangleTestCase(TEXT_ALIGN.LEFT, VERTICAL_ALIGN.MIDDLE);

      const result = computeBoundTextPosition(
        container,
        boundTextElement,
        elementsMap,
      );

      expect(result.x).toBeCloseTo(160, 1);
      expect(result.y).toBeCloseTo(75, 1);
    });

    it("should position text with LEFT + BOTTOM alignment at 90-degree rotation", () => {
      const { container, boundTextElement, elementsMap } =
        createRotatedRectangleTestCase(TEXT_ALIGN.LEFT, VERTICAL_ALIGN.BOTTOM);

      const result = computeBoundTextPosition(
        container,
        boundTextElement,
        elementsMap,
      );

      expect(result.x).toBeCloseTo(135, 1);
      expect(result.y).toBeCloseTo(75, 1);
    });

    it("should position text with CENTER + TOP alignment at 90-degree rotation", () => {
      const { container, boundTextElement, elementsMap } =
        createRotatedRectangleTestCase(TEXT_ALIGN.CENTER, VERTICAL_ALIGN.TOP);

      const result = computeBoundTextPosition(
        container,
        boundTextElement,
        elementsMap,
      );

      expect(result.x).toBeCloseTo(185, 1);
      expect(result.y).toBeCloseTo(130, 1);
    });

    it("should position text with CENTER + MIDDLE alignment at 90-degree rotation", () => {
      const { container, boundTextElement, elementsMap } =
        createRotatedRectangleTestCase(
          TEXT_ALIGN.CENTER,
          VERTICAL_ALIGN.MIDDLE,
        );

      const result = computeBoundTextPosition(
        container,
        boundTextElement,
        elementsMap,
      );

      expect(result.x).toBeCloseTo(160, 1);
      expect(result.y).toBeCloseTo(130, 1);
    });

    it("should position text with CENTER + BOTTOM alignment at 90-degree rotation", () => {
      const { container, boundTextElement, elementsMap } =
        createRotatedRectangleTestCase(
          TEXT_ALIGN.CENTER,
          VERTICAL_ALIGN.BOTTOM,
        );

      const result = computeBoundTextPosition(
        container,
        boundTextElement,
        elementsMap,
      );

      expect(result.x).toBeCloseTo(135, 1);
      expect(result.y).toBeCloseTo(130, 1);
    });

    it("should position text with RIGHT + TOP alignment at 90-degree rotation", () => {
      const { container, boundTextElement, elementsMap } =
        createRotatedRectangleTestCase(TEXT_ALIGN.RIGHT, VERTICAL_ALIGN.TOP);

      const result = computeBoundTextPosition(
        container,
        boundTextElement,
        elementsMap,
      );

      expect(result.x).toBeCloseTo(185, 1);
      expect(result.y).toBeCloseTo(185, 1);
    });

    it("should position text with RIGHT + MIDDLE alignment at 90-degree rotation", () => {
      const { container, boundTextElement, elementsMap } =
        createRotatedRectangleTestCase(TEXT_ALIGN.RIGHT, VERTICAL_ALIGN.MIDDLE);

      const result = computeBoundTextPosition(
        container,
        boundTextElement,
        elementsMap,
      );

      expect(result.x).toBeCloseTo(160, 1);
      expect(result.y).toBeCloseTo(185, 1);
    });

    it("should position text with RIGHT + BOTTOM alignment at 90-degree rotation", () => {
      const { container, boundTextElement, elementsMap } =
        createRotatedRectangleTestCase(TEXT_ALIGN.RIGHT, VERTICAL_ALIGN.BOTTOM);

      const result = computeBoundTextPosition(
        container,
        boundTextElement,
        elementsMap,
      );

      expect(result.x).toBeCloseTo(135, 1);
      expect(result.y).toBeCloseTo(185, 1);
    });
  });

  describe("textStyles preservation and canvas rendering", () => {
    it("preserves textStyles when redrawTextBoundingBox updates a bound text element", () => {
      const container = API.createElement({
        type: "rectangle",
        id: "container-styled",
        width: 200,
        height: 100,
        boundElements: [{ type: "text", id: "text-styled" }],
      });
      const baseText = API.createElement({
        type: "text",
        id: "text-styled",
        text: "hello world",
        containerId: container.id,
        strokeColor: "#1e1e1e",
      });
      const styledText = newElementWith(baseText, {
        textStyles: [{ start: 0, end: 5, color: "#e03131" }],
      });

      const scene = new Scene([container, styledText], {
        skipValidation: true,
      });
      const clone = newElementWith(styledText, { fontSize: 28 });

      redrawTextBoundingBox(clone, container, scene);

      const updated = scene.getElement<typeof styledText>(styledText.id);
      expect(updated?.textStyles).toEqual([
        { start: 0, end: 5, color: "#e03131" },
      ]);
    });

    it("shifts textStyles when list marker changes length on duplication and restores on prev", () => {
      const baseEl = API.createElement({
        type: "text",
        id: "list-item-9",
        text: "9. hello",
        strokeColor: "#1e1e1e",
      });
      const textEl = newElementWith(baseEl, {
        textStyles: [
          { start: 3, end: 8, color: "#1971c2", highlight: "#fff3bf" },
        ],
      });

      const scene = new Scene([textEl], { skipValidation: true });
      const advances = advanceDuplicatedListMarkers([textEl], scene);

      expect(advances).toHaveLength(1);
      const advancedEl = scene.getElement<typeof textEl>(textEl.id);
      expect(advancedEl?.originalText).toBe("10. hello");
      expect(advancedEl?.textStyles).toEqual([
        { start: 4, end: 9, color: "#1971c2", highlight: "#fff3bf" },
      ]);

      applyListMarkerAdvances(advances, "prev", scene);
      const restoredEl = scene.getElement<typeof textEl>(textEl.id);
      expect(restoredEl?.originalText).toBe("9. hello");
      expect(restoredEl?.textStyles).toEqual([
        { start: 3, end: 8, color: "#1971c2", highlight: "#fff3bf" },
      ]);
    });

    it("draws highlight fillRect and per-run fillText on canvas when textStyles is present", () => {
      const createRecordingContext = () => {
        const calls: Array<{
          type: "fillRect" | "fillText";
          fillStyle: string;
          text?: string;
        }> = [];
        const canvas = document.createElement("canvas");
        const ctx: any = {
          canvas,
          font: "",
          fillStyle: "#000000",
          strokeStyle: "#000000",
          textAlign: "left",
          globalAlpha: 1,
          imageSmoothingEnabled: true,
          save: () => {},
          restore: () => {},
          translate: () => {},
          rotate: () => {},
          scale: () => {},
          beginPath: () => {},
          rect: () => {},
          clip: () => {},
          getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
          setTransform: () => {},
          drawImage: () => {},
          measureText: (str: string) => ({ width: str.length * 10 }),
          fillRect: () => {
            calls.push({
              type: "fillRect",
              fillStyle: String(ctx.fillStyle),
            });
          },
          fillText: (str: string) => {
            calls.push({
              type: "fillText",
              fillStyle: String(ctx.fillStyle),
              text: str,
            });
          },
        };
        return { ctx: ctx as CanvasRenderingContext2D, calls };
      };

      const renderToCalls = (
        el: typeof unstyledEl,
        theme: typeof THEME.LIGHT | typeof THEME.DARK,
      ) => {
        const { ctx, calls } = createRecordingContext();
        const elementsMap = new Map([[el.id, el]]) as any;
        renderElement(
          el,
          elementsMap,
          elementsMap,
          {} as any,
          ctx,
          {
            canvasBackgroundColor: "#ffffff",
            imageCache: new Map(),
            renderEnvironment: {
              createCanvas: () =>
                ({
                  width: 100,
                  height: 100,
                  getContext: () => ctx,
                } as any),
              createImage: () => ({} as any),
            } as any,
            isExporting: true,
            scale: 1,
            theme,
            elementsPendingErasure: new Set(),
            pendingFlowchartNodes: null,
          } as any,
          {
            scrollX: 0,
            scrollY: 0,
            zoom: { value: 1 as any },
            theme,
            shouldCacheIgnoreZoom: false,
            frameRendering: {
              enabled: true,
              name: true,
              outline: true,
              clip: true,
            },
            openDialog: null,
            selectedElementIds: {},
            hoveredElementIds: {},
          } as any,
        );
        return calls;
      };

      const unstyledEl = API.createElement({
        type: "text",
        text: "hello world",
        strokeColor: "#1e1e1e",
        width: 110,
        height: 25,
      });

      const unstyledCalls = renderToCalls(unstyledEl, THEME.LIGHT);
      expect(unstyledCalls.filter((c) => c.type === "fillRect")).toHaveLength(
        0,
      );
      expect(
        unstyledCalls.filter((c) => c.type === "fillText").map((c) => c.text),
      ).toEqual(["hello world"]);

      const styledEl = newElementWith(unstyledEl, {
        textStyles: [
          { start: 0, end: 5, color: "#e03131", highlight: "#fff3bf" },
        ],
      });

      const lightCalls = renderToCalls(styledEl, THEME.LIGHT);
      const firstRectIdx = lightCalls.findIndex((c) => c.type === "fillRect");
      const firstTextIdx = lightCalls.findIndex((c) => c.type === "fillText");
      expect(firstRectIdx).toBeGreaterThanOrEqual(0);
      expect(firstTextIdx).toBeGreaterThan(firstRectIdx);
      expect(lightCalls[firstRectIdx].fillStyle).toBe(
        applyDarkModeFilter("#fff3bf", false),
      );
      const lightTextCalls = lightCalls.filter((c) => c.type === "fillText");
      expect(lightTextCalls.map((c) => c.text)).toEqual(["hello", " world"]);
      expect(lightTextCalls[0].fillStyle).toBe(
        applyDarkModeFilter("#e03131", false),
      );
      expect(lightTextCalls[1].fillStyle).toBe(
        applyDarkModeFilter("#1e1e1e", false),
      );

      const darkCalls = renderToCalls(styledEl, THEME.DARK);
      const darkRect = darkCalls.find((c) => c.type === "fillRect");
      const darkTexts = darkCalls.filter((c) => c.type === "fillText");
      expect(darkRect?.fillStyle).toBe(applyDarkModeFilter("#fff3bf", true));
      expect(darkTexts[0].fillStyle).toBe(applyDarkModeFilter("#e03131", true));
      expect(darkTexts[1].fillStyle).toBe(applyDarkModeFilter("#1e1e1e", true));
    });
  });
});
