import { describe, expect, it } from "vitest";
import {
  isEditorShowingNativeDiff,
  shouldHighlightEditor,
} from "./nativeDiffGuard";

const fileUri = "file:///repo/lib/content_datasource.dart";
const gitUri = "git:/repo/lib/content_datasource.dart?%7B%22path%22%3A%22lib%2Fcontent_datasource.dart%22%7D";

describe("isEditorShowingNativeDiff", () => {
  it("detects the working-tree side of a native side-by-side diff", () => {
    expect(
      isEditorShowingNativeDiff({
        documentUri: fileUri,
        viewColumn: 1,
        groups: [
          {
            viewColumn: 1,
            tabs: [
              {
                isActive: true,
                original: gitUri,
                modified: fileUri,
              },
            ],
          },
        ],
      })
    ).toBe(true);
  });

  it("detects the original side of a native diff", () => {
    expect(
      isEditorShowingNativeDiff({
        documentUri: gitUri,
        viewColumn: 1,
        groups: [
          {
            viewColumn: 1,
            tabs: [
              {
                isActive: true,
                original: gitUri,
                modified: fileUri,
              },
            ],
          },
        ],
      })
    ).toBe(true);
  });

  it("treats an editor without a column as part of any visible native diff", () => {
    expect(
      isEditorShowingNativeDiff({
        documentUri: fileUri,
        viewColumn: undefined,
        groups: [
          {
            viewColumn: 1,
            tabs: [
              {
                isActive: true,
                original: gitUri,
                modified: fileUri,
              },
            ],
          },
        ],
      })
    ).toBe(true);
  });

  it("still allows highlighting the same file in a normal editor column", () => {
    expect(
      isEditorShowingNativeDiff({
        documentUri: fileUri,
        viewColumn: 1,
        groups: [
          {
            viewColumn: 2,
            tabs: [
              {
                isActive: true,
                original: gitUri,
                modified: fileUri,
              },
            ],
          },
        ],
      })
    ).toBe(false);
  });

  it("ignores a diff tab that is not the visible tab in that column", () => {
    expect(
      isEditorShowingNativeDiff({
        documentUri: fileUri,
        viewColumn: 1,
        groups: [
          {
            viewColumn: 1,
            tabs: [
              {
                isActive: false,
                original: gitUri,
                modified: fileUri,
              },
              { isActive: true },
            ],
          },
        ],
      })
    ).toBe(false);
  });

  it("detects multi-file native review diffs", () => {
    expect(
      isEditorShowingNativeDiff({
        documentUri: fileUri,
        viewColumn: 1,
        groups: [
          {
            viewColumn: 1,
            tabs: [
              {
                isActive: true,
                multiDiff: [
                  {
                    original: gitUri,
                    modified: fileUri,
                  },
                ],
              },
            ],
          },
        ],
      })
    ).toBe(true);
  });
});

describe("shouldHighlightEditor", () => {
  it("skips non-file schemes used by Git revision editors", () => {
    expect(
      shouldHighlightEditor({
        scheme: "git",
        documentUri: gitUri,
        viewColumn: 1,
        groups: [],
      })
    ).toBe(false);
  });

  it("skips the file side of a native diff so decorations do not overlap", () => {
    expect(
      shouldHighlightEditor({
        scheme: "file",
        documentUri: fileUri,
        viewColumn: 1,
        groups: [
          {
            viewColumn: 1,
            tabs: [
              {
                isActive: true,
                original: gitUri,
                modified: fileUri,
              },
            ],
          },
        ],
      })
    ).toBe(false);
  });

  it("highlights a normal file editor", () => {
    expect(
      shouldHighlightEditor({
        scheme: "file",
        documentUri: fileUri,
        viewColumn: 1,
        groups: [
          {
            viewColumn: 1,
            tabs: [{ isActive: true }],
          },
        ],
      })
    ).toBe(true);
  });
});
