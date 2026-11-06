Changes asked for this step:

Re-review after Gate 3 revisions. Review only the changes made since your previous review (its findings were fixed or held, see .sdlc/runs/20261106-152445-feature-new-pages/review.round1.json), reading each as `git diff <git_head_before> -- <file>`:
1. packages/excalidraw/data/blob.ts: loadSceneOrLibraryFromBlob now skips getScrollToContentState only when data.appState.pages has length > 1; single-page and legacy imports keep scrolling to content as at HEAD (the user's resolution of your held blob.ts finding).
2. packages/element/src/Scene.ts setActivePageId: on a real page change it now sets `this.sceneNonce = ((this.sceneNonce ?? 0) + 1) | 0` (no random draw), so the renderer's memo keyed on getSceneNonce() is invalidated after a page switch made with informMutation: false. Check that it cannot collide with a nonce from randomInteger() in a way that serves a stale cached render, and that it makes no new random draw on mount, restore, legacy load or element creation.
3. packages/excalidraw/tests/pages.test.tsx: three new tests — AC-2 renderStaticScene visibleElements/elementsMap hold only page B's element (with API.setAppState({ width: 800, height: 600 }), since jsdom has no layout); AC-2 a click where a page-A element sits selects nothing on page B; AC-7 reorder pages, serializeAsJSON, restore, order and each element's page survive.
4. packages/excalidraw/components/ConvertElementTypePopup.tsx is back at HEAD.
Suite results (already run; do not re-run): `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` exit 0; 152/152 files, 2649 passed, 47 skipped. Snapshots: contextmenu +204, history +756, regressionTests +624 lines, 0 removed or changed; export.test.tsx.snap unchanged.
Write the new review.json (findings only on these changes; a verdict of approve when none).

Edit the pieces you handed in and hand each changed one in again.