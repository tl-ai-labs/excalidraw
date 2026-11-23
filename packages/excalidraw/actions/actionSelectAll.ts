import { LinearElementEditor } from "@excalidraw/element";
import { isLinearElement, isTextElement } from "@excalidraw/element";

import { KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { selectGroupsForSelectedElements } from "../components/App.selection";

import { selectAllIcon } from "../components/icons";

import { register } from "./register";

export const actionSelectAll = register({
  name: "selectAll",
  label: "labels.selectAll",
  icon: selectAllIcon,
  trackEvent: { category: "canvas" },
  viewMode: false,
  perform: (elements, appState, value, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const activePageElements = app.scene.getNonDeletedElements();

    const selectedElementIds = activePageElements
      .filter(
        (element) =>
          !(isTextElement(element) && element.containerId) && !element.locked,
      )
      .reduce((map: Record<ExcalidrawElement["id"], true>, element) => {
        map[element.id] = true;
        return map;
      }, {});

    const selectedIds = Object.keys(selectedElementIds);
    const singleSelectedElement =
      selectedIds.length === 1
        ? app.scene.getNonDeletedElementsMap().get(selectedIds[0])
        : null;

    return {
      appState: {
        ...appState,
        ...selectGroupsForSelectedElements(
          {
            editingGroupId: null,
            selectedElementIds,
          },
          activePageElements,
          appState,
          app,
        ),
        selectedLinearElement:
          // single linear element selected
          singleSelectedElement && isLinearElement(singleSelectedElement)
            ? new LinearElementEditor(
                singleSelectedElement as NonDeleted<ExcalidrawLinearElement>,
                app.scene.getNonDeletedElementsMap(),
              )
            : null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.A,
});
