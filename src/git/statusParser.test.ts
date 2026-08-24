import { describe, expect, it } from "vitest";
import {
  ancestorDirectories,
  parsePorcelainStatus,
} from "./statusParser";

describe("parsePorcelainStatus", () => {
  it("returns an empty list for empty status output", () => {
    expect(parsePorcelainStatus("")).toEqual([]);
  });

  it("classifies modified, untracked, added and deleted files", () => {
    const output = [
      " M models.py",
      "?? new_service.py",
      "A  added.py",
      "D  gone.py",
      "MM stripe_service.py",
    ].join("\n");

    expect(parsePorcelainStatus(output)).toEqual([
      { relativePath: "models.py", kind: "modified" },
      { relativePath: "new_service.py", kind: "untracked" },
      { relativePath: "added.py", kind: "added" },
      { relativePath: "gone.py", kind: "deleted" },
      { relativePath: "stripe_service.py", kind: "modified" },
    ]);
  });

  it("uses the destination path for renames", () => {
    expect(
      parsePorcelainStatus("R  backend/old.py -> backend/new.py")
    ).toEqual([{ relativePath: "backend/new.py", kind: "renamed" }]);
  });

  it("unquotes paths with spaces", () => {
    expect(parsePorcelainStatus(' M "my file.py"')).toEqual([
      { relativePath: "my file.py", kind: "modified" },
    ]);
  });

  it("parses NUL-separated porcelain output", () => {
    const output = [" M models.py", "?? new service.py", ""].join("\0");
    expect(parsePorcelainStatus(output)).toEqual([
      { relativePath: "models.py", kind: "modified" },
      { relativePath: "new service.py", kind: "untracked" },
    ]);
  });

  it("parses NUL-separated rename records", () => {
    const output = ["R  backend/new.py", "backend/old.py", ""].join("\0");
    expect(parsePorcelainStatus(output)).toEqual([
      { relativePath: "backend/new.py", kind: "renamed" },
    ]);
  });
});

describe("ancestorDirectories", () => {
  it("returns each parent directory up to the git root", () => {
    expect(
      ancestorDirectories("/repo", "backend/routes/webhooks/models.py")
    ).toEqual([
      "/repo/backend",
      "/repo/backend/routes",
      "/repo/backend/routes/webhooks",
    ]);
  });

  it("returns no directories for a file at the repository root", () => {
    expect(ancestorDirectories("/repo", "README.md")).toEqual([]);
  });
});
