import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

import { KEYS } from "@excalidraw/common";

import { t } from "../i18n";

import { useApp } from "./App";

import "./PageTabBar.scss";

import type { Page, UIAppState } from "../types";

export const PageTabBar = ({ appState }: { appState: UIAppState }) => {
  const app = useApp();
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingPageId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingPageId]);

  const startRename = (page: Page) => {
    if (appState.viewModeEnabled) {
      return;
    }
    setEditingPageId(page.id);
    setDraftName(page.name);
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
      className={clsx("page-tab-bar zen-mode-transition", {
        "layer-ui__wrapper__footer-left--transition-bottom":
          appState.zenModeEnabled,
      })}
      role="tablist"
      aria-label="Pages"
      data-testid="page-tab-bar"
    >
      <div className="page-tab-bar__tabs">
        {appState.pages.map((page, index) => {
          const isActive = page.id === appState.activePageId;
          const isEditing = editingPageId === page.id;

          return (
            <div
              key={page.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              data-testid={`page-tab-${page.id}`}
              className={clsx("page-tab-bar__tab", {
                "page-tab-bar__tab--active": isActive,
                "page-tab-bar__tab--drag-over": dragOverIndex === index,
              })}
              draggable={!appState.viewModeEnabled && !isEditing}
              onClick={() => {
                if (!isEditing) {
                  app.switchPage(page.id);
                }
              }}
              onDoubleClick={() => startRename(page)}
              onKeyDown={(e) => {
                if (isEditing) {
                  return;
                }
                if (e.key === KEYS.ENTER || e.key === KEYS.SPACE) {
                  e.preventDefault();
                  app.switchPage(page.id);
                } else if (e.key === "F2") {
                  e.preventDefault();
                  startRename(page);
                }
              }}
              onDragStart={(e) => {
                dragIndexRef.current = index;
                e.dataTransfer?.setData("text/plain", String(index));
                if (e.dataTransfer) {
                  e.dataTransfer.effectAllowed = "move";
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
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
                setDragOverIndex(null);
                const rawFrom =
                  e.dataTransfer?.getData("text/plain") ||
                  (dragIndexRef.current !== null
                    ? String(dragIndexRef.current)
                    : "");
                const fromIndex = Number.parseInt(rawFrom, 10);
                dragIndexRef.current = null;
                if (!Number.isNaN(fromIndex) && fromIndex !== index) {
                  app.reorderPage(fromIndex, index);
                }
              }}
              onDragEnd={() => {
                dragIndexRef.current = null;
                setDragOverIndex(null);
              }}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  className="page-tab-bar__input"
                  data-testid={`page-tab-input-${page.id}`}
                  aria-label={t("pages.renamePage")}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
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
                />
              ) : (
                <span className="page-tab-bar__label">{page.name}</span>
              )}
              {!appState.viewModeEnabled &&
                !isEditing &&
                appState.pages.length > 1 && (
                  <button
                    type="button"
                    className="page-tab-bar__delete"
                    data-testid={`delete-page-${page.id}`}
                    aria-label={t("pages.deletePage")}
                    title={t("pages.deletePage")}
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
      {!appState.viewModeEnabled && (
        <button
          type="button"
          className="page-tab-bar__add"
          data-testid="add-page-button"
          aria-label={t("pages.addPage")}
          title={t("pages.addPage")}
          onClick={() => app.createPage()}
        >
          +
        </button>
      )}
    </div>
  );
};
