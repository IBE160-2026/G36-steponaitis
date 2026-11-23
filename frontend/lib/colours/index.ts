// Key colours (FR-42): colour maths, presets, checks and popover warnings (pure), and the
// browser-only store that applies the eight `--colour-*` variables and keeps them in localStorage (storage.ts). No React.

export {
  contrastRatio,
  deltaE,
  fromHsl,
  isHexColour,
  mixOverWhite,
  normaliseHex,
  parseHex,
  relativeLuminance,
  toHex,
  toHsl,
  toLab,
  type Hsl,
  type Lab,
  type Rgb,
} from "./maths";
export {
  COLOUR_PRESETS,
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
export {
  GRAPHIC_CONTRAST,
  LIKENESS_THRESHOLD,
  TEXT_CONTRAST,
  checkContrast,
  darkenForWhiteText,
  deriveBestOnLight,
  deriveSelectedTint,
  similarPairs,
  tooAlike,
  type ContrastBackground,
  type ContrastCheck,
  type ContrastPair,
  type SimilarPair,
} from "./checks";
export {
  COLOURS_BOOT_SCRIPT,
  COLOURS_STORAGE_KEY,
  COLOUR_VARIABLES,
  DEFAULT_COLOUR_VARIABLES,
  applyKeyColours,
  getKeyColours,
  isColourStorageAvailable,
  parseStoredColours,
  previewKeyColour,
  resetKeyColour,
  setKeyColour,
  subscribeKeyColours,
  type ColourValues,
  type ColourVariable,
} from "./storage";
export { colourWarnings, type ColourWarning } from "./warnings";
