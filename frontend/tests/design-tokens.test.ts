import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_COLOUR_VARIABLES } from "@/lib/colours";

// UX-DR1 under NFR-10 (accessibility floor) and NFR-2 (runs locally, no runtime network calls).
const frontend = join(__dirname, "..");
const designPath = join(frontend, "..", ".docs", "planning-artifacts", "ux-designs", "ux-Project-2026-11-11", "DESIGN.md");
const css = readFileSync(join(frontend, "app", "globals.css"), "utf8");

/** The lines of one top-level block (`colors:`, `typography:` …) in the DESIGN.md front matter. */
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

/** `  key: 'value'` pairs at two-space indent. */
function flatEntries(name: string): [string, string][] {
  return frontMatterBlock(name)
    .map((line) => /^ {2}'?([\w-]+)'?:\s*(\S.*?)\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => [match[1], match[2].replace(/^'(.*)'$/, "$1")]);
}

type TypeEntry = { key: string; fontFamily: string; fontSize: string; fontWeight: string; lineHeight: string };

function typographyEntries(): TypeEntry[] {
  const entries: TypeEntry[] = [];
  let current: Partial<TypeEntry> | null = null;
  for (const line of frontMatterBlock("typography")) {
    const head = /^ {2}([\w-]+):\s*$/.exec(line);
    if (head) {
      current = { key: head[1] };
      entries.push(current as TypeEntry);
      continue;
    }
    const prop = /^ {4}(fontFamily|fontSize|fontWeight|lineHeight):\s*'?([^']+?)'?\s*$/.exec(line);
    if (prop && current) current[prop[1] as keyof TypeEntry] = prop[2];
  }
  return entries;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function declares(variable: string, value: string): boolean {
  if (new RegExp(`${escape(variable)}:\\s*${escape(value)};`).test(css)) return true;
  // An editable Key colour (FR-42) aliases a `--colour-*` variable whose `:root` default is the hex.
  const alias = aliasOf(variable);
  return alias !== null && declares(alias, value);
}

/** The `--colour-*` variable a token aliases (`--color-x: var(--colour-y);`), else null. */
function aliasOf(variable: string): string | null {
  return new RegExp(`${escape(variable)}:\\s*var\\((--colour-[\\w-]+)\\);`).exec(css)?.[1] ?? null;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css|mjs)$/.test(name) ? [path] : [];
  });
}

const sources = ["app", "components", "lib"].flatMap((dir) => sourceFiles(join(frontend, dir)));

describe("nfr10 theme defines every DESIGN.md token", () => {
  it("defines every colour with its exact hex", () => {
    const colors = flatEntries("colors");
    expect(colors.length).toBeGreaterThan(50);
    const missing = colors.filter(([key, hex]) => !declares(`--color-${key}`, hex));
    expect(missing).toEqual([]);
  });

  it("keeps the product mark in the fixed brand yellow", () => {
    expect(declares("--color-brand-mark", "#F0B323")).toBe(true);
  });

  it("fr42 (SM-7) the eight editable Key colours alias --colour-* variables and the fixed tokens do not", () => {
    expect({
      "--color-class-fast": aliasOf("--color-class-fast"),
      "--color-class-medium": aliasOf("--color-class-medium"),
      "--color-class-slow": aliasOf("--color-class-slow"),
      "--color-class-dead": aliasOf("--color-class-dead"),
      "--color-best": aliasOf("--color-best"),
      "--color-best-on-light": aliasOf("--color-best-on-light"),
      "--color-accent": aliasOf("--color-accent"),
      "--color-selected-tint": aliasOf("--color-selected-tint"),
    }).toEqual({
      "--color-class-fast": "--colour-fast",
      "--color-class-medium": "--colour-medium",
      "--color-class-slow": "--colour-slow",
      "--color-class-dead": "--colour-dead",
      "--color-best": "--colour-best",
      "--color-best-on-light": "--colour-best-on-light",
      "--color-accent": "--colour-selection",
      "--color-selected-tint": "--colour-selected-tint",
    });
    const defaults = Object.fromEntries(
      Object.entries(DEFAULT_COLOUR_VARIABLES).map(([name, hex]) => [`--colour-${name}`, hex]),
    );
    expect(Object.keys(defaults)).toHaveLength(8);
    for (const [variable, hex] of Object.entries(defaults)) expect(declares(variable, hex), variable).toBe(true);
    const fixed = [
      ["--color-focus-on-dark", "#FFFFFF"],
      ["--color-focus-on-dark-inner", "#141719"],
      ["--color-focus-on-light", "#1B1E22"],
      ["--color-focus-gap", "#FFFFFF"],
      ["--color-input-border", "#8A9097"],
      ["--color-brand-mark", "#F0B323"],
      ["--color-print-ink", "#000000"],
      ["--color-print-paper", "#FFFFFF"],
    ];
    for (const [variable, hex] of fixed) {
      expect(new RegExp(`${escape(variable)}:\\s*${escape(hex)};`).test(css), `${variable} stays ${hex}`).toBe(true);
      expect(aliasOf(variable), variable).toBeNull();
    }
    // Nothing outside the :root block and the eight aliases reads a --colour-* variable.
    expect(css.match(/var\(--colour-/g)).toHaveLength(8);
    const print = css.slice(css.indexOf("@media print"));
    expect(print).not.toMatch(/--colour-|--color-(class|best|accent|selected)/);
  });

  it("defines every typography entry with size, line height, weight and family", () => {
    const entries = typographyEntries();
    expect(entries.length).toBeGreaterThan(20);
    for (const entry of entries) {
      expect(declares(`--text-${entry.key}`, entry.fontSize), `--text-${entry.key}`).toBe(true);
      expect(declares(`--text-${entry.key}--line-height`, entry.lineHeight), `${entry.key} line height`).toBe(true);
      expect(declares(`--text-${entry.key}--font-weight`, entry.fontWeight), `${entry.key} weight`).toBe(true);
      const family = entry.fontFamily === "Figtree" ? "--font-sans" : "--font-code";
      const utility = new RegExp(`@utility type-${escape(entry.key)} \\{[^}]*font-family: var\\(${family}\\)`);
      expect(utility.test(css), `type-${entry.key} uses ${family}`).toBe(true);
    }
    expect(css).toMatch(/--font-sans: "Figtree", "Helvetica Neue", Helvetica, Arial, sans-serif;/);
    expect(css).toMatch(/--font-code: "Barlow Semi Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif;/);
  });

  it("defines every radius", () => {
    const missing = flatEntries("rounded").filter(
      ([key, value]) => !declares(key === "DEFAULT" ? "--radius" : `--radius-${key}`, value),
    );
    expect(missing).toEqual([]);
  });

  it("defines the spacing scale and every fixed size", () => {
    const spacing = flatEntries("spacing");
    expect(spacing.map(([key]) => key)).toContain("toolbar-height");
    const missing = spacing.filter(([key, value]) => !declares(`--spacing-${key}`, value));
    expect(missing).toEqual([]);
  });

  it("has no text size below 11px", () => {
    const sizes = [...css.matchAll(/--text-[\w-]+?:\s*([\d.]+)px;/g)].map((match) => Number(match[1]));
    expect(sizes.length).toBeGreaterThan(20);
    expect(sizes.filter((size) => size < 11)).toEqual([]);
    const tooSmall = sources.filter((file) =>
      [...readFileSync(file, "utf8").matchAll(/text-\[([\d.]+)(px|rem)\]/g)].some(
        ([, value, unit]) => Number(value) * (unit === "rem" ? 16 : 1) < 11,
      ),
    );
    expect(tooSmall).toEqual([]);
  });
});

describe("nfr2 fonts are self-hosted", () => {
  it("never loads fonts from Google or a CDN", () => {
    const offenders = sources.filter((file) =>
      /fonts\.googleapis|fonts\.gstatic|next\/font\/google/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("imports the @fontsource weights in the root layout", () => {
    const layout = readFileSync(join(frontend, "app", "layout.tsx"), "utf8");
    for (const weight of ["500", "600", "700"]) {
      expect(layout).toContain(`@fontsource/barlow-semi-condensed/${weight}.css`);
    }
    for (const weight of ["400", "500", "600", "700"]) {
      expect(layout).toContain(`@fontsource/figtree/${weight}.css`);
    }
  });
});
