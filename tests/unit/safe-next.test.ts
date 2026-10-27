import { describe, expect, it } from "vitest";
import { safeNext } from "@/components/staff/auth";

const ORIGIN = "https://app.example.org";

describe("safeNext (post-login redirect)", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/teacher", ORIGIN)).toBe("/teacher");
    expect(safeNext("/admin/items?status=draft#top", ORIGIN)).toBe("/admin/items?status=draft#top");
  });

  it.each([
    ["missing", null],
    ["relative", "teacher"],
    ["protocol-relative", "//evil.com"],
    ["backslash", "/\\evil.com"],
    ["tab trick", "/\t/evil.com"],
    ["newline trick", "/\n/evil.com"],
    ["absolute", "https://evil.com/x"],
    ["javascript", "javascript:alert(1)"],
  ])("rejects %s", (_name, value) => {
    expect(safeNext(value, ORIGIN)).toBeNull();
  });
});
