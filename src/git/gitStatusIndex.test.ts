import * as fs from "fs";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { runGit } from "./gitCommand";
import { GitStatusIndex } from "./gitStatusIndex";

describe("GitStatusIndex", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks modified, untracked and parent folders versus HEAD", async () => {
    const repo = await createRepo();
    dirs.push(repo);

    fs.mkdirSync(path.join(repo, "backend", "routes"), { recursive: true });
    const models = path.join(repo, "backend", "routes", "models.py");
    fs.writeFileSync(models, "x = 1\n");
    await git(repo, ["add", "backend/routes/models.py"]);
    await git(repo, ["commit", "-m", "initial"]);
    fs.writeFileSync(models, "x = 2\n");
    fs.writeFileSync(path.join(repo, "backend", "new_service.py"), "print(1)\n");

    const index = new GitStatusIndex();
    await index.refresh([repo]);

    expect(index.getKind(models)).toBe("modified");
    expect(index.getKind(path.join(repo, "backend", "new_service.py"))).toBe(
      "untracked"
    );
    expect(index.getKind(path.join(repo, "backend"))).toBe("folder");
    expect(index.getKind(path.join(repo, "backend", "routes"))).toBe("folder");
    expect(index.getKind(path.join(repo, "README.md"))).toBeUndefined();
  });

  async function createRepo(): Promise<string> {
    const base = path.join(process.cwd(), ".tmp");
    fs.mkdirSync(base, { recursive: true });
    const dir = fs.mkdtempSync(path.join(base, "agd-status-"));
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
