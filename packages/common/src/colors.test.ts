import {
  applyDarkModeFilter,
  COLOR_PALETTE,
  revertDarkModeFilter,
  rgbToHex,
} from "@excalidraw/common";

describe("COLOR_PALETTE", () => {
  it("color palette doesn't regress", () => {
    expect(COLOR_PALETTE).toMatchSnapshot();
  });
});

describe("applyDarkModeFilter", () => {
  describe("basic transformations", () => {
    it("transforms black to near-white", () => {
      const result = applyDarkModeFilter("#000000");
      // Black inverted 93% + hue rotate should be near white/light gray
      expect(result).toBe("#ededed");
    });

    it("transforms white to near-black", () => {
      const result = applyDarkModeFilter("#ffffff");
      // White inverted 93% should be near black/dark gray
      expect(result).toBe("#121212");
    });

    it("transforms pure red", () => {
      const result = applyDarkModeFilter("#ff0000");
      // Invert 93% + hue rotate 180deg produces a cyan-ish tint
      expect(result).toBe("#ff9090");
    });

    it("transforms pure green", () => {
      const result = applyDarkModeFilter("#00ff00");
      // Invert 93% + hue rotate 180deg
      expect(result).toBe("#008f00");
    });

    it("transforms pure blue", () => {
      const result = applyDarkModeFilter("#0000ff");
      // Invert 93% + hue rotate 180deg produces a light purple
      expect(result).toBe("#cdcdff");
    });
  });

  describe("color formats", () => {
    it("handles hex with hash", () => {
      const result = applyDarkModeFilter("#ff0000");
      // Fully opaque colors return 6-char hex
      expect(result).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("handles named colors", () => {
      const result = applyDarkModeFilter("red");
      // "red" = #ff0000, fully opaque
      expect(result).toBe("#ff9090");
    });

    it("handles rgb format", () => {
      const result = applyDarkModeFilter("rgb(255, 0, 0)");
      expect(result).toBe("#ff9090");
    });

    it("handles rgba format and preserves alpha", () => {
      const result = applyDarkModeFilter("rgba(255, 0, 0, 0.5)");
      expect(result).toMatch(/^#[0-9a-f]{8}$/);
      // Alpha 0.5 = 128 in hex = 80
      expect(result).toBe("#ff909080");
    });

    it("handles transparent", () => {
      const result = applyDarkModeFilter("transparent");
      // transparent = rgba(0,0,0,0), inverted should still have 0 alpha
      expect(result).toBe("#ededed00");
    });

    it("handles shorthand hex", () => {
      const result = applyDarkModeFilter("#f00");
      expect(result).toBe("#ff9090");
    });
  });

  describe("alpha preservation", () => {
    it("omits alpha for full opacity", () => {
      const result = applyDarkModeFilter("#ff0000ff");
      // Full opacity returns 6-char hex (no alpha suffix)
      expect(result).toBe("#ff9090");
    });

    it("preserves 50% opacity", () => {
      const result = applyDarkModeFilter("#ff000080");
      expect(result.slice(-2)).toBe("80");
    });

    it("preserves 0% opacity", () => {
      const result = applyDarkModeFilter("#ff000000");
      expect(result.slice(-2)).toBe("00");
    });
  });

  describe("COLOR_PALETTE regression tests", () => {
    it("transforms black from palette", () => {
      // COLOR_PALETTE.black is #1e1e1e (not pure black)
      const result = applyDarkModeFilter(COLOR_PALETTE.black);
      expect(result).toBe("#d3d3d3");
    });

    it("transforms white from palette", () => {
      const result = applyDarkModeFilter(COLOR_PALETTE.white);
      expect(result).toBe("#121212");
    });

    it("transforms transparent from palette", () => {
      const result = applyDarkModeFilter(COLOR_PALETTE.transparent);
      expect(result).toBe("#ededed00");
    });

    // Test each color family from the palette (all opaque, so 6-char hex)
    describe("red shades", () => {
      const redShades = COLOR_PALETTE.red;
      it.each(redShades.map((color, i) => [color, i]))(
        "transforms red shade %s (index %d)",
        (color) => {
          const result = applyDarkModeFilter(color as string);
          expect(result).toMatch(/^#[0-9a-f]{6}$/);
        },
      );
    });

    describe("blue shades", () => {
      const blueShades = COLOR_PALETTE.blue;
      it.each(blueShades.map((color, i) => [color, i]))(
        "transforms blue shade %s (index %d)",
        (color) => {
          const result = applyDarkModeFilter(color as string);
          expect(result).toMatch(/^#[0-9a-f]{6}$/);
        },
      );
    });

    describe("green shades", () => {
      const greenShades = COLOR_PALETTE.green;
      it.each(greenShades.map((color, i) => [color, i]))(
        "transforms green shade %s (index %d)",
        (color) => {
          const result = applyDarkModeFilter(color as string);
          expect(result).toMatch(/^#[0-9a-f]{6}$/);
        },
      );
    });

    describe("gray shades", () => {
      const grayShades = COLOR_PALETTE.gray;
      it.each(grayShades.map((color, i) => [color, i]))(
        "transforms gray shade %s (index %d)",
        (color) => {
          const result = applyDarkModeFilter(color as string);
          expect(result).toMatch(/^#[0-9a-f]{6}$/);
        },
      );
    });

    describe("bronze shades", () => {
      const bronzeShades = COLOR_PALETTE.bronze;
      it.each(bronzeShades.map((color, i) => [color, i]))(
        "transforms bronze shade %s (index %d)",
        (color) => {
          const result = applyDarkModeFilter(color as string);
          expect(result).toMatch(/^#[0-9a-f]{6}$/);
        },
      );
    });

    // Snapshot test for full palette to catch any regressions
    it("matches snapshot for all palette colors", () => {
      const transformedPalette: Record<string, string | string[]> = {};

      transformedPalette.black = applyDarkModeFilter(COLOR_PALETTE.black);
      transformedPalette.white = applyDarkModeFilter(COLOR_PALETTE.white);
      transformedPalette.transparent = applyDarkModeFilter(
        COLOR_PALETTE.transparent,
      );

      // Transform color arrays
      for (const colorName of [
        "gray",
        "red",
        "pink",
        "grape",
        "violet",
        "blue",
        "cyan",
        "teal",
        "green",
        "yellow",
        "orange",
        "bronze",
      ] as const) {
        const shades = COLOR_PALETTE[colorName];
        transformedPalette[colorName] = shades.map((shade) =>
          applyDarkModeFilter(shade),
        );
      }

      expect(transformedPalette).toMatchSnapshot();
    });
  });

  describe("caching", () => {
    it("returns same result for same input (cached)", () => {
      const result1 = applyDarkModeFilter("#ff0000");
      const result2 = applyDarkModeFilter("#ff0000");
      expect(result1).toBe(result2);
    });
  });
});

describe("revertDarkModeFilter", () => {
  it("returns input unchanged when disabled", () => {
    expect(revertDarkModeFilter("#d3d3d3", false)).toBe("#d3d3d3");
  });

  it("reverts basic dark mode colors", () => {
    expect(revertDarkModeFilter("#ededed")).toBe("#000000");
    expect(revertDarkModeFilter("#121212")).toBe("#ffffff");
    expect(revertDarkModeFilter("#d3d3d3")).toBe("#1e1e1e");
    expect(revertDarkModeFilter("#39994b")).toBe("#2f9e44");
    expect(revertDarkModeFilter("#56a2e8")).toBe("#1971c2");
  });

  it("round-trips non-clamped colors through applyDarkModeFilter", () => {
    const colors = [
      "#000000",
      "#ffffff",
      COLOR_PALETTE.black,
      COLOR_PALETTE.gray[0],
      COLOR_PALETTE.gray[1],
      COLOR_PALETTE.gray[2],
      COLOR_PALETTE.gray[3],
      COLOR_PALETTE.green[4],
      COLOR_PALETTE.blue[4],
      COLOR_PALETTE.teal[4],
      COLOR_PALETTE.cyan[4],
    ];

    for (const color of colors) {
      expect(revertDarkModeFilter(applyDarkModeFilter(color))).toBe(color);
    }
  });

  it("round-trips all COLOR_PALETTE colors to the same dark-mode screen color", () => {
    const paletteColors: string[] = [COLOR_PALETTE.black, COLOR_PALETTE.white];
    for (const key of [
      "gray",
      "red",
      "pink",
      "grape",
      "violet",
      "blue",
      "cyan",
      "teal",
      "green",
      "yellow",
      "orange",
      "bronze",
    ] as const) {
      paletteColors.push(...COLOR_PALETTE[key]);
    }

    for (const color of paletteColors) {
      const darkColor = applyDarkModeFilter(color);
      const reverted = revertDarkModeFilter(darkColor);
      expect(applyDarkModeFilter(reverted)).toBe(darkColor);
    }
  });

  it("preserves alpha", () => {
    const darkSemi = applyDarkModeFilter("rgba(30, 30, 30, 0.5)");
    expect(revertDarkModeFilter(darkSemi)).toBe("#1e1e1e80");
    expect(revertDarkModeFilter("#ededed00")).toBe("#00000000");
  });

  it("caches repeated calls", () => {
    expect(revertDarkModeFilter("#d3d3d3")).toBe(
      revertDarkModeFilter("#d3d3d3"),
    );
  });
});

describe("rgbToHex", () => {
  describe("basic RGB conversion", () => {
    it("converts black (0,0,0)", () => {
      expect(rgbToHex(0, 0, 0)).toBe("#000000");
    });

    it("converts white (255,255,255)", () => {
      expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
    });

    it("converts red (255,0,0)", () => {
      expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
    });

    it("converts green (0,255,0)", () => {
      expect(rgbToHex(0, 255, 0)).toBe("#00ff00");
    });

    it("converts blue (0,0,255)", () => {
      expect(rgbToHex(0, 0, 255)).toBe("#0000ff");
    });

    it("converts arbitrary color", () => {
      expect(rgbToHex(30, 30, 30)).toBe("#1e1e1e");
    });
  });

  describe("leading zeros preservation", () => {
    it("preserves leading zeros for low values", () => {
      expect(rgbToHex(0, 0, 1)).toBe("#000001");
      expect(rgbToHex(0, 1, 0)).toBe("#000100");
      expect(rgbToHex(1, 0, 0)).toBe("#010000");
    });

    it("preserves zeros for single-digit hex values", () => {
      expect(rgbToHex(15, 15, 15)).toBe("#0f0f0f");
    });
  });

  describe("alpha handling", () => {
    it("omits alpha when undefined", () => {
      expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
      expect(rgbToHex(255, 0, 0, undefined)).toBe("#ff0000");
    });

    it("omits alpha when fully opaque (1)", () => {
      expect(rgbToHex(255, 0, 0, 1)).toBe("#ff0000");
    });

    it("includes alpha for semi-transparent (0.5)", () => {
      // 0.5 * 255 = 127.5 -> rounds to 128 = 0x80
      expect(rgbToHex(255, 0, 0, 0.5)).toBe("#ff000080");
    });

    it("includes alpha for fully transparent (0)", () => {
      expect(rgbToHex(255, 0, 0, 0)).toBe("#ff000000");
    });

    it("includes alpha for near-opaque (0.99)", () => {
      // 0.99 * 255 = 252.45 -> rounds to 252 = 0xfc
      expect(rgbToHex(255, 0, 0, 0.99)).toBe("#ff0000fc");
    });

    it("pads alpha with leading zero when needed", () => {
      // 0.05 * 255 = 12.75 -> rounds to 13 = 0x0d
      expect(rgbToHex(255, 0, 0, 0.05)).toBe("#ff00000d");
    });
  });
});
