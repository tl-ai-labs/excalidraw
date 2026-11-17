import clsx from "clsx";
import { useEffect, useState } from "react";

import { getLivePages } from "@excalidraw/element";

import {
  actionCreatePage,
  actionDeletePage,
  actionMovePage,
  actionMovePageLeft,
  actionMovePageRight,
  actionRenamePage,
  actionSwitchPage,
} from "../actions";
import { useUIAppState } from "../context/ui-appState";
import { t } from "../i18n";

import { useExcalidrawActionManager } from "./App";
import { DotsIcon, PlusIcon } from "./icons";

import "./PageTabs.scss";

/** Tab bar to create, switch, rename, reorder and delete pages. */
export const PageTabs = () => {
  const appState = useUIAppState();
  const actionManager = useExcalidrawActionManager();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menuPageId, setMenuPageId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const pages = getLivePages(appState.pages);
  const editable = !appState.viewModeEnabled;

  useEffect(() => {
    if (!menuPageId) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        !(event.target as HTMLElement).closest?.(
          ".page-tabs__menu, .page-tabs__menu-button",
        )
      ) {
        setMenuPageId(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuPageId]);

  if (appState.zenModeEnabled) {
    return null;
  }

  const startRename = (pageId: string, name: string) => {
    if (!editable) {
      return;
    }
    setMenuPageId(null);
    setRenamingId(pageId);
    setRenameValue(name);
  };

  const commitRename = () => {
    if (renamingId) {
      actionManager.executeAction(actionRenamePage, "ui", {
        id: renamingId,
        name: renameValue,
      });
    }
    setRenamingId(null);
  };

  return (
    <div
      className="page-tabs"
      role="tablist"
      aria-label={t("pages.tabBar")}
      data-testid="page-tabs"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {pages.map((page, position) => {
        const isActive = page.id === appState.activePageId;
        return (
          <div
            key={page.id}
            className={clsx("page-tabs__tab", {
              "page-tabs__tab--active": isActive,
              "page-tabs__tab--dragging": dragId === page.id,
            })}
            draggable={editable && renamingId !== page.id}
            onDragStart={(event) => {
              setDragId(page.id);
              event.dataTransfer?.setData("text/plain", page.id);
            }}
            onDragOver={(event) => {
              if (dragId) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragId && dragId !== page.id) {
                actionManager.executeAction(actionMovePage, "ui", {
                  id: dragId,
                  to: position,
                });
              }
              setDragId(null);
            }}
            onDragEnd={() => setDragId(null)}
          >
            {renamingId === page.id ? (
              <input
                className="page-tabs__input"
                aria-label={t("pages.nameLabel")}
                data-testid={`page-tab-input-${page.id}`}
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    commitRename();
                  } else if (event.key === "Escape") {
                    setRenamingId(null);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className="page-tabs__label"
                data-testid={`page-tab-${page.id}`}
                onClick={() =>
                  actionManager.executeAction(actionSwitchPage, "ui", {
                    id: page.id,
                  })
                }
                onDoubleClick={() => startRename(page.id, page.name)}
              >
                {page.name}
              </button>
            )}
            {editable && (
              <button
                type="button"
                className="page-tabs__menu-button"
                aria-label={t("pages.menu")}
                aria-haspopup="menu"
                data-testid={`page-tab-menu-${page.id}`}
                onClick={() =>
                  setMenuPageId(menuPageId === page.id ? null : page.id)
                }
              >
                {DotsIcon}
              </button>
            )}
            {menuPageId === page.id && (
              <div className="page-tabs__menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => startRename(page.id, page.name)}
                >
                  {t("pages.rename")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={position === 0}
                  onClick={() => {
                    setMenuPageId(null);
                    actionManager.executeAction(actionMovePageLeft, "ui", {
                      id: page.id,
                    });
                  }}
                >
                  {t("pages.moveLeft")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={position === pages.length - 1}
                  onClick={() => {
                    setMenuPageId(null);
                    actionManager.executeAction(actionMovePageRight, "ui", {
                      id: page.id,
                    });
                  }}
                >
                  {t("pages.moveRight")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={pages.length <= 1}
                  onClick={() => {
                    setMenuPageId(null);
                    actionManager.executeAction(actionDeletePage, "ui", {
                      id: page.id,
                    });
                  }}
                >
                  {t("pages.delete")}
                </button>
              </div>
            )}
          </div>
        );
      })}
      {editable && (
        <button
          type="button"
          className="page-tabs__add"
          title={t("pages.new")}
          aria-label={t("pages.new")}
          data-testid="page-tabs-add"
          onClick={() => actionManager.executeAction(actionCreatePage, "ui")}
        >
          {PlusIcon}
        </button>
      )}
    </div>
  );
};
