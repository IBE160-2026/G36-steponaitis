// The colour popover's warnings (FR-42, Story 11.3): the checks of one pending pick that fail.
// Pure: the pick replaces the entry's current colour, the other five stay as they are. Words for
// the warnings live in lib/copy.

import { checkContrast, similarPairs, type ContrastBackground } from "./checks";
import { normaliseHex } from "./maths";
import type { KeyColourEntry, KeyColours } from "./presets";

export type ColourWarning =
  | { kind: "contrast"; entry: KeyColourEntry; against: ContrastBackground; ratio: number; threshold: number }
  | { kind: "alike"; a: KeyColourEntry; b: KeyColourEntry; deltaE: number };

/**
 * Every failing contrast pair of `pick` where `entry` is drawn, then every too-alike pair that
 * includes `entry` (in Key order). Throws `RangeError` only when `pick` is not a hex colour.
 */
export function colourWarnings(entry: KeyColourEntry, pick: string, current: Readonly<KeyColours>): ColourWarning[] {
  const colour = normaliseHex(pick);
  const contrast: ColourWarning[] = checkContrast(entry, colour)
    .pairs.filter((pair) => !pair.pass)
    .map(({ against, ratio, threshold }) => ({ kind: "contrast", entry, against, ratio, threshold }));
  const alike: ColourWarning[] = similarPairs({ ...current, [entry]: colour })
    .filter((pair) => pair.a === entry || pair.b === entry)
    .map(({ a, b, deltaE }) => ({ kind: "alike", a, b, deltaE }));
  return [...contrast, ...alike];
}
