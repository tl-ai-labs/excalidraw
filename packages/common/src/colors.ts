import tinycolor from "tinycolor2";

import { clamp } from "@excalidraw/math";
import { degreesToRadians } from "@excalidraw/math";

import type { Degrees } from "@excalidraw/math";

// ---------------------------------------------------------------------------
// Dark mode color transformation
// ---------------------------------------------------------------------------

// Browser-only cache to avoid memory leaks on server
const DARK_MODE_COLORS_CACHE: Map<string, string> | null =
  typeof window !== "undefined" ? new Map() : null;

function cssHueRotate(
  red: number,
  green: number,
  blue: number,
  degrees: Degrees,
): { r: number; g: number; b: number } {
  // normalize
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;

  // Convert degrees to radians
  const a = degreesToRadians(degrees);

  const c = Math.cos(a);
  const s = Math.sin(a);

  // rotation matrix
  const matrix = [
    0.213 + c * 0.787 - s * 0.213,
    0.715 - c * 0.715 - s * 0.715,
    0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143,
    0.715 + c * 0.285 + s * 0.14,
    0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787,
    0.715 - c * 0.715 + s * 0.715,
    0.072 + c * 0.928 + s * 0.072,
  ];

  // transform
  const newR = r * matrix[0] + g * matrix[1] + b * matrix[2];
  const newG = r * matrix[3] + g * matrix[4] + b * matrix[5];
  const newB = r * matrix[6] + g * matrix[7] + b * matrix[8];

  // clamp the values to [0, 1] range and convert back to [0, 255]
  return {
    r: Math.round(Math.max(0, Math.min(1, newR)) * 255),
    g: Math.round(Math.max(0, Math.min(1, newG)) * 255),
    b: Math.round(Math.max(0, Math.min(1, newB)) * 255),
  };
}

const cssInvert = (
  r: number,
  g: number,
  b: number,
  percent: number,
): { r: number; g: number; b: number } => {
  const p = clamp(percent, 0, 100) / 100;

  // Function to invert a single color component
  const invertComponent = (color: number): number => {
    // Apply the invert formula
    const inverted = color * (1 - p) + (255 - color) * p;
    // Round to the nearest integer and clamp to [0, 255]
    return Math.round(clamp(inverted, 0, 255));
  };

  // Calculate the inverted RGB components
  const invertedR = invertComponent(r);
  const invertedG = invertComponent(g);
  const invertedB = invertComponent(b);

  return { r: invertedR, g: invertedG, b: invertedB };
};

const DARK_MODE_INVERT_PERCENT = 93;

// order of operations matters
// (corresponds to "filter: invert(invertPercent) hue-rotate(hueDegrees)" in css)
const darkModeFilterRgb = (r: number, g: number, b: number) => {
  const inverted = cssInvert(r, g, b, DARK_MODE_INVERT_PERCENT);
  return cssHueRotate(inverted.r, inverted.g, inverted.b, 180 as Degrees);
};

let paletteColors: Map<string, [number, number, number]> | null = null;
const getPaletteColors = () => {
  if (!paletteColors) {
    paletteColors = new Map();
    for (const c of Object.values(COLOR_PALETTE).flat()) {
      if (c !== "transparent") {
        const { r, g, b } = tinycolor(c).toRgb();
        paletteColors.set(rgbToHex(r, g, b), [r, g, b]);
      }
    }
  }
  return paletteColors;
};

/**
 * Inverse of `applyDarkModeFilter`: given a color as it appears on the
 * (dark-mode filtered) canvas, returns the original element color. Alpha is
 * preserved.
 *
 * The forward transform is invert(93%) followed by hue-rotate(180deg), each
 * with rounding, and the latter with clamping. Both are inverted analytically
 * (hue-rotate(180deg) is its own inverse; invert is linear), which gives an
 * estimate that may be off by a couple of units due to rounding. We then
 * search the neighbourhood (+-2 per channel) for the color whose forward
 * transform equals the input exactly.
 *
 * Guarantees: `apply(revert(apply(c))) === apply(c)` for every color `c`, i.e.
 * the result always looks identical on screen. The forward transform is lossy
 * (it squeezes 256 levels into ~220 per channel, rounds twice and clamps), so
 * several originals can share one on-screen color and the exact original
 * can't always be known. In that case the result is, among the colors that
 * render identically, a COLOR_PALETTE color if there's one, else the one
 * closest to the analytic estimate. Where the forward transform is injective
 * the result is exact; for strongly saturated colors that were clamped when
 * drawn, the original can't be known and a same-looking color is returned.
 * Inputs that are not an output of `apply` (e.g. antialiased pixels) resolve
 * to the closest color in output space.
 */
export const revertDarkModeFilter = (color: string, enable = true): string => {
  if (!enable) {
    return color;
  }

  const tc = tinycolor(color);
  const alpha = tc.getAlpha();
  const { r, g, b } = tc.toRgb();

  // hue-rotate(180deg) is an involution; apply it without rounding/clamping
  const a = degreesToRadians(180 as Degrees);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const m = [
    0.213 + cos * 0.787 - sin * 0.213,
    0.715 - cos * 0.715 - sin * 0.715,
    0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143,
    0.715 + cos * 0.285 + sin * 0.14,
    0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787,
    0.715 - cos * 0.715 + sin * 0.715,
    0.072 + cos * 0.928 + sin * 0.072,
  ];
  const p = DARK_MODE_INVERT_PERCENT / 100;
  const unrotated = [
    r * m[0] + g * m[1] + b * m[2],
    r * m[3] + g * m[4] + b * m[5],
    r * m[6] + g * m[7] + b * m[8],
  ];
  // invert: v = 255p + c(1 - 2p)
  const estimate = unrotated.map((v) =>
    clamp((v - 255 * p) / (1 - 2 * p), 0, 255),
  );
  const center = estimate.map((v) => Math.round(v));

  const palette = getPaletteColors();
  const candidates: [number, number, number][] = [...palette.values()];
  for (let dr = -2; dr <= 2; dr++) {
    for (let dg = -2; dg <= 2; dg++) {
      for (let db = -2; db <= 2; db++) {
        candidates.push([
          clamp(center[0] + dr, 0, 255),
          clamp(center[1] + dg, 0, 255),
          clamp(center[2] + db, 0, 255),
        ]);
      }
    }
  }

  let best = candidates[0];
  let bestScore = Infinity;
  for (const [cr, cg, cb] of candidates) {
    const f = darkModeFilterRgb(cr, cg, cb);
    const outDist = (f.r - r) ** 2 + (f.g - g) ** 2 + (f.b - b) ** 2;
    const estDist =
      (cr - estimate[0]) ** 2 +
      (cg - estimate[1]) ** 2 +
      (cb - estimate[2]) ** 2;
    // output-space match dominates, then known palette colors (the most
    // likely originals), then the distance to the analytic estimate
    const score =
      outDist * 1e6 + (palette.has(rgbToHex(cr, cg, cb)) ? 0 : 1e5) + estDist;
    if (score < bestScore) {
      bestScore = score;
      best = [cr, cg, cb];
    }
  }

  return rgbToHex(best[0], best[1], best[2], alpha);
};

export const applyDarkModeFilter = (color: string, enable = true): string => {
  if (!enable) {
    return color;
  }

  const cached = DARK_MODE_COLORS_CACHE?.get(color);
  if (cached) {
    return cached;
  }

  const tc = tinycolor(color);
  const alpha = tc.getAlpha();

  const rgb = tc.toRgb();
  const rotated = darkModeFilterRgb(rgb.r, rgb.g, rgb.b);

  const result = rgbToHex(rotated.r, rotated.g, rotated.b, alpha);

  if (DARK_MODE_COLORS_CACHE) {
    DARK_MODE_COLORS_CACHE.set(color, result);
  }

  return result;
};

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

// FIXME can't put to utils.ts rn because of circular dependency
const pick = <R extends Record<string, any>, K extends readonly (keyof R)[]>(
  source: R,
  keys: K,
) => {
  return keys.reduce((acc, key: K[number]) => {
    if (key in source) {
      acc[key] = source[key];
    }
    return acc;
  }, {} as Pick<R, K[number]>) as Pick<R, K[number]>;
};

export type ColorTuple = readonly [string, string, string, string, string];

// used general type instead of specific type (ColorPalette) to support custom colors
export type ColorPaletteCustom = { [key: string]: ColorTuple | string };
export type ColorShadesIndexes = [number, number, number, number, number];

export const MAX_CUSTOM_COLORS_USED_IN_CANVAS = 5;
export const COLORS_PER_ROW = 5;

export const DEFAULT_CHART_COLOR_INDEX = 4;

export const DEFAULT_ELEMENT_STROKE_COLOR_INDEX = 4;
export const DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX = 1;

export const COLOR_PALETTE = {
  transparent: "transparent",
  black: "#1e1e1e",
  white: "#ffffff",
  // open-color from https://github.com/yeun/open-color/blob/master/open-color.js
  // corresponds to indexes [0,2,4,6,8] (weights: 50, 200, 400, 600, 800)
  gray: ["#f8f9fa", "#e9ecef", "#ced4da", "#868e96", "#343a40"],
  red: ["#fff5f5", "#ffc9c9", "#ff8787", "#fa5252", "#e03131"],
  pink: ["#fff0f6", "#fcc2d7", "#f783ac", "#e64980", "#c2255c"],
  grape: ["#f8f0fc", "#eebefa", "#da77f2", "#be4bdb", "#9c36b5"],
  violet: ["#f3f0ff", "#d0bfff", "#9775fa", "#7950f2", "#6741d9"],
  blue: ["#e7f5ff", "#a5d8ff", "#4dabf7", "#228be6", "#1971c2"],
  cyan: ["#e3fafc", "#99e9f2", "#3bc9db", "#15aabf", "#0c8599"],
  teal: ["#e6fcf5", "#96f2d7", "#38d9a9", "#12b886", "#099268"],
  green: ["#ebfbee", "#b2f2bb", "#69db7c", "#40c057", "#2f9e44"],
  yellow: ["#fff9db", "#ffec99", "#ffd43b", "#fab005", "#f08c00"],
  orange: ["#fff4e6", "#ffd8a8", "#ffa94d", "#fd7e14", "#e8590c"],
  // radix bronze shades [3,5,7,9,11]
  bronze: ["#f8f1ee", "#eaddd7", "#d2bab0", "#a18072", "#846358"],
} as const;

export type ColorPalette = typeof COLOR_PALETTE;
export type ColorPickerColor = keyof typeof COLOR_PALETTE;

const COMMON_ELEMENT_SHADES = pick(COLOR_PALETTE, [
  "cyan",
  "blue",
  "violet",
  "grape",
  "pink",
  "green",
  "teal",
  "yellow",
  "orange",
  "red",
]);

// quick picks defaults
// -----------------------------------------------------------------------------

// ORDER matters for positioning in quick picker
export const DEFAULT_ELEMENT_STROKE_PICKS = [
  COLOR_PALETTE.black,
  COLOR_PALETTE.red[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
  COLOR_PALETTE.green[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
  COLOR_PALETTE.blue[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
  COLOR_PALETTE.yellow[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
] as ColorTuple;

// ORDER matters for positioning in quick picker
export const DEFAULT_ELEMENT_BACKGROUND_PICKS = [
  COLOR_PALETTE.transparent,
  COLOR_PALETTE.red[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.green[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.blue[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.yellow[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
] as ColorTuple;

// ORDER matters for positioning in quick picker.
// Same as element background picks, with `transparent` (a no-op fill for the
// bucket tool) swapped for white.
export const BUCKET_FILL_BACKGROUND_PICKS = [
  COLOR_PALETTE.white,
  COLOR_PALETTE.red[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.green[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.blue[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.yellow[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
] as ColorTuple;

// ORDER matters for positioning in quick picker
export const DEFAULT_CANVAS_BACKGROUND_PICKS = [
  COLOR_PALETTE.white,
  // radix slate2
  "#f8f9fa",
  // radix blue2
  "#f5faff",
  // radix yellow2
  "#fffce8",
  // radix bronze2
  "#fdf8f6",
] as ColorTuple;

// palette defaults
// -----------------------------------------------------------------------------

export const DEFAULT_ELEMENT_STROKE_COLOR_PALETTE = {
  // 1st row
  transparent: COLOR_PALETTE.transparent,
  white: COLOR_PALETTE.white,
  gray: COLOR_PALETTE.gray,
  black: COLOR_PALETTE.black,
  bronze: COLOR_PALETTE.bronze,
  // rest
  ...COMMON_ELEMENT_SHADES,
} as const;

// ORDER matters for positioning in pallete (5x3 grid)s
export const DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE = {
  transparent: COLOR_PALETTE.transparent,
  white: COLOR_PALETTE.white,
  gray: COLOR_PALETTE.gray,
  black: COLOR_PALETTE.black,
  bronze: COLOR_PALETTE.bronze,

  ...COMMON_ELEMENT_SHADES,
} as const;

/**
 * The color the bucket fill tool actually fills with: the shared
 * `currentItemBackgroundColor`, falling back to green when that is
 * transparent (the tool's picker doesn't offer transparent, but the shared
 * state can hold it from the generic shape picker).
 */
export const getBucketFillBackgroundColor = (backgroundColor: string) =>
  isTransparent(backgroundColor)
    ? COLOR_PALETTE.green[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX]
    : backgroundColor;

// color palette helpers
// -----------------------------------------------------------------------------

// !!!MUST BE WITHOUT GRAY, TRANSPARENT AND BLACK!!!
export const getAllColorsSpecificShade = (index: 0 | 1 | 2 | 3 | 4) => [
  // 2nd row
  COLOR_PALETTE.cyan[index],
  COLOR_PALETTE.blue[index],
  COLOR_PALETTE.violet[index],
  COLOR_PALETTE.grape[index],
  COLOR_PALETTE.pink[index],

  // 3rd row
  COLOR_PALETTE.green[index],
  COLOR_PALETTE.teal[index],
  COLOR_PALETTE.yellow[index],
  COLOR_PALETTE.orange[index],
  COLOR_PALETTE.red[index],
];

// -----------------------------------------------------------------------------
// other helpers
// -----------------------------------------------------------------------------

export const rgbToHex = (r: number, g: number, b: number, a?: number) => {
  // (1 << 24) adds 0x1000000 to ensure the hex string is always 7 chars,
  // then slice(1) removes the leading "1" to get exactly 6 hex digits
  // e.g. rgb(0,0,0) -> 0x1000000 -> "1000000" -> "000000"
  const hex6 = `#${((1 << 24) + (r << 16) + (g << 8) + b)
    .toString(16)
    .slice(1)}`;
  if (a !== undefined && a < 1) {
    // convert alpha from 0-1 float to 0-255 int, then to 2-digit hex
    // e.g. 0.5 -> 128 -> "80"
    const alphaHex = Math.round(a * 255)
      .toString(16)
      .padStart(2, "0");
    return `${hex6}${alphaHex}`;
  }
  return hex6;
};

/**
 * @returns #RRGGBB or #RRGGBBAA based on color containing non-opaque alpha,
 *  null if not valid color
 */
export const colorToHex = (color: string): string | null => {
  const tc = tinycolor(color);
  if (!tc.isValid()) {
    return null;
  }
  const { r, g, b, a } = tc.toRgb();
  return rgbToHex(r, g, b, a);
};

export const isTransparent = (color: string) => {
  return tinycolor(color).getAlpha() === 0;
};

/**
 * Whether the color is fully opaque (alpha exactly 1).
 *
 * NOT the negation of `isTransparent`, which is true only at alpha 0 — a
 * partial-alpha color (`#RRGGBBAA`, `rgba(…, 0.5)`) is neither transparent
 * (it renders) nor opaque (what's beneath shows through it).
 */
export const isOpaqueColor = (color: string) => {
  return tinycolor(color).getAlpha() === 1;
};

// -----------------------------------------------------------------------------
// color contract helpers
// -----------------------------------------------------------------------------

export const COLOR_OUTLINE_CONTRAST_THRESHOLD = 240;

const calculateContrast = (r: number, g: number, b: number): number => {
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq;
};

// YIQ algo, inspiration from https://stackoverflow.com/a/11868398
export const isColorDark = (color: string, threshold = 160): boolean => {
  // no color ("") -> assume it default to black
  if (!color) {
    return true;
  }

  if (isTransparent(color)) {
    return false;
  }

  const tc = tinycolor(color);
  if (!tc.isValid()) {
    // invalid color -> assume it defaults to black
    return true;
  }

  const { r, g, b } = tc.toRgb();
  return calculateContrast(r, g, b) < threshold;
};

// -----------------------------------------------------------------------------
// normalization
// -----------------------------------------------------------------------------

/**
 * tries to keep the input color as-is if it's valid, making minimal adjustments
 * (trimming whitespace or adding `#` to hex colors)
 */
export const normalizeInputColor = (color: string): string | null => {
  color = color.trim();
  if (isTransparent(color)) {
    return color;
  }

  const tc = tinycolor(color);
  if (tc.isValid()) {
    // testing for `#` first fixes a bug on Electron (more specfically, an
    // Obsidian popout window), where a hex color without `#` is considered valid
    if (["hex", "hex8"].includes(tc.getFormat()) && !color.startsWith("#")) {
      return `#${color}`;
    }
    return color;
  }

  return null;
};
