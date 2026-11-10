import { useMemo, useState } from "react";
import clsx from "clsx";

import { getNonDeletedPages, resolveActivePageId } from "@excalidraw/element";

import {
  actionCreatePage,
  actionDeletePage,
  actionRenamePage,
  actionReorderPage,
  actionSwitchPage,
} from "../actions/actionPages";
import { t } from "../i18n";

import { TrashIcon } from "./icons";

import "./PageTabs.scss";

import type { ActionManager } from "../actions/manager";
import type { UIAppState } from "../types";

export const PageTabs = (props: {
  appState: UIAppState;
  actionManager: ActionManager;
}) => {
  const { appState, actionManager } = props;

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);

  const nonDeletedPages = useMemo(
    () => getNonDeletedPages(appState.pages),
    [appState.pages],
  );

  const activePageId = resolveActivePageId(
    appState.pages,
    appState.activePageId,
  );

  if (appState.zenModeEnabled) {
    return null;
  }

  const isViewMode = Boolean(appState.viewModeEnabled);

  const handleCommitRename = (pageId: string) => {
    const trimmed = editingName.trim();
    if (trimmed) {
      actionManager.executeAction(actionRenamePage, "ui", {
        pageId,
        name: trimmed,
      });
    }
    setEditingPageId(null);
    setEditingName("");
  };

  const handleCancelRename = () => {
    setEditingPageId(null);
    setEditingName("");
  };

  return (
    <div
      className="PageTabs"
      role="tablist"
      aria-label={t("pages.tabListLabel")}
      data-testid="page-tabs"
    >
      <div className="PageTabs__tabs">
        {nonDeletedPages.map((page, index) => {
          const isActive = page.id === activePageId;
          const label =
            page.name || t("pages.defaultName", { number: index + 1 });
          const isEditing = editingPageId === page.id;

          return (
            <div
              key={page.id}
              className={clsx("PageTabs__tab-wrapper", {
                "PageTabs__tab-wrapper--active": isActive,
              })}
              draggable={!isViewMode && !isEditing}
              onDragStart={(e) => {
                if (isViewMode || isEditing) {
                  return;
                }
                setDraggedPageId(page.id);
                e.dataTransfer.setData("text/plain", page.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (isViewMode || !draggedPageId) {
                  return;
                }
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                if (isViewMode) {
                  return;
                }
                e.preventDefault();
                const sourceId =
                  draggedPageId || e.dataTransfer.getData("text/plain");
                if (sourceId && sourceId !== page.id) {
                  actionManager.executeAction(actionReorderPage, "ui", {
                    pageId: sourceId,
                    toPosition: index,
                  });
                }
                setDraggedPageId(null);
              }}
              onDragEnd={() => {
                setDraggedPageId(null);
              }}
            >
              {isEditing ? (
                <input
                  aria-label={t("pages.renameInputLabel")}
                  data-testid="page-rename-input"
                  className="PageTabs__rename-input"
                  value={editingName}
                  autoFocus
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleCommitRename(page.id)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCommitRename(page.id);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      handleCancelRename();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`page-tab-${page.id}`}
                  className={clsx("PageTabs__tab", {
                    "PageTabs__tab--active": isActive,
                  })}
                  onClick={() => {
                    if (!isActive) {
                      actionManager.executeAction(
                        actionSwitchPage,
                        "ui",
                        page.id,
                      );
                    }
                  }}
                  onDoubleClick={() => {
                    if (isViewMode) {
                      return;
                    }
                    setEditingPageId(page.id);
                    setEditingName(label);
                  }}
                  onKeyDown={(e) => {
                    if (isViewMode) {
                      return;
                    }
                    if (e.altKey && e.key === "ArrowLeft") {
                      e.preventDefault();
                      const toPosition = Math.max(0, index - 1);
                      if (toPosition !== index) {
                        actionManager.executeAction(actionReorderPage, "ui", {
                          pageId: page.id,
                          toPosition,
                        });
                      }
                    } else if (e.altKey && e.key === "ArrowRight") {
                      e.preventDefault();
                      const toPosition = Math.min(
                        nonDeletedPages.length - 1,
                        index + 1,
                      );
                      if (toPosition !== index) {
                        actionManager.executeAction(actionReorderPage, "ui", {
                          pageId: page.id,
                          toPosition,
                        });
                      }
                    }
                  }}
                >
                  <span className="PageTabs__tab-label">{label}</span>
                </button>
              )}
              {isActive && nonDeletedPages.length > 1 && !isViewMode && (
                <button
                  type="button"
                  data-testid="page-delete"
                  aria-label={t("pages.deletePage")}
                  title={t("pages.deletePage")}
                  className="PageTabs__delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    actionManager.executeAction(
                      actionDeletePage,
                      "ui",
                      page.id,
                    );
                  }}
                >
                  {TrashIcon}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!isViewMode && (
        <button
          type="button"
          data-testid="page-create"
          aria-label={t("pages.createPage")}
          title={t("pages.createPage")}
          className="PageTabs__create-btn"
          onClick={() => {
            actionManager.executeAction(actionCreatePage, "ui", null);
          }}
        >
          +
        </button>
      )}
    </div>
  );
};
