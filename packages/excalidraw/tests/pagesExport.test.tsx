import React from "react";

import { getDefaultPage, newPage } from "@excalidraw/element";

import type { FractionalIndex } from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import { exportCanvas, prepareElementsForExport } from "../data";
import * as filesystemModule from "../data/filesystem";
import * as imageModule from "../data/image";
import { Excalidraw } from "../index";
import { decodeSvgBase64Payload, exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { render } from "./test-utils";

import type { ExportedElements } from "../data";
import type { AppState } from "../types";

const { h } = window;

// tiny polyfill for TextDecoder.decode on which we depend
Object.defineProperty(window, "TextDecoder", {
  value: class TextDecoder {
    decode(ab: ArrayBuffer) {
      return new Uint8Array(ab).reduce(
        (acc, c) => acc + String.fromCharCode(c),
        "",
      );
    }
  },
});

const ACTIVE_COLOR = "#ff0001";
const OTHER_COLOR = "#ff0002";

const defaultPage = getDefaultPage();
const otherPage = newPage([defaultPage], "Page 2");
const pages = [defaultPage, otherPage];

const createRectangle = (id: string, strokeColor: string, pageId?: string) => ({
  ...API.createElement({
    type: "rectangle",
    id,
    strokeColor,
    width: 100,
    height: 100,
    // indices may repeat across pages
    index: "a0" as FractionalIndex,
  }),
  ...(pageId ? { pageId } : {}),
});

// the default page's elements carry no pageId
const activeElements = [
  createRectangle("active_1", ACTIVE_COLOR),
  createRectangle("active_2", ACTIVE_COLOR),
];
const otherElements = [createRectangle("other_1", OTHER_COLOR, otherPage.id)];
const allElements = [...activeElements, ...otherElements];

const getPagedAppState = () => ({
  ...getDefaultAppState(),
  pages,
  activePageId: defaultPage.id,
  pageViewports: {},
});

describe("export of paged drawings", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("image export holds only the active page's elements", async () => {
    const svg = await exportScene({
      type: "svg",
      data: {
        elements: allElements,
        appState: getPagedAppState(),
        files: {},
      },
      config: { canvasBackgroundColor: false },
    });
    const svgText = svg.outerHTML;

    expect(svgText).toContain(ACTIVE_COLOR);
    expect(svgText).not.toContain(OTHER_COLOR);
  });

  it("embedded SVG scene holds one page and only its elements", async () => {
    const svg = await exportScene({
      type: "svg",
      data: {
        elements: allElements,
        appState: getPagedAppState(),
        files: {},
      },
      config: { embedScene: true },
    });

    const decoded = JSON.parse(decodeSvgBase64Payload({ svg: svg.outerHTML }));

    expect(decoded.appState.pages).toHaveLength(1);
    expect(decoded.appState.pages[0].id).toBe(defaultPage.id);
    expect(
      decoded.elements.map((element: { id: string }) => element.id),
    ).toEqual(["active_1", "active_2"]);
  });

  it("embedded PNG scene holds one page and only its elements", async () => {
    const encodeSpy = vi
      .spyOn(imageModule, "encodePngMetadata")
      .mockImplementation(async ({ blob }) => blob);
    const saveSpy = vi
      .spyOn(filesystemModule, "fileSave")
      .mockResolvedValue(null as any);

    await exportCanvas(
      "png",
      allElements as unknown as ExportedElements,
      { ...getPagedAppState(), exportEmbedScene: true } as unknown as AppState,
      {},
      { exportingFrame: null, name: "test" },
    );

    // exportCanvas hands fileSave a promise of the blob; encoding runs inside it
    await saveSpy.mock.lastCall![0];

    expect(encodeSpy).toHaveBeenCalledTimes(1);
    const metadata = JSON.parse(encodeSpy.mock.lastCall![0].metadata);

    expect(metadata.appState.pages).toHaveLength(1);
    expect(metadata.appState.pages[0].id).toBe(defaultPage.id);
    expect(
      metadata.elements.map((element: { id: string }) => element.id),
    ).toEqual(["active_1", "active_2"]);

    encodeSpy.mockRestore();
    saveSpy.mockRestore();
  });

  it("exports every element when no page is named", async () => {
    const svg = await exportScene({
      type: "svg",
      data: {
        elements: allElements,
        files: {},
      },
      config: { canvasBackgroundColor: false },
    });
    const svgText = svg.outerHTML;

    expect(svgText).toContain(ACTIVE_COLOR);
    expect(svgText).toContain(OTHER_COLOR);
  });

  it("exports only the selected elements of the active page", () => {
    const appState = {
      ...h.state,
      ...getPagedAppState(),
      selectedElementIds: { active_1: true as const },
    };

    const { exportedElements } = prepareElementsForExport(
      allElements,
      appState,
      true,
    );

    expect(exportedElements.map((element) => element.id)).toEqual(["active_1"]);
  });
});
