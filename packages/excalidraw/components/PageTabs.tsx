import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import { getVisiblePages } from "@excalidraw/element";

import type { ExcalidrawPage } from "@excalidraw/element/types";

import { t } from "../i18n";

import { useApp } from "./App";
import ConfirmDialog from "./ConfirmDialog";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import {
  DotsHorizontalIcon,
  PlusIcon,
  TrashIcon,
  chevronLeft,
  chevronRight,
  pencilIcon,
} from "./icons";

import "./PageTabs.scss";

import type { UIAppState } from "../types";

const PageNameInput = ({
  page,
  onDone,
}: {
  page: ExcalidrawPage;
  onDone: (name: string | null) => void;
}) => {
  const [value, setValue] = useState(page.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const done = (name: string | null) => {
    if (!doneRef.current) {
      doneRef.current = true;
      onDone(name);
    }
  };

  return (
    <input
      ref={inputRef}
      className="PageTabs__input"
      data-testid="page-tab-rename-input"
      aria-label={t("pages.pageName")}
      value={value}
      maxLength={100}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => done(value)}
      onKeyDown={(event) => {
        // keep the editor's shortcuts out of the input
        event.stopPropagation();
        if (event.key === "Enter") {
          done(value);
        } else if (event.key === "Escape") {
          done(null);
        }
      }}
    />
  );
};

/**
 * Tab bar of the drawing's pages: switch (click), add (+), rename
 * (double-click or menu), reorder (drag & drop or menu), delete (menu).
 */
export const PageTabs = ({ appState }: { appState: UIAppState }) => {
  const app = useApp();
  const pages = getVisiblePages(appState.pages);
  const canEdit = !appState.viewModeEnabled;

  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [menuPageId, setMenuPageId] = useState<string | null>(null);
  const [deletingPage, setDeletingPage] = useState<ExcalidrawPage | null>(null);
  const [dragPageId, setDragPageId] = useState<string | null>(null);

  const activeTabRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
  }, [appState.activePageId]);

  return (
    <div className="PageTabs" data-testid="page-tabs">
      <div
        className="PageTabs__list"
        role="tablist"
        aria-label={t("pages.title")}
      >
        {pages.map((page, index) => {
          const isActive = page.id === appState.activePageId;
          return (
            <div
              key={page.id}
              ref={isActive ? activeTabRef : undefined}
              className={clsx("PageTabs__tab", {
                "PageTabs__tab--active": isActive,
                "PageTabs__tab--dragging": dragPageId === page.id,
              })}
              draggable={canEdit && renamingPageId !== page.id}
              onDragStart={(event) => {
                setDragPageId(page.id);
                event.dataTransfer.effectAllowed = "move";
                // required by Firefox to start the drag
                event.dataTransfer.setData("text/plain", page.name);
              }}
              onDragOver={(event) => {
                if (dragPageId) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                if (dragPageId) {
                  event.preventDefault();
                  app.pages.move(dragPageId, index);
                  setDragPageId(null);
                }
              }}
              onDragEnd={() => setDragPageId(null)}
            >
              {renamingPageId === page.id ? (
                <PageNameInput
                  page={page}
                  onDone={(name) => {
                    setRenamingPageId(null);
                    if (name !== null) {
                      app.pages.rename(page.id, name);
                    }
                    app.focusContainer();
                  }}
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className="PageTabs__tab-button"
                  data-testid={`page-tab-${page.id}`}
                  title={page.name}
                  onClick={() => app.pages.setActive(page.id)}
                  onDoubleClick={() => canEdit && setRenamingPageId(page.id)}
                >
                  {page.name}
                </button>
              )}
              {canEdit && isActive && renamingPageId !== page.id && (
                <DropdownMenu open={menuPageId === page.id}>
                  <DropdownMenu.Trigger
                    className="PageTabs__menu-trigger"
                    onToggle={() =>
                      setMenuPageId(menuPageId === page.id ? null : page.id)
                    }
                    title={t("pages.options")}
                    aria-label={t("pages.options")}
                    data-testid="page-tab-menu"
                  >
                    {DotsHorizontalIcon}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    onClickOutside={() => setMenuPageId(null)}
                    onSelect={() => setMenuPageId(null)}
                    className="PageTabs__menu"
                  >
                    <DropdownMenu.Item
                      icon={pencilIcon}
                      data-testid="page-tab-menu-rename"
                      onSelect={() => setRenamingPageId(page.id)}
                    >
                      {t("pages.rename")}
                    </DropdownMenu.Item>
                    {index > 0 && (
                      <DropdownMenu.Item
                        icon={chevronLeft}
                        onSelect={() => app.pages.move(page.id, index - 1)}
                      >
                        {t("pages.moveLeft")}
                      </DropdownMenu.Item>
                    )}
                    {index < pages.length - 1 && (
                      <DropdownMenu.Item
                        icon={chevronRight}
                        onSelect={() => app.pages.move(page.id, index + 1)}
                      >
                        {t("pages.moveRight")}
                      </DropdownMenu.Item>
                    )}
                    {pages.length > 1 && (
                      <DropdownMenu.Item
                        icon={TrashIcon}
                        data-testid="page-tab-menu-delete"
                        onSelect={() => setDeletingPage(page)}
                      >
                        {t("pages.delete")}
                      </DropdownMenu.Item>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>
      {canEdit && (
        <button
          type="button"
          className="PageTabs__add"
          data-testid="page-tab-add"
          title={t("pages.addPage")}
          aria-label={t("pages.addPage")}
          onClick={() => app.pages.create()}
        >
          {PlusIcon}
        </button>
      )}
      {deletingPage && (
        <ConfirmDialog
          title={t("pages.deleteConfirmTitle")}
          onConfirm={() => {
            app.pages.delete(deletingPage.id);
            setDeletingPage(null);
          }}
          onCancel={() => setDeletingPage(null)}
        >
          <p className="clear-canvas__content">
            {t("pages.deleteConfirmMessage", { name: deletingPage.name })}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
};
