import * as vscode from "vscode";
import type { DiffGroupInfo, DiffTabInfo } from "./nativeDiffGuard";

export function currentDiffGroups(): DiffGroupInfo[] {
  return vscode.window.tabGroups.all.map((group) => ({
    viewColumn: group.viewColumn,
    tabs: group.tabs.map(describeTab),
  }));
}

function describeTab(tab: vscode.Tab): DiffTabInfo {
  const info: DiffTabInfo = { isActive: tab.isActive };
  const input = tab.input as unknown;
  const multi = asMultiDiff(input);
  if (multi) {
    info.multiDiff = multi;
    return info;
  }
  const pair = asUriPair(input);
  if (pair) {
    info.original = pair.original;
    info.modified = pair.modified;
  }
  return info;
}

function asUriPair(
  input: unknown
): { original: string; modified: string } | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const rec = input as {
    original?: { toString(): string };
    modified?: { toString(): string };
  };
  if (!rec.original || !rec.modified) {
    return undefined;
  }
  return {
    original: rec.original.toString(),
    modified: rec.modified.toString(),
  };
}

function asMultiDiff(
  input: unknown
): Array<{ original: string; modified: string }> | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const rec = input as {
    textDiffs?: Array<{
      original?: { toString(): string };
      modified?: { toString(): string };
    }>;
  };
  if (!Array.isArray(rec.textDiffs)) {
    return undefined;
  }
  const pairs = rec.textDiffs
    .map((entry) => {
      if (!entry?.original || !entry?.modified) {
        return undefined;
      }
      return {
        original: entry.original.toString(),
        modified: entry.modified.toString(),
      };
    })
    .filter(
      (entry): entry is { original: string; modified: string } =>
        entry !== undefined
    );
  return pairs.length > 0 ? pairs : undefined;
}
