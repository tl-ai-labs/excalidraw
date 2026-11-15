import React, { useRef, useState } from "react";
import clsx from "clsx";

import { KEYS } from "@excalidraw/common";

import "./PageTabBar.scss";

import type { AppClassProperties, UIAppState } from "../types";

interface PageTabBarProps {
  app: AppClassProperties;
  appState: UIAppState;
}

export const PageTabBar: React.FC<PageTabBarProps> = ({ app, appState }) => {
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (appState.zenModeEnabled) {
    return null;
  }

  const { pages, activePageId, viewModeEnabled } = appState;

  const startEditing = (pageId: string, currentName: string) => {
    if (viewModeEnabled) {
      return;
    }
    setEditingPageId(pageId);
    setDraftName(currentName);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const commitRename = () => {
    if (editingPageId) {
      app.renamePage(editingPageId, draftName);
      setEditingPageId(null);
    }
  };

  const cancelRename = () => {
    setEditingPageId(null);
  };

  return (
    <div
      className="excalidraw-page-tab-bar"
      role="tablist"
      aria-label="Pages"
      data-testid="page-tab-bar"
    >
      <div className="excalidraw-page-tab-bar__tabs">
        {pages.map((page, index) => {
          const isActive = page.id === activePageId;
          const isEditing = editingPageId === page.id;

          return (
            <div
              key={page.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              data-testid={`page-tab-${page.id}`}
              className={clsx("excalidraw-page-tab", {
                "excalidraw-page-tab--active": isActive,
                "excalidraw-page-tab--drag-over":
                  dragOverIndex === index && draggedIndex !== index,
              })}
              draggable={!viewModeEnabled && !isEditing}
              onClick={() => {
                if (!isEditing) {
                  app.switchPage(page.id);
                }
              }}
              onDoubleClick={() => startEditing(page.id, page.name)}
              onKeyDown={(e) => {
                if (
                  !isEditing &&
                  (e.key === KEYS.ENTER || e.key === KEYS.SPACE)
                ) {
                  e.preventDefault();
                  app.switchPage(page.id);
                }
              }}
              onDragStart={(e) => {
                setDraggedIndex(index);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(index));
              }}
              onDragOver={(e) => {
                if (draggedIndex === null) {
                  return;
                }
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverIndex !== index) {
                  setDragOverIndex(index);
                }
              }}
              onDragLeave={() => {
                if (dragOverIndex === index) {
                  setDragOverIndex(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromIndex =
                  draggedIndex ??
                  Number.parseInt(e.dataTransfer.getData("text/plain"), 10);
                if (!Number.isNaN(fromIndex) && fromIndex !== index) {
                  app.reorderPages(fromIndex, index);
                }
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  className="excalidraw-page-tab__input"
                  value={draftName}
                  aria-label="Rename page"
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === KEYS.ENTER) {
                      commitRename();
                    } else if (e.key === KEYS.ESCAPE) {
                      cancelRename();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="excalidraw-page-tab__name">{page.name}</span>
              )}

              {!viewModeEnabled && pages.length > 1 && !isEditing && (
                <button
                  type="button"
                  className="excalidraw-page-tab__delete"
                  aria-label={`Delete ${page.name}`}
                  title={`Delete ${page.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    app.deletePage(page.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!viewModeEnabled && (
        <button
          type="button"
          className="excalidraw-page-tab-bar__add"
          aria-label="Add page"
          title="Add page"
          data-testid="add-page-button"
          onClick={() => app.createPage()}
        >
          +
        </button>
      )}
    </div>
  );
};
