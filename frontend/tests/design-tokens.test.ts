import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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
  return new RegExp(`${escape(variable)}:\\s*${escape(value)};`).test(css);
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
