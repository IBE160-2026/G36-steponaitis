// Key colours kept in this browser (FR-42, Story 11.2). The eight `--colour-*` variables on `<html>`
// are the one source every wall, mini-wall, crop, swatch, best mark and selection reads (the theme
// tokens in globals.css alias them). The choice lives in localStorage `swp:colours` as one JSON
// object of the eight values; every access is in try/catch and a blocked storage keeps the change
// in memory for the page's life. Nothing here is ever sent to the server.
//
// `parseStoredColours` is shared with the inline script in the root layout, which applies the
// stored colours before first paint: the script is built from the function's own source, so the
// function must stay self-contained (no outer names, no imports) and in plain syntax.

import { deriveBestOnLight, deriveSelectedTint } from "./checks";
import { normaliseHex } from "./maths";
import { DEFAULT_BEST_ON_LIGHT, DEFAULT_COLOURS, DEFAULT_SELECTED_TINT, KEY_COLOUR_ENTRIES, type KeyColourEntry, type KeyColours } from "./presets";

export const COLOURS_STORAGE_KEY = "swp:colours";

/** The suffixes of the eight `--colour-*` variables: the six entries and the two derived tokens. */
export const COLOUR_VARIABLES = [
  "fast",
  "medium",
  "slow",
  "dead",
  "best",
  "best-on-light",
  "selection",
  "selected-tint",
] as const;

export type ColourVariable = (typeof COLOUR_VARIABLES)[number];
export type ColourValues = Record<ColourVariable, string>;

export const DEFAULT_COLOUR_VARIABLES: Readonly<ColourValues> = Object.freeze({
  ...DEFAULT_COLOURS,
  "best-on-light": DEFAULT_BEST_ON_LIGHT,
  "selected-tint": DEFAULT_SELECTED_TINT,
});

/**
 * The stored `swp:colours` text to the valid variables in it, as uppercase `#RRGGBB`. Anything
 * that is not a JSON object gives `{}`; a value that is not `#RRGGBB` is dropped; a derived pair
 * (best + best-on-light, selection + selected-tint) is kept only when both halves are valid.
 * Self-contained and in plain syntax (no imports, outer names or helpers a compiler could inject):
 * the inline boot script runs its `toString()`.
 */
export function parseStoredColours(raw: unknown): Partial<ColourValues> {
  const names = ["fast", "medium", "slow", "dead", "best", "best-on-light", "selection", "selected-tint"];
  const pairs = [
    ["best", "best-on-light"],
    ["selection", "selected-tint"],
  ];
  const hex = /^#[0-9a-fA-F]{6}$/;
  const out: Record<string, string> = {};
  let data: unknown;
  if (typeof raw !== "string") return out;
  try {
    data = JSON.parse(raw);
  } catch {
    return out;
  }
  if (Object.prototype.toString.call(data) !== "[object Object]") return out;
  const record = data as Record<string, unknown>;
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (!Object.prototype.hasOwnProperty.call(record, name)) continue;
    const value = record[name];
    if (typeof value === "string" && hex.test(value)) out[name] = value.toUpperCase();
  }
  for (let j = 0; j < pairs.length; j++) {
    const a = pairs[j][0];
    const b = pairs[j][1];
    if (!(a in out) || !(b in out)) {
      delete out[a];
      delete out[b];
    }
  }
  return out;
}

/**
 * The inline script for `<head>` in the root layout: reads `swp:colours` with `parseStoredColours`
 * and sets each valid variable on `<html>` before first paint. Any error leaves the CSS defaults.
 */
export const COLOURS_BOOT_SCRIPT =
  "(function(){try{var v=(" +
  parseStoredColours.toString() +
  ")(localStorage.getItem(" +
  JSON.stringify(COLOURS_STORAGE_KEY) +
  "));var s=document.documentElement.style;for(var k in v)s.setProperty(\"--colour-\"+k,v[k])}catch(e){}})()";

// The store: one in-memory copy of the eight values, read from storage on first use.

type Listener = () => void;

let values: ColourValues | null = null;
let entries: Readonly<KeyColours> | null = null;
let storageAvailable = true;
const listeners = new Set<Listener>();

function inBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function load(): ColourValues {
  if (values !== null) return values;
  let raw: string | null = null;
  try {
    raw = globalThis.localStorage.getItem(COLOURS_STORAGE_KEY);
  } catch {
    storageAvailable = false;
  }
  values = { ...DEFAULT_COLOUR_VARIABLES, ...parseStoredColours(raw) };
  return values;
}

/**
 * The values to merge a change into: what is stored now (another tab may have changed it), or the
 * in-memory copy when storage cannot be read.
 */
function latest(): ColourValues {
  const current = load();
  try {
    const raw = globalThis.localStorage.getItem(COLOURS_STORAGE_KEY);
    return { ...DEFAULT_COLOUR_VARIABLES, ...parseStoredColours(raw) };
  } catch {
    return current;
  }
}

function rootStyle(): CSSStyleDeclaration | null {
  try {
    return inBrowser() ? document.documentElement.style : null;
  } catch {
    return null;
  }
}

function apply(next: Partial<ColourValues>): void {
  const style = rootStyle();
  if (style === null) return;
  for (const name of COLOUR_VARIABLES) {
    const value = next[name];
    if (value !== undefined) style.setProperty(`--colour-${name}`, value);
  }
}

function store(next: ColourValues): void {
  try {
    globalThis.localStorage.setItem(COLOURS_STORAGE_KEY, JSON.stringify(next));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
}

/** The six Key colours now in use (a stable object until the next change). Defaults on the server. */
export function getKeyColours(): Readonly<KeyColours> {
  if (!inBrowser()) return DEFAULT_COLOURS;
  if (entries === null) {
    const current = load();
    entries = Object.freeze(
      Object.fromEntries(KEY_COLOUR_ENTRIES.map((entry) => [entry, current[entry]])) as KeyColours,
    );
  }
  return entries;
}

function requireEntry(entry: KeyColourEntry): void {
  if (!KEY_COLOUR_ENTRIES.includes(entry)) throw new RangeError(`Not a Key colour entry: ${String(entry)}`);
}

/** The variables one entry's colour sets: the entry and, for best and selection, its derived partner. */
function changeFor(entry: KeyColourEntry, hex: string): Partial<ColourValues> {
  const colour = normaliseHex(hex);
  const change: Partial<ColourValues> = { [entry]: colour };
  if (entry === "best") change["best-on-light"] = deriveBestOnLight(colour);
  if (entry === "selection") change["selected-tint"] = deriveSelectedTint(colour);
  return change;
}

/**
 * Sets one Key colour: the variable (and its derived partner for best and selection) changes on
 * `<html>` at once, all eight values are stored, and subscribers are told. A value that is not a
 * colour as `#RRGGBB` throws `RangeError` and changes nothing.
 */
export function setKeyColour(entry: KeyColourEntry, hex: string): void {
  requireEntry(entry);
  const change = changeFor(entry, hex);
  const next: ColourValues = { ...latest(), ...change };
  values = next;
  entries = null;
  apply(change);
  store(next);
  for (const listener of [...listeners]) listener();
}

/**
 * Previews one Key colour (Story 11.3): `hex` sets the entry's variable and its derived partner on
 * `<html>` without storing or notifying; `null` sets the kept values of that entry and partner
 * again. A value that is not a colour as `#RRGGBB` throws `RangeError` and changes nothing.
 */
export function previewKeyColour(entry: KeyColourEntry, hex: string | null): void {
  requireEntry(entry);
  if (hex !== null) {
    apply(changeFor(entry, hex));
    return;
  }
  if (!inBrowser()) return;
  const kept = load();
  const restore: Partial<ColourValues> = { [entry]: kept[entry] };
  if (entry === "best") restore["best-on-light"] = kept["best-on-light"];
  if (entry === "selection") restore["selected-tint"] = kept["selected-tint"];
  apply(restore);
}

/** Restores one entry's DESIGN.md default (best also restores best-on-light `#267A4B`). */
export function resetKeyColour(entry: KeyColourEntry): void {
  setKeyColour(entry, DEFAULT_COLOURS[entry]);
}

/** Calls `listener` after every change; returns the unsubscribe function. */
export function subscribeKeyColours(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** False once reading or writing `swp:colours` has failed: changes then last only for this page. */
export function isColourStorageAvailable(): boolean {
  if (inBrowser()) load();
  return storageAvailable;
}

/**
 * Sets every variable that differs from its default on `<html>` again. The boot script already
 * did this on load; React's development remount of `<html>` can clear it, so the app calls this
 * once after hydration.
 */
export function applyKeyColours(): void {
  if (!inBrowser()) return;
  const current = load();
  const changed: Partial<ColourValues> = {};
  for (const name of COLOUR_VARIABLES) {
    if (current[name] !== DEFAULT_COLOUR_VARIABLES[name]) changed[name] = current[name];
  }
  apply(changed);
}
