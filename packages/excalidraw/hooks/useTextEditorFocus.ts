import { useState, useCallback } from "react";

// Utility type for caret position
export type CaretPosition = {
  start: number;
  end: number;
};

// Utility function to get text editor element
const getTextEditor = (ownerDocument: Document): HTMLTextAreaElement | null => {
  return ownerDocument.querySelector(
    ".excalidraw-wysiwyg",
  ) as HTMLTextAreaElement;
};

// Utility functions for caret position management
export const saveCaretPosition = (
  ownerDocument: Document = document,
): CaretPosition | null => {
  const textEditor = getTextEditor(ownerDocument);
  if (textEditor) {
    return {
      start: textEditor.selectionStart,
      end: textEditor.selectionEnd,
    };
  }
  return null;
};

/**
 * Returns the active non-empty selection range `[start, end)` in the open
 * WYSIWYG text editor (in `originalText` code units), or `null` if no editor
 * is open or the caret is collapsed.
 */
export const getEditingTextSelection = (
  ownerDocument: Document = document,
): CaretPosition | null => {
  const textEditor = getTextEditor(ownerDocument);
  if (!textEditor) {
    return null;
  }
  const { selectionStart, selectionEnd } = textEditor;
  if (
    typeof selectionStart !== "number" ||
    typeof selectionEnd !== "number" ||
    selectionStart === selectionEnd
  ) {
    return null;
  }
  return {
    start: Math.min(selectionStart, selectionEnd),
    end: Math.max(selectionStart, selectionEnd),
  };
};

export const restoreCaretPosition = (
  position: CaretPosition | null,
  ownerDocument: Document = document,
): void => {
  const ownerWindow = ownerDocument.defaultView ?? window;
  ownerWindow.setTimeout(() => {
    const textEditor = getTextEditor(ownerDocument);
    if (textEditor) {
      textEditor.focus();
      if (position) {
        textEditor.selectionStart = position.start;
        textEditor.selectionEnd = position.end;
      }
    }
  }, 0);
};

export const withCaretPositionPreservation = (
  callback: () => void,
  isCompactMode: boolean,
  isEditingText: boolean,
  onPreventClose?: () => void,
  ownerDocument: Document = document,
): void => {
  // Prevent popover from closing in compact mode
  if (isCompactMode && onPreventClose) {
    onPreventClose();
  }

  // Save caret position if editing text
  const savedPosition =
    isCompactMode && isEditingText ? saveCaretPosition(ownerDocument) : null;

  // Execute the callback
  callback();

  // Restore caret position if needed
  if (isCompactMode && isEditingText) {
    restoreCaretPosition(savedPosition, ownerDocument);
  }
};

// Hook for managing text editor caret position with state
export const useTextEditorFocus = (ownerDocument: Document = document) => {
  const [savedCaretPosition, setSavedCaretPosition] =
    useState<CaretPosition | null>(null);

  const saveCaretPositionToState = useCallback(() => {
    const position = saveCaretPosition(ownerDocument);
    setSavedCaretPosition(position);
  }, [ownerDocument]);

  const restoreCaretPositionFromState = useCallback(() => {
    const ownerWindow = ownerDocument.defaultView ?? window;
    ownerWindow.setTimeout(() => {
      const textEditor = getTextEditor(ownerDocument);
      if (textEditor) {
        textEditor.focus();
        if (savedCaretPosition) {
          textEditor.selectionStart = savedCaretPosition.start;
          textEditor.selectionEnd = savedCaretPosition.end;
          setSavedCaretPosition(null);
        }
      }
    }, 0);
  }, [ownerDocument, savedCaretPosition]);

  const clearSavedPosition = useCallback(() => {
    setSavedCaretPosition(null);
  }, []);

  return {
    saveCaretPosition: saveCaretPositionToState,
    restoreCaretPosition: restoreCaretPositionFromState,
    clearSavedPosition,
    hasSavedPosition: !!savedCaretPosition,
  };
};

// Utility function to temporarily disable text editor blur
export const temporarilyDisableTextEditorBlur = (
  ownerDocument: Document = document,
  duration: number = 100,
): void => {
  const textEditor = getTextEditor(ownerDocument);
  if (textEditor) {
    const originalOnBlur = textEditor.onblur;
    textEditor.onblur = null;

    const ownerWindow = ownerDocument.defaultView ?? window;
    ownerWindow.setTimeout(() => {
      textEditor.onblur = originalOnBlur;
    }, duration);
  }
};
