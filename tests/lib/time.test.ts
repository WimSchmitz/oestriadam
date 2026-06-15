import { describe, it, expect } from "vitest";
import { formatDuration, diffMs } from "@/lib/time";

describe("formatDuration", () => {
  it("formats whole seconds as HH:MM:SS", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(1000)).toBe("00:00:01");
    expect(formatDuration(61_000)).toBe("00:01:01");
    expect(formatDuration(3_661_000)).toBe("01:01:01");
  });
  it("renders placeholder for null", () => {
    expect(formatDuration(null)).toBe("--:--:--");
  });
  it("floors sub-second remainders", () => {
    expect(formatDuration(1999)).toBe("00:00:01");
  });
});

describe("diffMs", () => {
  it("returns ms between two ISO strings", () => {
    expect(diffMs("2026-06-20T10:00:00.000Z", "2026-06-20T10:00:05.000Z")).toBe(5000);
  });
  it("returns null if either input is null", () => {
    expect(diffMs(null, "2026-06-20T10:00:05.000Z")).toBeNull();
    expect(diffMs("2026-06-20T10:00:00.000Z", null)).toBeNull();
  });
});
