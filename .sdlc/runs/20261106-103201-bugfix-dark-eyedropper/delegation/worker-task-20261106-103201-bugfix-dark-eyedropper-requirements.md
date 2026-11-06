Changes asked for this step:

Gate 1 (revision 1) revise, the person's words verbatim:

"revise: add AC-8 — a test in colors.test.ts spies on Map.prototype.set, calls invertDarkModeFilter on an unreachable pixel (e.g. #0000ff) and on a reachable one, and asserts set was never called; no export of DARK_MODE_COLORS_CACHE."

Facts checked in the session (for the revision, not new scope): vitest.config.mts sets environment "jsdom" (line 84) and colors.test.ts has no @vitest-environment override, so DARK_MODE_COLORS_CACHE is a live Map in that test file, not null. vi.spyOn(Map.prototype, "set") records 1 call when the cached applyDarkModeFilter runs on an uncached colour, so AC-8 fails if invertDarkModeFilter goes through the cache. #0000ff is unreachable by the dark transform, so the inverse runs its full ±3 search on it; a reachable example is applyDarkModeFilter("#1e1e1e") = #d3d3d3. The spy must be restored after the test.

What to change in requirements.md:
1. Add AC-8 after AC-7, in the same style: "AC-8 — Cache untouched by the inverse": a unit test in packages/common/src/colors.test.ts spies on Map.prototype.set (vi.spyOn), calls invertDarkModeFilter on an unreachable pixel (#0000ff, where the full ±3 search runs) and on a reachable one (#d3d3d3 = applyDarkModeFilter("#1e1e1e"), computed before the spy is installed so the forward call's own cache write is not counted), asserts set was never called, and restores the spy afterwards (mockRestore, also on failure, e.g. in a finally or afterEach). DARK_MODE_COLORS_CACHE is not exported for this; the test relies on the vitest jsdom environment (vitest.config.mts line 84; colors.test.ts has no @vitest-environment override), where the cache is a live Map.
2. Link NFR-4 to AC-8 (one short clause: "verified by AC-8").
3. In "In scope" item 2 (colors.test.ts), add the cache-untouched spy test to the list of tests.
4. Add to Out of scope: exporting DARK_MODE_COLORS_CACHE (or any test-only accessor to it).
5. Keep AC-1..AC-7 and every other section unchanged. No new open questions.

Edit the pieces you handed in and hand each changed one in again.