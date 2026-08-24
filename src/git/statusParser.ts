import * as path from "path";
import type { FileKind } from "../types";

export type ExplorerChangeKind =
  | Extract<FileKind, "modified" | "added" | "untracked" | "deleted">
  | "renamed";

export interface StatusEntry {
  relativePath: string;
  kind: ExplorerChangeKind;
}

export function parsePorcelainStatus(output: string): StatusEntry[] {
  if (!output) {
    return [];
  }

  if (output.includes("\0")) {
    return parseNulSeparated(output);
  }

  return output
    .split(/\r?\n/)
    .map((line) => parseLine(line))
    .filter((entry): entry is StatusEntry => entry !== undefined);
}

export function ancestorDirectories(gitRoot: string, relativePath: string): string[] {
  const parts = relativePath.split("/").filter((part) => part.length > 0);
  parts.pop();
  const dirs: string[] = [];
  let current = gitRoot;
  for (const part of parts) {
    current = path.join(current, part);
    dirs.push(current);
  }
  return dirs;
}

function parseNulSeparated(output: string): StatusEntry[] {
  const tokens = output.split("\0").filter((token) => token.length > 0);
  const entries: StatusEntry[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const parsed = parseLine(tokens[i]);
    if (!parsed) {
      continue;
    }
    if (parsed.kind === "renamed") {
      i += 1;
    }
    entries.push(parsed);
  }

  return entries;
}

function parseLine(line: string): StatusEntry | undefined {
  if (line.length < 3) {
    return undefined;
  }

  const xy = line.slice(0, 2);
  if (!isStatusCode(xy) || xy === "!!") {
    return undefined;
  }

  let rest = line.slice(3);
  if (xy.includes("R") || xy.includes("C")) {
    const arrow = rest.indexOf(" -> ");
    if (arrow >= 0) {
      rest = rest.slice(arrow + 4);
    }
    return { relativePath: unquotePath(rest), kind: "renamed" };
  }

  return { relativePath: unquotePath(rest), kind: kindFromStatus(xy) };
}

function isStatusCode(xy: string): boolean {
  return /^[ MADRCU?!]{2}$/.test(xy);
}

function kindFromStatus(xy: string): ExplorerChangeKind {
  if (xy === "??") {
    return "untracked";
  }
  if (xy.includes("A")) {
    return "added";
  }
  if (xy.includes("D")) {
    return "deleted";
  }
  return "modified";
}

function unquotePath(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return trimmed;
}
