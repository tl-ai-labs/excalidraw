import {
  applyDarkModeFilter,
  arrayToMap,
  FONT_FAMILY,
  THEME,
  toBrandedType,
} from "@excalidraw/common";
import { afterEach, describe, expect, it } from "vitest";

import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "@excalidraw/excalidraw/scene/types";

import { Scene } from "../src/Scene";
import { ElementsDelta } from "../src/delta";
import { syncInvalidIndices } from "../src/fractionalIndex";
import { newElementWith } from "../src/mutateElement";
import { newElement, newTextElement } from "../src/newElement";
import { elementWithCanvasCache, renderElement } from "../src/renderElement";
import { redrawTextBoundingBox } from "../src/textElement";
import { setCustomTextMetricsProvider } from "../src/textMeasurements";
import {
  applyTextRangeStyle,
  areTextRangesEqual,
  computeTextEditDelta,
  getStyleForTextRange,
  isValidRangeColor,
  normalizeTextRanges,
  projectTextRangesToLines,
  shiftTextRangesOnEdit,
} from "../src/textRanges";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  FontString,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
  Ordered,
  OrderedExcalidrawElement,
  SceneElementsMap,
  TextRangeStyle,
} from "../src/types";

const createMockRenderConfig = (
  theme: typeof THEME[keyof typeof THEME],
): StaticCanvasRenderConfig =>
  ({
    canvasBackgroundColor: "#ffffff",
    imageCache: new Map(),
    renderGrid: false,
    isExporting: false,
    embedsValidationStatus: new Map(),
    elementsPendingErasure: new Set(),
    pendingFlowchartNodes: null,
    scale: 1,
    theme,
  } as unknown as StaticCanvasRenderConfig);

describe("textRanges", () => {
  it("normalizes, clamps, sorts, and merges adjacent identical ranges and returns undefined when empty", () => {
    expect(isValidRangeColor("#e03131")).toBe(true);
    expect(isValidRangeColor("transparent")).toBe(false);
    expect(isValidRangeColor("  TRANSPARENT ")).toBe(false);
    expect(isValidRangeColor("")).toBe(false);
    expect(isValidRangeColor(null)).toBe(false);

    const rawRanges = [
      { start: 5, end: 8, color: "#e03131" },
      { start: -4, end: 2, color: "#1971c2" },
      { start: 2, end: 5, color: "#1971c2" },
      { start: 6, end: 6, color: "#2f9e44" },
      { start: 9, end: 7, color: "#2f9e44" },
      { start: 8, end: 15, color: "#e03131", highlightColor: "transparent" },
    ];

    const normalized = normalizeTextRanges(rawRanges, 10);
    expect(normalized).toEqual([
      { start: 0, end: 5, color: "#1971c2" },
      { start: 5, end: 10, color: "#e03131" },
    ]);
    expect(normalized?.[1]).not.toHaveProperty("highlightColor");

    expect(
      normalizeTextRanges(
        [
          { start: 0, end: 0, color: "#e03131" },
          { start: 3, end: 2, color: "#e03131" },
          { start: 1, end: 4, color: "transparent", highlightColor: "  " },
        ],
        10,
      ),
    ).toBeUndefined();
    expect(normalizeTextRanges([], 10)).toBeUndefined();
    expect(
      normalizeTextRanges([{ start: 0, end: 3, color: "#e03131" }], 0),
    ).toBeUndefined();

    expect(areTextRangesEqual(undefined, [])).toBe(true);
    expect(
      areTextRangesEqual(normalized, [
        { start: 0, end: 5, color: "#1971c2" },
        { start: 5, end: 10, color: "#e03131" },
      ]),
    ).toBe(true);
    expect(
      areTextRangesEqual(normalized, [{ start: 0, end: 5, color: "#1971c2" }]),
    ).toBe(false);
  });

  it("splits overlapping colour and highlight ranges independently per channel", () => {
    let ranges = applyTextRangeStyle(
      undefined,
      10,
      0,
      6,
      { color: "#e03131" },
      "#1e1e1e",
    );
    expect(ranges).toEqual([{ start: 0, end: 6, color: "#e03131" }]);

    ranges = applyTextRangeStyle(
      ranges,
      10,
      3,
      9,
      { highlightColor: "#ffec99" },
      "#1e1e1e",
    );
    expect(ranges).toEqual([
      { start: 0, end: 3, color: "#e03131" },
      { start: 3, end: 6, color: "#e03131", highlightColor: "#ffec99" },
      { start: 6, end: 9, highlightColor: "#ffec99" },
    ]);

    expect(getStyleForTextRange(ranges, 3, 6, "#1e1e1e")).toEqual({
      color: "#e03131",
      highlightColor: "#ffec99",
    });
    expect(getStyleForTextRange(ranges, 0, 9, "#1e1e1e")).toEqual({
      color: "#1e1e1e",
      highlightColor: "transparent",
    });

    // Clearing colour on [0, 6) by applying baseStrokeColor preserves highlight on [3, 9)
    const afterColorReset = applyTextRangeStyle(
      ranges,
      10,
      0,
      6,
      { color: "#1e1e1e" },
      "#1e1e1e",
    );
    expect(afterColorReset).toEqual([
      { start: 3, end: 9, highlightColor: "#ffec99" },
    ]);

    // Clearing highlight with "transparent" leaves no ranges and returns undefined
    const afterHighlightClear = applyTextRangeStyle(
      afterColorReset,
      10,
      3,
      9,
      { highlightColor: "transparent" },
      "#1e1e1e",
    );
    expect(afterHighlightClear).toBeUndefined();
  });

  it("shifts, expands, trims, and removes ranges across insert, delete, and replace text edits", () => {
    const initialRanges: readonly TextRangeStyle[] = [
      { start: 6, end: 11, color: "#e03131", highlightColor: "#ffec99" },
    ];

    // Insert before styled range ("Hello world" -> "Hello brave world")
    expect(computeTextEditDelta("Hello world", "Hello brave world")).toEqual({
      start: 6,
      deleteCount: 0,
      insertLength: 6,
    });
    const afterPrefixInsert = shiftTextRangesOnEdit(
      initialRanges,
      "Hello world",
      "Hello brave world",
    );
    expect(afterPrefixInsert).toEqual([
      { start: 12, end: 17, color: "#e03131", highlightColor: "#ffec99" },
    ]);

    // Insert inside styled range ("Hello world" -> "Hello woXYZrld")
    const afterInteriorInsert = shiftTextRangesOnEdit(
      initialRanges,
      "Hello world",
      "Hello woXYZrld",
    );
    expect(afterInteriorInsert).toEqual([
      { start: 6, end: 14, color: "#e03131", highlightColor: "#ffec99" },
    ]);

    // Insert after styled range ("Hello world" -> "Hello world!")
    const afterSuffixInsert = shiftTextRangesOnEdit(
      initialRanges,
      "Hello world",
      "Hello world!",
    );
    expect(afterSuffixInsert).toEqual([
      { start: 6, end: 11, color: "#e03131", highlightColor: "#ffec99" },
    ]);

    // Partial delete overlapping start of styled range ("Hello world" -> "Hello rld")
    const afterPartialDelete = shiftTextRangesOnEdit(
      initialRanges,
      "Hello world",
      "Hello rld",
    );
    expect(afterPartialDelete).toEqual([
      { start: 6, end: 9, color: "#e03131", highlightColor: "#ffec99" },
    ]);

    // Replace slice inside styled range ("Hello world" -> "Hello wXYZd")
    const afterInteriorReplace = shiftTextRangesOnEdit(
      initialRanges,
      "Hello world",
      "Hello wXYZd",
    );
    expect(afterInteriorReplace).toEqual([
      { start: 6, end: 11, color: "#e03131", highlightColor: "#ffec99" },
    ]);

    // Replace entire styled substring ("Hello world" -> "Hello friends") removes the replaced range
    const afterFullReplace = shiftTextRangesOnEdit(
      initialRanges,
      "Hello world",
      "Hello friends",
    );
    expect(afterFullReplace).toBeUndefined();

    // Delete entire styled substring ("Hello world" -> "Hello ")
    const afterFullDelete = shiftTextRangesOnEdit(
      initialRanges,
      "Hello world",
      "Hello ",
    );
    expect(afterFullDelete).toBeUndefined();
  });

  it("projects originalText ranges onto soft-wrapped and hard-wrapped lines", () => {
    const originalText = "  Hello  World\nNext line";
    const wrappedText = "  Hello\nWorld\nNext line";
    const ranges: readonly TextRangeStyle[] = [
      { start: 2, end: 14, color: "#e03131", highlightColor: "#ffec99" },
      { start: 15, end: 19, color: "#1971c2" },
    ];

    const lineRuns = projectTextRangesToLines(
      originalText,
      wrappedText,
      ranges,
    );

    expect(lineRuns).toEqual([
      [
        { text: "  ", start: 0, end: 2 },
        {
          text: "Hello",
          start: 2,
          end: 7,
          color: "#e03131",
          highlightColor: "#ffec99",
        },
      ],
      [
        {
          text: "World",
          start: 9,
          end: 14,
          color: "#e03131",
          highlightColor: "#ffec99",
        },
      ],
      [
        { text: "Next", start: 15, end: 19, color: "#1971c2" },
        { text: " line", start: 19, end: 24 },
      ],
    ]);
  });

  it("omits textRanges own property on newTextElement when empty and renders per-run fillRect and fillText on canvas", () => {
    const unstyled = newTextElement({
      x: 0,
      y: 0,
      text: "Plain text",
    });
    expect("textRanges" in unstyled).toBe(false);

    const emptyRangesEl = newTextElement({
      x: 0,
      y: 0,
      text: "Plain text",
      textRanges: [],
    });
    expect("textRanges" in emptyRangesEl).toBe(false);

    const styled = newTextElement({
      x: 10,
      y: 20,
      text: "Hello world",
      strokeColor: "#1e1e1e",
      textRanges: [
        { start: 0, end: 5, color: "#e03131", highlightColor: "#ffec99" },
      ],
    });
    expect("textRanges" in styled).toBe(true);
    expect(styled.textRanges).toEqual([
      { start: 0, end: 5, color: "#e03131", highlightColor: "#ffec99" },
    ]);

    const allElementsMap = toBrandedType<NonDeletedSceneElementsMap>(
      arrayToMap([styled as Ordered<NonDeletedExcalidrawElement>]),
    );
    const renderableElementsMap =
      toBrandedType<RenderableElementsMap>(allElementsMap);

    for (const theme of [THEME.LIGHT, THEME.DARK] as const) {
      for (const textAlign of ["left", "center", "right"] as const) {
        const alignedEl = newElementWith(styled, {
          textAlign,
          width: 200,
        });
        elementWithCanvasCache.delete(alignedEl);

        const drawOps: Array<
          | {
              type: "fillRect";
              x: number;
              y: number;
              w: number;
              h: number;
              fillStyle: string;
            }
          | {
              type: "fillText";
              text: string;
              x: number;
              y: number;
              fillStyle: string;
            }
        > = [];

        const origGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          contextId: string,
          options?: any,
        ) {
          const ctx = origGetContext.call(
            this,
            contextId as any,
            options,
          ) as CanvasRenderingContext2D | null;
          if (ctx && !(ctx as any).__spied) {
            (ctx as any).__spied = true;
            const origFillRect = ctx.fillRect.bind(ctx);
            const origFillText = ctx.fillText.bind(ctx);
            ctx.measureText = ((str: string) => ({
              width: str.length * 10,
            })) as any;
            ctx.fillRect = (x: number, y: number, w: number, h: number) => {
              drawOps.push({
                type: "fillRect",
                x,
                y,
                w,
                h,
                fillStyle: String(ctx.fillStyle),
              });
              return origFillRect(x, y, w, h);
            };
            ctx.fillText = (
              text: string,
              x: number,
              y: number,
              maxWidth?: number,
            ) => {
              drawOps.push({
                type: "fillText",
                text,
                x,
                y,
                fillStyle: String(ctx.fillStyle),
              });
              return origFillText(text, x, y, maxWidth);
            };
          }
          return ctx as any;
        };

        try {
          const mainCanvas = document.createElement("canvas");
          const rc = { draw: () => undefined } as any;
          renderElement(
            alignedEl,
            renderableElementsMap,
            allElementsMap,
            rc,
            mainCanvas.getContext("2d")!,
            createMockRenderConfig(theme),
            {
              scrollX: 0,
              scrollY: 0,
              zoom: { value: 1 as any },
              viewBackgroundColor: "#ffffff",
              theme,
            } as any,
          );
        } finally {
          HTMLCanvasElement.prototype.getContext = origGetContext;
        }

        const rectOps = drawOps.filter((op) => op.type === "fillRect");
        const textOps = drawOps.filter((op) => op.type === "fillText");

        expect(rectOps.length).toBe(1);
        expect(textOps.length).toBe(2);

        // Background highlight fillRect is drawn before foreground fillText runs
        const firstRectIdx = drawOps.findIndex((op) => op.type === "fillRect");
        const firstTextIdx = drawOps.findIndex((op) => op.type === "fillText");
        expect(firstRectIdx).toBeLessThan(firstTextIdx);

        const expectedLineWidth = "Hello world".length * 10; // 110
        const expectedStartX =
          textAlign === "center"
            ? (alignedEl.width - expectedLineWidth) / 2
            : textAlign === "right"
            ? alignedEl.width - expectedLineWidth
            : 0;

        expect(rectOps[0]).toMatchObject({
          type: "fillRect",
          x: expectedStartX,
          w: 50,
          fillStyle: applyDarkModeFilter("#ffec99", theme === THEME.DARK),
        });
        expect(textOps[0]).toMatchObject({
          type: "fillText",
          text: "Hello",
          x: expectedStartX,
          fillStyle: applyDarkModeFilter("#e03131", theme === THEME.DARK),
        });
        expect(textOps[1]).toMatchObject({
          type: "fillText",
          text: " world",
          x: expectedStartX + 50,
          fillStyle: applyDarkModeFilter("#1e1e1e", theme === THEME.DARK),
        });
      }
    }

    // Verify elementWithCanvasCache invalidates when textRanges changes
    const mainCanvas = document.createElement("canvas");
    const rc = { draw: () => undefined } as any;
    const renderConfig = createMockRenderConfig(THEME.LIGHT);
    const appState = {
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 as any },
      viewBackgroundColor: "#ffffff",
      theme: THEME.LIGHT,
    } as any;

    renderElement(
      styled,
      renderableElementsMap,
      allElementsMap,
      rc,
      mainCanvas.getContext("2d")!,
      renderConfig,
      appState,
    );
    const cachedBefore = elementWithCanvasCache.get(styled);
    expect(cachedBefore).toBeDefined();
    expect(cachedBefore?.textRanges).toEqual(styled.textRanges);

    const updatedStyled = newElementWith(styled, {
      textRanges: [{ start: 6, end: 11, color: "#2f9e44" }],
    });
    renderElement(
      updatedStyled,
      renderableElementsMap,
      allElementsMap,
      rc,
      mainCanvas.getContext("2d")!,
      renderConfig,
      appState,
    );
    const cachedAfter = elementWithCanvasCache.get(updatedStyled);
    expect(cachedAfter?.textRanges).toEqual([
      { start: 6, end: 11, color: "#2f9e44" },
    ]);
    expect(cachedAfter?.canvas).not.toBe(cachedBefore?.canvas);
  });

  it("applies and reverses ElementsDelta for textRanges without leaving undefined own properties", () => {
    const baseText = newTextElement({
      x: 0,
      y: 0,
      text: "Hello world",
    }) as OrderedExcalidrawElement & ExcalidrawTextElement;
    expect("textRanges" in baseText).toBe(false);

    const styledText = newElementWith(baseText, {
      textRanges: [
        { start: 0, end: 5, color: "#e03131", highlightColor: "#ffec99" },
      ],
    }) as OrderedExcalidrawElement & ExcalidrawTextElement;

    const prevMap = toBrandedType<SceneElementsMap>(arrayToMap([baseText]));
    const nextMap = toBrandedType<SceneElementsMap>(arrayToMap([styledText]));

    const forwardDelta = ElementsDelta.calculate(prevMap, nextMap);
    expect(forwardDelta.isEmpty()).toBe(false);

    const [appliedForwardMap, forwardVisibleDiff] =
      forwardDelta.applyTo(prevMap);
    expect(forwardVisibleDiff).toBe(true);

    const forwardAppliedEl = appliedForwardMap.get(
      baseText.id,
    ) as ExcalidrawTextElement;
    expect(forwardAppliedEl.textRanges).toEqual([
      { start: 0, end: 5, color: "#e03131", highlightColor: "#ffec99" },
    ]);

    // Reverse delta (undo) back to unstyled state
    const reverseDelta = forwardDelta.inverse();

    const [appliedReverseMap, reverseVisibleDiff] =
      reverseDelta.applyTo(appliedForwardMap);
    expect(reverseVisibleDiff).toBe(true);

    const restoredEl = appliedReverseMap.get(
      styledText.id,
    ) as ExcalidrawTextElement;
    expect(restoredEl.textRanges).toBeUndefined();
    expect("textRanges" in restoredEl).toBe(false);
  });
});

describe("re-wrapping keeps styled runs on their words", () => {
  afterEach(() => {
    setCustomTextMetricsProvider(undefined);
  });

  const SENTENCE = "The quick brown fox jumps over the lazy dog today";
  const STYLED_WORD = "lazy";
  const STYLED_START = SENTENCE.indexOf(STYLED_WORD);
  const STYLED_END = STYLED_START + STYLED_WORD.length;
  const STYLED_COLOR = "#e03131";
  const STYLED_HIGHLIGHT = "#ffec99";

  const installFontAwareMetricsProvider = () => {
    setCustomTextMetricsProvider({
      getLineWidth(text: string, fontString: FontString) {
        const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(fontString);
        const fontSize = sizeMatch ? parseFloat(sizeMatch[1]) : 20;
        const factor = fontString.includes("Comic Shanns") ? 1.2 : 0.5;
        return text.length * fontSize * factor;
      },
    });
  };

  const createBoundStyledTextScene = () => {
    const baseContainer = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 320,
      height: 200,
    });
    const text = newTextElement({
      x: 10,
      y: 10,
      text: SENTENCE,
      originalText: SENTENCE,
      containerId: baseContainer.id,
      fontSize: 20,
      fontFamily: FONT_FAMILY.Excalifont,
      textRanges: [
        {
          start: STYLED_START,
          end: STYLED_END,
          color: STYLED_COLOR,
          highlightColor: STYLED_HIGHLIGHT,
        },
      ],
    });
    const container = newElementWith(baseContainer, {
      boundElements: [{ type: "text", id: text.id }],
    });
    const scene = new Scene(syncInvalidIndices([container, text]));
    redrawTextBoundingBox(
      scene.getElement<ExcalidrawTextElement>(text.id)!,
      scene.getElement<ExcalidrawElement>(container.id)!,
      scene,
    );
    return {
      scene,
      containerId: container.id,
      textId: text.id,
    };
  };

  const assertStyledWordAfterRewrap = (
    rewrappedText: ExcalidrawTextElement,
  ) => {
    expect(rewrappedText.originalText).toBe(SENTENCE);
    expect(rewrappedText.textRanges).toEqual([
      {
        start: STYLED_START,
        end: STYLED_END,
        color: STYLED_COLOR,
        highlightColor: STYLED_HIGHLIGHT,
      },
    ]);
    const range = rewrappedText.textRanges![0];
    expect(rewrappedText.originalText.slice(range.start, range.end)).toBe(
      STYLED_WORD,
    );

    const lines = rewrappedText.text.split("\n");
    const targetLineIdx = lines.findIndex((line) => line.includes(STYLED_WORD));
    expect(targetLineIdx).toBeGreaterThanOrEqual(0);

    const lineRuns = projectTextRangesToLines(
      rewrappedText.originalText,
      rewrappedText.text,
      rewrappedText.textRanges,
    );
    const matchingRun = lineRuns[targetLineIdx].find(
      (run) => run.text === STYLED_WORD,
    );
    expect(matchingRun).toEqual({
      text: STYLED_WORD,
      start: STYLED_START,
      end: STYLED_END,
      color: STYLED_COLOR,
      highlightColor: STYLED_HIGHLIGHT,
    });
  };

  it("preserves styled word run when container width is halved", () => {
    const { scene, containerId, textId } = createBoundStyledTextScene();
    const initialText = scene.getElement<ExcalidrawTextElement>(textId)!;
    const initialContainer = scene.getElement<ExcalidrawElement>(containerId)!;
    const initialLineCount = initialText.text.split("\n").length;

    scene.mutateElement(initialContainer, {
      width: initialContainer.width / 2,
    });
    const latestContainer = scene.getElement<ExcalidrawElement>(containerId)!;
    const latestText = scene.getElement<ExcalidrawTextElement>(textId)!;
    redrawTextBoundingBox(latestText, latestContainer, scene);

    const rewrappedText = scene.getElement<ExcalidrawTextElement>(textId)!;
    const nextLineCount = rewrappedText.text.split("\n").length;
    expect(nextLineCount).toBeGreaterThan(initialLineCount);

    assertStyledWordAfterRewrap(rewrappedText);
  });

  it("preserves styled word run when fontSize increases and forces re-wrap", () => {
    installFontAwareMetricsProvider();
    const { scene, containerId, textId } = createBoundStyledTextScene();
    const initialText = scene.getElement<ExcalidrawTextElement>(textId)!;
    const initialLineCount = initialText.text.split("\n").length;

    scene.mutateElement(initialText, {
      fontSize: initialText.fontSize * 2,
    });
    const latestContainer = scene.getElement<ExcalidrawElement>(containerId)!;
    const latestText = scene.getElement<ExcalidrawTextElement>(textId)!;
    redrawTextBoundingBox(latestText, latestContainer, scene);

    const rewrappedText = scene.getElement<ExcalidrawTextElement>(textId)!;
    const nextLineCount = rewrappedText.text.split("\n").length;
    expect(nextLineCount).toBeGreaterThan(initialLineCount);

    assertStyledWordAfterRewrap(rewrappedText);
  });

  it("preserves styled word run when fontFamily changes to a wider font and forces re-wrap", () => {
    installFontAwareMetricsProvider();
    const { scene, containerId, textId } = createBoundStyledTextScene();
    const initialText = scene.getElement<ExcalidrawTextElement>(textId)!;
    const initialLineCount = initialText.text.split("\n").length;

    scene.mutateElement(initialText, {
      fontFamily: FONT_FAMILY["Comic Shanns"],
    });
    const latestContainer = scene.getElement<ExcalidrawElement>(containerId)!;
    const latestText = scene.getElement<ExcalidrawTextElement>(textId)!;
    redrawTextBoundingBox(latestText, latestContainer, scene);

    const rewrappedText = scene.getElement<ExcalidrawTextElement>(textId)!;
    const nextLineCount = rewrappedText.text.split("\n").length;
    expect(nextLineCount).toBeGreaterThan(initialLineCount);

    assertStyledWordAfterRewrap(rewrappedText);
  });
});
