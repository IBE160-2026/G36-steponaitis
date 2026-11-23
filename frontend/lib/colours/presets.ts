// The six Key colours (FR-42): their defaults, the fixed backgrounds they are checked against,
// the derived-token defaults and the eight preset shades per entry, all from DESIGN.md.

export const KEY_COLOUR_ENTRIES = ["fast", "medium", "slow", "dead", "best", "selection"] as const;

export type KeyColourEntry = (typeof KEY_COLOUR_ENTRIES)[number];
export type KeyColours = Record<KeyColourEntry, string>;

export const DEFAULT_COLOURS: Readonly<KeyColours> = Object.freeze({
  fast: "#D85144",
  medium: "#F0B323",
  slow: "#417DDC",
  dead: "#8C939A",
  best: "#3DAE6B",
  selection: "#9466F0",
});

/** Eight shades per entry, lightest first, in DESIGN.md `components.colour-presets` order. */
export const COLOUR_PRESETS: Readonly<Record<KeyColourEntry, readonly string[]>> = Object.freeze({
  fast: Object.freeze(["#DFB19A", "#DF9AA5", "#E58C61", "#DF7267", "#D37382", "#E4586E", "#DB6024", "#D85144"]),
  medium: Object.freeze(["#F7F083", "#FAED0F", "#EBB98E", "#F0B323", "#C7BE23", "#FBA255", "#D26304", "#8B8419"]),
  slow: Object.freeze(["#98C6E1", "#5EB5E9", "#98A3E1", "#8A99EF", "#4C9AE6", "#378CBE", "#677AEA", "#417DDC"]),
  dead: Object.freeze(["#B8BFC1", "#B3B5BD", "#A4A8AD", "#949C9E", "#8C939A", "#848890", "#798386", "#7C808D"]),
  best: Object.freeze(["#9AE0A5", "#A3D6C4", "#73D483", "#53CAA0", "#3CC353", "#3DAE6B", "#459B7D", "#309C42"]),
  selection: Object.freeze(["#A280E5", "#B45AF7", "#9466F0", "#7267E0", "#6658EF", "#9516F3", "#9034D5", "#5747F6"]),
});

/** Fixed backgrounds the colours are drawn on (DESIGN.md `colors`). */
export const WALL = "#30353A";
export const OPEN_SLOT = "#141719";
export const INK = "#1B1E22";
export const WHITE = "#FFFFFF";

/** Fixed derived-token defaults; Reset restores these. */
export const DEFAULT_BEST_ON_LIGHT = "#267A4B";
export const DEFAULT_SELECTED_TINT = "#F3EFFD";
