import { spawn } from "child_process";
import * as path from "path";
import { startDirFor } from "./gitRoots";

export class GitNotFoundError extends Error {
  constructor() {
    super("Git executable was not found on PATH");
    this.name = "GitNotFoundError";
  }
}

export interface GitResult {
  stdout: string;
  stderr: string;
  code: number;
}

export async function runGit(
  args: string[],
  cwd: string,
  timeoutMs = 10000
): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn("git", ["-c", "core.quotepath=false", "-c", "core.pager=", ...args], {
      cwd,
      windowsHide: true,
      env: {
        ...process.env,
        GIT_OPTIONAL_LOCKS: "0",
        GIT_PAGER: "cat",
        GIT_TERMINAL_PROMPT: "0",
      },
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`git ${args.join(" ")} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        finish(new GitNotFoundError());
        return;
      }
      finish(error);
    });
    child.on("close", (code) => {
      finish(undefined, {
        stdout,
        stderr,
        code: code ?? 1,
      });
    });

    function finish(error?: Error, result?: GitResult): void {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (error) {
        reject(error);
        return;
      }
      resolve(result as GitResult);
    }
  });
}

export function toGitRelativePath(gitRoot: string, filePath: string): string {
  return path.relative(gitRoot, filePath).split(path.sep).join("/");
}

const gitRootCache = new Map<string, { root: string | undefined; at: number }>();
const GIT_ROOT_TTL_MS = 30_000;

export function clearGitRootCache(): void {
  gitRootCache.clear();
}

export async function findGitRoot(filePath: string): Promise<string | undefined> {
  const startDir = startDirFor(filePath);
  const cached = gitRootCache.get(startDir);
  if (cached && Date.now() - cached.at < GIT_ROOT_TTL_MS) {
    return cached.root;
  }

  try {
    const result = await runGit(["rev-parse", "--show-toplevel"], startDir);
    if (result.code !== 0) {
      return undefined;
    }
    const root = result.stdout.trim();
    gitRootCache.set(startDir, { root, at: Date.now() });
    return root || undefined;
  } catch (error) {
    if (error instanceof GitNotFoundError) {
      throw error;
    }
    return undefined;
  }
}

export async function hasHead(gitRoot: string): Promise<boolean> {
  const result = await runGit(["rev-parse", "--verify", "HEAD"], gitRoot);
  return result.code === 0;
}

export async function pathExistsInHead(
  gitRoot: string,
  relativePath: string
): Promise<boolean> {
  const result = await runGit(
    ["cat-file", "-e", `HEAD:${relativePath}`],
    gitRoot
  );
  return result.code === 0;
}

export async function getHeadSha(gitRoot: string): Promise<string | undefined> {
  const result = await runGit(["rev-parse", "HEAD"], gitRoot);
  if (result.code !== 0) {
    return undefined;
  }
  const sha = result.stdout.trim();
  return sha || undefined;
}

export async function showHeadFile(
  gitRoot: string,
  relativePath: string
): Promise<string | undefined> {
  const result = await runGit(["show", `HEAD:${relativePath}`], gitRoot);
  if (result.code !== 0) {
    return undefined;
  }
  return result.stdout;
}

export function isBinaryDiff(diffText: string): boolean {
  return /Binary files .* differ/i.test(diffText);
}
