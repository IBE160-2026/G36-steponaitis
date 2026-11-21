import { describe, expect, it } from "vitest";

import { formatDate, formatNumber, formatTime } from "@/lib/format";

// UX-DR56 display formats, a copy rule under NFR-11. Vitest runs with TZ=Europe/Oslo.

describe("nfr11 formats dates as YYYY-MM-DD", () => {
  it("returns a date-only string unchanged, never shifted by the time zone", () => {
    expect(formatDate("2026-09-30")).toBe("2026-09-30");
  });

  it("shows an instant as the viewer's local date", () => {
    expect(process.env.TZ).toBe("Europe/Oslo");
    expect(formatDate("2026-09-30T22:30:00Z")).toBe("2026-10-01");
  });

  it("rejects input that is not a date", () => {
    expect(() => formatDate("not a date")).toThrow(RangeError);
    expect(() => formatDate("2026-02-30")).toThrow(RangeError);
  });
});

describe("nfr11 formats times as HH:MM in the viewer's zone", () => {
  it("shows an instant as the local 24-hour time", () => {
    expect(formatTime("2026-09-30T22:30:00Z")).toBe("00:30");
    expect(formatTime("2026-09-30T11:05:00Z")).toBe("13:05");
  });

  it("rejects input that is not a time", () => {
    expect(() => formatTime("yesterday")).toThrow(RangeError);
    expect(() => formatTime("2026-09-30")).toThrow(RangeError);
  });
});

describe("nfr11 formats numbers with thousands separators", () => {
  it.each([
    [1584, "1,584"],
    [2000000, "2,000,000"],
    ["12345.5", "12,345.5"],
    [-1234, "-1,234"],
    [0, "0"],
    [999, "999"],
    ["1000.250", "1,000.250"],
    [12.75, "12.75"],
    [1e21, "1,000,000,000,000,000,000,000"],
    [1e-7, "0.0000001"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatNumber(value)).toBe(expected);
  });

  it("rejects a non-numeric string", () => {
    expect(() => formatNumber("12a")).toThrow(RangeError);
    expect(() => formatNumber("")).toThrow(RangeError);
    expect(() => formatNumber(Number.NaN)).toThrow(RangeError);
  });
});
