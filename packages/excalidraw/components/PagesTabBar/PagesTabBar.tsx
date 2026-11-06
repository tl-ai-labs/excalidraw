import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { getVisiblePages } from "@excalidraw/element";

import type { DrawingPage } from "@excalidraw/element/types";

import {
  actionAddPage,
  actionDeletePage,
  actionMovePage,
  actionMovePageLeft,
  actionMovePageRight,
  actionRenamePage,
  actionSwitchPage,
} from "../../actions/actionPages";
import { useUIAppState } from "../../context/ui-appState";
import { t } from "../../i18n";
import { useApp, useExcalidrawActionManager } from "../App";
import DropdownMenu from "../dropdownMenu/DropdownMenu";
import { DotsHorizontalIcon, PlusIcon, TrashIcon } from "../icons";

import "./PagesTabBar.scss";

import type { JSX } from "react";

export const PagesTabBar = ({
  isMobile,
}: {
  isMobile?: boolean;
}): JSX.Element | null => {
  const app = useApp();
  const appState = useUIAppState();
  const actionManager = useExcalidrawActionManager();

  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dropTargetPageId, setDropTargetPageId] = useState<string | null>(null);

  const draggedPageIdRef = useRef<string | null>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  const visiblePages = getVisiblePages(appState.pages);
  const activePageId = appState.activePageId;
  const isViewMode = !!appState.viewModeEnabled;

  useEffect(() => {
    if (
      activeTabRef.current &&
      typeof activeTabRef.current.scrollIntoView === "function"
    ) {
      activeTabRef.current.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [activePageId]);

  if (appState.zenModeEnabled || app.props.UIOptions.pages === false) {
    return null;
  }

  const startRename = (page: DrawingPage) => {
    if (isViewMode) {
      return;
    }
    setRenamingPageId(page.id);
    setRenameValue(page.name);
  };

  const commitRename = (pageId: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      actionManager.executeAction(actionRenamePage, "ui", {
        pageId,
        name: trimmed,
      });
    }
    setRenamingPageId(null);
  };

  const cancelRename = () => {
    setRenamingPageId(null);
  };

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    page: DrawingPage,
  ) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prevIndex = index > 0 ? index - 1 : visiblePages.length - 1;
      const prevPage = visiblePages[prevIndex];
      if (prevPage) {
        actionManager.executeAction(actionSwitchPage, "ui", prevPage.id);
      }
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextIndex = index < visiblePages.length - 1 ? index + 1 : 0;
      const nextPage = visiblePages[nextIndex];
      if (nextPage) {
        actionManager.executeAction(actionSwitchPage, "ui", nextPage.id);
      }
    } else if ((event.key === "Enter" || event.key === "F2") && !isViewMode) {
      event.preventDefault();
      startRename(page);
    }
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    pageId: string,
  ) => {
    if (isViewMode) {
      return;
    }
    draggedPageIdRef.current = pageId;
    const dt = event.dataTransfer;
    if (dt) {
      try {
        dt.setData("text/plain", pageId);
        dt.effectAllowed = "move";
      } catch {}
    }
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLButtonElement>,
    pageId: string,
  ) => {
    if (isViewMode || draggedPageIdRef.current === pageId) {
      return;
    }
    event.preventDefault();
    const dt = event.dataTransfer;
    if (dt) {
      try {
        dt.dropEffect = "move";
      } catch {}
    }
    setDropTargetPageId(pageId);
  };

  const handleDragLeave = () => {
    setDropTargetPageId(null);
  };

  const handleDrop = (
    event: React.DragEvent<HTMLButtonElement>,
    targetPageId: string,
  ) => {
    event.preventDefault();
    const draggedId = draggedPageIdRef.current;
    setDropTargetPageId(null);
    draggedPageIdRef.current = null;

    if (!draggedId || draggedId === targetPageId) {
      return;
    }

    const remainingPages = visiblePages.filter((p) => p.id !== draggedId);
    const targetIndex = remainingPages.findIndex((p) => p.id === targetPageId);
    if (targetIndex !== -1) {
      actionManager.executeAction(actionMovePage, "ui", {
        pageId: draggedId,
        toIndex: targetIndex,
      });
    }
  };

  const handleDragEnd = () => {
    draggedPageIdRef.current = null;
    setDropTargetPageId(null);
  };

  const activePageIndex = visiblePages.findIndex((p) => p.id === activePageId);
  const activePage = visiblePages[activePageIndex];

  return (
    <div
      className={clsx("pages-tab-bar", { "pages-tab-bar--mobile": isMobile })}
      role="tablist"
      aria-label={t("pages.title")}
      data-testid="pages-tab-bar"
    >
      {visiblePages.map((page, index) => {
        const isActive = page.id === activePageId;
        const isRenaming = renamingPageId === page.id;
        const isDropTarget = dropTargetPageId === page.id;

        if (isRenaming) {
          return (
            <input
              key={page.id}
              className="pages-tab-bar__rename-input"
              aria-label={t("pages.pageName")}
              data-testid="page-rename-input"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename(page.id);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelRename();
                }
              }}
              onBlur={() => commitRename(page.id)}
            />
          );
        }

        return (
          <button
            key={page.id}
            ref={isActive ? activeTabRef : undefined}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            data-testid={`page-tab-${page.id}`}
            className={clsx("pages-tab-bar__tab", {
              "pages-tab-bar__tab--active": isActive,
              "pages-tab-bar__tab--drop-target": isDropTarget,
            })}
            onClick={() => {
              if (!isActive) {
                actionManager.executeAction(actionSwitchPage, "ui", page.id);
              }
            }}
            onDoubleClick={() => startRename(page)}
            onKeyDown={(e) => handleTabKeyDown(e, index, page)}
            draggable={!isViewMode}
            onDragStart={(e) => handleDragStart(e, page.id)}
            onDragOver={(e) => handleDragOver(e, page.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, page.id)}
            onDragEnd={handleDragEnd}
          >
            {page.name}
          </button>
        );
      })}

      {!isViewMode && activePage && (
        <DropdownMenu open={isMenuOpen}>
          <DropdownMenu.Trigger
            onToggle={() => setIsMenuOpen(!isMenuOpen)}
            className="pages-tab-bar__menu-trigger"
            aria-label={t("pages.pageMenu")}
            data-testid="pages-menu-trigger"
          >
            {DotsHorizontalIcon}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            onClickOutside={() => setIsMenuOpen(false)}
            onSelect={() => setIsMenuOpen(false)}
            className="pages-tab-bar__menu-content"
            align="start"
          >
            <DropdownMenu.Item
              data-testid="page-menu-rename"
              onSelect={() => {
                startRename(activePage);
              }}
            >
              {t("pages.renamePage")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              data-testid="page-menu-move-left"
              disabled={activePageIndex <= 0}
              onSelect={() => {
                actionManager.executeAction(
                  actionMovePageLeft,
                  "ui",
                  activePage.id,
                );
              }}
            >
              {t("pages.movePageLeft")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              data-testid="page-menu-move-right"
              disabled={activePageIndex >= visiblePages.length - 1}
              onSelect={() => {
                actionManager.executeAction(
                  actionMovePageRight,
                  "ui",
                  activePage.id,
                );
              }}
            >
              {t("pages.movePageRight")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              data-testid="page-menu-delete"
              icon={TrashIcon}
              disabled={visiblePages.length <= 1}
              onSelect={() => {
                actionManager.executeAction(
                  actionDeletePage,
                  "ui",
                  activePage.id,
                );
              }}
            >
              {t("pages.deletePage")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      )}

      {!isViewMode && (
        <button
          type="button"
          className="pages-tab-bar__add"
          aria-label={t("pages.addPage")}
          title={t("pages.addPage")}
          data-testid="pages-add-button"
          onClick={() => actionManager.executeAction(actionAddPage, "ui")}
        >
          {PlusIcon}
        </button>
      )}
    </div>
  );
};

PagesTabBar.displayName = "PagesTabBar";

export default PagesTabBar;
