import * as fs from "fs";
import * as path from "path";

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "build",
  ".venv",
  "venv",
  "__pycache__",
  ".next",
  "target",
  ".tox",
  ".mypy_cache",
  ".pytest_cache",
  "coverage",
  ".idea",
  ".vscode",
  ".turbo",
  "Pods",
]);

export function startDirFor(filePath: string): string {
  try {
    if (fs.statSync(filePath).isDirectory()) {
      return filePath;
    }
  } catch {
    // Missing files still belong to their parent directory.
  }
  return path.dirname(filePath);
}

export function isGitRoot(dir: string): boolean {
  try {
    const gitPath = path.join(dir, ".git");
    const stats = fs.statSync(gitPath);
    return stats.isDirectory() || stats.isFile();
  } catch {
    return false;
  }
}

export function discoverGitRoots(workspaceFolder: string, maxDepth = 3): string[] {
  const roots: string[] = [];
  walk(workspaceFolder, 0, maxDepth, roots);
  return roots;
}

export function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(path.normalize(parent), path.normalize(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function shouldIgnoreFsPath(fsPath: string): boolean {
  const normalized = fsPath.replace(/\\/g, "/");
  return [...SKIP_DIR_NAMES].some(
    (name) =>
      normalized.includes(`/${name}/`) ||
      normalized.endsWith(`/${name}`)
  );
}

function walk(dir: string, depth: number, maxDepth: number, roots: string[]): void {
  if (isGitRoot(dir)) {
    roots.push(dir);
    return;
  }
  if (depth >= maxDepth) {
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (SKIP_DIR_NAMES.has(entry.name)) {
      continue;
    }
    walk(path.join(dir, entry.name), depth + 1, maxDepth, roots);
  }
}
