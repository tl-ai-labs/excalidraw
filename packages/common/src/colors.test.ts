import {
  applyDarkModeFilter,
  COLOR_PALETTE,
  matchDarkModeColor,
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

// These colours are clamped by the forward hue-rotate, so the original is
// unrecoverable. A new miss must be added here on purpose, never by widening
// the tolerance.
const ROUND_TRIP_EXCEPTIONS: readonly {
  name: string;
  color: string;
  roundTrip: string;
  error: number[];
}[] = [
  {
    name: "red[4]",
    color: "#e03131",
    roundTrip: "#ce3e3e",
    error: [-18, 13, 13],
  },
  {
    name: "pink[4]",
    color: "#c2255c",
    roundTrip: "#b43067",
    error: [-14, 11, 11],
  },
  {
    name: "violet[3]",
    color: "#7950f2",
    roundTrip: "#7d54e2",
    error: [4, 4, -16],
  },
  {
    name: "violet[4]",
    color: "#6741d9",
    roundTrip: "#6a45c0",
    error: [3, 4, -25],
  },
  {
    name: "cyan[1]",
    color: "#99e9f2",
    roundTrip: "#9ce8f1",
    error: [3, -1, -1],
  },
  {
    name: "cyan[2]",
    color: "#3bc9db",
    roundTrip: "#40c5d6",
    error: [5, -4, -5],
  },
  {
    name: "teal[1]",
    color: "#96f2d7",
    roundTrip: "#9eebd0",
    error: [8, -7, -7],
  },
  {
    name: "teal[2]",
    color: "#38d9a9",
    roundTrip: "#46cd9d",
    error: [14, -12, -12],
  },
  {
    name: "yellow[1]",
    color: "#ffec99",
    roundTrip: "#f9e6ba",
    error: [-6, -6, 33],
  },
  {
    name: "yellow[2]",
    color: "#ffd43b",
    roundTrip: "#f3c885",
    error: [-12, -12, 74],
  },
  {
    name: "yellow[3]",
    color: "#fab005",
    roundTrip: "#efa447",
    error: [-11, -12, 66],
  },
  {
    name: "yellow[4]",
    color: "#f08c00",
    roundTrip: "#eb8715",
    error: [-5, -5, 21],
  },
  {
    name: "orange[2]",
    color: "#ffa94d",
    roundTrip: "#fea854",
    error: [-1, -1, 7],
  },
];

describe("revertDarkModeFilter", () => {
  const ROUND_TRIP_TOLERANCE = 1;

  const toChannels = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

  const subjects: { name: string; color: string }[] = [
    { name: "pure black", color: "#000000" },
    { name: "pure white", color: "#ffffff" },
    { name: "black", color: COLOR_PALETTE.black },
    { name: "white", color: COLOR_PALETTE.white },
  ];
  for (const family of [
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
    COLOR_PALETTE[family].forEach((shade, i) => {
      subjects.push({ name: `${family}[${i}]`, color: shade });
    });
  }

  const exceptionNames = new Set(
    ROUND_TRIP_EXCEPTIONS.map((entry) => entry.name),
  );

  it("reverts the dark-mode output of pure black, pure white and palette black", () => {
    expect(revertDarkModeFilter("#ededed")).toBe("#000000");
    expect(revertDarkModeFilter("#121212")).toBe("#ffffff");
    expect(revertDarkModeFilter("#d3d3d3")).toBe("#1e1e1e");
  });

  it("preserves alpha", () => {
    expect(revertDarkModeFilter("#d3d3d380")).toBe("#1e1e1e80");
    // Full opacity has no alpha suffix
    expect(revertDarkModeFilter("#d3d3d3ff")).toBe("#1e1e1e");
  });

  it("returns the input unchanged when disabled", () => {
    expect(revertDarkModeFilter("#d3d3d3", false)).toBe("#d3d3d3");
  });

  it.each(
    subjects
      .filter((subject) => !exceptionNames.has(subject.name))
      .map((subject) => [subject.name, subject.color]),
  )("round-trips %s within ±1 per channel", (_name, color) => {
    const roundTrip = revertDarkModeFilter(applyDarkModeFilter(color));
    expect(roundTrip).toMatch(/^#[0-9a-f]{6}$/);
    const original = toChannels(color);
    toChannels(roundTrip).forEach((channel, i) => {
      expect(Math.abs(channel - original[i])).toBeLessThanOrEqual(
        ROUND_TRIP_TOLERANCE,
      );
    });
  });

  it.each(ROUND_TRIP_EXCEPTIONS.map((entry) => [entry.name, entry]))(
    "records the measured round trip of clamped colour %s",
    (_name, entry) => {
      const roundTrip = revertDarkModeFilter(applyDarkModeFilter(entry.color));
      expect(roundTrip).toBe(entry.roundTrip);
      const original = toChannels(entry.color);
      expect(
        toChannels(roundTrip).map((channel, i) => channel - original[i]),
      ).toEqual(entry.error);
    },
  );

  it("lists only palette colours as exceptions", () => {
    for (const entry of ROUND_TRIP_EXCEPTIONS) {
      const subject = subjects.find((s) => s.name === entry.name);
      expect(subject).toBeDefined();
      expect(subject?.color).toBe(entry.color);
    }
  });
});

describe("matchDarkModeColor", () => {
  it("matches the dark-mode pixel of palette yellow[2] exactly", () => {
    expect(matchDarkModeColor(applyDarkModeFilter("#ffd43b"), [])).toBe(
      "#ffd43b",
    );
  });

  it.each(ROUND_TRIP_EXCEPTIONS.map((entry) => [entry.name, entry]))(
    "recovers clamped palette colour %s exactly",
    (_name, entry) => {
      expect(matchDarkModeColor(applyDarkModeFilter(entry.color), [])).toBe(
        entry.color,
      );
    },
  );

  it("prefers a scene colour over the palette and returns it verbatim", () => {
    expect(
      matchDarkModeColor(applyDarkModeFilter("#ffd43b"), ["#FFD43B"]),
    ).toBe("#FFD43B");
  });

  it("matches a scene colour that is not in the palette", () => {
    expect(
      matchDarkModeColor(applyDarkModeFilter("#123456"), [
        "#ffc9c9",
        "#123456",
      ]),
    ).toBe("#123456");
  });

  it("ignores alpha on the picked and the candidate colour", () => {
    expect(
      matchDarkModeColor(`${applyDarkModeFilter("#1e1e1e")}80`, ["#1e1e1e80"]),
    ).toBe("#1e1e1e80");
  });

  it("skips transparent and invalid scene colours", () => {
    // Both render like #000000 in dark mode, and no palette colour does
    expect(
      matchDarkModeColor(applyDarkModeFilter("#000000"), [
        "transparent",
        "not-a-colour",
      ]),
    ).toBeNull();
  });

  it("returns null when no candidate matches", () => {
    expect(matchDarkModeColor("#123456", [])).toBeNull();
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
