import clsx from "clsx";
import { useState } from "react";

import {
  actionCreatePage,
  actionDeletePage,
  actionRenamePage,
  actionReorderPages,
  actionSwitchPage,
} from "../actions";
import { t } from "../i18n";

import "./PageTabBar.scss";

import type { ActionManager } from "../actions/manager";
import type { ExcalidrawPage, UIAppState } from "../types";

export const PageTabBar = (props: {
  appState: UIAppState;
  actionManager: ActionManager;
}) => {
  const { appState, actionManager } = props;
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const startRenaming = (page: ExcalidrawPage) => {
    setRenamingPageId(page.id);
    setDraftName(page.name);
  };

  const commitRenaming = (pageId: string) => {
    if (renamingPageId !== pageId) {
      return;
    }
    actionManager.executeAction(actionRenamePage, "ui", {
      id: pageId,
      name: draftName,
    });
    setRenamingPageId(null);
  };

  const cancelRenaming = () => {
    setRenamingPageId(null);
  };

  return (
    <div
      className={clsx("page-tab-bar", "zen-mode-transition", {
        "layer-ui__wrapper__footer-left--transition-bottom":
          appState.zenModeEnabled,
      })}
      data-testid="page-tab-bar"
      role="tablist"
      aria-label={t("pages.title")}
    >
      {appState.pages.map((page, index) => {
        const isActive = page.id === appState.activePageId;
        const isRenaming =
          renamingPageId === page.id && !appState.viewModeEnabled;

        return (
          <div
            key={page.id}
            className={clsx("page-tab-bar__item", {
              "page-tab-bar__item--active": isActive,
            })}
          >
            {isRenaming ? (
              <input
                type="text"
                data-testid="page-rename-input"
                className="page-tab-bar__rename-input"
                aria-label={t("pages.pageName")}
                value={draftName}
                autoFocus
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => commitRenaming(page.id)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    commitRenaming(page.id);
                  } else if (event.key === "Escape") {
                    cancelRenaming();
                  }
                }}
              />
            ) : (
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`page-tab-${page.id}`}
                className={clsx("page-tab-bar__tab", {
                  "page-tab-bar__tab--active": isActive,
                })}
                onClick={() =>
                  actionManager.executeAction(actionSwitchPage, "ui", page.id)
                }
                onDoubleClick={() =>
                  !appState.viewModeEnabled && startRenaming(page)
                }
              >
                {page.name}
              </button>
            )}

            {!appState.viewModeEnabled && isActive && !isRenaming && (
              <div className="page-tab-bar__actions">
                <button
                  type="button"
                  className="page-tab-bar__action-btn"
                  data-testid={`page-rename-${page.id}`}
                  aria-label={t("pages.renamePage")}
                  title={t("pages.renamePage")}
                  onClick={() => startRenaming(page)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="page-tab-bar__action-btn"
                  data-testid={`page-move-left-${page.id}`}
                  aria-label={t("pages.moveLeft")}
                  title={t("pages.moveLeft")}
                  disabled={index === 0}
                  onClick={() =>
                    actionManager.executeAction(actionReorderPages, "ui", {
                      fromIndex: index,
                      toIndex: index - 1,
                    })
                  }
                >
                  ←
                </button>
                <button
                  type="button"
                  className="page-tab-bar__action-btn"
                  data-testid={`page-move-right-${page.id}`}
                  aria-label={t("pages.moveRight")}
                  title={t("pages.moveRight")}
                  disabled={index === appState.pages.length - 1}
                  onClick={() =>
                    actionManager.executeAction(actionReorderPages, "ui", {
                      fromIndex: index,
                      toIndex: index + 1,
                    })
                  }
                >
                  →
                </button>
                <button
                  type="button"
                  className="page-tab-bar__action-btn"
                  data-testid={`page-delete-${page.id}`}
                  aria-label={t("pages.deletePage")}
                  title={t("pages.deletePage")}
                  disabled={appState.pages.length <= 1}
                  onClick={() =>
                    actionManager.executeAction(actionDeletePage, "ui", page.id)
                  }
                >
                  ×
                </button>
              </div>
            )}
          </div>
        );
      })}

      {!appState.viewModeEnabled && (
        <button
          type="button"
          className="page-tab-bar__add-btn"
          data-testid="page-add-button"
          aria-label={t("pages.addPage")}
          title={t("pages.addPage")}
          onClick={() => actionManager.executeAction(actionCreatePage, "ui")}
        >
          +
        </button>
      )}
    </div>
  );
};
