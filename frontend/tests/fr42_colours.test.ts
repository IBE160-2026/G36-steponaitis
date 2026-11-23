import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  COLOUR_PRESETS,
  DEFAULT_BEST_ON_LIGHT,
  DEFAULT_COLOURS,
  DEFAULT_SELECTED_TINT,
  KEY_COLOUR_ENTRIES,
  WHITE,
  checkContrast,
  contrastRatio,
  darkenForWhiteText,
  deltaE,
  deriveBestOnLight,
  deriveSelectedTint,
  fromHsl,
  isHexColour,
  mixOverWhite,
  parseHex,
  relativeLuminance,
  similarPairs,
  toHsl,
  toLab,
  tooAlike,
  type KeyColourEntry,
} from "@/lib/colours";

// FR-42: the Key colours' maths, checks, derived tokens and presets (Story 11.1).
const designPath = join(
  __dirname,
  "..",
  "..",
  ".docs",
  "planning-artifacts",
  "ux-designs",
  "ux-Project-2026-11-11",
  "DESIGN.md",
);

/** The lines of one top-level block (`components:` …) in the DESIGN.md front matter. */
function frontMatterBlock(name: string): string[] {
  const front = readFileSync(designPath, "utf8").split(/^---$/m)[1];
  const lines = front.split("\n");
  const start = lines.indexOf(`${name}:`);
  expect(start, `DESIGN.md front matter has ${name}:`).toBeGreaterThanOrEqual(0);
  const block: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    block.push(line);
  }
  return block;
}

/** `components.colour-presets` as entry → shades, from the 4-space keys under it. */
function designPresets(): Record<string, string[]> {
  const block = frontMatterBlock("components");
  const start = block.indexOf("  colour-presets:");
  expect(start, "DESIGN.md components has colour-presets:").toBeGreaterThanOrEqual(0);
  const presets: Record<string, string[]> = {};
  for (const line of block.slice(start + 1)) {
    if (!/^ {4}/.test(line)) break;
    const match = /^ {4}([\w-]+):\s*'(.*)'\s*$/.exec(line);
    if (match && match[1] !== "note") presets[match[1]] = match[2].trim().split(/\s+/);
  }
  return presets;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const EXPECTED_RATIOS: Record<KeyColourEntry, number[]> = {
  fast: [3.05, 4.44],
  medium: [6.59, 9.58],
  slow: [3.06, 4.45],
  dead: [3.98, 5.79],
  best: [4.4, 6.4, 5.95],
  selection: [4.65, 3.88],
};

describe("fr42 colour maths", () => {
  it("fr42 contrast ratio matches DESIGN.md and is symmetric", () => {
    expect(contrastRatio("#D85144", "#30353A")).toBeCloseTo(3.05, 2);
    expect(contrastRatio("#30353A", "#D85144")).toBe(contrastRatio("#D85144", "#30353A"));
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 6);
    expect(contrastRatio("#8C939A", "#8C939A")).toBe(1);
  });

  it("fr42 parses lowercase and #-less hex like uppercase", () => {
    const expected = { r: 0xd8, g: 0x51, b: 0x44 };
    expect(parseHex("d85144")).toEqual(expected);
    expect(parseHex("#d85144")).toEqual(expected);
    expect(parseHex("#D85144")).toEqual(expected);
    expect(relativeLuminance("d85144")).toBe(relativeLuminance("#D85144"));
    expect(isHexColour("#d85144")).toBe(true);
  });

  it.each(["#12345", "red", "#GGGGGG", "", "#1234567"])("fr42 rejects invalid hex %j", (value) => {
    expect(parseHex(value)).toBeNull();
    expect(isHexColour(value)).toBe(false);
    expect(() => contrastRatio(value, "#FFFFFF")).toThrow(RangeError);
    expect(() => relativeLuminance(value)).toThrow(RangeError);
    expect(() => deltaE(value, "#FFFFFF")).toThrow(RangeError);
    expect(() => toLab(value)).toThrow(RangeError);
    expect(() => mixOverWhite(value, 0.1)).toThrow(RangeError);
    expect(() => checkContrast("fast", value)).toThrow(RangeError);
    expect(() => deriveBestOnLight(value)).toThrow(RangeError);
    expect(() => deriveSelectedTint(value)).toThrow(RangeError);
    expect(() => darkenForWhiteText(value)).toThrow(RangeError);
  });

  it.each(["#D85144", "#F0B323", "#3DAE6B", "#417DDC", "#9466F0", "#D037C0", "#8C939A"])(
    "fr42 HSL round trip returns %s",
    (hex) => {
      expect(fromHsl(toHsl(hex))).toBe(hex);
    },
  );

  it("fr42 CIELAB matches the D65 reference for white and black", () => {
    const white = toLab("#FFFFFF");
    expect(white.l).toBeCloseTo(100, 3);
    expect(white.a).toBeCloseTo(0, 3);
    expect(white.b).toBeCloseTo(0, 3);
    expect(toLab("#000000").l).toBeCloseTo(0, 6);
    expect(deltaE("#000000", "#FFFFFF")).toBeCloseTo(100, 3);
  });
});

describe("fr42 contrast checks", () => {
  it.each(KEY_COLOUR_ENTRIES)("fr42 default %s passes every pair with the DESIGN.md ratios", (entry) => {
    const check = checkContrast(entry, DEFAULT_COLOURS[entry]);
    expect(check.passes).toBe(true);
    expect(check.pairs.map((pair) => pair.pass)).toEqual(EXPECTED_RATIOS[entry].map(() => true));
    check.pairs.forEach((pair, i) => {
      expect(Math.abs(pair.ratio - EXPECTED_RATIOS[entry][i])).toBeLessThanOrEqual(0.02);
    });
  });

  it("fr42 each pair names its background and threshold", () => {
    const pairs = (entry: KeyColourEntry) =>
      checkContrast(entry, DEFAULT_COLOURS[entry]).pairs.map(({ against, background, threshold }) => [
        against,
        background,
        threshold,
      ]);
    expect(pairs("fast")).toEqual([
      ["wall", "#30353A", 3],
      ["open-slot", "#141719", 3],
    ]);
    expect(pairs("best")).toEqual([
      ["wall", "#30353A", 3],
      ["open-slot", "#141719", 3],
      ["ink-text", "#1B1E22", 4.5],
    ]);
    expect(pairs("selection")).toEqual([
      ["casing", "#141719", 3],
      ["white", "#FFFFFF", 3],
    ]);
  });

  it("fr42 a failing colour gives warnings, never an error", () => {
    const check = checkContrast("slow", "#20304A");
    expect(check.passes).toBe(false);
    expect(check.colour).toBe("#20304A");
    expect(check.pairs.every((pair) => !pair.pass)).toBe(true);
    expect(check.pairs[0].ratio).toBeLessThan(3);
  });
});

describe("fr42 likeness", () => {
  it("fr42 the six defaults are at least ΔE 37 apart and none is flagged", () => {
    let closest = { distance: Infinity, pair: "" };
    KEY_COLOUR_ENTRIES.forEach((a, i) => {
      for (const b of KEY_COLOUR_ENTRIES.slice(i + 1)) {
        const distance = deltaE(DEFAULT_COLOURS[a], DEFAULT_COLOURS[b]);
        expect(distance, `${a}/${b}`).toBeGreaterThanOrEqual(37);
        expect(tooAlike(DEFAULT_COLOURS[a], DEFAULT_COLOURS[b])).toBe(false);
        if (distance < closest.distance) closest = { distance, pair: `${a}/${b}` };
      }
    });
    expect(closest.pair).toBe("slow/selection");
    expect(similarPairs(DEFAULT_COLOURS)).toEqual([]);
  });

  it("fr42 two colours under ΔE 20 are flagged too alike", () => {
    const near = "#5A7AE0";
    const distance = deltaE(DEFAULT_COLOURS.slow, near);
    expect(distance).toBeLessThan(20);
    expect(tooAlike(DEFAULT_COLOURS.slow, near)).toBe(true);
    expect(deltaE(near, DEFAULT_COLOURS.slow)).toBe(distance);
    const pairs = similarPairs({ ...DEFAULT_COLOURS, selection: near });
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: "slow", b: "selection" });
    expect(pairs[0].deltaE).toBeCloseTo(distance, 10);
  });

  it("fr42 identical colours are too alike and black and white are not", () => {
    expect(tooAlike("#417DDC", "#417DDC")).toBe(true);
    expect(tooAlike("#000000", "#FFFFFF")).toBe(false);
  });
});

describe("fr42 presets", () => {
  it("fr42 presets equal DESIGN.md colour-presets exactly", () => {
    const fromDesign = designPresets();
    expect(Object.keys(fromDesign)).toEqual([...KEY_COLOUR_ENTRIES]);
    for (const entry of KEY_COLOUR_ENTRIES) {
      expect([...COLOUR_PRESETS[entry]], entry).toEqual(fromDesign[entry]);
    }
  });

  it.each(KEY_COLOUR_ENTRIES)("fr42 %s has eight distinct valid shades, lightest first, with the default", (entry) => {
    const shades = COLOUR_PRESETS[entry];
    expect(shades).toHaveLength(8);
    expect(new Set(shades).size).toBe(8);
    for (const shade of shades) expect(shade).toMatch(/^#[0-9A-F]{6}$/);
    expect(shades).toContain(DEFAULT_COLOURS[entry]);
    shades.slice(1).forEach((shade, i) => {
      expect(relativeLuminance(shade), `${shades[i]} → ${shade}`).toBeLessThanOrEqual(relativeLuminance(shades[i]));
    });
  });

  it.each(KEY_COLOUR_ENTRIES)("fr42 every %s preset is at least ΔE 22 from the other five defaults", (entry) => {
    for (const shade of COLOUR_PRESETS[entry]) {
      for (const other of KEY_COLOUR_ENTRIES.filter((e) => e !== entry)) {
        expect(deltaE(shade, DEFAULT_COLOURS[other]), `${shade} vs ${other}`).toBeGreaterThanOrEqual(22);
      }
    }
  });

  it.each(KEY_COLOUR_ENTRIES)("fr42 every %s preset passes its entry check", (entry) => {
    for (const shade of COLOUR_PRESETS[entry]) {
      expect(checkContrast(entry, shade).passes, shade).toBe(true);
    }
  });
});

describe("fr42 derived tokens", () => {
  it("fr42 the default best gives the fixed best-on-light #267A4B", () => {
    expect(deriveBestOnLight("#3DAE6B")).toBe("#267A4B");
    expect(deriveBestOnLight("#3dae6b")).toBe(DEFAULT_BEST_ON_LIGHT);
  });

  it.each([...new Set([DEFAULT_COLOURS.best, ...COLOUR_PRESETS.best])])(
    "fr42 darkening %s keeps its hue and reaches white text 4.5:1, as #267A4B does",
    (best) => {
      const darkened = darkenForWhiteText(best);
      expect(darkened).toMatch(/^#[0-9A-F]{6}$/);
      expect(hueDistance(toHsl(darkened).h, toHsl(best).h)).toBeLessThanOrEqual(2);
      expect(contrastRatio(WHITE, darkened)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkened, WHITE)).toBeGreaterThanOrEqual(3);
      if (best !== DEFAULT_COLOURS.best) expect(deriveBestOnLight(best)).toBe(darkened);
    },
  );

  it.each(["fast", "slow", "selection"] as const)(
    "fr42 darkening the default %s keeps its hue and reaches white text 4.5:1",
    (entry) => {
      const source = DEFAULT_COLOURS[entry];
      const darkened = darkenForWhiteText(source);
      expect(hueDistance(toHsl(darkened).h, toHsl(source).h)).toBeLessThanOrEqual(2);
      expect(contrastRatio(WHITE, darkened)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("fr42 the fixed best-on-light meets the same constraints", () => {
    expect(contrastRatio(WHITE, DEFAULT_BEST_ON_LIGHT)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DEFAULT_BEST_ON_LIGHT, WHITE)).toBeGreaterThanOrEqual(3);
    // The uncapped rule on the default lands near the pre-checked #2F8653.
    expect(deltaE(darkenForWhiteText(DEFAULT_COLOURS.best), "#2F8653")).toBeLessThan(2);
  });

  it("fr42 an already-dark best is returned unchanged", () => {
    expect(contrastRatio(WHITE, "#1E5E3A")).toBeGreaterThanOrEqual(4.5);
    expect(darkenForWhiteText("#1E5E3A")).toBe("#1E5E3A");
    expect(deriveBestOnLight("#1e5e3a")).toBe("#1E5E3A");
  });

  it("fr42 the default selection gives the fixed selected-tint #F3EFFD", () => {
    expect(deriveSelectedTint("#9466F0")).toBe("#F3EFFD");
    expect(deriveSelectedTint("#9466f0")).toBe(DEFAULT_SELECTED_TINT);
  });

  it.each(COLOUR_PRESETS.selection.filter((shade) => shade !== DEFAULT_COLOURS.selection))(
    "fr42 selection %s gives a tint of 10%% over white",
    (selection) => {
      const tint = parseHex(deriveSelectedTint(selection));
      const source = parseHex(selection);
      expect(tint).not.toBeNull();
      expect(source).not.toBeNull();
      for (const channel of ["r", "g", "b"] as const) {
        const expected = source![channel] * 0.1 + 255 * 0.9;
        expect(Math.abs(tint![channel] - expected)).toBeLessThanOrEqual(1);
      }
    },
  );

  it("fr42 a plain 10% mix of the default selection is #F4F0FE", () => {
    expect(mixOverWhite("#9466F0", 0.1)).toBe("#F4F0FE");
  });
});
