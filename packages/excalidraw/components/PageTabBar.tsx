import clsx from "clsx";
import { useRef, useState } from "react";

import { getVisiblePages } from "@excalidraw/element";

import {
  actionCreatePage,
  actionDeletePage,
  actionMovePage,
  actionRenamePage,
  actionSwitchPage,
} from "../actions/actionPages";
import { t } from "../i18n";

import { useApp } from "./App";
import ConfirmDialog from "./ConfirmDialog";
import {
  PlusIcon,
  TrashIcon,
  chevronLeftIcon,
  chevronRight,
  pencilIcon,
} from "./icons";

import "./PageTabBar.scss";

import type { ActionManager } from "../actions/manager";
import type { UIAppState } from "../types";

const PageTabBar = ({
  appState,
  actionManager,
}: {
  appState: UIAppState;
  actionManager: ActionManager;
}) => {
  const app = useApp();
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const renamingPageIdRef = useRef<string | null>(null);
  const [pendingDeletePageId, setPendingDeletePageId] = useState<string | null>(
    null,
  );

  const pages = getVisiblePages(appState.pages);
  const isEditable = !appState.viewModeEnabled;
  const activeIndex = pages.findIndex(
    (page) => page.id === appState.activePageId,
  );
  const activePage = activeIndex >= 0 ? pages[activeIndex] : null;
  const pendingDeletePage =
    pendingDeletePageId !== null
      ? pages.find((page) => page.id === pendingDeletePageId) ?? null
      : null;

  const startRename = (pageId: string) => {
    renamingPageIdRef.current = pageId;
    setRenamingPageId(pageId);
  };

  const cancelRename = () => {
    renamingPageIdRef.current = null;
    setRenamingPageId(null);
  };

  const commitRename = (pageId: string, name: string) => {
    if (renamingPageIdRef.current !== pageId) {
      return;
    }
    renamingPageIdRef.current = null;
    actionManager.executeAction(actionRenamePage, "ui", { pageId, name });
    setRenamingPageId(null);
  };

  const requestDelete = (pageId: string) => {
    const hasElements = app.scene
      .getAllPagesElementsIncludingDeleted()
      .some((element) => element.pageId === pageId && !element.isDeleted);
    if (hasElements) {
      setPendingDeletePageId(pageId);
    } else {
      actionManager.executeAction(actionDeletePage, "ui", pageId);
    }
  };

  return (
    <div className="page-tab-bar" data-testid="page-tab-bar">
      <div role="tablist" aria-label={t("pages.tabBar")}>
        {pages.map((page) => {
          const isActive = page.id === appState.activePageId;
          if (isEditable && renamingPageId === page.id) {
            return (
              <input
                key={page.id}
                className="page-tab-bar__rename-input"
                aria-label={t("pages.renameInput")}
                data-testid="page-rename-input"
                autoFocus
                defaultValue={page.name}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitRename(page.id, event.currentTarget.value);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    cancelRename();
                  }
                }}
                onKeyUp={(event) => event.stopPropagation()}
                onBlur={(event) => {
                  commitRename(page.id, event.currentTarget.value);
                }}
              />
            );
          }
          return (
            <button
              key={page.id}
              type="button"
              role="tab"
              className={clsx("page-tab-bar__tab", {
                "page-tab-bar__tab--active": isActive,
              })}
              aria-selected={isActive}
              data-testid={`page-tab-${page.id}`}
              onClick={() =>
                actionManager.executeAction(actionSwitchPage, "ui", page.id)
              }
              onDoubleClick={() => {
                if (isEditable) {
                  startRename(page.id);
                }
              }}
            >
              {page.name}
            </button>
          );
        })}
      </div>
      {isEditable && (
        <>
          {activePage && (
            <>
              <button
                type="button"
                className="page-tab-bar__icon-button"
                aria-label={t("pages.rename")}
                title={t("pages.rename")}
                data-testid="page-rename"
                onClick={() => startRename(activePage.id)}
              >
                {pencilIcon}
              </button>
              <button
                type="button"
                className="page-tab-bar__icon-button"
                aria-label={t("pages.moveLeft")}
                title={t("pages.moveLeft")}
                data-testid="page-move-left"
                disabled={activeIndex <= 0}
                onClick={() =>
                  actionManager.executeAction(actionMovePage, "ui", {
                    pageId: activePage.id,
                    direction: -1,
                  })
                }
              >
                {chevronLeftIcon}
              </button>
              <button
                type="button"
                className="page-tab-bar__icon-button"
                aria-label={t("pages.moveRight")}
                title={t("pages.moveRight")}
                data-testid="page-move-right"
                disabled={activeIndex >= pages.length - 1}
                onClick={() =>
                  actionManager.executeAction(actionMovePage, "ui", {
                    pageId: activePage.id,
                    direction: 1,
                  })
                }
              >
                {chevronRight}
              </button>
              <button
                type="button"
                className="page-tab-bar__icon-button"
                aria-label={t("pages.delete")}
                title={t("pages.delete")}
                data-testid="page-delete"
                disabled={pages.length <= 1}
                onClick={() => requestDelete(activePage.id)}
              >
                {TrashIcon}
              </button>
            </>
          )}
          <button
            type="button"
            className="page-tab-bar__icon-button"
            aria-label={t("pages.newPage")}
            title={t("pages.newPage")}
            data-testid="page-add"
            onClick={() => actionManager.executeAction(actionCreatePage)}
          >
            {PlusIcon}
          </button>
        </>
      )}
      {pendingDeletePage && (
        <ConfirmDialog
          title={t("pages.deleteConfirmTitle")}
          onConfirm={() => {
            actionManager.executeAction(
              actionDeletePage,
              "ui",
              pendingDeletePage.id,
            );
            setPendingDeletePageId(null);
          }}
          onCancel={() => setPendingDeletePageId(null)}
        >
          <p>{t("pages.deleteConfirm", { name: pendingDeletePage.name })}</p>
        </ConfirmDialog>
      )}
    </div>
  );
};

export default PageTabBar;
PageTabBar.displayName = "PageTabBar";
