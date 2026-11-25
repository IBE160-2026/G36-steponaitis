import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ColourPopoverBody, Key, KeySwatch } from "@/components/common/wall";
import { colourWarnings, DEFAULT_COLOURS, type KeyColourEntry } from "@/lib/colours";
import {
  colourChanged,
  colourEntryName,
  colourPickerName,
  colourPopoverTitle,
  colourWarningText,
  keyEntryButtonName,
  presetName,
} from "@/lib/copy";

// FR-42 (UJ-4), Story 11.3: the Key colour popover. The warnings and copy are pure; the preview
// runs against a fake `<html>` style and localStorage; the Key and the popover body are rendered
// to static markup (Vitest has no DOM, so opening, arrows, Esc and Done are in Playwright).

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function sentences(entry: KeyColourEntry, pick: string, current = DEFAULT_COLOURS): string[] {
  return colourWarnings(entry, pick, current).map(colourWarningText);
}

describe("fr42 colour popover warnings", () => {
  it("fr42 the defaults give no warning", () => {
    for (const entry of Object.keys(DEFAULT_COLOURS) as KeyColourEntry[]) {
      expect(colourWarnings(entry, DEFAULT_COLOURS[entry], DEFAULT_COLOURS)).toEqual([]);
    }
  });

  it("fr42 a dark slow fails both wall pairs, with the ratio floored", () => {
    expect(sentences("slow", "#222222")).toEqual([
      "Slow-moving on the wall: 1.2:1 (3:1 or more recommended)",
      "Slow-moving on an open slot: 1.1:1 (3:1 or more recommended)",
    ]);
  });

  it("fr42 a slow like the selection warns once, names in Key order", () => {
    expect(sentences("slow", "#9466f0")).toEqual([
      "Slow-moving and Selection look alike (ΔE 0). Bins and the selection frame may be hard to tell apart.",
    ]);
    expect(sentences("selection", DEFAULT_COLOURS.slow)).toContain(
      "Slow-moving and Selection look alike (ΔE 0). Bins and the selection frame may be hard to tell apart.",
    );
  });

  it("fr42 alike pairs name what may be hard to tell apart", () => {
    expect(sentences("medium", DEFAULT_COLOURS.fast).at(-1)).toBe(
      "Fast-moving and Medium-moving look alike (ΔE 0). Bins of the two classes may be hard to tell apart.",
    );
    expect(sentences("best", DEFAULT_COLOURS.fast).at(-1)).toBe(
      "Fast-moving and Best location look alike (ΔE 0). Bins and the best-location frame may be hard to tell apart.",
    );
    expect(sentences("best", DEFAULT_COLOURS.selection).at(-1)).toBe(
      "Best location and Selection look alike (ΔE 0). The best-location frame and the selection frame may be hard to tell apart.",
    );
  });

  it("fr42 only pairs with the entry are warned about", () => {
    const current = { ...DEFAULT_COLOURS, fast: "#D85145", medium: "#D85144" };
    expect(sentences("slow", "#378CBE", current)).toEqual([]);
  });

  it("fr42 a dark best fails the BEST text pair", () => {
    const warnings = colourWarnings("best", "#1B5E33", DEFAULT_COLOURS);
    expect(warnings.map((warning) => warning.kind === "contrast" && warning.against)).toContain("ink-text");
    expect(warnings.map(colourWarningText)).toContain("Best location under BEST text: 2.1:1 (4.5:1 or more recommended)");
  });

  it("fr42 selection is measured on its casing and on white", () => {
    expect(sentences("selection", "#FFFFFF")).toEqual([
      "Selection on white: 1.0:1 (3:1 or more recommended)",
    ]);
    expect(sentences("selection", "#141719")[0]).toBe("Selection on its casing: 1.0:1 (3:1 or more recommended)");
  });
});

describe("fr42 colour popover copy", () => {
  it("fr42 names and announcements", () => {
    expect(keyEntryButtonName("Fast-moving")).toBe("Fast-moving, change colour");
    expect(colourPopoverTitle("Fast-moving")).toBe("Fast-moving colour");
    expect(presetName("Fast-moving", 3)).toBe("Fast-moving shade 3 of 8");
    expect(colourPickerName("Slow-moving")).toBe("Slow-moving, pick a colour");
    expect(colourChanged("Slow-moving")).toBe("Slow-moving colour changed");
    expect(colourEntryName("selection")).toBe("Selection");
    expect(colourEntryName("dead")).toBe("Dead stock");
  });
});

class FakeStyle {
  readonly values = new Map<string, string>();
  setProperty(name: string, value: string) {
    this.values.set(name, value);
  }
  getPropertyValue(name: string) {
    return this.values.get(name) ?? "";
  }
}

describe("fr42 previewKeyColour", () => {
  let style: FakeStyle;
  let items: Map<string, string>;

  beforeEach(() => {
    vi.resetModules();
    style = new FakeStyle();
    items = new Map();
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", { documentElement: { style } });
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fr42 a preview applies without storing or notifying and null restores what is kept", async () => {
    items.set("swp:colours", JSON.stringify({ slow: "#5EB5E9" }));
    const store = await import("@/lib/colours/storage");
    const listener = vi.fn();
    store.subscribeKeyColours(listener);
    store.previewKeyColour("slow", "#378cbe");
    expect(style.getPropertyValue("--colour-slow")).toBe("#378CBE");
    expect(items.get("swp:colours")).toBe(JSON.stringify({ slow: "#5EB5E9" }));
    expect(store.getKeyColours().slow).toBe("#5EB5E9");
    expect(listener).not.toHaveBeenCalled();
    store.previewKeyColour("slow", null);
    expect(style.getPropertyValue("--colour-slow")).toBe("#5EB5E9");
    expect(listener).not.toHaveBeenCalled();
  });

  it("fr42 a best preview carries its paper shade and null restores both", async () => {
    const store = await import("@/lib/colours/storage");
    store.previewKeyColour("best", "#459B7D");
    expect(style.getPropertyValue("--colour-best")).toBe("#459B7D");
    const derived = style.getPropertyValue("--colour-best-on-light");
    expect(derived).toMatch(/^#[0-9A-F]{6}$/);
    expect(derived).not.toBe("#267A4B");
    store.previewKeyColour("best", null);
    expect(style.getPropertyValue("--colour-best")).toBe("#3DAE6B");
    expect(style.getPropertyValue("--colour-best-on-light")).toBe("#267A4B");
    store.previewKeyColour("selection", "#7267E0");
    expect(style.getPropertyValue("--colour-selected-tint")).not.toBe("");
    store.previewKeyColour("selection", null);
    expect(style.getPropertyValue("--colour-selection")).toBe("#9466F0");
    expect(style.getPropertyValue("--colour-selected-tint")).toBe("#F3EFFD");
    expect(items.size).toBe(0);
  });

  it("fr42 a preview that is not hex throws RangeError and changes nothing", async () => {
    const store = await import("@/lib/colours/storage");
    expect(() => store.previewKeyColour("slow", "#12345")).toThrow(RangeError);
    expect(style.values.size).toBe(0);
  });
});

describe("fr42 Key colour buttons and popover body", () => {
  it("fr42 the six colour entries are dialog buttons and Empty and 2 parts are plain", () => {
    const markup = renderToStaticMarkup(<Key />);
    const buttons = [...markup.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]);
    expect(buttons).toHaveLength(6);
    for (const button of buttons) {
      expect(button).toContain('aria-haspopup="dialog"');
      expect(button).toContain('aria-expanded="false"');
      expect(button).toContain('type="button"');
    }
    expect(buttons.map((button) => /aria-label="([^"]+)"/.exec(button)?.[1])).toEqual([
      "Fast-moving, change colour",
      "Medium-moving, change colour",
      "Slow-moving, change colour",
      "Dead stock, change colour",
      "Best location, change colour",
      "Selected, change colour",
    ]);
    expect(markup.match(/data-icon="palette"/g)).toHaveLength(6);
    expect(markup).toMatch(/<p role="status" aria-live="polite"[^>]*data-key-announcer=""/);
    for (const entry of ["empty", "twoParts"]) {
      const item = new RegExp(`<li[^>]*data-key-entry="${entry}">(.*?)</li>`).exec(markup)?.[1] ?? "";
      expect(item).not.toContain("<button");
    }
    expect(text(markup)).not.toMatch(/#[0-9A-F]{6}/i);
  });

  function body(pick: string, textValue = pick, storageAvailable = true): string {
    return renderToStaticMarkup(
      <ColourPopoverBody
        entry="slow"
        label="Slow-moving"
        swatch={<KeySwatch entry="slow" />}
        titleId="title"
        pick={pick}
        text={textValue}
        current={DEFAULT_COLOURS}
        storageAvailable={storageAvailable}
        onPick={() => {}}
        onText={() => {}}
        onDone={() => {}}
      />,
    );
  }

  it("fr42 the body has the title, eight named radios with the current checked and the actions", () => {
    const markup = body("#417DDC");
    expect(markup).toMatch(/<h2 id="title"[^>]*><span>Slow-moving<\/span> <svg[^>]*aria-hidden="true"[\s\S]*<\/svg> <span>colour<\/span><\/h2>/);
    expect(markup).toContain('role="radiogroup"');
    const radios = [...markup.matchAll(/<button[^>]*role="radio"[^>]*>/g)].map((match) => match[0]);
    expect(radios).toHaveLength(8);
    expect(radios.map((radio) => /aria-label="([^"]+)"/.exec(radio)?.[1])).toEqual([
      "Slow-moving shade 1 of 8",
      "Slow-moving shade 2 of 8",
      "Slow-moving shade 3 of 8",
      "Slow-moving shade 4 of 8",
      "Slow-moving shade 5 of 8",
      "Slow-moving shade 6 of 8",
      "Slow-moving shade 7 of 8",
      "Default",
    ]);
    expect(radios.filter((radio) => radio.includes('aria-checked="true"'))).toHaveLength(1);
    expect(radios[7]).toContain('aria-checked="true"');
    expect(markup.match(/data-icon="check"/g)).toHaveLength(1);
    expect(markup).toContain('aria-label="Slow-moving, pick a colour"');
    expect(markup).toContain('type="color"');
    expect(markup).toContain('value="#417ddc"');
    expect(markup).toMatch(/data-colour-default="">[\s\S]*Default[\s\S]*#417DDC/);
    expect(markup).toContain(">Reset this colour</button>");
    expect(markup).toContain(">Done</button>");
    // No warning, no storage note, the field valid and described by the always-present status.
    const status = /<div id="([^"]+)" role="status"[^>]*><\/div>/.exec(markup);
    expect(status).not.toBeNull();
    expect(markup).toMatch(new RegExp(`aria-describedby="${status![1]}"`));
    expect(markup).not.toContain("aria-invalid");
    expect(markup).not.toContain("Colours can");
  });

  it("fr42 a pick that is no preset checks no radio; an invalid hex is marked; blocked storage is said", () => {
    const markup = body("#222222", "#12345", false);
    expect(markup).not.toContain('aria-checked="true"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain("Enter a colour as #RRGGBB");
    // The field is described by the always-present status and by the error.
    const statusId = /<div id="([^"]+)" role="status"/.exec(markup)?.[1];
    const errorId = /<p id="([^"]+)"[^>]*>(?:(?!<\/p>).)*Enter a colour as #RRGGBB/.exec(markup)?.[1];
    const describedBy = /<input[^>]*aria-describedby="([^"]+)"[^>]*data-colour-hex=""/.exec(markup)?.[1].split(" ");
    expect(statusId).toBeDefined();
    expect(errorId).toBeDefined();
    expect(describedBy).toEqual(expect.arrayContaining([statusId, errorId]));
    expect(markup).toContain("Slow-moving on the wall: 1.2:1 (3:1 or more recommended)");
    expect(markup).toContain("Colours can&#x27;t be kept in this browser");
  });
});
