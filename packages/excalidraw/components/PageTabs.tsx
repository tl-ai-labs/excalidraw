import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { KEYS } from "@excalidraw/common";

import type { ExcalidrawPage } from "@excalidraw/element/types";

import {
  actionCreatePage,
  actionDeletePage,
  actionRenamePage,
  actionReorderPage,
  actionSwitchPage,
} from "../actions/actionPages";
import { t } from "../i18n";

import { useApp } from "./App";
import ConfirmDialog from "./ConfirmDialog";
import { PlusIcon } from "./icons";

import "./PageTabs.scss";

import type { ActionManager } from "../actions/manager";
import type { UIAppState } from "../types";

export const PageTabs = ({
  appState,
  actionManager,
}: {
  appState: UIAppState;
  actionManager: ActionManager;
}) => {
  const app = useApp();
  const pages = app.scene.getPages();
  const activePageId = appState.activePageId;
  const isViewMode = appState.viewModeEnabled;

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [dragOverPageId, setDragOverPageId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    pageId: string;
    x: number;
    y: number;
  } | null>(null);
  const [pageToDelete, setPageToDelete] = useState<ExcalidrawPage | null>(null);

  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingPageId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingPageId]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".page-tabs__context-menu")) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === KEYS.ESCAPE) {
        setContextMenu(null);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  if (appState.zenModeEnabled) {
    return null;
  }

  const startRename = (page: ExcalidrawPage) => {
    if (isViewMode) {
      return;
    }
    setEditingPageId(page.id);
    setEditingName(page.name);
  };

  const commitRename = () => {
    if (!editingPageId) {
      return;
    }
    const trimmed = editingName.trim();
    if (trimmed) {
      actionManager.executeAction(actionRenamePage, "ui", {
        pageId: editingPageId,
        name: trimmed,
      });
    }
    setEditingPageId(null);
    setEditingName("");
  };

  const cancelRename = () => {
    setEditingPageId(null);
    setEditingName("");
  };

  const contextPageIndex = contextMenu
    ? pages.findIndex((p) => p.id === contextMenu.pageId)
    : -1;
  const contextPage = contextPageIndex >= 0 ? pages[contextPageIndex] : null;

  return (
    <div
      className="page-tabs"
      data-testid="page-tabs"
      role="tablist"
      aria-label="Pages"
    >
      <div className="page-tabs__list">
        {pages.map((page, index) => {
          const isActive = page.id === activePageId;
          const isEditing = page.id === editingPageId;

          return (
            <div
              key={page.id}
              role="tab"
              aria-selected={isActive}
              data-testid={`page-tab-${page.id}`}
              className={clsx("page-tabs__tab", {
                "page-tabs__tab--active": isActive,
                "page-tabs__tab--drag-over": dragOverPageId === page.id,
              })}
              draggable={!isViewMode && !isEditing}
              onClick={() => {
                if (!isEditing) {
                  actionManager.executeAction(actionSwitchPage, "ui", page.id);
                }
              }}
              onDoubleClick={() => startRename(page)}
              onContextMenu={(e) => {
                if (isViewMode) {
                  return;
                }
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({
                  pageId: page.id,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              onDragStart={(e) => {
                if (isViewMode || isEditing) {
                  return;
                }
                setDraggedPageId(page.id);
                e.dataTransfer?.setData("text/plain", page.id);
              }}
              onDragOver={(e) => {
                if (isViewMode || !draggedPageId || draggedPageId === page.id) {
                  return;
                }
                e.preventDefault();
                setDragOverPageId(page.id);
              }}
              onDragLeave={() => {
                if (dragOverPageId === page.id) {
                  setDragOverPageId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverPageId(null);
                if (isViewMode || !draggedPageId || draggedPageId === page.id) {
                  setDraggedPageId(null);
                  return;
                }
                actionManager.executeAction(actionReorderPage, "ui", {
                  pageId: draggedPageId,
                  targetIndex: index,
                });
                setDraggedPageId(null);
              }}
              onDragEnd={() => {
                setDraggedPageId(null);
                setDragOverPageId(null);
              }}
            >
              {isEditing ? (
                <input
                  ref={renameInputRef}
                  data-testid="page-rename-input"
                  className="page-tabs__rename-input"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === KEYS.ENTER) {
                      e.preventDefault();
                      commitRename();
                    } else if (e.key === KEYS.ESCAPE) {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="page-tabs__tab-label">{page.name}</span>
              )}
            </div>
          );
        })}
      </div>

      {!isViewMode && (
        <button
          type="button"
          className="page-tabs__add-btn"
          data-testid="add-page-button"
          title={t("pages.addPage")}
          aria-label={t("pages.addPage")}
          onClick={() => actionManager.executeAction(actionCreatePage, "ui")}
        >
          {PlusIcon}
        </button>
      )}

      {contextMenu && contextPage && !isViewMode && (
        <div
          className="page-tabs__context-menu"
          style={{
            left: contextMenu.x,
            bottom: "calc(100% + 6px)",
          }}
        >
          <button
            type="button"
            className="page-tabs__context-menu-item"
            onClick={() => {
              startRename(contextPage);
              setContextMenu(null);
            }}
          >
            {t("pages.rename")}
          </button>
          <button
            type="button"
            className="page-tabs__context-menu-item"
            disabled={contextPageIndex <= 0}
            onClick={() => {
              actionManager.executeAction(actionReorderPage, "contextMenu", {
                pageId: contextPage.id,
                targetIndex: contextPageIndex - 1,
              });
              setContextMenu(null);
            }}
          >
            {t("pages.moveLeft")}
          </button>
          <button
            type="button"
            className="page-tabs__context-menu-item"
            disabled={contextPageIndex >= pages.length - 1}
            onClick={() => {
              actionManager.executeAction(actionReorderPage, "contextMenu", {
                pageId: contextPage.id,
                targetIndex: contextPageIndex + 1,
              });
              setContextMenu(null);
            }}
          >
            {t("pages.moveRight")}
          </button>
          <button
            type="button"
            className="page-tabs__context-menu-item page-tabs__context-menu-item--danger"
            disabled={pages.length <= 1}
            onClick={() => {
              setPageToDelete(contextPage);
              setContextMenu(null);
            }}
          >
            {t("pages.delete")}
          </button>
        </div>
      )}

      {pageToDelete && (
        <ConfirmDialog
          title={t("pages.deleteConfirmTitle")}
          onConfirm={() => {
            actionManager.executeAction(
              actionDeletePage,
              "ui",
              pageToDelete.id,
            );
            setPageToDelete(null);
          }}
          onCancel={() => setPageToDelete(null)}
        >
          <p>
            {t("pages.deleteConfirmMessage", { pageName: pageToDelete.name })}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
};
