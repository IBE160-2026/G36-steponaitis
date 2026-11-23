// Colour maths for the Key colours (FR-42): WCAG 2 contrast, CIELAB ΔE (CIE76, D65, sRGB),
// mixing over white and HSL helpers. Pure functions, hex in and out as uppercase `#RRGGBB`.

export type Rgb = { r: number; g: number; b: number };
export type Lab = { l: number; a: number; b: number };
export type Hsl = { h: number; s: number; l: number };

const HEX = /^#?([0-9a-fA-F]{6})$/;

/** `#RRGGBB`, `#rrggbb` or `RRGGBB` to 0–255 channels; anything else is `null`. */
export function parseHex(value: string): Rgb | null {
  const match = HEX.exec(value.trim());
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function isHexColour(value: string): boolean {
  return parseHex(value) !== null;
}

function requireRgb(value: string): Rgb {
  const rgb = parseHex(value);
  if (rgb === null) throw new RangeError(`Not a colour as #RRGGBB: ${value}`);
  return rgb;
}

/** Normalises any accepted hex spelling to uppercase `#RRGGBB`; throws `RangeError` otherwise. */
export function normaliseHex(value: string): string {
  return toHex(requireRgb(value));
}

/** Channels (rounded, clamped to 0–255) to uppercase `#RRGGBB`. */
export function toHex({ r, g, b }: Rgb): string {
  const part = (c: number) => Math.min(255, Math.max(0, Math.round(c))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2 relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = requireRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG 2 contrast ratio, 1–21, symmetric in its arguments. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// D65 reference white (2°), for XYZ scaled to 0–1.
const WHITE_X = 0.95047;
const WHITE_Y = 1.0;
const WHITE_Z = 1.08883;

function labF(t: number): number {
  const delta = 6 / 29;
  return t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;
}

/** sRGB hex to CIELAB (D65). */
export function toLab(hex: string): Lab {
  const { r, g, b } = requireRgb(hex);
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = 0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb;
  const fx = labF(x / WHITE_X);
  const fy = labF(y / WHITE_Y);
  const fz = labF(z / WHITE_Z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIE76 colour difference: Euclidean distance in CIELAB. */
export function deltaE(a: string, b: string): number {
  const la = toLab(a);
  const lb = toLab(b);
  return Math.hypot(la.l - lb.l, la.a - lb.a, la.b - lb.b);
}

/** `amount` (0–1) of the colour laid over white, per sRGB channel. */
export function mixOverWhite(hex: string, amount: number): string {
  const { r, g, b } = requireRgb(hex);
  const mix = (c: number) => c * amount + 255 * (1 - amount);
  return toHex({ r: mix(r), g: mix(g), b: mix(b) });
}

/** Hex to HSL: hue in degrees 0–360, saturation and lightness 0–1. */
export function toHsl(hex: string): Hsl {
  const { r, g, b } = requireRgb(hex);
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

/** HSL (hue in degrees, saturation and lightness 0–1) to uppercase `#RRGGBB`. */
export function fromHsl({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  return toHex({ r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 });
}
