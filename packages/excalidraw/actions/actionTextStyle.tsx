import { COLOR_PALETTE, arrayToMap, isTransparent } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  applyTextStyleToRange,
  getBoundTextElement,
  getTextStyleOfRange,
  isTextElement,
  newElementWith,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  TextStyleProperty,
} from "@excalidraw/element/types";

import { RadioSelection } from "../components/RadioSelection";
import { t } from "../i18n";
import { getSelectedElements } from "../scene";

import { register } from "./register";

import type { AppClassProperties, AppState, UIAppState } from "../types";

/**
 * The part of the text being edited that's selected in the editor, to style
 * on its own — null if no text is being edited, or nothing in it selected
 * (just the caret), or all of it (as when the editor opens): then the text
 * is styled as a whole.
 */
export const getEditingTextSelection = (
  elements: readonly ExcalidrawElement[],
  appState: Pick<AppState, "editingTextElement">,
  app: Pick<AppClassProperties, "text">,
): { element: ExcalidrawTextElement; start: number; end: number } | null => {
  const editingId = appState.editingTextElement?.id;
  if (!editingId) {
    return null;
  }
  const element = elements.find((element) => element.id === editingId);
  const selection = app.text.getTextEditorSelection();
  if (
    !element ||
    !isTextElement(element) ||
    element.isDeleted ||
    !selection ||
    selection.start === selection.end
  ) {
    return null;
  }
  const length = element.originalText.length;
  const start = Math.min(selection.start, length);
  const end = Math.min(selection.end, length);
  return start < end && end - start < length ? { element, start, end } : null;
};

/**
 * Styles the part of the edited text that's selected in the editor (see
 * `getEditingTextSelection`). `null` (or transparent) clears the property
 * over it, as does the text's own color for `strokeColor`.
 */
export const styleEditingTextSelection = (
  elements: readonly ExcalidrawElement[],
  selection: NonNullable<ReturnType<typeof getEditingTextSelection>>,
  property: TextStyleProperty,
  color: string | null,
): readonly ExcalidrawElement[] => {
  const { element, start, end } = selection;
  const value =
    !color ||
    isTransparent(color) ||
    (property === "strokeColor" && color === element.strokeColor)
      ? null
      : color;
  const styleRanges = applyTextStyleToRange(
    element.styleRanges,
    start,
    end,
    { [property]: value },
    element.originalText.length,
  );
  if (styleRanges === element.styleRanges) {
    return elements;
  }
  return elements.map((el) =>
    el.id === element.id ? newElementWith(element, { styleRanges }) : el,
  );
};

/**
 * The text elements a highlight applies to as a whole: the selected texts
 * and labels, or the text being edited.
 */
const getHighlightTargets = (
  elements: readonly ExcalidrawElement[],
  appState: AppState | UIAppState,
): ExcalidrawTextElement[] => {
  const elementsMap = arrayToMap(elements);
  const targets = new Map<string, ExcalidrawTextElement>();
  for (const element of getSelectedElements(elements, appState, {
    includeBoundTextElement: true,
  })) {
    const text = isTextElement(element)
      ? element
      : getBoundTextElement(element, elementsMap);
    if (text && !text.isDeleted) {
      targets.set(text.id, text);
    }
  }
  const editing =
    appState.editingTextElement &&
    elementsMap.get(appState.editingTextElement.id);
  if (editing && isTextElement(editing) && !editing.isDeleted) {
    targets.set(editing.id, editing);
  }
  return [...targets.values()];
};

export const TEXT_HIGHLIGHT_COLORS = [
  COLOR_PALETTE.yellow[1],
  COLOR_PALETTE.green[1],
  COLOR_PALETTE.blue[1],
  COLOR_PALETTE.red[1],
  COLOR_PALETTE.violet[1],
] as const;

const NO_HIGHLIGHT = COLOR_PALETTE.transparent;

const HighlightSwatch = ({ color }: { color: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" width="20" height="20">
    {isTransparent(color) ? (
      <>
        <rect
          x="2.5"
          y="2.5"
          width="15"
          height="15"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <path d="M4 16L16 4" stroke="currentColor" strokeWidth="1.25" />
      </>
    ) : (
      <rect
        x="2.5"
        y="2.5"
        width="15"
        height="15"
        rx="3"
        fill={color}
        stroke="currentColor"
        strokeOpacity="0.25"
      />
    )}
  </svg>
);

/**
 * Highlights text: the part selected in the editor while editing, else all
 * of the edited or selected texts.
 */
export const actionChangeTextHighlight = register<string | null>({
  name: "changeTextHighlight",
  label: "labels.textHighlight",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    const color = value && !isTransparent(value) ? value : null;
    const selection = getEditingTextSelection(elements, appState, app);
    if (selection) {
      return {
        elements: styleEditingTextSelection(
          elements,
          selection,
          "backgroundColor",
          color,
        ),
        appState,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    const targets = new Set(
      getHighlightTargets(elements, appState).map((element) => element.id),
    );
    return {
      elements: elements.map((element) => {
        if (!targets.has(element.id) || !isTextElement(element)) {
          return element;
        }
        const styleRanges = applyTextStyleToRange(
          element.styleRanges,
          0,
          element.originalText.length,
          { backgroundColor: color },
          element.originalText.length,
        );
        return styleRanges === element.styleRanges
          ? element
          : newElementWith(element, { styleRanges });
      }),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const selection = getEditingTextSelection(elements, appState, app);
    const targets = selection
      ? [selection]
      : getHighlightTargets(elements, appState).map((element) => ({
          element,
          start: 0,
          end: element.originalText.length,
        }));
    const values = new Set(
      targets.map(({ element, start, end }) =>
        getTextStyleOfRange(element.styleRanges, start, end, "backgroundColor"),
      ),
    );
    const [only] = values;
    const value =
      values.size === 1 && only !== undefined ? only ?? NO_HIGHLIGHT : null;

    return (
      <fieldset>
        <legend>{t("labels.textHighlight")}</legend>
        <div className="buttonList">
          <RadioSelection<string>
            group="text-highlight"
            options={[NO_HIGHLIGHT, ...TEXT_HIGHLIGHT_COLORS].map((color) => ({
              value: color,
              text:
                color === NO_HIGHLIGHT
                  ? t("labels.noTextHighlight")
                  : `${t("labels.textHighlight")} ${color}`,
              icon: <HighlightSwatch color={color} />,
              testId: `text-highlight-${
                color === NO_HIGHLIGHT ? "none" : color
              }`,
            }))}
            value={value}
            onChange={(color) => updateData(color)}
          />
        </div>
      </fieldset>
    );
  },
});
