import {
  applyDarkModeFilter,
  BOUND_TEXT_PADDING,
  FONT_FAMILY,
  FRAME_STYLE,
  THEME,
} from "@excalidraw/common";

import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawTextElement,
  FractionalIndex,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { LocalPoint } from "@excalidraw/math";

import { getDefaultAppState } from "../../appState";
import * as staticSceneModule from "../../renderer/staticScene";
import { exportScene } from "../../scene/export";

import { prepareElementsForExport } from "../../data";
import {
  diamondFixture,
  ellipseFixture,
  rectangleWithLinkFixture,
  textFixture,
} from "../fixtures/elementFixture";
import { API } from "../helpers/api";

import type { ExportSceneData } from "../../scene/export";

describe("exportToSvg", () => {
  const ELEMENT_HEIGHT = 100;
  const ELEMENT_WIDTH = 100;
  const ELEMENTS = [
    {
      ...diamondFixture,
      height: ELEMENT_HEIGHT,
      width: ELEMENT_WIDTH,
      index: "a0",
    },
    {
      ...ellipseFixture,
      height: ELEMENT_HEIGHT,
      width: ELEMENT_WIDTH,
      index: "a1",
    },
    {
      ...textFixture,
      height: ELEMENT_HEIGHT,
      width: ELEMENT_WIDTH,
      index: "a2",
    },
    {
      ...textFixture,
      fontFamily: FONT_FAMILY.Nunito, // test embedding external font
      height: ELEMENT_HEIGHT,
      width: ELEMENT_WIDTH,
      index: "a3",
    },
  ] as NonDeletedExcalidrawElement[];

  const DEFAULT_APP_STATE = {
    viewBackgroundColor: "#ffffff",
  };

  it("with default arguments", async () => {
    const svgElement = await exportScene({
      type: "svg",
      data: {
        elements: ELEMENTS,
        appState: DEFAULT_APP_STATE,
        files: {},
      },
      config: { canvasBackgroundColor: false },
    });

    expect(svgElement).toMatchSnapshot();
  });

  it("with a CJK font", async () => {
    const svgElement = await exportScene({
      type: "svg",
      data: {
        elements: [
          ...ELEMENTS,
          {
            ...textFixture,
            height: ELEMENT_HEIGHT,
            width: ELEMENT_WIDTH,
            text: "中国你好！这是一个测试。中国你好！日本こんにちは！これはテストです。한국 안녕하세요! 이것은 테스트입니다.",
            originalText:
              "中国你好！这是一个测试。中国你好！日本こんにちは！これはテストです。한국 안녕하세요! 이것은 테스트입니다.",
            index: "a4" as FractionalIndex,
          } as NonDeleted<ExcalidrawTextElement>,
        ],
        appState: DEFAULT_APP_STATE,
        files: {},
      },
      config: { canvasBackgroundColor: false },
    });

    expect(svgElement).toMatchSnapshot();
    // extend the timeout, as it needs to first load the fonts from disk and then perform whole woff2 decode, subset and encode (without workers)
  }, 30_000);

  it("with background color", async () => {
    const BACKGROUND_COLOR = "#abcdef";

    const svgElement = await exportScene({
      type: "svg",
      data: {
        elements: ELEMENTS,
        appState: {
          ...DEFAULT_APP_STATE,
          viewBackgroundColor: BACKGROUND_COLOR,
        },
        files: {},
      },
    });

    expect(svgElement.querySelector("rect")).toHaveAttribute(
      "fill",
      BACKGROUND_COLOR,
    );
  });

  it("with dark mode", async () => {
    const svgElement = await exportScene({
      type: "svg",
      data: {
        elements: ELEMENTS,
        appState: {
          ...DEFAULT_APP_STATE,
        },
        files: {},
      },
      config: {
        canvasBackgroundColor: false,
        theme: THEME.DARK,
      },
    });

    const textElements = svgElement.querySelectorAll("text");
    expect(textElements.length).toBeGreaterThan(0);

    textElements.forEach((textEl) => {
      // fill color should be inverted in dark mode
      expect(textEl.getAttribute("fill")).toBe(
        applyDarkModeFilter(textFixture.strokeColor),
      );
    });
  });

  it("with exportPadding", async () => {
    const svgElement = await exportScene({
      type: "svg",
      data: {
        elements: ELEMENTS,
        appState: DEFAULT_APP_STATE,
        files: {},
      },
      config: {
        canvasBackgroundColor: false,
        padding: 0,
      },
    });

    expect(svgElement).toHaveAttribute("height", ELEMENT_HEIGHT.toString());
    expect(svgElement).toHaveAttribute("width", ELEMENT_WIDTH.toString());
    expect(svgElement).toHaveAttribute(
      "viewBox",
      `0 0 ${ELEMENT_WIDTH} ${ELEMENT_HEIGHT}`,
    );
  });

  it("with scale", async () => {
    const SCALE = 2;

    const svgElement = await exportScene({
      type: "svg",
      data: {
        elements: ELEMENTS,
        appState: DEFAULT_APP_STATE,
        files: {},
      },
      config: {
        canvasBackgroundColor: false,
        padding: 0,
        scale: SCALE,
      },
    });

    expect(svgElement).toHaveAttribute(
      "height",
      (ELEMENT_HEIGHT * SCALE).toString(),
    );
    expect(svgElement).toHaveAttribute(
      "width",
      (ELEMENT_WIDTH * SCALE).toString(),
    );
  });

  it("with exportEmbedScene", async () => {
    const svgElement = await exportScene({
      type: "svg",
      data: {
        elements: ELEMENTS,
        appState: DEFAULT_APP_STATE,
        files: {},
      },
      config: { canvasBackgroundColor: false, embedScene: true },
    });
    expect(svgElement.innerHTML).toMatchSnapshot();
  });

  it("with elements that have a link", async () => {
    const svgElement = await exportScene({
      type: "svg",
      data: {
        elements: [rectangleWithLinkFixture] as NonDeletedExcalidrawElement[],
        appState: DEFAULT_APP_STATE,
        files: {},
      },
      config: { canvasBackgroundColor: false },
    });
    expect(svgElement.innerHTML).toMatchSnapshot();
  });

  // #11439: a perfectly horizontal/vertical arrow has a zero-size bounding box.
  // The bound-text "gap" mask must use userSpaceOnUse units, otherwise its
  // objectBoundingBox region collapses to zero area and the whole arrow line
  // disappears from the SVG export (only the label remains).
  it("keeps a horizontal arrow with a bound label visible (#11439)", async () => {
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow-11439",
      width: 200,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
      boundElements: [{ type: "text", id: "label-11439" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label-11439",
      text: "label",
      width: 50,
      height: 20,
      containerId: "arrow-11439",
    });

    const svgElement = await exportScene({
      type: "svg",
      data: {
        elements: [arrow, label] as NonDeletedExcalidrawElement[],
        appState: DEFAULT_APP_STATE,
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const mask = svgElement.querySelector("mask");
    expect(mask).not.toBeNull();
    expect(mask?.getAttribute("maskUnits")).toBe("userSpaceOnUse");
    // a degenerate (objectBoundingBox) region would be zero-area here
    expect(Number(mask?.getAttribute("width"))).toBeGreaterThan(0);
    expect(Number(mask?.getAttribute("height"))).toBeGreaterThan(0);

    // the masked arrow group still renders its line (not clipped away)
    expect(svgElement.querySelector("g[mask] path")).not.toBeNull();
  });

  it("cuts the same padded hole around an arrow label as the canvas", async () => {
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow-hole",
      x: 100,
      y: 100,
      width: 200,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
      boundElements: [{ type: "text", id: "label-hole" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label-hole",
      text: "label",
      width: 50,
      height: 20,
      containerId: "arrow-hole",
    });

    const svgElement = await exportScene({
      type: "svg",
      data: {
        elements: [arrow, label] as NonDeletedExcalidrawElement[],
        appState: DEFAULT_APP_STATE,
        files: null,
      },
      config: { padding: 0, canvasBackgroundColor: false },
    });

    // the mask's first rect is the visible region, sized to the arrow plus
    // its offset within the export; the second is the hole cut for the label
    const [visible, hole] = Array.from(
      svgElement.querySelectorAll("mask rect"),
    );
    expect(hole).toBeDefined();
    const offsetX = Number(visible.getAttribute("width")) - 100 - arrow.width;
    const offsetY = Number(visible.getAttribute("height")) - 100 - arrow.height;

    // the label sits centered on the arrow's midpoint; the hole is its box
    // grown by the padding on every side, in the mask's (arrow-relative)
    // coordinates
    const labelLeft = arrow.x + arrow.width / 2 - label.width / 2;
    const labelTop = arrow.y - label.height / 2;
    expect(Number(hole.getAttribute("x"))).toBe(
      offsetX + labelLeft - arrow.x - BOUND_TEXT_PADDING,
    );
    expect(Number(hole.getAttribute("y"))).toBe(
      offsetY + labelTop - arrow.y - BOUND_TEXT_PADDING,
    );
    expect(Number(hole.getAttribute("width"))).toBe(
      label.width + BOUND_TEXT_PADDING * 2,
    );
    expect(Number(hole.getAttribute("height"))).toBe(
      label.height + BOUND_TEXT_PADDING * 2,
    );
  });
});

describe("exportToCanvas", () => {
  it("does not paint over elements beneath a labeled arrow's label (#11591)", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      id: "rect-11591",
      x: 0,
      y: -50,
      width: 200,
      height: 100,
      backgroundColor: "#ffc9c9",
      fillStyle: "solid",
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow-11591",
      x: -50,
      y: 0,
      width: 300,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(300, 0)],
      boundElements: [{ type: "text", id: "label-11591" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label-11591",
      text: "label",
      x: 75,
      y: -10,
      width: 50,
      height: 20,
      containerId: "arrow-11591",
    });

    const canvas = await exportScene({
      type: "canvas",
      data: {
        elements: [rectangle, arrow, label],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
    });

    const context = canvas.getContext("2d") as any;
    const events = context.__getEvents();

    // the label "hole" must be cut out of the arrow's own strokes via an
    // even-odd clip — erasing (clearRect) or painting the background color
    // (fillRect) over the hole rect would destroy elements rendered beneath
    // the arrow
    expect(
      events.some(
        (event: any) =>
          event.type === "clip" && event.props.fillRule === "evenodd",
      ),
    ).toBe(true);

    const holeWidth = label.width + BOUND_TEXT_PADDING * 2;
    const holeHeight = label.height + BOUND_TEXT_PADDING * 2;
    expect(
      events.filter(
        (event: any) =>
          (event.type === "fillRect" || event.type === "clearRect") &&
          event.props.width === holeWidth &&
          event.props.height === holeHeight,
      ),
    ).toEqual([]);
  });

  it("renders on a CPU-backed canvas", async () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext");

    const canvas = await exportScene({
      type: "canvas",
      data: {
        elements: [API.createElement({ type: "rectangle" })],
        files: null,
      },
    });

    // only the first getContext() call's options take effect
    const firstCall = getContextSpy.mock.contexts.indexOf(canvas);
    expect(getContextSpy.mock.calls[firstCall]).toEqual([
      "2d",
      { willReadFrequently: true },
    ]);
    getContextSpy.mockRestore();
  });
});

describe("export background", () => {
  // an outline arrowhead fakes its hollow interior by filling it with the
  // background color — the arrow's shaft runs into the arrowhead
  const sceneWithOutlineArrow = (viewBackgroundColor = "#ffffff") => ({
    elements: [
      API.createElement({
        type: "arrow",
        width: 100,
        height: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
        endArrowhead: "triangle_outline",
      }),
    ],
    appState: { viewBackgroundColor },
    files: null,
  });
  const getBackgroundRects = (svg: SVGSVGElement) =>
    Array.from(svg.children).filter((child) => child.tagName === "rect");
  const getCanvasFillStyles = (canvas: HTMLCanvasElement) =>
    (canvas.getContext("2d") as any)
      .__getEvents()
      .filter((event: any) => event.type === "fillStyle")
      .map((event: any) => event.props.value);

  it("exportToSvg paints no background for `false` or a transparent scene background", async () => {
    const svg = await exportScene({
      type: "svg",
      data: sceneWithOutlineArrow(),
      config: { canvasBackgroundColor: false },
    });
    expect(getBackgroundRects(svg)).toEqual([]);

    const svgOfTransparentScene = await exportScene({
      type: "svg",
      data: sceneWithOutlineArrow("transparent"),
    });
    expect(getBackgroundRects(svgOfTransparentScene)).toEqual([]);
  });

  it("exportToSvg fills outline arrowheads with the configured background", async () => {
    const svg = await exportScene({
      type: "svg",
      data: sceneWithOutlineArrow(),
      config: { canvasBackgroundColor: "#000000" },
    });
    expect(getBackgroundRects(svg)[0]).toHaveAttribute("fill", "#000000");
    expect(svg.querySelector('g path[fill="#000000"]')).not.toBeNull();
  });

  it("transparent exports keep filling outline arrowheads with the scene background", async () => {
    const canvas = await exportScene({
      type: "canvas",
      data: sceneWithOutlineArrow(),
      config: { canvasBackgroundColor: false },
    });
    expect(getCanvasFillStyles(canvas)).toContain("#ffffff");

    const svg = await exportScene({
      type: "svg",
      data: sceneWithOutlineArrow(),
      config: { canvasBackgroundColor: false },
    });
    expect(svg.querySelector('g path[fill="#ffffff"]')).not.toBeNull();
  });

  it("JPEG export paints the default background instead of `false`", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const canvas = document.createElement("canvas");

    await exportScene({
      type: "jpeg",
      data: sceneWithOutlineArrow("#abcdef"),
      config: { environment: { createCanvas: () => canvas } },
    });
    // the default background needs no warning
    expect(warn).not.toHaveBeenCalled();

    const canvasWithoutBackground = document.createElement("canvas");
    await exportScene({
      type: "jpeg",
      data: sceneWithOutlineArrow("#abcdef"),
      config: {
        canvasBackgroundColor: false,
        environment: { createCanvas: () => canvasWithoutBackground },
      },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(getCanvasFillStyles(canvasWithoutBackground)).toContain("#abcdef");

    warn.mockRestore();
  });
});

describe("export inputs", () => {
  it("takes only the scene settings from data.appState", async () => {
    const renderSpy = vi.spyOn(staticSceneModule, "renderStaticScene");

    await exportScene({
      type: "canvas",
      data: {
        elements: [API.createElement({ type: "rectangle" })],
        // a live AppState, as JS callers (and the editor) may pass
        appState: {
          ...getDefaultAppState(),
          viewBackgroundColor: "#abcdef",
          openDialog: { name: "elementLinkSelector", sourceElementId: "x" },
          croppingElementId: "x",
        } as ExportSceneData["appState"],
      },
    });

    const { appState } = renderSpy.mock.calls[0][0];
    expect(appState.viewBackgroundColor).toBe("#abcdef");
    expect(appState.openDialog).toBe(null);
    expect(appState.croppingElementId).toBe(null);
    renderSpy.mockRestore();
  });

  it("loads fonts through environment.loadFonts", async () => {
    const loadFonts = vi.fn(async () => {});

    await exportScene({
      type: "svg",
      data: { elements: [API.createElement({ type: "text", text: "hi" })] },
      config: { environment: { loadFonts } },
    });

    expect(loadFonts).toHaveBeenCalledTimes(1);
  });

  it("measures text through environment.textMetrics", async () => {
    const getLineWidth = vi.fn((text: string) => text.length * 100);
    const frame = API.createElement({ type: "frame", width: 450 });

    const svg = await exportScene({
      type: "svg",
      data: { elements: [frame] },
      config: { environment: { textMetrics: { getLineWidth } } },
    });

    // "Frame" is 500 wide by these metrics, so the label is truncated to fit
    // the 450 wide frame
    expect(getLineWidth).toHaveBeenCalledWith("Frame", expect.any(String));
    expect(
      Array.from(svg.querySelectorAll("text")).map((text) => text.textContent),
    ).toContain("F...");
  });

  describe("without a document font set (e.g. a DOM shim like linkedom)", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("exports without loading fonts, warning once", async () => {
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      // jsdom implements no `document.fonts`; only the test document is mocked
      vi.stubGlobal("document", document.implementation.createHTMLDocument());

      // a local font is never loaded, so nothing is missing
      await exportScene({
        type: "svg",
        data: {
          elements: [
            API.createElement({
              type: "text",
              text: "hi",
              fontFamily: FONT_FAMILY.Helvetica,
            }),
          ],
        },
      });
      expect(consoleWarn).not.toHaveBeenCalled();

      for (let i = 0; i < 2; i++) {
        const svg = await exportScene({
          type: "svg",
          data: {
            elements: [API.createElement({ type: "text", text: "hi" })],
          },
        });
        expect(svg.querySelector("text")?.textContent).toBe("hi");
      }
      expect(consoleWarn).toHaveBeenCalledTimes(1);
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("config.environment.loadFonts"),
      );
      consoleWarn.mockRestore();
    });

    it("loads fonts into a worker's own font set", async () => {
      const fonts = {
        has: () => true,
        add: vi.fn(),
        check: () => false,
        load: vi.fn(async () => []),
      };
      vi.stubGlobal("document", document.implementation.createHTMLDocument());
      vi.stubGlobal("self", { fonts });

      await exportScene({
        type: "svg",
        data: { elements: [API.createElement({ type: "text", text: "hi" })] },
      });

      expect(fonts.load).toHaveBeenCalledWith(
        expect.stringContaining("Excalifont"),
        "hi",
      );
    });
  });

  it("renders frame decorations per config.frames", async () => {
    const elements = [API.createElement({ type: "frame" })];
    const countFrameNames = (svg: SVGSVGElement) =>
      Array.from(svg.querySelectorAll("text")).filter(
        (text) => text.textContent === "Frame",
      ).length;

    const svg = await exportScene({ type: "svg", data: { elements } });
    const svgWithoutNames = await exportScene({
      type: "svg",
      data: { elements },
      config: { frames: { name: false } },
    });

    expect(countFrameNames(svg)).toBe(1);
    expect(countFrameNames(svgWithoutNames)).toBe(0);
  });
});

describe("exporting frames", () => {
  const getFrameNameHeight = (exportType: "canvas" | "svg") => {
    const height =
      FRAME_STYLE.nameFontSize * FRAME_STYLE.nameLineHeight +
      FRAME_STYLE.nameOffsetY;
    // canvas rounds dimensions to integers
    if (exportType === "canvas") {
      return Math.round(height);
    }
    return height;
  };

  // a few tests with exportToCanvas (where we can't inspect elements)
  // ---------------------------------------------------------------------------

  describe("exportToCanvas", () => {
    it("exporting canvas with a single frame shouldn't crop if not exporting frame directly", async () => {
      const elements = [
        API.createElement({
          type: "frame",
          width: 100,
          height: 100,
          x: 0,
          y: 0,
        }),
        API.createElement({
          type: "rectangle",
          width: 100,
          height: 100,
          x: 100,
          y: 0,
        }),
      ];

      const canvas = await exportScene({
        type: "canvas",
        data: {
          elements,
          appState: {},
          files: null,
        },
        config: {
          padding: 0,
        },
      });

      expect(canvas.width).toEqual(200);
      expect(canvas.height).toEqual(100 + getFrameNameHeight("canvas"));
    });

    it("exporting canvas with a single frame should crop when exporting frame directly", async () => {
      const frame = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      });
      const elements = [
        frame,
        API.createElement({
          type: "rectangle",
          width: 100,
          height: 100,
          x: 100,
          y: 0,
        }),
      ];

      const canvas = await exportScene({
        type: "canvas",
        data: {
          elements,
          appState: {},
          files: null,
        },
        config: {
          padding: 0,
          exportingFrame: frame,
        },
      });

      expect(canvas.width).toEqual(frame.width);
      expect(canvas.height).toEqual(frame.height);
    });
  });

  // exportToSvg (so we can test for element existence)
  // ---------------------------------------------------------------------------
  describe("exportToSvg", () => {
    it("colors frame names like the editor in the configured theme", async () => {
      const frame = API.createElement({ type: "frame" });

      const svg = await exportScene({
        type: "svg",
        data: { elements: [frame], files: null },
        config: { theme: THEME.DARK },
      });

      const label = Array.from(svg.querySelectorAll("text")).find(
        (text) => text.textContent === "Frame",
      );
      expect(label).toHaveAttribute("fill", FRAME_STYLE.nameColorDarkTheme);
    });

    it("truncates frame names to what fits, down to no name at all", async () => {
      // 10px per character in tests, so "..." is 30 wide
      const svg = await exportScene({
        type: "svg",
        data: {
          elements: [
            API.createElement({ type: "frame", x: 0, width: 20 }),
            API.createElement({ type: "frame", x: 100, width: 35 }),
          ],
        },
      });

      expect(
        Array.from(svg.querySelectorAll("text"))
          .map((text) => text.textContent)
          .filter(Boolean),
      ).toEqual(["..."]);
    });

    it("clips a frame export larger than the frame to the frame", async () => {
      const frame = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
      });
      const child = API.createElement({
        type: "rectangle",
        x: 50,
        y: 20,
        width: 150,
        height: 40,
        frameId: frame.id,
      });
      const data = { elements: [frame, child] };
      const config = { exportingFrame: frame, width: 200, height: 100 };

      const svg = await exportScene({ type: "svg", data, config });
      expect(
        svg.querySelector(
          `g[clip-path="url(#${frame.id})"] [data-id="${child.id}"]`,
        ),
      ).not.toBeNull();

      const canvas = await exportScene({ type: "canvas", data, config });
      const clips = (canvas.getContext("2d") as any)
        .__getEvents()
        .filter((event: any) => event.type === "clip");
      expect(clips).toHaveLength(1);
    });

    it("exporting frame should include overlapping elements, but crop to frame", async () => {
      const frame = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      });
      const frameChild = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 0,
        y: 50,
        frameId: frame.id,
      });
      const rectOverlapping = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 50,
        y: 0,
      });

      const svg = await exportScene({
        type: "svg",
        data: {
          elements: [rectOverlapping, frame, frameChild],
          appState: {},
          files: null,
        },
        config: {
          padding: 0,
          exportingFrame: frame,
        },
      });

      // frame itself isn't exported
      expect(svg.querySelector(`[data-id="${frame.id}"]`)).toBeNull();
      // frame child is exported
      expect(svg.querySelector(`[data-id="${frameChild.id}"]`)).not.toBeNull();
      // overlapping element is exported
      expect(
        svg.querySelector(`[data-id="${rectOverlapping.id}"]`),
      ).not.toBeNull();

      expect(svg.getAttribute("width")).toBe(frame.width.toString());
      expect(svg.getAttribute("height")).toBe(frame.height.toString());
    });

    it("should filter non-overlapping elements when exporting a frame", async () => {
      const frame = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      });
      const frameChild = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 0,
        y: 50,
        frameId: frame.id,
      });
      const elementOutside = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 200,
        y: 0,
      });

      const svg = await exportScene({
        type: "svg",
        data: {
          elements: [frameChild, frame, elementOutside],
          appState: {},
          files: null,
        },
        config: {
          padding: 0,
          exportingFrame: frame,
        },
      });

      // frame itself isn't exported
      expect(svg.querySelector(`[data-id="${frame.id}"]`)).toBeNull();
      // frame child is exported
      expect(svg.querySelector(`[data-id="${frameChild.id}"]`)).not.toBeNull();
      // non-overlapping element is not exported
      expect(svg.querySelector(`[data-id="${elementOutside.id}"]`)).toBeNull();

      expect(svg.getAttribute("width")).toBe(frame.width.toString());
      expect(svg.getAttribute("height")).toBe(frame.height.toString());
    });

    it("should export multiple frames when selected, excluding overlapping elements", async () => {
      const frame1 = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      });
      const frame2 = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 200,
        y: 0,
      });

      const frame1Child = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 0,
        y: 50,
        frameId: frame1.id,
      });
      const frame2Child = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 200,
        y: 0,
        frameId: frame2.id,
      });
      const frame2Overlapping = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 350,
        y: 0,
      });

      // low-level exportToSvg api expects elements to be pre-filtered, so let's
      // use the filter we use in the editor
      const { exportedElements, exportingFrame } = prepareElementsForExport(
        [frame1Child, frame1, frame2Child, frame2, frame2Overlapping],
        {
          selectedElementIds: { [frame1.id]: true, [frame2.id]: true },
        },
        true,
      );

      const svg = await exportScene({
        type: "svg",
        data: {
          elements: exportedElements,
          appState: {},
          files: null,
        },
        config: {
          padding: 0,
          exportingFrame,
        },
      });

      // frames themselves should be exported when multiple frames selected
      expect(svg.querySelector(`[data-id="${frame1.id}"]`)).not.toBeNull();
      expect(svg.querySelector(`[data-id="${frame2.id}"]`)).not.toBeNull();
      // children should be epxorted
      expect(svg.querySelector(`[data-id="${frame1Child.id}"]`)).not.toBeNull();
      expect(svg.querySelector(`[data-id="${frame2Child.id}"]`)).not.toBeNull();
      // overlapping elements or non-overlapping elements should not be exported
      expect(
        svg.querySelector(`[data-id="${frame2Overlapping.id}"]`),
      ).toBeNull();

      expect(svg.getAttribute("width")).toBe(
        (frame2.x + frame2.width).toString(),
      );
      expect(svg.getAttribute("height")).toBe(
        (frame2.y + frame2.height + getFrameNameHeight("svg")).toString(),
      );
    });

    it("should render frame alone when not selected", async () => {
      const frame = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      });

      // low-level exportToSvg api expects elements to be pre-filtered, so let's
      // use the filter we use in the editor
      const { exportedElements, exportingFrame } = prepareElementsForExport(
        [frame],
        {
          selectedElementIds: {},
        },
        false,
      );

      const svg = await exportScene({
        type: "svg",
        data: {
          elements: exportedElements,
          appState: {},
          files: null,
        },
        config: {
          padding: 0,
          exportingFrame,
        },
      });

      // frame itself isn't exported
      expect(svg.querySelector(`[data-id="${frame.id}"]`)).not.toBeNull();

      expect(svg.getAttribute("width")).toBe(frame.width.toString());
      expect(svg.getAttribute("height")).toBe(
        (frame.height + getFrameNameHeight("svg")).toString(),
      );
    });

    it("should not export frame-overlapping elements belonging to different frame", async () => {
      const frame1 = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      });
      const frame2 = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 200,
        y: 0,
      });

      const frame1Child = API.createElement({
        type: "rectangle",
        width: 150,
        height: 100,
        x: 0,
        y: 50,
        frameId: frame1.id,
      });
      const frame2Child = API.createElement({
        type: "rectangle",
        width: 150,
        height: 100,
        x: 50,
        y: 0,
        frameId: frame2.id,
      });

      // low-level exportToSvg api expects elements to be pre-filtered, so let's
      // use the filter we use in the editor
      const { exportedElements, exportingFrame } = prepareElementsForExport(
        [frame1Child, frame1, frame2Child, frame2],
        {
          selectedElementIds: { [frame1.id]: true },
        },
        true,
      );

      const svg = await exportScene({
        type: "svg",
        data: {
          elements: exportedElements,
          appState: {},
          files: null,
        },
        config: {
          padding: 0,
          exportingFrame,
        },
      });

      // frame shouldn't be exported
      expect(svg.querySelector(`[data-id="${frame1.id}"]`)).toBeNull();
      // frame1 child should be epxorted
      expect(svg.querySelector(`[data-id="${frame1Child.id}"]`)).not.toBeNull();
      // frame2 child should not be exported even if it physically overlaps with
      // frame1
      expect(svg.querySelector(`[data-id="${frame2Child.id}"]`)).toBeNull();

      expect(svg.getAttribute("width")).toBe(frame1.width.toString());
      expect(svg.getAttribute("height")).toBe(frame1.height.toString());
    });
  });
});

describe("text style ranges", () => {
  const RED = "#ff0000";
  const YELLOW = "#ffec99";
  const GREEN = "#b2f2bb";

  const makeText = (
    text: string,
    textStyleRanges: any,
    width = 110,
    extra: Record<string, any> = {},
  ) =>
    ({
      ...API.createElement({
        type: "text",
        text,
        index: "a0" as FractionalIndex,
        ...extra,
      }),
      width,
      height: 25,
      textStyleRanges,
    } as any as NonDeleted<ExcalidrawTextElement>);

  const exportSvg = (elements: any[], config: any = {}) =>
    exportScene({ type: "svg", data: { elements, files: null }, config });

  const exportCanvas = (elements: any[], config: any = {}) =>
    exportScene({ type: "canvas", data: { elements, files: null }, config });

  const getFillTexts = (canvas: HTMLCanvasElement) =>
    (canvas.getContext("2d") as any).fillText.mock.calls as [
      string,
      number,
      number,
    ][];

  const getEvents = (canvas: HTMLCanvasElement) =>
    (canvas.getContext("2d") as any).__getEvents() as any[];

  const worldRange = (extra: Record<string, any> = {}) => [
    { id: "r1", seq: 1, start: 6, end: 11, ...extra },
  ];

  it("writes tspans with the right fill", async () => {
    const element = makeText("hello world", worldRange({ color: RED }));
    const svg = await exportSvg([element]);
    const texts = svg.querySelectorAll("text");
    expect(texts).toHaveLength(1);
    const tspans = texts[0].querySelectorAll("tspan");
    expect(tspans).toHaveLength(2);
    expect(tspans[0].textContent).toBe("hello ");
    expect(tspans[0].hasAttribute("fill")).toBe(false);
    expect(tspans[1].textContent).toBe("world");
    expect(tspans[1].getAttribute("fill")).toBe(RED);
    expect(texts[0].getAttribute("fill")).toBe(element.strokeColor);
  });

  it("writes highlights behind the text", async () => {
    const element = makeText("hello world", worldRange({ highlight: YELLOW }));
    const svg = await exportSvg([element]);
    const text = svg.querySelector("text")!;
    const group = text.parentElement!;
    const rect = group.querySelector(`rect[fill="${YELLOW}"]`)!;
    expect(rect).not.toBeNull();
    expect(
      rect.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(Number(rect.getAttribute("height"))).toBe(
      element.fontSize * element.lineHeight,
    );
    expect(Number(rect.getAttribute("width"))).toBe(50);
  });

  it("positions highlights like the canvas runs", async () => {
    const ranges = [
      { id: "r1", seq: 1, start: 0, end: 5, highlight: YELLOW },
      { id: "r2", seq: 2, start: 6, end: 11, highlight: GREEN },
    ];
    const element = makeText("hello world", ranges, 200, {
      textAlign: "center",
    });
    const svg = await exportSvg([element]);
    const rectX = (fill: string) =>
      Number(svg.querySelector(`rect[fill="${fill}"]`)!.getAttribute("x"));

    const canvas = await exportCanvas([element]);
    const calls = getFillTexts(canvas);
    const hello = calls.find((call) => call[0].startsWith("hello"))!;
    const world = calls.find((call) => call[0] === "world")!;

    expect(rectX(GREEN) - rectX(YELLOW)).toBe(world[1] - hello[1]);
  });

  it("keeps an unstyled line byte for byte", async () => {
    const styled = makeText(
      "one\ntwo",
      [{ id: "r1", seq: 1, start: 4, end: 7, color: RED }],
      30,
    );
    const plain = makeText("one\ntwo", undefined, 30);
    delete (plain as any).textStyleRanges;

    const svgStyled = await exportSvg([styled]);
    const svgPlain = await exportSvg([plain]);
    const first = (svg: SVGSVGElement) =>
      svg.querySelectorAll("text")[0].outerHTML;
    expect(first(svgStyled)).toBe(first(svgPlain));
  });

  it("exports unstyled text identically", async () => {
    const withField = makeText("hello world", undefined);
    const without = makeText("hello world", undefined);
    delete (without as any).textStyleRanges;

    const a = await exportSvg([withField]);
    const b = await exportSvg([without]);
    expect(a.querySelectorAll("tspan")).toHaveLength(0);
    expect(b.querySelectorAll("tspan")).toHaveLength(0);
    expect(a.querySelector("text")!.outerHTML).toBe(
      b.querySelector("text")!.outerHTML,
    );
  });

  it("does not let a hostile colour reach the markup", async () => {
    const element = makeText(
      "hello world",
      worldRange({ color: 'red" onload="x' }),
    );
    const svg = await exportSvg([element]);
    expect(svg.querySelector("[onload]")).toBeNull();
    expect(svg.querySelectorAll("tspan")).toHaveLength(0);
  });

  it.each(["left", "center", "right"])(
    "draws runs in place for %s alignment",
    async (align) => {
      const startX = async (textAlign: string) => {
        const element = makeText(
          "hello world",
          worldRange({ color: RED }),
          200,
          { textAlign },
        );
        const canvas = await exportCanvas([element]);
        const calls = getFillTexts(canvas);
        const hello = calls.find((call) => call[0].startsWith("hello"))!;
        const world = calls.find((call) => call[0] === "world")!;
        expect(hello).toBeDefined();
        expect(world).toBeDefined();
        expect(world[1] - hello[1]).toBe(60);

        // the align in force when each run is drawn
        let current = "";
        const aligns: string[] = [];
        for (const event of getEvents(canvas)) {
          if (event.type === "textAlign") {
            current = event.props.value;
          } else if (
            event.type === "fillText" &&
            (event.props.text === "world" ||
              event.props.text.startsWith("hello"))
          ) {
            aligns.push(current);
          }
        }
        expect(aligns.length).toBeGreaterThan(0);
        expect(aligns.every((value) => value === "left")).toBe(true);
        return hello[1];
      };

      const left = await startX("left");
      const actual = await startX(align);
      const offset = { left: 0, center: 45, right: 90 }[align]!;
      expect(actual - left).toBe(offset);
    },
  );

  it("draws a highlight behind its text", async () => {
    const element = makeText("hello world", worldRange({ highlight: YELLOW }));
    const canvas = await exportCanvas([element]);
    const events = getEvents(canvas);
    const rectIndex = events.findIndex(
      (event) =>
        event.type === "fillRect" &&
        event.props.width === 50 &&
        event.props.height === 25,
    );
    const textIndex = events.findIndex(
      (event) => event.type === "fillText" && event.props.text === "world",
    );
    expect(rectIndex).toBeGreaterThanOrEqual(0);
    expect(textIndex).toBeGreaterThan(rectIndex);
    expect(events[rectIndex].props.x).toBe(events[textIndex].props.x);
  });

  it("keeps the run's y for line height and bound text", async () => {
    const build = (textStyleRanges: any) => {
      const rect = API.createElement({
        type: "rectangle",
        id: "container",
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        boundElements: [{ type: "text", id: "label" }],
      });
      const label = {
        ...API.createElement({
          type: "text",
          id: "label",
          text: "hello world",
          containerId: "container",
          textAlign: "center",
          verticalAlign: "middle",
          index: "a1" as FractionalIndex,
        }),
        // not an API.createElement option, so set it on the element itself
        lineHeight: 2,
        width: 110,
        height: 40,
        textStyleRanges,
      } as any;
      return [rect, label];
    };

    const styled = await exportCanvas(build(worldRange({ color: RED })));
    const plain = await exportCanvas(build(undefined));
    const world = getFillTexts(styled).find((call) => call[0] === "world")!;
    const whole = getFillTexts(plain).find(
      (call) => call[0] === "hello world",
    )!;
    expect(world).toBeDefined();
    expect(whole).toBeDefined();
    expect(world[2]).toBe(whole[2]);
  });

  it("follows dark mode for range colours", async () => {
    const element = makeText(
      "hello world",
      worldRange({ color: RED, highlight: YELLOW }),
    );
    const config = { theme: THEME.DARK };

    const svg = await exportSvg([element], config);
    expect(svg.querySelector("tspan[fill]")!.getAttribute("fill")).toBe(
      applyDarkModeFilter(RED),
    );
    expect(svg.querySelector("rect[fill]:not(:first-child)")).not.toBeNull();
    expect(
      Array.from(svg.querySelectorAll("rect")).some(
        (rect) => rect.getAttribute("fill") === applyDarkModeFilter(YELLOW),
      ),
    ).toBe(true);

    const canvas = await exportCanvas([element], config);
    const fills = getEvents(canvas)
      .filter((event) => event.type === "fillStyle")
      .map((event) => event.props.value);
    expect(fills).toContain(applyDarkModeFilter(RED));
    expect(fills).toContain(applyDarkModeFilter(YELLOW));
  });

  it("draws a line with no styled run as one fillText", async () => {
    const element = makeText(
      "one\ntwo",
      [{ id: "r1", seq: 1, start: 4, end: 7, color: RED }],
      100,
      { textAlign: "center" },
    );
    const canvas = await exportCanvas([element]);
    const ones = getFillTexts(canvas).filter((call) => call[0] === "one");
    expect(ones).toHaveLength(1);

    let current = "";
    let seen = "";
    for (const event of getEvents(canvas)) {
      if (event.type === "textAlign") {
        current = event.props.value;
      } else if (event.type === "fillText" && event.props.text === "one") {
        seen = current;
      }
    }
    expect(seen).toBe("center");
  });

  it("uses the same runs for PNG export", async () => {
    const canvas = document.createElement("canvas");
    const element = makeText("hello world", worldRange({ color: RED }));

    await expect(
      exportScene({
        type: "png",
        data: { elements: [element], files: null },
        config: { environment: { createCanvas: () => canvas } },
      }),
    ).resolves.toBeDefined();

    expect(getFillTexts(canvas).some((call) => call[0] === "world")).toBe(true);
  });

  describe("a Hebrew line followed by a styled LTR line", () => {
    const HEBREW_TEXT = "\u05e9\u05dc\u05d5\u05dd\nhello world";
    // "world" on the second line: 4 Hebrew letters + newline + "hello "
    const styledRanges = () => [
      { id: "r1", seq: 1, start: 11, end: 16, color: RED, highlight: YELLOW },
    ];

    it.each([
      ["left", "end", "start", 60],
      ["center", "middle", "middle", 105],
      ["right", "end", "end", 150],
    ])(
      "anchors the styled line by %s alignment alone in SVG",
      async (textAlign, hebrewAnchor, styledAnchor, highlightX) => {
        const element = makeText(HEBREW_TEXT, styledRanges(), 200, {
          textAlign,
        });
        const svg = await exportSvg([element]);
        const texts = svg.querySelectorAll("text");
        expect(texts).toHaveLength(2);

        // the Hebrew line keeps today's attributes
        expect(texts[0].getAttribute("direction")).toBe("rtl");
        expect(texts[0].getAttribute("text-anchor")).toBe(hebrewAnchor);
        expect(texts[0].querySelectorAll("tspan")).toHaveLength(0);

        expect(texts[1].getAttribute("direction")).toBe("ltr");
        expect(texts[1].getAttribute("text-anchor")).toBe(styledAnchor);

        const rect = svg.querySelector(`rect[fill="${YELLOW}"]`)!;
        expect(rect).not.toBeNull();
        expect(Number(rect.getAttribute("x"))).toBe(highlightX);
      },
    );

    it("draws every run of the styled line with direction ltr on canvas", async () => {
      const drawn: { text: string; direction: string }[] = [];
      const spy = vi
        .spyOn(CanvasRenderingContext2D.prototype, "fillText")
        .mockImplementation(function (
          this: CanvasRenderingContext2D,
          text: string,
        ) {
          drawn.push({ text, direction: this.direction });
        });

      try {
        await exportCanvas([makeText(HEBREW_TEXT, styledRanges(), 200)]);
      } finally {
        spy.mockRestore();
      }

      const runs = drawn.filter(
        (call) => call.text.startsWith("hello") || call.text === "world",
      );
      expect(runs.map((call) => call.text)).toEqual(["hello ", "world"]);
      expect(runs.every((call) => call.direction === "ltr")).toBe(true);
    });
  });
});
