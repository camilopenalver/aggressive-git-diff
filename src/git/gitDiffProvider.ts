import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { FileDiffResult } from "../types";
import { allLinesAdded, emptyDiff, parseUnifiedDiff } from "./diffParser";
import {
  findGitRoot,
  getHeadSha,
  isBinaryDiff,
  pathExistsInHead,
  runGit,
  showHeadFile,
  toGitRelativePath,
} from "./gitCommand";

export class GitDiffProvider {
  private cache = new Map<string, { signature: string; result: FileDiffResult }>();

  invalidate(filePath?: string): void {
    if (!filePath) {
      this.cache.clear();
      return;
    }
    this.cache.delete(filePath);
  }

  async getFileDiff(args: {
    filePath: string;
    lineCount: number;
    fileSizeBytes: number;
    maxFileSizeBytes: number;
    documentText: string;
    documentVersion: number;
  }): Promise<FileDiffResult> {
    if (args.fileSizeBytes > args.maxFileSizeBytes) {
      return { kind: "unmodified", diff: emptyDiff() };
    }

    if (args.documentText.includes("\0")) {
      return { kind: "binary", diff: emptyDiff() };
    }

    const gitRoot = await findGitRoot(args.filePath);
    if (!gitRoot) {
      return { kind: "outside-git", diff: emptyDiff() };
    }

    const relativePath = toGitRelativePath(gitRoot, args.filePath);
    if (!relativePath || relativePath.startsWith("..")) {
      return { kind: "outside-git", diff: emptyDiff(), gitRoot };
    }

    const headSha = await getHeadSha(gitRoot);
    const signature = `${headSha}:${args.documentVersion}:${args.lineCount}:${args.fileSizeBytes}`;
    const cached = this.cache.get(args.filePath);
    if (cached && cached.signature === signature) {
      return cached.result;
    }

    const result = await this.compute({
      gitRoot,
      relativePath,
      headSha,
      lineCount: args.lineCount,
      documentText: args.documentText,
    });
    this.cache.set(args.filePath, { signature, result });
    return result;
  }

  private async compute(args: {
    gitRoot: string;
    relativePath: string;
    headSha: string | undefined;
    lineCount: number;
    documentText: string;
  }): Promise<FileDiffResult> {
    if (!args.headSha) {
      return {
        kind: "untracked",
        diff: allLinesAdded(args.lineCount),
        gitRoot: args.gitRoot,
        relativePath: args.relativePath,
      };
    }

    const inHead = await pathExistsInHead(args.gitRoot, args.relativePath);
    if (!inHead) {
      return {
        kind: "untracked",
        diff: allLinesAdded(args.lineCount),
        gitRoot: args.gitRoot,
        relativePath: args.relativePath,
      };
    }

    const headContent = await showHeadFile(args.gitRoot, args.relativePath);
    if (headContent === undefined || headContent.includes("\0")) {
      return {
        kind: "binary",
        diff: emptyDiff(),
        gitRoot: args.gitRoot,
        relativePath: args.relativePath,
      };
    }

    const rawDiff = await diffStrings(headContent, args.documentText);
    if (isBinaryDiff(rawDiff)) {
      return {
        kind: "binary",
        diff: emptyDiff(),
        gitRoot: args.gitRoot,
        relativePath: args.relativePath,
      };
    }

    const diff = parseUnifiedDiff(rawDiff);
    const hasChanges =
      diff.added.length > 0 ||
      diff.modified.length > 0 ||
      diff.deleted.length > 0;

    return {
      kind: hasChanges ? "modified" : "unmodified",
      diff,
      gitRoot: args.gitRoot,
      relativePath: args.relativePath,
    };
  }
}

async function diffStrings(before: string, after: string): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aggressive-git-diff-"));
  const beforePath = path.join(dir, "before");
  const afterPath = path.join(dir, "after");
  try {
    fs.writeFileSync(beforePath, before, "utf8");
    fs.writeFileSync(afterPath, after, "utf8");
    const result = await runGit(
      ["diff", "--unified=0", "--no-color", "--no-ext-diff", "--no-index", "--", beforePath, afterPath],
      dir
    );
    return result.stdout;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
