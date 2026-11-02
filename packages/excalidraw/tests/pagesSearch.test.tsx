import React from "react";

import { CLASSES, KEYS } from "@excalidraw/common";
import { deletePage, getDefaultPage, newPage } from "@excalidraw/element";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { updateTextEditor } from "./queries/dom";
import { fireEvent, render, waitFor } from "./test-utils";

const { h } = window;

const SECOND_PAGE_NAME = "Second page";

const openSearch = async (query: string) => {
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    Keyboard.keyPress(KEYS.F);
  });

  const input =
    h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
      `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
    )!;
  await waitFor(() => expect(input).not.toBeNull());

  updateTextEditor(input, query);
};

const getMatchedIds = () =>
  h.app.state.searchMatches?.matches.map((match) => match.id) ?? [];

const getPreviewPages = () =>
  Array.from(document.querySelectorAll<HTMLElement>(".preview-page"));

const setupTwoPages = () => {
  const defaultPage = getDefaultPage();
  const secondPage = newPage([defaultPage], SECOND_PAGE_NAME);
  const pages = [defaultPage, secondPage];

  const textOne = API.createElement({ type: "text", text: "alpha one" });
  const textTwo = {
    ...API.createElement({ type: "text", text: "alpha two" }),
    pageId: secondPage.id,
  };
  const frame = {
    ...API.createElement({ type: "frame" }),
    name: "alpha frame",
    pageId: secondPage.id,
  };

  h.app.updateScene({ elements: [textOne, textTwo, frame], pages });

  return { pages, secondPage, textOne, textTwo, frame };
};

describe("search across pages", () => {
  beforeEach(async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    await render(<Excalidraw handleKeyboardGlobally />);
    API.setAppState({
      openSidebar: null,
    });
  });

  it("finds matches on every page", async () => {
    const { textOne, textTwo, frame } = setupTwoPages();

    await openSearch("alpha");

    await waitFor(() => {
      expect(getMatchedIds().sort()).toEqual(
        [textOne.id, textTwo.id, frame.id].sort(),
      );
    });
  });

  it("shows page names", async () => {
    setupTwoPages();

    await openSearch("alpha");

    await waitFor(() => {
      const names = getPreviewPages().map((node) => node.textContent);
      expect(names).toHaveLength(3);
      expect(new Set(names)).toEqual(
        new Set([getDefaultPage().name, SECOND_PAGE_NAME]),
      );
    });
  });

  it("one page shows no page name", async () => {
    API.setElements([API.createElement({ type: "text", text: "alpha one" })]);

    await openSearch("alpha");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(1);
    });
    expect(getPreviewPages()).toHaveLength(0);
  });

  it("activating a match switches page", async () => {
    const { secondPage } = setupTwoPages();
    expect(h.app.state.activePageId).toBe(getDefaultPage().id);

    await openSearch("alpha two");

    await waitFor(() => {
      expect(getPreviewPages()).toHaveLength(1);
    });

    fireEvent.click(getPreviewPages()[0]);

    await waitFor(() => {
      expect(h.app.state.activePageId).toBe(secondPage.id);
    });
  });

  it("re-search after switching pages doesn't pull back to the match page", async () => {
    const { secondPage } = setupTwoPages();
    const firstPageId = getDefaultPage().id;

    await openSearch("alpha two");

    await waitFor(() => {
      expect(getPreviewPages()).toHaveLength(1);
    });

    fireEvent.click(getPreviewPages()[0]);

    await waitFor(() => {
      expect(h.app.state.activePageId).toBe(secondPage.id);
    });

    const matchesBefore = h.app.state.searchMatches;

    const firstTab = Array.from(
      document.querySelectorAll<HTMLElement>('[role="tab"]'),
    ).find((tab) => tab.textContent?.includes(getDefaultPage().name))!;
    expect(firstTab).toBeDefined();

    fireEvent.click(firstTab);

    await waitFor(() => {
      expect(h.app.state.activePageId).toBe(firstPageId);
    });

    // wait for the debounced re-search to replace the matches
    await waitFor(() => {
      expect(h.app.state.searchMatches).not.toBe(matchesBefore);
    });

    expect(h.app.state.activePageId).toBe(firstPageId);
  });

  it("deleted pages aren't searched", async () => {
    const { pages, secondPage, textOne, textTwo, frame } = setupTwoPages();

    h.app.updateScene({
      elements: [
        textOne,
        { ...textTwo, isDeleted: true },
        { ...frame, isDeleted: true },
      ],
      pages: deletePage(pages, secondPage.id),
    });

    await openSearch("alpha");

    await waitFor(() => {
      expect(getMatchedIds()).toEqual([textOne.id]);
    });
  });
});
