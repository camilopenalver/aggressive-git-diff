import * as path from "path";
import { runGit } from "./gitCommand";
import { discoverGitRoots } from "./gitRoots";
import {
  ancestorDirectories,
  parsePorcelainStatus,
  type ExplorerChangeKind,
} from "./statusParser";

export class GitStatusIndex {
  private files = new Map<string, ExplorerChangeKind>();
  private folders = new Set<string>();

  getKind(fsPath: string): ExplorerChangeKind | "folder" | undefined {
    const normalized = normalizePath(fsPath);
    const kind = this.files.get(normalized);
    if (kind) {
      return kind;
    }
    if (this.folders.has(normalized)) {
      return "folder";
    }
    return undefined;
  }

  changedFilePaths(): string[] {
    return Array.from(this.files.keys());
  }

  clear(): void {
    this.files.clear();
    this.folders.clear();
  }

  async refreshFromWorkspaceFolders(folderPaths: string[]): Promise<void> {
    const roots = new Set<string>();
    for (const folderPath of folderPaths) {
      for (const gitRoot of discoverGitRoots(folderPath)) {
        roots.add(gitRoot);
      }
    }
    await this.refresh(Array.from(roots));
  }

  async refresh(gitRoots: string[]): Promise<void> {
    const files = new Map<string, ExplorerChangeKind>();
    const folders = new Set<string>();

    for (const gitRoot of gitRoots) {
      const result = await runGit(
        ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
        gitRoot,
        15000
      );
      if (result.code !== 0) {
        continue;
      }

      for (const entry of parsePorcelainStatus(result.stdout)) {
        const absPath = normalizePath(path.join(gitRoot, entry.relativePath));
        files.set(absPath, entry.kind);
        for (const directory of ancestorDirectories(gitRoot, entry.relativePath)) {
          folders.add(normalizePath(directory));
        }
      }
    }

    this.files = files;
    this.folders = folders;
  }
}

function normalizePath(fsPath: string): string {
  return path.normalize(fsPath);
}
