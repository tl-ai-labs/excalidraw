import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

import { t } from "../../i18n";

import "./PageBar.scss";

import type { AppClassProperties, UIAppState } from "../../types";

export const PageBar = ({
  app,
  appState,
}: {
  app: AppClassProperties;
  appState: UIAppState;
}) => {
  const appWithPageOps = app as AppClassProperties & {
    renamePage: (id: string, name: string) => void;
    reorderPages: (fromIndex: number, toIndex: number) => void;
  };
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (editingPageId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingPageId]);

  const startRename = (pageId: string, currentName: string) => {
    if (appState.viewModeEnabled) {
      return;
    }
    cancelledRef.current = false;
    setEditingPageId(pageId);
    setDraftName(currentName);
  };

  const commitRename = (pageId: string) => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditingPageId(null);
      return;
    }
    const trimmed = draftName.trim();
    if (trimmed) {
      appWithPageOps.renamePage(pageId, trimmed);
    }
    setEditingPageId(null);
  };

  const cancelRename = () => {
    cancelledRef.current = true;
    setEditingPageId(null);
  };

  return (
    <div
      className="excalidraw-page-bar Island"
      data-testid="page-bar"
      role="tablist"
    >
      {appState.pages.map((page, index) => {
        const isActive = page.id === appState.activePageId;
        const isEditing =
          !appState.viewModeEnabled && editingPageId === page.id;

        return (
          <div
            key={page.id}
            className={clsx("excalidraw-page-bar__tab", { active: isActive })}
            draggable={!appState.viewModeEnabled && !isEditing}
            onDragStart={(event) => {
              if (appState.viewModeEnabled) {
                return;
              }
              setDragIndex(index);
              event.dataTransfer?.setData("text/plain", String(index));
            }}
            onDragOver={(event) => {
              if (appState.viewModeEnabled) {
                return;
              }
              event.preventDefault();
            }}
            onDrop={(event) => {
              if (appState.viewModeEnabled) {
                return;
              }
              event.preventDefault();
              const rawFrom = event.dataTransfer?.getData("text/plain");
              const parsedFrom =
                rawFrom !== undefined && rawFrom !== "" ? Number(rawFrom) : NaN;
              const fromIndex = Number.isInteger(parsedFrom)
                ? parsedFrom
                : dragIndex;
              if (fromIndex !== null && fromIndex !== index) {
                appWithPageOps.reorderPages(fromIndex, index);
              }
              setDragIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                className="excalidraw-page-bar__input"
                data-testid="page-rename-input"
                aria-label={t("pages.pageName")}
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => commitRename(page.id)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitRename(page.id);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    cancelRename();
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="excalidraw-page-bar__tab-btn"
                data-testid={`page-tab-${page.id}`}
                role="tab"
                aria-selected={isActive}
                onClick={() => app.setActivePage(page.id)}
                onDoubleClick={() => startRename(page.id, page.name)}
              >
                {page.name}
              </button>
            )}

            {!appState.viewModeEnabled && !isEditing && (
              <>
                <button
                  type="button"
                  className="excalidraw-page-bar__action-btn"
                  data-testid={`page-rename-${page.id}`}
                  aria-label={t("pages.renamePage")}
                  title={t("pages.renamePage")}
                  onClick={(event) => {
                    event.stopPropagation();
                    startRename(page.id, page.name);
                  }}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="excalidraw-page-bar__action-btn"
                  data-testid={`page-move-left-${page.id}`}
                  aria-label={t("pages.moveLeft")}
                  title={t("pages.moveLeft")}
                  disabled={index === 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (index > 0) {
                      appWithPageOps.reorderPages(index, index - 1);
                    }
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="excalidraw-page-bar__action-btn"
                  data-testid={`page-move-right-${page.id}`}
                  aria-label={t("pages.moveRight")}
                  title={t("pages.moveRight")}
                  disabled={index === appState.pages.length - 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (index < appState.pages.length - 1) {
                      appWithPageOps.reorderPages(index, index + 1);
                    }
                  }}
                >
                  ›
                </button>
                <button
                  type="button"
                  className="excalidraw-page-bar__action-btn"
                  data-testid={`page-delete-${page.id}`}
                  aria-label={t("pages.deletePage")}
                  title={t("pages.deletePage")}
                  disabled={appState.pages.length <= 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    app.deletePage(page.id);
                  }}
                >
                  ×
                </button>
              </>
            )}
          </div>
        );
      })}

      {!appState.viewModeEnabled && (
        <button
          type="button"
          className="excalidraw-page-bar__add-btn"
          data-testid="page-bar-add"
          aria-label={t("pages.addPage")}
          title={t("pages.addPage")}
          onClick={() => app.addPage()}
        >
          +
        </button>
      )}
    </div>
  );
};
