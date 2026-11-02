import React, { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { MAX_PAGE_NAME_LENGTH } from "@excalidraw/common";
import { getLivePages } from "@excalidraw/element";

import { useOutsideClick } from "../hooks/useOutsideClick";
import { t } from "../i18n";

import ConfirmDialog from "./ConfirmDialog";
import { PlusIcon } from "./icons";

import "./PageTabs.scss";

import type { AppClassProperties, UIAppState } from "../types";

export const PageTabs = ({
  app,
  appState,
}: {
  app: AppClassProperties;
  appState: UIAppState;
}) => {
  const pages = getLivePages(appState.pages);
  const activePageId = appState.activePageId;
  const isEditable = !appState.viewModeEnabled;

  const [menuPageId, setMenuPageId] = useState<string | null>(null);
  const [menuLeft, setMenuLeft] = useState(0);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const menuTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const menuRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const draggedIdRef = useRef<string | null>(null);
  const renameFinishedRef = useRef(false);
  const focusTabAfterRenameRef = useRef<string | null>(null);

  useEffect(() => {
    tabRefs.current.get(activePageId)?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
  }, [activePageId]);

  useEffect(() => {
    if (renamingId === null && focusTabAfterRenameRef.current) {
      tabRefs.current.get(focusTabAfterRenameRef.current)?.focus();
      focusTabAfterRenameRef.current = null;
    }
  }, [renamingId]);

  useEffect(() => {
    if (menuPageId) {
      const menu = menuRef.current;
      const root = rootRef.current;
      if (menu && root) {
        setMenuLeft((left) =>
          Math.max(0, Math.min(left, root.clientWidth - menu.offsetWidth)),
        );
      }
      menu?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    }
  }, [menuPageId]);

  const closeMenu = useCallback(
    (restoreFocus: boolean) => {
      if (menuPageId && restoreFocus) {
        menuTriggerRefs.current.get(menuPageId)?.focus();
      }
      setMenuPageId(null);
    },
    [menuPageId],
  );

  const onOutsideClick = useCallback(() => {
    closeMenu(true);
  }, [closeMenu]);

  const isInsideTrigger = useCallback(
    (event: Event) => {
      const trigger = menuPageId
        ? menuTriggerRefs.current.get(menuPageId)
        : undefined;
      return !!trigger && trigger.contains(event.target as Node);
    },
    [menuPageId],
  );

  useOutsideClick(menuRef, onOutsideClick, isInsideTrigger);

  const startRename = (pageId: string) => {
    renameFinishedRef.current = false;
    setRenamingId(pageId);
  };

  const finishRename = (pageId: string, value: string, commit: boolean) => {
    if (renameFinishedRef.current) {
      return;
    }
    renameFinishedRef.current = true;
    if (commit) {
      const page = pages.find((p) => p.id === pageId);
      if (page && page.name !== value) {
        app.pages.renamePage(pageId, value);
      }
    }
    focusTabAfterRenameRef.current = pageId;
    setRenamingId(null);
  };

  const requestDelete = (pageId: string) => {
    const hasContent = app.scene
      .getPageElements(pageId)
      .some((element) => !element.isDeleted);
    if (hasContent) {
      setConfirmDeleteId(pageId);
    } else {
      app.pages.deletePage(pageId);
    }
  };

  const focusTabAt = (index: number) => {
    const page = pages[index];
    if (page) {
      tabRefs.current.get(page.id)?.focus();
    }
  };

  const onTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    pageId: string,
  ) => {
    const index = pages.findIndex((page) => page.id === pageId);
    let handled = true;
    switch (event.key) {
      case "ArrowRight":
        focusTabAt((index + 1) % pages.length);
        break;
      case "ArrowLeft":
        focusTabAt((index - 1 + pages.length) % pages.length);
        break;
      case "Home":
        focusTabAt(0);
        break;
      case "End":
        focusTabAt(pages.length - 1);
        break;
      case "F2":
        if (isEditable) {
          startRename(pageId);
        } else {
          handled = false;
        }
        break;
      default:
        handled = false;
    }
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const menuIndex = menuPageId
    ? pages.findIndex((page) => page.id === menuPageId)
    : -1;
  const confirmPage = confirmDeleteId
    ? pages.find((page) => page.id === confirmDeleteId)
    : undefined;

  return (
    <div
      className="page-tabs"
      data-testid="page-tabs"
      data-viewport-ui="bottom"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.stopPropagation();
        }
      }}
    >
      <div
        role="tablist"
        aria-label={t("pages.tabList")}
        className="page-tabs__list"
      >
        {pages.map((page) => {
          const isActive = page.id === activePageId;
          return (
            <div
              key={page.id}
              role="presentation"
              className={clsx("page-tabs__tab", {
                "page-tabs__tab--active": isActive,
              })}
              draggable={isEditable}
              onDragStart={
                isEditable
                  ? (event) => {
                      draggedIdRef.current = page.id;
                      event.dataTransfer?.setData("text/plain", page.id);
                    }
                  : undefined
              }
              onDragOver={
                isEditable ? (event) => event.preventDefault() : undefined
              }
              onDrop={
                isEditable
                  ? (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const draggedId = draggedIdRef.current;
                      draggedIdRef.current = null;
                      if (draggedId && draggedId !== page.id) {
                        app.pages.movePage(
                          draggedId,
                          pages.findIndex((p) => p.id === page.id),
                        );
                      }
                    }
                  : undefined
              }
            >
              {renamingId === page.id ? (
                <input
                  className="page-tabs__rename"
                  aria-label={t("pages.renameLabel")}
                  data-testid="page-tab-rename-input"
                  defaultValue={page.name}
                  maxLength={MAX_PAGE_NAME_LENGTH}
                  ref={(input) => {
                    if (input && !input.dataset.initialized) {
                      input.dataset.initialized = "true";
                      input.focus();
                      input.select();
                    }
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      finishRename(page.id, event.currentTarget.value, true);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      finishRename(page.id, event.currentTarget.value, false);
                    }
                  }}
                  onBlur={(event) =>
                    finishRename(page.id, event.currentTarget.value, true)
                  }
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  className="page-tabs__tab-button"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  title={page.name}
                  data-testid={`page-tab-${page.id}`}
                  ref={(node) => {
                    if (node) {
                      tabRefs.current.set(page.id, node);
                    } else {
                      tabRefs.current.delete(page.id);
                    }
                  }}
                  onClick={(event) => {
                    app.pages.setActivePage(page.id);
                    if (event.detail > 0) {
                      app.focusContainer();
                    }
                  }}
                  onDoubleClick={
                    isEditable ? () => startRename(page.id) : undefined
                  }
                  onKeyDown={(event) => onTabKeyDown(event, page.id)}
                >
                  {page.name}
                </button>
              )}
              {isEditable && (
                <button
                  type="button"
                  className="page-tabs__tab-menu-button"
                  aria-label={t("pages.options")}
                  aria-haspopup="menu"
                  tabIndex={isActive ? 0 : -1}
                  data-testid={`page-tab-menu-${page.id}`}
                  ref={(node) => {
                    if (node) {
                      menuTriggerRefs.current.set(page.id, node);
                    } else {
                      menuTriggerRefs.current.delete(page.id);
                    }
                  }}
                  onClick={(event) => {
                    if (menuPageId === page.id) {
                      closeMenu(true);
                      return;
                    }
                    const trigger = event.currentTarget;
                    const root = event.currentTarget.closest(".page-tabs");
                    const left = root
                      ? trigger.getBoundingClientRect().left -
                        root.getBoundingClientRect().left
                      : 0;
                    setMenuLeft(Math.max(0, left));
                    setMenuPageId(page.id);
                  }}
                >
                  ⋯
                </button>
              )}
            </div>
          );
        })}
      </div>
      {isEditable && (
        <button
          type="button"
          className="page-tabs__add"
          aria-label={t("pages.add")}
          title={t("pages.add")}
          data-testid="page-tab-add"
          onClick={() => {
            app.pages.createPage();
          }}
        >
          {PlusIcon}
        </button>
      )}
      {isEditable && menuPageId && menuIndex !== -1 && (
        <div
          role="menu"
          className="page-tabs__menu"
          style={{ left: menuLeft }}
          ref={menuRef}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeMenu(true);
            }
          }}
        >
          <button
            type="button"
            role="menuitem"
            data-testid="page-menu-rename"
            onClick={() => {
              const id = menuPageId;
              setMenuPageId(null);
              startRename(id);
            }}
          >
            {t("pages.rename")}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="page-menu-move-left"
            disabled={menuIndex === 0}
            onClick={() => {
              app.pages.movePage(menuPageId, menuIndex - 1);
              closeMenu(true);
            }}
          >
            {t("pages.moveLeft")}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="page-menu-move-right"
            disabled={menuIndex === pages.length - 1}
            onClick={() => {
              app.pages.movePage(menuPageId, menuIndex + 1);
              closeMenu(true);
            }}
          >
            {t("pages.moveRight")}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="page-menu-delete"
            disabled={pages.length <= 1}
            onClick={() => {
              const id = menuPageId;
              setMenuPageId(null);
              requestDelete(id);
            }}
          >
            {t("pages.delete")}
          </button>
        </div>
      )}
      {confirmPage && (
        <ConfirmDialog
          title={t("pages.deleteConfirmTitle")}
          onConfirm={() => {
            app.pages.deletePage(confirmPage.id);
            setConfirmDeleteId(null);
          }}
          onCancel={() => setConfirmDeleteId(null)}
        >
          {t("pages.deleteConfirm", { name: confirmPage.name })}
        </ConfirmDialog>
      )}
    </div>
  );
};
