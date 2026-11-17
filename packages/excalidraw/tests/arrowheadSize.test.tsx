import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { restoreElements } from "../data/restore";
import { exportScene } from "../scene/export";

import { API } from "./helpers/api";

const makeArrow = (extra: Record<string, unknown> = {}) => ({
  ...API.createElement({
    type: "arrow",
    width: 100,
    height: 0,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
    endArrowhead: "triangle",
  }),
  ...extra,
});

const restoreOne = (el: any) => restoreElements([el], null)[0] as any;

const headPathD = async (el: any) => {
  const svg = await exportScene({
    type: "svg",
    data: { elements: [el], appState: {}, files: null },
  });
  return Array.from(svg.querySelectorAll("path")).map((p) =>
    p.getAttribute("d"),
  );
};

const pathExtent = (ds: (string | null)[]) => {
  const nums = ds
    .join(" ")
    .match(/-?\d+(\.\d+)?/g)!
    .map(Number);
  return Math.max(...nums) - Math.min(...nums);
};

describe("arrowheadSize", () => {
  it("restores with the size and exports a smaller head", async () => {
    const small = restoreOne(makeArrow({ arrowheadSize: 0.5 }));
    const plain = restoreOne(makeArrow());
    expect(small.arrowheadSize).toBe(0.5);

    const smallD = await headPathD(small);
    const plainD = await headPathD(plain);
    expect(smallD).not.toEqual(plainD);
    expect(pathExtent(smallD)).toBeLessThan(pathExtent(plainD));
  });

  it("does not add the key to old arrows", () => {
    expect("arrowheadSize" in restoreOne(makeArrow())).toBe(false);
  });

  it("clamps and drops invalid values", () => {
    expect(restoreOne(makeArrow({ arrowheadSize: 10 })).arrowheadSize).toBe(3);
    expect(restoreOne(makeArrow({ arrowheadSize: 0 })).arrowheadSize).toBe(
      0.25,
    );
    for (const bad of ["x", NaN, Infinity, null]) {
      expect(
        "arrowheadSize" in restoreOne(makeArrow({ arrowheadSize: bad })),
      ).toBe(false);
    }
  });
});
