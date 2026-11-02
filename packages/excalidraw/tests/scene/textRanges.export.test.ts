import { applyDarkModeFilter } from "@excalidraw/common";
import { newElementWith } from "@excalidraw/element";
import { applyTextRangeStyle } from "@excalidraw/element/textRanges";

import type {
  ExcalidrawTextElement,
  ExcalidrawTextRanges,
  NonDeleted,
} from "@excalidraw/element/types";

import { exportScene } from "../../scene/export";
import { API } from "../helpers/api";

describe("text ranges export tests", () => {
  const T = "Bid request timeout 120ms";
  const RED = "#e03131";
  const YELLOW = "#ffec99";

  const createTextElement = (
    overrides?: Partial<ExcalidrawTextElement>,
    textRanges?: ExcalidrawTextRanges,
  ): NonDeleted<ExcalidrawTextElement> => {
    const base = API.createElement({
      type: "text",
      text: T,
      ...overrides,
    }) as ExcalidrawTextElement;
    const withIndex = {
      ...base,
      index: "a0" as const,
    } as unknown as NonDeleted<ExcalidrawTextElement>;
    return (textRanges
      ? newElementWith(withIndex, { textRanges })
      : withIndex) as unknown as NonDeleted<ExcalidrawTextElement>;
  };

  const getCanvasEvents = (canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d") as any;
    const rawEvents = context.__getEvents();
    const relevant: Array<{ type: string; props: any }> = [];
    for (const ev of rawEvents) {
      if (
        ev.type === "fillStyle" ||
        ev.type === "fillText" ||
        ev.type === "fillRect"
      ) {
        relevant.push(ev);
      }
    }
    return relevant;
  };

  const getColorOfEvent = (
    events: Array<{ type: string; props: any }>,
    targetEvent: { type: string; props: any },
  ) => {
    let lastColor: string | null = null;
    for (const ev of events) {
      if (ev.type === "fillStyle") {
        lastColor = ev.props.value;
      }
      if (ev === targetEvent) {
        return lastColor;
      }
    }
    return lastColor;
  };

  test("a coloured range exports a tspan with its fill", async () => {
    const raw = createTextElement();
    const ranges = applyTextRangeStyle(
      raw,
      { start: 20, end: 25 },
      { color: RED },
    );
    const element = createTextElement({}, ranges);

    const svg = await exportScene({
      type: "svg",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const textNodes = svg.querySelectorAll("text");
    expect(textNodes.length).toBe(1);
    expect(textNodes[0].textContent).toBe(T);

    const tspans = svg.querySelectorAll("tspan");
    expect(tspans.length).toBe(1);
    expect(tspans[0].getAttribute("fill")).toBe(RED);
    expect(tspans[0].textContent).toBe("120ms");
  });

  test("dark mode filters the tspan fill", async () => {
    const raw = createTextElement();
    const ranges = applyTextRangeStyle(
      raw,
      { start: 20, end: 25 },
      { color: RED },
    );
    const element = createTextElement({}, ranges);

    const svg = await exportScene({
      type: "svg",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false, theme: "dark" },
    });

    const tspans = svg.querySelectorAll("tspan");
    expect(tspans.length).toBe(1);
    expect(tspans[0].getAttribute("fill")).toBe(applyDarkModeFilter(RED, true));
  });

  test("tspans land on the right lines", async () => {
    const raw = createTextElement({
      text: "Bid request\ntimeout 120ms",
      originalText: T,
    });
    const ranges = applyTextRangeStyle(
      raw,
      { start: 20, end: 25 },
      { color: RED },
    );
    const element = createTextElement(
      { text: "Bid request\ntimeout 120ms", originalText: T },
      ranges,
    );

    const svg = await exportScene({
      type: "svg",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const textNodes = svg.querySelectorAll("text");
    expect(textNodes.length).toBe(2);

    expect(textNodes[0].querySelectorAll("tspan").length).toBe(0);
    const tspansSecond = textNodes[1].querySelectorAll("tspan");
    expect(tspansSecond.length).toBe(1);
    expect(tspansSecond[0].textContent).toBe("120ms");
    expect(tspansSecond[0].getAttribute("fill")).toBe(RED);
  });

  test("a highlight is a rect before its text", async () => {
    const raw = createTextElement();
    const ranges = applyTextRangeStyle(
      raw,
      { start: 20, end: 25 },
      { highlight: YELLOW },
    );
    const element = createTextElement({}, ranges);

    const svg = await exportScene({
      type: "svg",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const rects = svg.querySelectorAll("rect");
    expect(rects.length).toBe(1);
    const rect = rects[0];
    expect(rect.getAttribute("fill")).toBe(YELLOW);
    expect(Number(rect.getAttribute("x"))).toBe(200);
    expect(Number(rect.getAttribute("width"))).toBe(50);
    expect(Number(rect.getAttribute("height"))).toBe(
      element.fontSize * element.lineHeight,
    );

    const text = svg.querySelector("text")!;
    expect(
      rect.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("highlight rects follow textAlign", async () => {
    const rawCenter = createTextElement({ width: 400, textAlign: "center" });
    const rangesCenter = applyTextRangeStyle(
      rawCenter,
      { start: 20, end: 25 },
      { highlight: YELLOW },
    );
    const elementCenter = createTextElement(
      { width: 400, textAlign: "center" },
      rangesCenter,
    );

    const svgCenter = await exportScene({
      type: "svg",
      data: {
        elements: [elementCenter],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const rectCenter = svgCenter.querySelector("rect")!;
    expect(Number(rectCenter.getAttribute("x"))).toBe(275);
    const textCenter = svgCenter.querySelector("text")!;
    expect(textCenter.getAttribute("text-anchor")).toBe("middle");

    const rawRight = createTextElement({ width: 400, textAlign: "right" });
    const rangesRight = applyTextRangeStyle(
      rawRight,
      { start: 20, end: 25 },
      { highlight: YELLOW },
    );
    const elementRight = createTextElement(
      { width: 400, textAlign: "right" },
      rangesRight,
    );

    const svgRight = await exportScene({
      type: "svg",
      data: {
        elements: [elementRight],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const rectRight = svgRight.querySelector("rect")!;
    expect(Number(rectRight.getAttribute("x"))).toBe(350);
    const textRight = svgRight.querySelector("text")!;
    expect(textRight.getAttribute("text-anchor")).toBe("end");
  });

  test("a highlight follows rtl right-aligned text", async () => {
    const rtlText = "אבג דה";
    const raw = createTextElement({
      text: rtlText,
      originalText: rtlText,
      textAlign: "right",
      width: 400,
    });
    const ranges = applyTextRangeStyle(
      raw,
      { start: 3, end: 6 },
      { highlight: YELLOW },
    );
    const element = createTextElement(
      {
        text: rtlText,
        originalText: rtlText,
        textAlign: "right",
        width: 400,
      },
      ranges,
    );

    const svg = await exportScene({
      type: "svg",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const rect = svg.querySelector("rect")!;
    expect(Number(rect.getAttribute("x"))).toBe(400);
    expect(Number(rect.getAttribute("width"))).toBe(30);
  });

  test("a rect inherits element opacity", async () => {
    const raw = createTextElement({ opacity: 50 });
    const ranges = applyTextRangeStyle(
      raw,
      { start: 20, end: 25 },
      { highlight: YELLOW },
    );
    const element = createTextElement({ opacity: 50 }, ranges);

    const svg = await exportScene({
      type: "svg",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const rect = svg.querySelector("rect")!;
    const parentG = rect.closest("g");
    expect(parentG).not.toBeNull();
    expect(
      parentG?.getAttribute("fill-opacity") || parentG?.getAttribute("opacity"),
    ).toBe("0.5");
  });

  test("a colour only passes through as an attribute", async () => {
    const element = createTextElement({}, {
      textHash: 12345,
      ranges: [
        {
          id: "bad",
          start: 20,
          end: 25,
          z: 1,
          color: '"><script>alert(1)</script><tspan fill="red',
        },
      ],
    } as any);

    const svg = await exportScene({
      type: "svg",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    expect(svg.querySelectorAll("script").length).toBe(0);
    expect(svg.querySelectorAll("tspan").length).toBe(0);
  });

  test("a text with no ranges exports as today", async () => {
    const element = createTextElement();

    const svg = await exportScene({
      type: "svg",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    expect(svg.querySelectorAll("tspan").length).toBe(0);
    expect(svg.querySelectorAll("rect").length).toBe(0);
    const textNode = svg.querySelector("text")!;
    expect(textNode.textContent).toBe(T);
  });

  test("fully cleared ranges export like no ranges", async () => {
    const unstyled = createTextElement();
    const styled = applyTextRangeStyle(
      unstyled,
      { start: 20, end: 25 },
      { color: RED },
    );
    const cleared = applyTextRangeStyle(
      { ...unstyled, textRanges: styled },
      { start: 20, end: 25 },
      { color: null, highlight: null },
    );
    const clearedElement = createTextElement({}, cleared);

    const svgUnstyled = await exportScene({
      type: "svg",
      data: {
        elements: [unstyled],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const svgCleared = await exportScene({
      type: "svg",
      data: {
        elements: [clearedElement],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const textUnstyled = svgUnstyled.querySelector("text")!;
    const textCleared = svgCleared.querySelector("text")!;
    expect(textCleared.outerHTML).toBe(textUnstyled.outerHTML);
  });

  test("canvas draws runs in their own colours", async () => {
    const raw = createTextElement();
    const ranges = applyTextRangeStyle(
      raw,
      { start: 20, end: 25 },
      { color: RED },
    );
    const element = createTextElement({}, ranges);

    const canvas = await exportScene({
      type: "canvas",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const events = getCanvasEvents(canvas);
    const textEvents = events.filter((e) => e.type === "fillText");
    expect(textEvents.length).toBe(2);

    expect(textEvents[0].props.text).toBe("Bid request timeout ");
    expect(textEvents[0].props.x).toBe(0);

    expect(textEvents[1].props.text).toBe("120ms");
    expect(textEvents[1].props.x).toBe(200);
    expect(getColorOfEvent(events, textEvents[1])).toBe(RED);
  });

  test("canvas draws highlights before text", async () => {
    const raw = createTextElement();
    const ranges = applyTextRangeStyle(
      raw,
      { start: 20, end: 25 },
      { highlight: YELLOW },
    );
    const element = createTextElement({}, ranges);

    const canvas = await exportScene({
      type: "canvas",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const events = getCanvasEvents(canvas);
    const fillRects = events.filter((e) => e.type === "fillRect");
    const fillTexts = events.filter((e) => e.type === "fillText");

    expect(fillRects.length).toBeGreaterThanOrEqual(1);
    const targetRect = fillRects.find(
      (e) => e.props.x === 200 && e.props.width === 50,
    );
    expect(targetRect).toBeDefined();
    expect(getColorOfEvent(events, targetRect!)).toBe(YELLOW);

    const rectIndex = events.indexOf(targetRect!);
    for (const textEv of fillTexts) {
      expect(rectIndex).toBeLessThan(events.indexOf(textEv));
    }
  });

  test("canvas runs follow textAlign", async () => {
    const rawCenter = createTextElement({ width: 400, textAlign: "center" });
    const rangesCenter = applyTextRangeStyle(
      rawCenter,
      { start: 20, end: 25 },
      { color: RED },
    );
    const elementCenter = createTextElement(
      { width: 400, textAlign: "center" },
      rangesCenter,
    );

    const canvasCenter = await exportScene({
      type: "canvas",
      data: {
        elements: [elementCenter],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const eventsCenter = getCanvasEvents(canvasCenter);
    const text120Center = eventsCenter.find(
      (e) => e.type === "fillText" && e.props.text === "120ms",
    );
    expect(text120Center?.props.x).toBe(275);

    const rawRight = createTextElement({ width: 400, textAlign: "right" });
    const rangesRight = applyTextRangeStyle(
      rawRight,
      { start: 20, end: 25 },
      { color: RED },
    );
    const elementRight = createTextElement(
      { width: 400, textAlign: "right" },
      rangesRight,
    );

    const canvasRight = await exportScene({
      type: "canvas",
      data: {
        elements: [elementRight],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const eventsRight = getCanvasEvents(canvasRight);
    const text120Right = eventsRight.find(
      (e) => e.type === "fillText" && e.props.text === "120ms",
    );
    expect(text120Right?.props.x).toBe(350);
  });

  test("canvas lines keep their baseline", async () => {
    const textTwoLines = "Bid request\ntimeout 120ms";
    const raw = createTextElement({
      text: textTwoLines,
      originalText: T,
    });
    const ranges = applyTextRangeStyle(
      raw,
      { start: 20, end: 25 },
      { color: RED },
    );
    const element = createTextElement(
      { text: textTwoLines, originalText: T },
      ranges,
    );

    const canvas = await exportScene({
      type: "canvas",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const events = getCanvasEvents(canvas);
    const fillTexts = events.filter((e) => e.type === "fillText");
    const line1 = fillTexts.find((e) => e.props.text === "Bid request");
    const line2 = fillTexts.find((e) => e.props.text === "120ms");

    expect(line1).toBeDefined();
    expect(line2).toBeDefined();
    expect(line2!.props.y - line1!.props.y).toBe(
      element.fontSize * element.lineHeight,
    );
  });

  test("canvas theme applies to range colours", async () => {
    const raw = createTextElement();
    const ranges = applyTextRangeStyle(
      raw,
      { start: 20, end: 25 },
      { color: RED },
    );
    const element = createTextElement({}, ranges);

    const canvas = await exportScene({
      type: "canvas",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false, theme: "dark" },
    });

    const events = getCanvasEvents(canvas);
    const text120 = events.find(
      (e) => e.type === "fillText" && e.props.text === "120ms",
    );
    expect(text120).toBeDefined();
    expect(getColorOfEvent(events, text120!)).toBe(
      applyDarkModeFilter(RED, true),
    );
  });

  test("canvas right-to-left runs", async () => {
    const rtlText = "אבג דה";
    const raw = createTextElement({
      text: rtlText,
      originalText: rtlText,
    });
    const ranges = applyTextRangeStyle(
      raw,
      { start: 3, end: 6 },
      { color: RED },
    );
    const element = createTextElement(
      { text: rtlText, originalText: rtlText },
      ranges,
    );

    const canvas = await exportScene({
      type: "canvas",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const events = getCanvasEvents(canvas);
    const fillTexts = events.filter((e) => e.type === "fillText");
    const run1 = fillTexts.find((e) => e.props.text === " דה");
    const run2 = fillTexts.find((e) => e.props.text === "אבג");

    expect(run1).toBeDefined();
    expect(run2).toBeDefined();
    expect(run1!.props.x).toBe(0);
    expect(run2!.props.x).toBe(30);
  });

  test("a text with no ranges makes one fillText per line", async () => {
    const element = createTextElement();

    const canvas = await exportScene({
      type: "canvas",
      data: {
        elements: [element],
        appState: { viewBackgroundColor: "#ffffff" },
        files: null,
      },
      config: { canvasBackgroundColor: false },
    });

    const events = getCanvasEvents(canvas);
    const fillTexts = events.filter((e) => e.type === "fillText");
    expect(fillTexts.length).toBe(1);
    expect(fillTexts[0].props.text).toBe(T);
  });

  test("an unstyled line after an rtl piece is drawn in the element direction", async () => {
    // First line Hebrew with a Latin word at the end, so the last piece of line 1 has direction "ltr".
    // Second line plain English with no range.
    // Third line Hebrew plain, ensuring isRTL(element.text) is true so element direction is "rtl".
    const mixedText = "שלום world\nPlain English line\nעוד שורה";
    const raw = createTextElement({
      text: mixedText,
      originalText: mixedText,
    });
    // Color "world" on line 1 (start 5, end 10)
    const ranges = applyTextRangeStyle(
      raw,
      { start: 5, end: 10 },
      { color: RED },
    );
    const element = createTextElement(
      { text: mixedText, originalText: mixedText },
      ranges,
    );

    const capturedDirections: Array<{ text: string; direction: string }> = [];
    const spy = vi
      .spyOn(CanvasRenderingContext2D.prototype, "fillText")
      .mockImplementation(function (
        this: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
      ) {
        capturedDirections.push({
          text: String(text),
          direction: this.direction,
        });
      });

    try {
      await exportScene({
        type: "canvas",
        data: {
          elements: [element],
          appState: { viewBackgroundColor: "#ffffff" },
          files: null,
        },
        config: { canvasBackgroundColor: false },
      });

      const englishCall = capturedDirections.find(
        (call) => call.text === "Plain English line",
      );
      expect(englishCall).toBeDefined();
      expect(englishCall!.direction).toBe("rtl");
    } finally {
      spy.mockRestore();
    }
  });
});
