/**
 * Lets actions read the selection of the text editor (the offsets into the
 * element's `originalText`) and give it back after applying a style, so that
 * picking colours repeatedly keeps working.
 */
type TextEditorSelectionHandle = {
  getSelection: () => { start: number; end: number };
  restoreSelection: (selection: { start: number; end: number }) => void;
};

const handles = new Map<string, TextEditorSelectionHandle>();

export const registerTextEditorSelection = (
  elementId: string,
  handle: TextEditorSelectionHandle,
) => {
  handles.set(elementId, handle);
  return () => {
    if (handles.get(elementId) === handle) {
      handles.delete(elementId);
    }
  };
};

/** the editor's non-collapsed selection, if any */
export const getTextEditorSelection = (elementId: string) => {
  const selection = handles.get(elementId)?.getSelection();
  return selection && selection.end > selection.start ? selection : null;
};

export const restoreTextEditorSelection = (
  elementId: string,
  selection: { start: number; end: number },
) => {
  handles.get(elementId)?.restoreSelection(selection);
};
