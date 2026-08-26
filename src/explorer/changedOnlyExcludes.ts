import * as path from "path";

export function buildChangedOnlyExcludes(args: {
  workspaceRoot: string;
  changedFiles: Iterable<string>;
  listChildren: (absoluteDir: string) => string[];
}): Record<string, boolean> {
  const workspaceRoot = path.normalize(args.workspaceRoot);
  const visible = new Set<string>([workspaceRoot]);
  const foldersToList = new Set<string>([workspaceRoot]);

  for (const file of args.changedFiles) {
    const normalized = path.normalize(file);
    if (isWorkspaceSettingsFile(workspaceRoot, normalized)) {
      continue;
    }
    if (!isInside(workspaceRoot, normalized)) {
      continue;
    }
    visible.add(normalized);
    for (const ancestor of ancestorsUpTo(workspaceRoot, normalized)) {
      visible.add(ancestor);
      foldersToList.add(ancestor);
    }
  }

  const excludes: Record<string, boolean> = {};
  for (const dir of foldersToList) {
    let children: string[] = [];
    try {
      children = args.listChildren(dir);
    } catch {
      children = [];
    }
    for (const child of children) {
      const normalizedChild = path.normalize(child);
      if (visible.has(normalizedChild)) {
        continue;
      }
      const key = toExcludeKey(workspaceRoot, normalizedChild);
      if (key) {
        excludes[key] = true;
      }
    }
  }
  return excludes;
}

export function restoreInjectedExcludes(
  current: Record<string, boolean> | undefined,
  injectedKeys: string[],
  original: Record<string, boolean> | undefined
): Record<string, boolean> | undefined {
  const next: Record<string, boolean> = { ...(current ?? {}) };
  for (const key of injectedKeys) {
    delete next[key];
    if (original && Object.prototype.hasOwnProperty.call(original, key)) {
      next[key] = original[key];
    }
  }
  return Object.keys(next).length === 0 ? undefined : next;
}

function ancestorsUpTo(root: string, filePath: string): string[] {
  const dirs: string[] = [];
  let current = path.dirname(filePath);
  while (current !== root && isInside(root, current)) {
    const parent = path.dirname(current);
    dirs.push(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return dirs;
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isWorkspaceSettingsFile(workspaceRoot: string, filePath: string): boolean {
  return toExcludeKey(workspaceRoot, filePath) === ".vscode/settings.json";
}

function toExcludeKey(workspaceRoot: string, absPath: string): string | undefined {
  const relative = path.relative(workspaceRoot, absPath);
  if (!relative || relative === ".") {
    return undefined;
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }
  return relative.split(path.sep).join("/");
}
