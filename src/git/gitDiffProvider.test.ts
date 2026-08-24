import * as fs from "fs";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { runGit, toGitRelativePath } from "./gitCommand";
import { GitDiffProvider } from "./gitDiffProvider";

describe("toGitRelativePath", () => {
  it("returns a posix path relative to the git root", () => {
    const root = "/repo";
    const file = path.join(root, "src", "models.py");
    expect(toGitRelativePath(root, file)).toBe("src/models.py");
  });
});

describe("GitDiffProvider vs HEAD", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("highlights existing uncommitted edits immediately against HEAD", async () => {
    const repo = await createRepo();
    dirs.push(repo);

    const filePath = path.join(repo, "models.py");
    fs.writeFileSync(
      filePath,
      ['name = "Camilo"', "age = 24", 'country = "Colombia"', ""].join("\n")
    );
    await git(repo, ["add", "models.py"]);
    await git(repo, ["commit", "-m", "initial"]);

    const working = [
      'name = "Camilo Peñalver"',
      "age = 25",
      'country = "Colombia"',
      'company = "Gurwi"',
      "",
    ].join("\n");
    fs.writeFileSync(filePath, working);

    const provider = new GitDiffProvider();
    const result = await provider.getFileDiff({
      filePath,
      lineCount: working.split("\n").length,
      fileSizeBytes: Buffer.byteLength(working),
      maxFileSizeBytes: 1024 * 1024,
      documentText: working,
      documentVersion: 1,
    });

    expect(result.kind).toBe("modified");
    expect(result.diff.modified).toEqual([0, 1]);
    expect(result.diff.added).toEqual([3]);
    expect(result.diff.deleted).toEqual([]);
  });

  it("treats an untracked file as entirely added", async () => {
    const repo = await createRepo();
    dirs.push(repo);
    await git(repo, ["commit", "--allow-empty", "-m", "root"]);

    const filePath = path.join(repo, "new_service.py");
    const working = "print('hello')\n";
    fs.writeFileSync(filePath, working);

    const provider = new GitDiffProvider();
    const result = await provider.getFileDiff({
      filePath,
      lineCount: 1,
      fileSizeBytes: Buffer.byteLength(working),
      maxFileSizeBytes: 1024 * 1024,
      documentText: working,
      documentVersion: 1,
    });

    expect(result.kind).toBe("untracked");
    expect(result.diff.added).toEqual([0]);
  });

  it("clears the diff when HEAD matches the working tree after a commit", async () => {
    const repo = await createRepo();
    dirs.push(repo);
    const filePath = path.join(repo, "app.py");
    fs.writeFileSync(filePath, "x = 1\n");
    await git(repo, ["add", "app.py"]);
    await git(repo, ["commit", "-m", "one"]);
    fs.writeFileSync(filePath, "x = 2\n");

    const provider = new GitDiffProvider();
    const dirty = await provider.getFileDiff({
      filePath,
      lineCount: 1,
      fileSizeBytes: 10,
      maxFileSizeBytes: 1024 * 1024,
      documentText: "x = 2\n",
      documentVersion: 1,
    });
    expect(dirty.diff.modified).toEqual([0]);

    await git(repo, ["add", "app.py"]);
    await git(repo, ["commit", "-m", "two"]);
    provider.invalidate(filePath);

    const clean = await provider.getFileDiff({
      filePath,
      lineCount: 1,
      fileSizeBytes: 10,
      maxFileSizeBytes: 1024 * 1024,
      documentText: "x = 2\n",
      documentVersion: 2,
    });
    expect(clean.kind).toBe("unmodified");
    expect(clean.diff.added).toEqual([]);
    expect(clean.diff.modified).toEqual([]);
  });

  it("handles paths with spaces", async () => {
    const repo = await createRepo();
    dirs.push(repo);
    const filePath = path.join(repo, "my file.py");
    fs.writeFileSync(filePath, "a = 1\n");
    await git(repo, ["add", "my file.py"]);
    await git(repo, ["commit", "-m", "space"]);
    const working = "a = 2\n";
    fs.writeFileSync(filePath, working);

    const provider = new GitDiffProvider();
    const result = await provider.getFileDiff({
      filePath,
      lineCount: 1,
      fileSizeBytes: Buffer.byteLength(working),
      maxFileSizeBytes: 1024 * 1024,
      documentText: working,
      documentVersion: 1,
    });
    expect(result.diff.modified).toEqual([0]);
  });

  async function createRepo(): Promise<string> {
    const base = path.join(process.cwd(), ".tmp");
    fs.mkdirSync(base, { recursive: true });
    const dir = fs.mkdtempSync(path.join(base, "agd-repo-"));
    await git(dir, ["init"]);
    await git(dir, ["config", "user.email", "test@example.com"]);
    await git(dir, ["config", "user.name", "Test"]);
    await git(dir, ["config", "commit.gpgsign", "false"]);
    return dir;
  }

  async function git(cwd: string, args: string[]): Promise<void> {
    const result = await runGit(args, cwd);
    if (result.code !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
    }
  }
});
