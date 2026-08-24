import * as vscode from "vscode";
import type { GitStatusIndex } from "../git/gitStatusIndex";
import type { ExplorerChangeKind } from "../git/statusParser";

const COLOR_IDS: Record<ExplorerChangeKind | "folder", string> = {
  modified: "aggressiveGitDiff.explorerModifiedForeground",
  added: "aggressiveGitDiff.explorerAddedForeground",
  untracked: "aggressiveGitDiff.explorerUntrackedForeground",
  renamed: "aggressiveGitDiff.explorerAddedForeground",
  deleted: "aggressiveGitDiff.explorerDeletedForeground",
  folder: "aggressiveGitDiff.explorerModifiedForeground",
};

const BADGES: Record<ExplorerChangeKind | "folder", string> = {
  modified: "M",
  added: "A",
  untracked: "U",
  renamed: "R",
  deleted: "D",
  folder: "●",
};

const TOOLTIPS: Record<ExplorerChangeKind | "folder", string> = {
  modified: "Modified vs HEAD",
  added: "Added vs HEAD",
  untracked: "Untracked — not in HEAD",
  renamed: "Renamed vs HEAD",
  deleted: "Deleted vs HEAD",
  folder: "Contains uncommitted changes vs HEAD",
};

export class ExplorerDecorationProvider implements vscode.FileDecorationProvider {
  private readonly emitter = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();
  readonly onDidChangeFileDecorations = this.emitter.event;
  private enabled = true;

  constructor(private readonly index: GitStatusIndex) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.notify();
  }

  notify(): void {
    this.emitter.fire(undefined);
  }

  provideFileDecoration(
    uri: vscode.Uri
  ): vscode.ProviderResult<vscode.FileDecoration> {
    if (!this.enabled || uri.scheme !== "file") {
      return undefined;
    }

    const kind = this.index.getKind(uri.fsPath);
    if (!kind) {
      return undefined;
    }

    const decoration = new vscode.FileDecoration(
      BADGES[kind],
      TOOLTIPS[kind],
      new vscode.ThemeColor(COLOR_IDS[kind])
    );
    decoration.propagate = false;
    return decoration;
  }

  dispose(): void {
    this.emitter.dispose();
  }
}
