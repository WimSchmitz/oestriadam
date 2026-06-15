import { describe, it, expect } from "vitest";
import { keyIsValid } from "@/lib/auth";

describe("keyIsValid", () => {
  it("returns true only on exact non-empty match", () => {
    expect(keyIsValid("abc", "abc")).toBe(true);
    expect(keyIsValid("abc", "abcd")).toBe(false);
    expect(keyIsValid("abc", "")).toBe(false);
    expect(keyIsValid("", "")).toBe(false); // empty expected => always false
    expect(keyIsValid(undefined, "abc")).toBe(false);
    expect(keyIsValid("abc", null)).toBe(false);
  });
});
