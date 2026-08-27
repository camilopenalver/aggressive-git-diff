import { describe, expect, it } from "vitest";
import {
  deletedLineTextDecoration,
  formatDeletedLabel,
  formatDeletedLines,
  withOpacity,
} from "./colors";

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

describe("formatDeletedLines", () => {
  it("renders each deleted line instead of a count summary", () => {
    const lines = formatDeletedLines([
      '"user_subscription_credits",',
      '"user_id": user_id,',
      "amount = 5,",
      "reason = \"refund\",",
      "created_at = now(),",
    ]);

    expect(lines).toHaveLength(5);
    expect(lines.some((line) => line.includes("5 deleted"))).toBe(false);
    expect(lines[0]).toBe('− "user_subscription_credits",');
    expect(lines[2]).toBe("− amount = 5,");
  });

  it("preserves indentation of the original deleted code", () => {
    expect(formatDeletedLines(["    return None"])).toEqual([
      "−     return None",
    ]);
  });

  it("keeps empty deleted lines visible", () => {
    expect(formatDeletedLines([""])).toEqual(["− "]);
  });
});

describe("deletedLineTextDecoration", () => {
  it("does not strikethrough deleted lines by default", () => {
    const style = deletedLineTextDecoration();
    expect(style.startsWith("line-through")).toBe(false);
    expect(style).toContain("display: block");
    expect(style).toContain("border-left");
  });

  it("can opt back into strikethrough", () => {
    expect(deletedLineTextDecoration(true).startsWith("line-through")).toBe(
      true
    );
  });
});
