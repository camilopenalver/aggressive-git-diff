export interface LineRange {
  /** Inclusive 0-based start line in the working-tree document. */
  startLine: number;
  /** Inclusive 0-based end line in the working-tree document. */
  endLine: number;
}

export interface DeletedBlock {
  /**
   * 0-based line in the current document used as the visual anchor.
   * Deleted lines no longer exist, so we attach the indicator here.
   */
  adjacentLine: number;
  /** Place the indicator before or after the anchor line. */
  position: "before" | "after";
  deletedCount: number;
  deletedLines: string[];
}

export interface FileDiff {
  added: number[];
  modified: number[];
  deleted: DeletedBlock[];
}

export type FileKind =
  | "untracked"
  | "added"
  | "modified"
  | "deleted"
  | "unmodified"
  | "binary"
  | "outside-git"
  | "missing";

export interface FileDiffResult {
  kind: FileKind;
  diff: FileDiff;
  gitRoot?: string;
  relativePath?: string;
}
