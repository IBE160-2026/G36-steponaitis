// FR-42 checks on the Key colours: contrast where each colour is drawn, likeness between the six,
// and the derived tokens `best-on-light` and `selected-tint`. Failing checks are warnings only.

import { contrastRatio, deltaE, fromHsl, mixOverWhite, normaliseHex, toHsl } from "./maths";
import {
  DEFAULT_BEST_ON_LIGHT,
  DEFAULT_COLOURS,
  DEFAULT_SELECTED_TINT,
  INK,
  KEY_COLOUR_ENTRIES,
  OPEN_SLOT,
  WALL,
  WHITE,
  type KeyColourEntry,
  type KeyColours,
} from "./presets";

/** Where a colour is measured: the background it sits on, or `ink-text` written on it. */
export type ContrastBackground = "wall" | "open-slot" | "ink-text" | "casing" | "white";

export type ContrastPair = {
  against: ContrastBackground;
  /** The other colour of the pair, uppercase `#RRGGBB`. */
  background: string;
  ratio: number;
  threshold: number;
  pass: boolean;
};

export type ContrastCheck = {
  entry: KeyColourEntry;
  colour: string;
  pairs: ContrastPair[];
  passes: boolean;
};

export const GRAPHIC_CONTRAST = 3;
export const TEXT_CONTRAST = 4.5;
/** CIE76 ΔE strictly below this flags two colours as too alike. */
export const LIKENESS_THRESHOLD = 20;

type PairSpec = { against: ContrastBackground; background: string; threshold: number };

const MOVEMENT_PAIRS: PairSpec[] = [
  { against: "wall", background: WALL, threshold: GRAPHIC_CONTRAST },
  { against: "open-slot", background: OPEN_SLOT, threshold: GRAPHIC_CONTRAST },
];

const PAIRS: Record<KeyColourEntry, PairSpec[]> = {
  fast: MOVEMENT_PAIRS,
  medium: MOVEMENT_PAIRS,
  slow: MOVEMENT_PAIRS,
  dead: MOVEMENT_PAIRS,
  best: [...MOVEMENT_PAIRS, { against: "ink-text", background: INK, threshold: TEXT_CONTRAST }],
  selection: [
    { against: "casing", background: OPEN_SLOT, threshold: GRAPHIC_CONTRAST },
    { against: "white", background: WHITE, threshold: GRAPHIC_CONTRAST },
  ],
};

/** Measures `hex` where `entry` is drawn. Throws `RangeError` only for a value that is not hex. */
export function checkContrast(entry: KeyColourEntry, hex: string): ContrastCheck {
  const colour = normaliseHex(hex);
  const pairs = PAIRS[entry].map(({ against, background, threshold }) => {
    const ratio = contrastRatio(colour, background);
    return { against, background, ratio, threshold, pass: ratio >= threshold };
  });
  return { entry, colour, pairs, passes: pairs.every((pair) => pair.pass) };
}

function isTooAlike(distance: number): boolean {
  return distance < LIKENESS_THRESHOLD;
}

export function tooAlike(a: string, b: string): boolean {
  return isTooAlike(deltaE(a, b));
}

export type SimilarPair = { a: KeyColourEntry; b: KeyColourEntry; deltaE: number };

/** Every pair of the six colours that is too alike, in Key order. */
export function similarPairs(colours: Readonly<KeyColours>): SimilarPair[] {
  const result: SimilarPair[] = [];
  KEY_COLOUR_ENTRIES.forEach((a, i) => {
    for (const b of KEY_COLOUR_ENTRIES.slice(i + 1)) {
      const distance = deltaE(colours[a], colours[b]);
      if (isTooAlike(distance)) result.push({ a, b, deltaE: distance });
    }
  });
  return result;
}

const LIGHTNESS_STEP = 0.005;

/**
 * Keeps the HSL hue and saturation and lowers lightness in steps of 0.005 until white text on the
 * colour reaches 4.5:1 (so the colour reaches at least 3:1 on white). Returns the input if it passes.
 */
export function darkenForWhiteText(hex: string): string {
  const start = normaliseHex(hex);
  if (contrastRatio(WHITE, start) >= TEXT_CONTRAST) return start;
  const { h, s, l } = toHsl(start);
  for (let step = 1; ; step += 1) {
    const lightness = Math.max(0, l - step * LIGHTNESS_STEP);
    const candidate = fromHsl({ h, s, l: lightness });
    if (contrastRatio(WHITE, candidate) >= TEXT_CONTRAST || lightness === 0) return candidate;
  }
}

/** `best-on-light`: the fixed DESIGN.md token for the default best, else the darkened hue. */
export function deriveBestOnLight(best: string): string {
  const colour = normaliseHex(best);
  return colour === DEFAULT_COLOURS.best ? DEFAULT_BEST_ON_LIGHT : darkenForWhiteText(colour);
}

/** `selected-tint`: the fixed DESIGN.md token for the default selection, else 10% over white. */
export function deriveSelectedTint(selection: string): string {
  const colour = normaliseHex(selection);
  return colour === DEFAULT_COLOURS.selection ? DEFAULT_SELECTED_TINT : mixOverWhite(colour, 0.1);
}
