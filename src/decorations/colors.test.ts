import { describe, expect, it } from "vitest";
import { formatDeletedLabel, withOpacity } from "./colors";

describe("withOpacity", () => {
  it("replaces the alpha of an rgba color", () => {
    expect(withOpacity("rgba(40, 200, 90, 0.28)", 0.25)).toBe(
      "rgba(40, 200, 90, 0.25)"
    );
  });

  it("converts hex colors to rgba using the given opacity", () => {
    expect(withOpacity("#28c85a", 0.3)).toBe("rgba(40, 200, 90, 0.3)");
  });
});

describe("formatDeletedLabel", () => {
  it("uses a singular noun for one deleted line", () => {
    expect(formatDeletedLabel(1)).toBe("──────── − 1 deleted line ────────");
  });

  it("appends a truncated preview when provided", () => {
    expect(formatDeletedLabel(3, "country = \"Colombia\"")).toContain(
      "− 3 deleted lines"
    );
    expect(formatDeletedLabel(3, "country = \"Colombia\"")).toContain(
      'country = "Colombia"'
    );
  });
});
