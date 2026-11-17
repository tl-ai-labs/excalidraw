import { reconcilePages } from "@excalidraw/element";

import type { Page } from "@excalidraw/element/types";

const page = (
  id: string,
  version: number,
  versionNonce: number,
  extra: Partial<Page> = {},
): Page => ({
  id,
  name: id,
  index: "a0" as Page["index"],
  version,
  versionNonce,
  isDeleted: false,
  ...extra,
});

describe("reconcilePages", () => {
  it("merges per page id, higher version wins", () => {
    const result = reconcilePages(
      [page("a", 1, 1, { name: "old" }), page("only-local", 1, 1)],
      [page("a", 2, 9, { name: "new" }), page("only-remote", 1, 1)],
    );
    expect(result.map((p) => p.id).sort()).toEqual([
      "a",
      "only-local",
      "only-remote",
    ]);
    expect(result.find((p) => p.id === "a")!.name).toBe("new");
  });

  it("breaks version ties with the lower versionNonce", () => {
    const a = page("a", 3, 10, { name: "high-nonce" });
    const b = page("a", 3, 2, { name: "low-nonce" });
    expect(reconcilePages([a], [b])[0].name).toBe("low-nonce");
    expect(reconcilePages([b], [a])[0].name).toBe("low-nonce");
  });

  it("keeps tombstones", () => {
    const result = reconcilePages(
      [page("a", 1, 1)],
      [page("a", 2, 1, { isDeleted: true })],
    );
    expect(result).toHaveLength(1);
    expect(result[0].isDeleted).toBe(true);
  });
});
