import { applyDarkModeFilter } from "@excalidraw/common";

import type { TextStyleRun } from "@excalidraw/element";

export const PREVIEW_CLASS_NAME = "excalidraw-wysiwyg-preview";

export type TextPreview = {
  update: (args: {
    runs: readonly TextStyleRun[];
    baseColor: string;
    isDark: boolean;
  }) => void;
  syncScroll: () => void;
  destroy: () => void;
};

const MIRRORED_STYLE_KEYS = [
  "position",
  "display",
  "minHeight",
  "margin",
  "padding",
  "border",
  "zIndex",
  "wordBreak",
  "whiteSpace",
  "overflowWrap",
  "boxSizing",
  "backfaceVisibility",
  "font",
  "fontFamily",
  "lineHeight",
  "width",
  "height",
  "left",
  "top",
  "transformOrigin",
  "transform",
  "textAlign",
  "verticalAlign",
  "opacity",
] as const;

export const createTextPreview = (args: {
  editable: HTMLTextAreaElement;
  parent: HTMLElement | null;
}): TextPreview => {
  const { editable, parent } = args;
  const ownerDocument = editable.ownerDocument;

  let node: HTMLDivElement | null = null;
  let lastKey: string | null = null;

  const syncScroll = () => {
    if (node) {
      node.scrollTop = editable.scrollTop;
      node.scrollLeft = editable.scrollLeft;
    }
  };

  const destroy = () => {
    if (node) {
      node.remove();
      node = null;
    }
    lastKey = null;
  };

  const update = ({
    runs,
    baseColor,
    isDark,
  }: {
    runs: readonly TextStyleRun[];
    baseColor: string;
    isDark: boolean;
  }) => {
    if (runs.length === 0) {
      if (node) {
        node.remove();
      }
      editable.style.removeProperty("caret-color");
      lastKey = null;
      return;
    }

    if (!node) {
      node = ownerDocument.createElement("div");
      node.className = PREVIEW_CLASS_NAME;
      node.setAttribute("aria-hidden", "true");
      node.dir = "auto";
      node.style.pointerEvents = "none";
      node.style.userSelect = "none";
      node.style.overflow = "hidden";
      node.style.background = "transparent";
      node.style.unicodeBidi = "plaintext";
    }

    for (const key of MIRRORED_STYLE_KEYS) {
      node.style[key] = editable.style[key];
    }

    node.style.color = baseColor;
    editable.style.caretColor = baseColor;
    editable.style.color = "transparent";

    const key = JSON.stringify([editable.value, runs, isDark]);
    if (key !== lastKey) {
      lastKey = key;
      node.replaceChildren();

      const text = editable.value;
      let currentIndex = 0;

      for (const run of runs) {
        const runStart = Math.max(0, Math.min(run.start, text.length));
        const runEnd = Math.max(0, Math.min(run.end, text.length));

        if (runStart > currentIndex) {
          node.appendChild(
            ownerDocument.createTextNode(text.slice(currentIndex, runStart)),
          );
        }

        if (runEnd > runStart) {
          const span = ownerDocument.createElement("span");
          span.textContent = text.slice(runStart, runEnd);

          if (run.color) {
            span.style.color = applyDarkModeFilter(run.color, isDark);
          }
          if (run.highlight) {
            span.style.backgroundColor = applyDarkModeFilter(
              run.highlight,
              isDark,
            );
          }

          node.appendChild(span);
        }

        currentIndex = Math.max(currentIndex, runEnd);
      }

      if (currentIndex < text.length) {
        node.appendChild(
          ownerDocument.createTextNode(text.slice(currentIndex)),
        );
      }
    }

    if (!node.parentNode && parent) {
      parent.insertBefore(
        node,
        editable.parentNode === parent ? editable : null,
      );
    }

    syncScroll();
  };

  return {
    update,
    syncScroll,
    destroy,
  };
};
