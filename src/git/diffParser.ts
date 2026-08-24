import type { DeletedBlock, FileDiff } from "../types";

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseUnifiedDiff(diffText: string): FileDiff {
  const added: number[] = [];
  const modified: number[] = [];
  const deleted: DeletedBlock[] = [];

  const lines = diffText.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const match = lines[i].match(HUNK_RE);
    if (!match) {
      i += 1;
      continue;
    }

    const oldCount = match[2] === undefined ? 1 : Number(match[2]);
    const newStart = Number(match[3]);
    const newCount = match[4] === undefined ? 1 : Number(match[4]);

    i += 1;
    const deletedLines: string[] = [];
    while (i < lines.length && !HUNK_RE.test(lines[i])) {
      const line = lines[i];
      if (
        line.startsWith("diff --git") ||
        line.startsWith("--- ") ||
        line.startsWith("+++ ") ||
        line.startsWith("index ")
      ) {
        break;
      }
      if (line.startsWith("\\")) {
        i += 1;
        continue;
      }
      if (line.startsWith("-")) {
        deletedLines.push(line.slice(1));
      }
      i += 1;
    }

    if (oldCount === 0 && newCount > 0) {
      pushLineNumbers(added, newStart - 1, newCount);
      continue;
    }

    if (newCount === 0 && oldCount > 0) {
      deleted.push(deletionAnchor(newStart, oldCount, deletedLines));
      continue;
    }

    if (oldCount > 0 && newCount > 0) {
      const changed = Math.min(oldCount, newCount);
      pushLineNumbers(modified, newStart - 1, changed);
      if (newCount > oldCount) {
        pushLineNumbers(added, newStart - 1 + changed, newCount - oldCount);
      }
      if (oldCount > newCount) {
        deleted.push({
          adjacentLine: Math.max(0, newStart - 1 + changed - 1),
          position: "after",
          deletedCount: oldCount - newCount,
          deletedLines: deletedLines.slice(changed),
        });
      }
    }
  }

  const addedSet = new Set(added);
  return {
    added: uniqSort(added),
    modified: uniqSort(modified.filter((line) => !addedSet.has(line))),
    deleted,
  };
}

export function allLinesAdded(lineCount: number): FileDiff {
  const added: number[] = [];
  for (let i = 0; i < lineCount; i += 1) {
    added.push(i);
  }
  return { added, modified: [], deleted: [] };
}

export function emptyDiff(): FileDiff {
  return { added: [], modified: [], deleted: [] };
}

function pushLineNumbers(target: number[], start: number, count: number): void {
  for (let i = 0; i < count; i += 1) {
    target.push(start + i);
  }
}

function deletionAnchor(
  newStart: number,
  oldCount: number,
  deletedLines: string[]
): DeletedBlock {
  if (newStart <= 0) {
    return {
      adjacentLine: 0,
      position: "before",
      deletedCount: oldCount,
      deletedLines,
    };
  }
  return {
    adjacentLine: newStart - 1,
    position: "after",
    deletedCount: oldCount,
    deletedLines,
  };
}

function uniqSort(lines: number[]): number[] {
  return [...new Set(lines)].filter((line) => line >= 0).sort((a, b) => a - b);
}
