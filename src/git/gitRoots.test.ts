import * as fs from "fs";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverGitRoots, startDirFor } from "./gitRoots";

describe("startDirFor", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses a directory as-is when the path is a git root folder", () => {
    const dir = makeTemp();
    dirs.push(dir);
    expect(startDirFor(dir)).toBe(dir);
  });

  it("uses the parent directory for a file path", () => {
    const dir = makeTemp();
    dirs.push(dir);
    const file = path.join(dir, "refunds.py");
    fs.writeFileSync(file, "x = 1\n");
    expect(startDirFor(file)).toBe(dir);
  });
});

describe("discoverGitRoots", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns the workspace itself when it is a git repository", () => {
    const workspace = makeTemp();
    dirs.push(workspace);
    fs.mkdirSync(path.join(workspace, ".git"));
    expect(discoverGitRoots(workspace)).toEqual([workspace]);
  });

  it("finds nested git repositories under a non-git workspace", () => {
    const workspace = makeTemp();
    dirs.push(workspace);
    const backend = path.join(workspace, "gurwi-backend");
    const web = path.join(workspace, "gurwi-web");
    const notes = path.join(workspace, "notes");
    fs.mkdirSync(path.join(backend, ".git"), { recursive: true });
    fs.mkdirSync(path.join(web, ".git"), { recursive: true });
    fs.mkdirSync(notes);

    expect(discoverGitRoots(workspace).sort()).toEqual([backend, web].sort());
  });

  it("skips node_modules and other ignored directories", () => {
    const workspace = makeTemp();
    dirs.push(workspace);
    fs.mkdirSync(path.join(workspace, "node_modules", "leftpad", ".git"), {
      recursive: true,
    });
    const app = path.join(workspace, "app");
    fs.mkdirSync(path.join(app, ".git"), { recursive: true });

    expect(discoverGitRoots(workspace)).toEqual([app]);
  });
});

function makeTemp(): string {
  const base = path.join(process.cwd(), ".tmp");
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, "agd-roots-"));
}
