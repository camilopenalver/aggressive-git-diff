import * as path from "path";
import { describe, expect, it } from "vitest";
import {
  buildChangedOnlyExcludes,
  restoreInjectedExcludes,
} from "./changedOnlyExcludes";

const root = path.join("/workspace");
const mobile = path.join(root, "gurwi-mobile");
const web = path.join(root, "gurwi-web");
const lib = path.join(mobile, "lib");
const app = path.join(lib, "app.dart");
const other = path.join(lib, "other.dart");
const ios = path.join(mobile, "ios");
const readme = path.join(root, "README.md");
const settings = path.join(root, ".vscode", "settings.json");

function childrenOf(tree: Record<string, string[]>) {
  return (dir: string): string[] => tree[dir] ?? [];
}

describe("buildChangedOnlyExcludes", () => {
  it("hides sibling folders and files that are not on a change path", () => {
    const excludes = buildChangedOnlyExcludes({
      workspaceRoot: root,
      changedFiles: [app],
      listChildren: childrenOf({
        [root]: [mobile, web, readme],
        [mobile]: [lib, ios],
        [lib]: [app, other],
      }),
    });

    expect(excludes).toEqual({
      "gurwi-web": true,
      "README.md": true,
      "gurwi-mobile/ios": true,
      "gurwi-mobile/lib/other.dart": true,
    });
  });

  it("hides every top-level child when there are no changes", () => {
    expect(
      buildChangedOnlyExcludes({
        workspaceRoot: root,
        changedFiles: [],
        listChildren: childrenOf({
          [root]: [mobile, web, readme],
        }),
      })
    ).toEqual({
      "gurwi-mobile": true,
      "gurwi-web": true,
      "README.md": true,
    });
  });

  it("keeps a changed file at the workspace root and hides its siblings", () => {
    expect(
      buildChangedOnlyExcludes({
        workspaceRoot: root,
        changedFiles: [readme],
        listChildren: childrenOf({
          [root]: [mobile, web, readme],
        }),
      })
    ).toEqual({
      "gurwi-mobile": true,
      "gurwi-web": true,
    });
  });

  it("ignores the workspace settings file so the filter does not reveal itself", () => {
    expect(
      buildChangedOnlyExcludes({
        workspaceRoot: root,
        changedFiles: [app, settings],
        listChildren: childrenOf({
          [root]: [mobile, path.join(root, ".vscode"), web],
          [mobile]: [lib],
          [lib]: [app],
          [path.join(root, ".vscode")]: [settings],
        }),
      })
    ).toEqual({
      ".vscode": true,
      "gurwi-web": true,
    });
  });

  it("uses forward slashes in exclude keys", () => {
    const excludes = buildChangedOnlyExcludes({
      workspaceRoot: root,
      changedFiles: [app],
      listChildren: childrenOf({
        [root]: [mobile],
        [mobile]: [lib, ios],
        [lib]: [app],
      }),
    });

    expect(Object.keys(excludes).every((key) => !key.includes("\\"))).toBe(
      true
    );
    expect(excludes["gurwi-mobile/ios"]).toBe(true);
  });
});

describe("restoreInjectedExcludes", () => {
  it("removes injected keys and restores previous workspace values", () => {
    expect(
      restoreInjectedExcludes(
        {
          "**/node_modules": true,
          "gurwi-web": true,
          "README.md": true,
        },
        ["gurwi-web", "README.md"],
        { "**/node_modules": true }
      )
    ).toEqual({ "**/node_modules": true });
  });

  it("returns undefined when nothing remains", () => {
    expect(
      restoreInjectedExcludes({ "gurwi-web": true }, ["gurwi-web"], undefined)
    ).toBeUndefined();
  });

  it("puts back a key the user already excluded before the filter ran", () => {
    expect(
      restoreInjectedExcludes(
        { dist: true, "gurwi-web": true },
        ["gurwi-web", "dist"],
        { dist: true }
      )
    ).toEqual({ dist: true });
  });
});
