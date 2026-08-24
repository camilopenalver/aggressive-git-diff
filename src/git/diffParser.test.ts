import { describe, expect, it } from "vitest";
import { allLinesAdded, parseUnifiedDiff } from "./diffParser";

describe("parseUnifiedDiff", () => {
  it("returns empty arrays for an empty diff", () => {
    expect(parseUnifiedDiff("")).toEqual({
      added: [],
      modified: [],
      deleted: [],
    });
  });

  it("classifies a pure addition hunk as added lines", () => {
    const diff = [
      "diff --git a/file.py b/file.py",
      "--- a/file.py",
      "+++ b/file.py",
      "@@ -3,0 +4,1 @@",
      '+company = "Gurwi"',
    ].join("\n");

    expect(parseUnifiedDiff(diff)).toEqual({
      added: [3],
      modified: [],
      deleted: [],
    });
  });

  it("classifies equal-count replacement hunks as modified lines", () => {
    const diff = [
      "@@ -1,1 +1,1 @@",
      '-name = "Camilo"',
      '+name = "Camilo Peñalver"',
      "@@ -2,1 +2,1 @@",
      "-age = 24",
      "+age = 25",
    ].join("\n");

    expect(parseUnifiedDiff(diff)).toEqual({
      added: [],
      modified: [0, 1],
      deleted: [],
    });
  });

  it("treats omitted hunk counts as 1", () => {
    const diff = ["@@ -1 +1 @@", "-old", "+new"].join("\n");

    expect(parseUnifiedDiff(diff)).toEqual({
      added: [],
      modified: [0],
      deleted: [],
    });
  });

  it("anchors a mid-file deletion after the previous remaining line", () => {
    const diff = [
      "@@ -3,2 +2,0 @@",
      "-deleted one",
      "-deleted two",
    ].join("\n");

    expect(parseUnifiedDiff(diff)).toEqual({
      added: [],
      modified: [],
      deleted: [
        {
          adjacentLine: 1,
          position: "after",
          deletedCount: 2,
          deletedLines: ["deleted one", "deleted two"],
        },
      ],
    });
  });

  it("anchors a deletion at the start of the file before line 0", () => {
    const diff = ["@@ -1,3 +0,0 @@", "-a", "-b", "-c"].join("\n");

    expect(parseUnifiedDiff(diff)).toEqual({
      added: [],
      modified: [],
      deleted: [
        {
          adjacentLine: 0,
          position: "before",
          deletedCount: 3,
          deletedLines: ["a", "b", "c"],
        },
      ],
    });
  });

  it("splits a hunk with more new lines than old into modified plus added", () => {
    const diff = [
      "@@ -5,1 +5,3 @@",
      "-old",
      "+new1",
      "+new2",
      "+new3",
    ].join("\n");

    expect(parseUnifiedDiff(diff)).toEqual({
      added: [5, 6],
      modified: [4],
      deleted: [],
    });
  });

  it("keeps extra old lines as a deletion after the surviving modified lines", () => {
    const diff = [
      "@@ -5,3 +5,1 @@",
      "-old1",
      "-old2",
      "-old3",
      "+new1",
    ].join("\n");

    expect(parseUnifiedDiff(diff)).toEqual({
      added: [],
      modified: [4],
      deleted: [
        {
          adjacentLine: 4,
          position: "after",
          deletedCount: 2,
          deletedLines: ["old2", "old3"],
        },
      ],
    });
  });

  it("ignores No newline at end of file markers", () => {
    const diff = [
      "@@ -1,1 +1,1 @@",
      "-old",
      "\\ No newline at end of file",
      "+new",
      "\\ No newline at end of file",
    ].join("\n");

    expect(parseUnifiedDiff(diff)).toEqual({
      added: [],
      modified: [0],
      deleted: [],
    });
  });

  it("parses CRLF diffs the same as LF diffs", () => {
    const diff = ["@@ -1,0 +1,2 @@", "+alpha", "+beta"].join("\r\n");

    expect(parseUnifiedDiff(diff)).toEqual({
      added: [0, 1],
      modified: [],
      deleted: [],
    });
  });

  it("covers the Camilo example: two modifications and one addition", () => {
    const diff = [
      "@@ -1,1 +1,1 @@",
      '-name = "Camilo"',
      '+name = "Camilo Peñalver"',
      "@@ -2,1 +2,1 @@",
      "-age = 24",
      "+age = 25",
      "@@ -3,0 +4,1 @@",
      '+company = "Gurwi"',
    ].join("\n");

    expect(parseUnifiedDiff(diff)).toEqual({
      added: [3],
      modified: [0, 1],
      deleted: [],
    });
  });
});

describe("allLinesAdded", () => {
  it("marks every document line as added for untracked files", () => {
    expect(allLinesAdded(4)).toEqual({
      added: [0, 1, 2, 3],
      modified: [],
      deleted: [],
    });
  });

  it("returns an empty diff for an empty document", () => {
    expect(allLinesAdded(0)).toEqual({
      added: [],
      modified: [],
      deleted: [],
    });
  });
});
