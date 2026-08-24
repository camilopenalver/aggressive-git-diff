import * as vscode from "vscode";
import { formatDeletedLabel, formatDeletedLines, withOpacity } from "./colors";
import type { FileDiffResult } from "../types";

interface DecorationSet {
  added: vscode.TextEditorDecorationType;
  modified: vscode.TextEditorDecorationType;
  deleted: vscode.TextEditorDecorationType;
}

export class DecorationManager {
  private decorations: DecorationSet | undefined;
  private decoratedEditors = new Set<vscode.TextEditor>();
  private deletedLineBackground = "rgba(255, 70, 70, 0.38)";

  recreate(config: {
    addedBackground: string;
    modifiedBackground: string;
    deletedBackground: string;
    opacity: number;
    highlightWholeLine: boolean;
  }): void {
    this.disposeTypes();
    const addedBg = withOpacity(config.addedBackground, config.opacity);
    const modifiedBg = withOpacity(config.modifiedBackground, Math.min(1, config.opacity + 0.04));
    const deletedBg = withOpacity(config.deletedBackground, Math.min(1, config.opacity + 0.1));
    this.deletedLineBackground = deletedBg;

    this.decorations = {
      added: vscode.window.createTextEditorDecorationType({
        isWholeLine: config.highlightWholeLine,
        backgroundColor: addedBg,
        overviewRulerColor: "rgba(40, 200, 90, 0.95)",
        overviewRulerLane: vscode.OverviewRulerLane.Full,
        borderColor: "rgba(40, 200, 90, 0.95)",
        borderWidth: "0 0 0 6px",
        borderStyle: "solid",
      }),
      modified: vscode.window.createTextEditorDecorationType({
        isWholeLine: config.highlightWholeLine,
        backgroundColor: modifiedBg,
        overviewRulerColor: "rgba(40, 200, 90, 0.75)",
        overviewRulerLane: vscode.OverviewRulerLane.Full,
        borderColor: "rgba(230, 180, 40, 0.95)",
        borderWidth: "0 0 0 6px",
        borderStyle: "solid",
      }),
      deleted: vscode.window.createTextEditorDecorationType({
        isWholeLine: false,
        overviewRulerColor: "rgba(255, 70, 70, 0.95)",
        overviewRulerLane: vscode.OverviewRulerLane.Full,
      }),
    };
  }

  apply(
    editor: vscode.TextEditor,
    result: FileDiffResult,
    options: { showDeletedIndicators: boolean; showDeletedContent: boolean }
  ): void {
    if (!this.decorations) {
      return;
    }

    const lineCount = editor.document.lineCount;
    const added = toLineRanges(result.diff.added, lineCount);
    const modified = toLineRanges(
      result.diff.modified.filter((line) => !result.diff.added.includes(line)),
      lineCount
    );
    const deleted = options.showDeletedIndicators
      ? result.diff.deleted.flatMap((block) => {
          const line = clampLine(block.adjacentLine, lineCount);
          const slot = block.position === "before" ? "before" : "after";
          const texts = options.showDeletedContent
            ? formatDeletedLines(
                block.deletedLines.length > 0
                  ? block.deletedLines
                  : Array.from({ length: Math.max(block.deletedCount, 1) }, () => "")
              )
            : [formatDeletedLabel(block.deletedCount)];
          return texts.map((contentText) => ({
            range: new vscode.Range(line, 0, line, 0),
            renderOptions: {
              [slot]: {
                contentText,
                color: "#ffc9c9",
                backgroundColor: this.deletedLineBackground,
                fontWeight: "normal",
                textDecoration:
                  "line-through; display: block; width: 100%; white-space: pre; padding: 0 8px; box-sizing: border-box; border-left: 6px solid rgba(255, 70, 70, 0.95);",
              },
            },
          })) satisfies vscode.DecorationOptions[];
        })
      : [];

    editor.setDecorations(this.decorations.added, added);
    editor.setDecorations(this.decorations.modified, modified);
    editor.setDecorations(this.decorations.deleted, deleted);
    this.decoratedEditors.add(editor);
  }

  clear(editor: vscode.TextEditor): void {
    if (!this.decorations) {
      return;
    }
    editor.setDecorations(this.decorations.added, []);
    editor.setDecorations(this.decorations.modified, []);
    editor.setDecorations(this.decorations.deleted, []);
    this.decoratedEditors.delete(editor);
  }

  clearAll(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.clear(editor);
    }
    this.decoratedEditors.clear();
  }

  dispose(): void {
    this.clearAll();
    this.disposeTypes();
  }

  private disposeTypes(): void {
    if (!this.decorations) {
      return;
    }
    this.decorations.added.dispose();
    this.decorations.modified.dispose();
    this.decorations.deleted.dispose();
    this.decorations = undefined;
  }
}

function toLineRanges(lines: number[], lineCount: number): vscode.Range[] {
  return lines
    .filter((line) => line >= 0 && line < lineCount)
    .map((line) => new vscode.Range(line, 0, line, 0));
}

function clampLine(line: number, lineCount: number): number {
  if (lineCount <= 0) {
    return 0;
  }
  return Math.min(Math.max(line, 0), lineCount - 1);
}
