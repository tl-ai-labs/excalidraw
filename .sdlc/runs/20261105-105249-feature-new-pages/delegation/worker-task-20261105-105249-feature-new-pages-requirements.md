Changes asked for this step:

Gate 1 revise from the person, verbatim: "(1) FR-6 allows undo to "switch cleanly" to another page, but the brief says undo stays on its page. (2) FR-16 and AC-6 name exportToCanvas, exportToSvg and exportToBlob, which don't exist at this commit; the export entry points are exportScene and exportToClipboard in packages/excalidraw/scene/export.ts."

Make exactly these two changes and nothing else:
1. FR-6 (and AC-5 only where it repeats the same allowance): undo/redo stays on its page. Remove any allowance for undo or redo to switch the active page; undo/redo on a page applies only to that page's history and never switches pages or mutates other pages.
2. FR-16 and AC-6: replace exportToCanvas, exportToSvg and exportToBlob with the export entry points that exist at this commit, exportScene and exportToClipboard in packages/excalidraw/scene/export.ts. Check that file to confirm the names before writing.
Do not add, remove or reword any other requirement, section or acceptance criterion. In particular do not add anything about page ids on collaborator cursors, follow mode, or how deleting a page is handled.

Edit the pieces you handed in and hand each changed one in again.