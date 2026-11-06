import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { KEYS } from "@excalidraw/common";

import { t } from "../i18n";

import { useApp } from "./App";
import ConfirmDialog from "./ConfirmDialog";

import "./PageTabs.scss";

import type { ExcalidrawPage, UIAppState } from "../types";

export const PageTabs = ({ appState }: { appState: UIAppState }) => {
  const app = useApp();
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [pageToDelete, setPageToDelete] = useState<ExcalidrawPage | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isViewMode = appState.viewModeEnabled;
  const pages = appState.pages;

  useEffect(() => {
    if (editingPageId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingPageId]);

  const startEditing = (page: ExcalidrawPage) => {
    if (isViewMode) {
      return;
    }
    setEditingPageId(page.id);
    setDraftName(page.name);
  };

  const commitEditing = (pageId: string) => {
    if (editingPageId !== pageId) {
      return;
    }
    app.renamePage(pageId, draftName);
    setEditingPageId(null);
  };

  const cancelEditing = () => {
    setEditingPageId(null);
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    if (isViewMode) {
      return;
    }
    setDraggedIndex(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (isViewMode) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    toIndex: number,
  ) => {
    if (isViewMode) {
      return;
    }
    event.preventDefault();
    let fromIndex = draggedIndex;
    if (fromIndex === null && event.dataTransfer) {
      const parsed = Number.parseInt(
        event.dataTransfer.getData("text/plain"),
        10,
      );
      if (!Number.isNaN(parsed)) {
        fromIndex = parsed;
      }
    }
    setDraggedIndex(null);
    if (fromIndex !== null && fromIndex !== toIndex) {
      app.reorderPages(fromIndex, toIndex);
    }
  };

  return (
    <div className="page-tabs">
      <div
        className="page-tabs__list"
        role="tablist"
        aria-label={t("pages.tabsLabel")}
      >
        {pages.map((page, index) => {
          const isActive = page.id === appState.activePageId;
          const isEditing = editingPageId === page.id;

          return (
            <div
              key={page.id}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              aria-selected={isActive}
              data-testid={`page-tab-${page.id}`}
              draggable={!isViewMode && !isEditing}
              className={clsx("page-tabs__tab", {
                "page-tabs__tab--active": isActive,
              })}
              onClick={() => {
                if (!isEditing) {
                  app.switchPage(page.id);
                }
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                startEditing(page);
              }}
              onDragStart={(event) => handleDragStart(event, index)}
              onDragOver={handleDragOver}
              onDrop={(event) => handleDrop(event, index)}
              onDragEnd={() => setDraggedIndex(null)}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  className="page-tabs__rename-input"
                  data-testid={`page-rename-input-${page.id}`}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onBlur={() => commitEditing(page.id)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === KEYS.ENTER) {
                      event.preventDefault();
                      commitEditing(page.id);
                    } else if (event.key === KEYS.ESCAPE) {
                      event.preventDefault();
                      cancelEditing();
                    }
                  }}
                  onKeyUp={(event) => event.stopPropagation()}
                />
              ) : (
                <span className="page-tabs__name" title={page.name}>
                  {page.name}
                </span>
              )}

              {!isViewMode && !isEditing && (
                <div
                  className="page-tabs__actions"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="page-tabs__action-btn"
                    data-testid={`page-rename-${page.id}`}
                    aria-label={t("pages.renamePage")}
                    title={t("pages.renamePage")}
                    onClick={() => startEditing(page)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="page-tabs__action-btn"
                    data-testid={`page-move-left-${page.id}`}
                    aria-label={t("pages.movePageLeft")}
                    title={t("pages.movePageLeft")}
                    disabled={index === 0}
                    onClick={() => app.reorderPages(index, index - 1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="page-tabs__action-btn"
                    data-testid={`page-move-right-${page.id}`}
                    aria-label={t("pages.movePageRight")}
                    title={t("pages.movePageRight")}
                    disabled={index === pages.length - 1}
                    onClick={() => app.reorderPages(index, index + 1)}
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className="page-tabs__action-btn"
                    data-testid={`page-delete-${page.id}`}
                    aria-label={t("pages.deletePage")}
                    title={t("pages.deletePage")}
                    disabled={pages.length <= 1}
                    onClick={() => {
                      if (pages.length > 1) {
                        setPageToDelete(page);
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isViewMode && (
        <button
          type="button"
          className="page-tabs__add-btn"
          data-testid="page-add-button"
          aria-label={t("pages.addPage")}
          title={t("pages.addPage")}
          onClick={() => app.addPage()}
        >
          +
        </button>
      )}

      {pageToDelete && (
        <ConfirmDialog
          title={t("pages.deletePageConfirmTitle")}
          onConfirm={() => {
            const targetId = pageToDelete.id;
            setPageToDelete(null);
            app.deletePage(targetId);
          }}
          onCancel={() => setPageToDelete(null)}
        >
          <p>
            {t("pages.deletePageConfirmDescription", {
              pageName: pageToDelete.name,
            })}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
};
