import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// FR-42 (SM-7), Story 11.2: the Key colours kept in this browser. The store runs against a fake
// localStorage and a fake `<html>` style; the boot script string runs with `new Function` against
// the same fakes and must agree with `parseStoredColours`.

type Store = typeof import("@/lib/colours/storage");

class FakeStyle {
  readonly values = new Map<string, string>();
  setProperty(name: string, value: string) {
    this.values.set(name, value);
  }
  getPropertyValue(name: string) {
    return this.values.get(name) ?? "";
  }
}

class FakeStorage {
  readonly items = new Map<string, string>();
  failRead = false;
  failWrite = false;
  getItem(key: string) {
    if (this.failRead) throw new Error("SecurityError");
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrite) throw new Error("QuotaExceededError");
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

let style: FakeStyle;
let storage: FakeStorage;

beforeEach(() => {
  vi.resetModules();
  style = new FakeStyle();
  storage = new FakeStorage();
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { documentElement: { style } });
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function freshStore(stored?: string): Promise<Store> {
  if (stored !== undefined) storage.items.set("swp:colours", stored);
  return import("@/lib/colours/storage");
}

/** Runs the inline boot script against the fakes and returns the variables it set. */
function runBootScript(script: string): Record<string, string> {
  new Function("localStorage", "document", script)(storage, { documentElement: { style } });
  return Object.fromEntries(style.values);
}

const DEFAULTS = {
  fast: "#D85144",
  medium: "#F0B323",
  slow: "#417DDC",
  dead: "#8C939A",
  best: "#3DAE6B",
  selection: "#9466F0",
};

describe("fr42 parseStoredColours", () => {
  it("fr42 nothing stored gives no variable", async () => {
    const { parseStoredColours } = await freshStore();
    expect(parseStoredColours(null)).toEqual({});
  });

  it("fr42 a valid stored colour is kept", async () => {
    const { parseStoredColours } = await freshStore();
    expect(parseStoredColours('{"slow":"#378CBE"}')).toEqual({ slow: "#378CBE" });
  });

  it("fr42 a stored best pair is kept whole and a broken pair is dropped whole", async () => {
    const { parseStoredColours } = await freshStore();
    expect(parseStoredColours('{"best":"#2F9A5C","best-on-light":"#246F45"}')).toEqual({
      best: "#2F9A5C",
      "best-on-light": "#246F45",
    });
    expect(parseStoredColours('{"best":"#2F9A5C"}')).toEqual({});
    expect(parseStoredColours('{"best":"#2F9A5C","best-on-light":"green"}')).toEqual({});
    expect(parseStoredColours('{"selection":"#7267E0","selected-tint":"#F1F0FC","slow":"#378CBE"}')).toEqual({
      selection: "#7267E0",
      "selected-tint": "#F1F0FC",
      slow: "#378CBE",
    });
    expect(parseStoredColours('{"selected-tint":"#F1F0FC","slow":"#378CBE"}')).toEqual({ slow: "#378CBE" });
  });

  it("fr42 an invalid value is ignored per variable and a valid one is normalised to uppercase", async () => {
    const { parseStoredColours } = await freshStore();
    expect(parseStoredColours('{"fast":"red","slow":"#378cbe"}')).toEqual({ slow: "#378CBE" });
    expect(parseStoredColours('{"fast":"#D8514","medium":"F0B323","dead":7,"other":"#000000"}')).toEqual({});
  });

  it("fr42 corrupt JSON, an array, null or a non-string gives all defaults without throwing", async () => {
    const { parseStoredColours } = await freshStore();
    for (const raw of ["{oops", "[1]", "null", '"#378CBE"', "42", "", undefined, 3]) {
      expect(parseStoredColours(raw), String(raw)).toEqual({});
    }
  });
});

describe("fr42 boot script", () => {
  const cases = [
    undefined,
    '{"slow":"#378CBE"}',
    '{"best":"#2F9A5C","best-on-light":"#246F45"}',
    '{"best":"#2F9A5C"}',
    '{"fast":"red","slow":"#378cbe"}',
    "{oops",
    "[1]",
    "null",
  ];

  it.each(cases)("fr42 sets the same variables as parseStoredColours for %s", async (stored) => {
    const { COLOURS_BOOT_SCRIPT, parseStoredColours } = await freshStore(stored);
    const expected = Object.fromEntries(
      Object.entries(parseStoredColours(stored ?? null)).map(([name, value]) => [`--colour-${name}`, value]),
    );
    expect(runBootScript(COLOURS_BOOT_SCRIPT)).toEqual(expected);
  });

  it("fr42 reads swp:colours and stays quiet when storage throws", async () => {
    const { COLOURS_BOOT_SCRIPT } = await freshStore('{"slow":"#378CBE"}');
    expect(COLOURS_BOOT_SCRIPT).toContain('"swp:colours"');
    expect(COLOURS_BOOT_SCRIPT).not.toContain("</script");
    storage.failRead = true;
    expect(() => runBootScript(COLOURS_BOOT_SCRIPT)).not.toThrow();
    expect(style.values.size).toBe(0);
  });
});

describe("fr42 key colours store", () => {
  it("fr42 nothing stored gives the defaults and sets no variable", async () => {
    const store = await freshStore();
    expect(store.getKeyColours()).toEqual(DEFAULTS);
    store.applyKeyColours();
    expect(style.values.size).toBe(0);
    expect(store.isColourStorageAvailable()).toBe(true);
  });

  it("fr42 the store reads the stored colours with the same parser as the boot script", async () => {
    const store = await freshStore('{"fast":"red","slow":"#378cbe","best":"#2F9A5C"}');
    expect(store.getKeyColours()).toEqual({ ...DEFAULTS, slow: "#378CBE" });
    store.applyKeyColours();
    expect(Object.fromEntries(style.values)).toEqual({ "--colour-slow": "#378CBE" });
  });

  it("fr42 corrupt storage gives all defaults", async () => {
    for (const stored of ["{oops", "[1]", "null"]) {
      vi.resetModules();
      storage.items.clear();
      const store = await freshStore(stored);
      expect(store.getKeyColours(), stored).toEqual(DEFAULTS);
    }
  });

  it("fr42 storage that throws on read gives all defaults", async () => {
    storage.failRead = true;
    const store = await freshStore();
    expect(store.getKeyColours()).toEqual(DEFAULTS);
    expect(store.isColourStorageAvailable()).toBe(false);
  });

  it("fr42 setKeyColour applies best and its derived best-on-light, stores all eight and notifies", async () => {
    const store = await freshStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribeKeyColours(listener);
    const before = store.getKeyColours();
    store.setKeyColour("best", "#2f9a5c");
    const { deriveBestOnLight } = await import("@/lib/colours/checks");
    const onLight = deriveBestOnLight("#2F9A5C");
    expect(style.getPropertyValue("--colour-best")).toBe("#2F9A5C");
    expect(style.getPropertyValue("--colour-best-on-light")).toBe(onLight);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getKeyColours()).not.toBe(before);
    expect(store.getKeyColours().best).toBe("#2F9A5C");
    const saved = JSON.parse(storage.items.get("swp:colours")!);
    expect(saved).toEqual({
      ...DEFAULTS,
      best: "#2F9A5C",
      "best-on-light": onLight,
      "selected-tint": "#F3EFFD",
    });
    expect(store.parseStoredColours(storage.items.get("swp:colours")!)).toEqual(saved);
    unsubscribe();
    store.setKeyColour("slow", "#378CBE");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("fr42 setKeyColour on selection derives the selected tint", async () => {
    const store = await freshStore();
    store.setKeyColour("selection", "#7267E0");
    const { deriveSelectedTint } = await import("@/lib/colours/checks");
    expect(style.getPropertyValue("--colour-selection")).toBe("#7267E0");
    expect(style.getPropertyValue("--colour-selected-tint")).toBe(deriveSelectedTint("#7267E0"));
  });

  it("fr42 an invalid hex throws RangeError and changes nothing", async () => {
    const store = await freshStore();
    const listener = vi.fn();
    store.subscribeKeyColours(listener);
    expect(() => store.setKeyColour("fast", "red")).toThrow(RangeError);
    expect(() => store.setKeyColour("fast", "#D8514")).toThrow(RangeError);
    expect(style.values.size).toBe(0);
    expect(storage.items.size).toBe(0);
    expect(listener).not.toHaveBeenCalled();
    expect(store.getKeyColours()).toEqual(DEFAULTS);
  });

  it("fr42 resetKeyColour restores best and best-on-light", async () => {
    const store = await freshStore('{"best":"#2F9A5C","best-on-light":"#246F45"}');
    expect(store.getKeyColours().best).toBe("#2F9A5C");
    store.resetKeyColour("best");
    expect(style.getPropertyValue("--colour-best")).toBe("#3DAE6B");
    expect(style.getPropertyValue("--colour-best-on-light")).toBe("#267A4B");
    expect(store.getKeyColours()).toEqual(DEFAULTS);
    expect(JSON.parse(storage.items.get("swp:colours")!)).toMatchObject({ best: "#3DAE6B", "best-on-light": "#267A4B" });
  });

  it("fr42 resetKeyColour restores selection and selected-tint", async () => {
    const store = await freshStore('{"selection":"#7267E0","selected-tint":"#F1F0FC"}');
    expect(store.getKeyColours().selection).toBe("#7267E0");
    store.resetKeyColour("selection");
    expect(style.getPropertyValue("--colour-selection")).toBe("#9466F0");
    expect(style.getPropertyValue("--colour-selected-tint")).toBe("#F3EFFD");
    expect(JSON.parse(storage.items.get("swp:colours")!)).toMatchObject({ selection: "#9466F0", "selected-tint": "#F3EFFD" });
  });

  it("fr42 setKeyColour rejects an unknown entry with RangeError", async () => {
    const store = await freshStore();
    expect(() => store.setKeyColour("purple" as never, "#378CBE")).toThrow(RangeError);
    expect(style.values.size).toBe(0);
    expect(storage.items.size).toBe(0);
  });

  it("fr42 a change from another tab is kept when this tab changes a colour", async () => {
    const store = await freshStore();
    store.setKeyColour("slow", "#378CBE");
    const other = JSON.parse(storage.items.get("swp:colours")!);
    storage.items.set("swp:colours", JSON.stringify({ ...other, fast: "#DB6024" }));
    store.setKeyColour("dead", "#798386");
    expect(JSON.parse(storage.items.get("swp:colours")!)).toMatchObject({ slow: "#378CBE", fast: "#DB6024", dead: "#798386" });
  });

  it("fr42 blocked storage on write keeps the change in memory", async () => {
    storage.failWrite = true;
    const store = await freshStore();
    store.setKeyColour("slow", "#378CBE");
    expect(style.getPropertyValue("--colour-slow")).toBe("#378CBE");
    expect(store.getKeyColours().slow).toBe("#378CBE");
    expect(storage.items.size).toBe(0);
    expect(store.isColourStorageAvailable()).toBe(false);
  });

  it("fr42_readable_but_not_writable_storage_is_known_before_the_first_change", async () => {
    // Story 11.3: "Colours can't be kept" shows at once, not only after a save has failed.
    storage.failWrite = true;
    const store = await freshStore('{"slow":"#378CBE"}');
    expect(store.isColourStorageAvailable()).toBe(false);
    // The stored colours are still read and used.
    expect(store.getKeyColours().slow).toBe("#378CBE");
  });

  it("fr42_the_write_probe_leaves_nothing_behind", async () => {
    const store = await freshStore();
    expect(store.isColourStorageAvailable()).toBe(true);
    expect([...storage.items.keys()]).toEqual([]);
  });

  it("fr42 on the server the store gives the defaults and touches nothing", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    const store = await freshStore('{"slow":"#378CBE"}');
    expect(store.getKeyColours()).toEqual(DEFAULTS);
    expect(() => store.applyKeyColours()).not.toThrow();
  });
});
