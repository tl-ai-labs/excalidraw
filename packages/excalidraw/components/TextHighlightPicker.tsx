import clsx from "clsx";
import React, { useCallback, useSyncExternalStore } from "react";

import {
  applyDarkModeFilter,
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
  COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  isColorDark,
  THEME,
} from "@excalidraw/common";

import { isTextElement } from "@excalidraw/element";

import {
  getTextEditorSelection,
  subscribeToTextEditorSelection,
} from "../actions/colorTargets";
import { t } from "../i18n";

import type { AppClassProperties, UIAppState } from "../types";

export const TextHighlightPicker = ({
  app,
  appState,
  compact,
  onChange,
}: {
  app: AppClassProperties;
  appState: UIAppState;
  compact: boolean;
  onChange: (color: string) => void;
}): React.JSX.Element | null => {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToTextEditorSelection(app, listener),
    [app],
  );
  const selectionKey = useSyncExternalStore(subscribe, () => {
    const s = getTextEditorSelection(app, appState);
    return s ? `${s.elementId}:${s.start}:${s.end}` : "";
  });

  if (selectionKey === "") {
    return null;
  }

  const selection = getTextEditorSelection(app, appState);
  let activeColor: string | null = null;

  if (selection) {
    const element = app.scene.getElement(selection.elementId);
    if (element && isTextElement(element)) {
      const ranges = element.styleRanges ?? [];
      const coveringRange = ranges.find(
        (r) =>
          r.backgroundColor &&
          r.start <= selection.start &&
          r.end >= selection.end,
      );
      if (coveringRange?.backgroundColor) {
        activeColor = coveringRange.backgroundColor;
      } else {
        const hasOverlappingBg = ranges.some(
          (r) =>
            r.backgroundColor &&
            Math.max(r.start, selection.start) < Math.min(r.end, selection.end),
        );
        if (!hasOverlappingBg) {
          activeColor = COLOR_PALETTE.transparent;
        }
      }
    }
  }

  const swatches = (
    <div
      className="color-picker__top-picks"
      role="group"
      aria-label={t("labels.textHighlight")}
    >
      {DEFAULT_ELEMENT_BACKGROUND_PICKS.map((color: string) => {
        const active = color === activeColor;
        const isTransparent = color === COLOR_PALETTE.transparent;
        const displayColor = applyDarkModeFilter(
          color,
          appState.theme === THEME.DARK,
        );
        const label = isTransparent ? t("labels.textHighlightNone") : color;

        return (
          <button
            key={color}
            type="button"
            className={clsx("color-picker__button", {
              active,
              "is-transparent": isTransparent,
              "has-outline": !isColorDark(
                color,
                COLOR_OUTLINE_CONTRAST_THRESHOLD,
              ),
            })}
            style={{
              ["--swatch-color" as string]: displayColor,
            }}
            title={label}
            aria-label={label}
            data-testid={`text-highlight-${color}`}
            onClick={() => onChange(color)}
          >
            <div className="color-picker__button-outline" />
          </button>
        );
      })}
    </div>
  );

  if (compact) {
    return <div className="compact-action-item">{swatches}</div>;
  }

  return (
    <>
      <h3 aria-hidden="true">{t("labels.textHighlight")}</h3>
      {swatches}
    </>
  );
};
