import * as vscode from "vscode";
import { DecorationManager } from "./decorations/decorationManager";
import { GitNotFoundError } from "./git/gitCommand";
import { GitDiffProvider } from "./git/gitDiffProvider";
import { WorkspaceWatcher } from "./watchers/workspaceWatcher";

const CONFIG_SECTION = "aggressiveGitDiff";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new GitDiffProvider();
  const decorations = new DecorationManager();
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    10
  );
  statusBar.command = "aggressiveGitDiff.toggle";
  statusBar.show();

  let gitAvailable = true;
  let gitWarningShown = false;

  const applyConfig = (): ReturnType<typeof readConfig> => {
    const config = readConfig();
    decorations.recreate(config);
    watcher?.setDebounceMs(config.debounceMs);
    updateStatusBar(statusBar, config.enabled, gitAvailable);
    return config;
  };

  const refreshEditor = async (editor: vscode.TextEditor | undefined): Promise<void> => {
    if (!editor) {
      return;
    }
    const config = readConfig();
    if (!config.enabled || !gitAvailable) {
      decorations.clear(editor);
      return;
    }
    if (editor.document.uri.scheme !== "file") {
      decorations.clear(editor);
      return;
    }

    try {
      const filePath = editor.document.uri.fsPath;
      const result = await provider.getFileDiff({
        filePath,
        lineCount: editor.document.lineCount,
        fileSizeBytes: Buffer.byteLength(editor.document.getText(), "utf8"),
        maxFileSizeBytes: config.maxFileSizeKb * 1024,
        documentText: editor.document.getText(),
        documentVersion: editor.document.version,
      });
      decorations.apply(editor, result, config);
    } catch (error) {
      if (error instanceof GitNotFoundError) {
        gitAvailable = false;
        decorations.clearAll();
        updateStatusBar(statusBar, config.enabled, false);
        if (!gitWarningShown) {
          gitWarningShown = true;
          void vscode.window.showWarningMessage(
            "Aggressive Git Diff: Git was not found on PATH. Highlighting is paused."
          );
        }
        return;
      }
      decorations.clear(editor);
    }
  };

  const refreshVisible = async (): Promise<void> => {
    provider.invalidate();
    await Promise.all(
      vscode.window.visibleTextEditors.map((editor) => refreshEditor(editor))
    );
  };

  const refreshUri = async (uri: vscode.Uri): Promise<void> => {
    provider.invalidate(uri.fsPath);
    const editors = vscode.window.visibleTextEditors.filter(
      (editor) => editor.document.uri.toString() === uri.toString()
    );
    if (editors.length === 0) {
      return;
    }
    await Promise.all(editors.map((editor) => refreshEditor(editor)));
  };

  let watcher: WorkspaceWatcher | undefined;
  applyConfig();
  watcher = new WorkspaceWatcher(
    (uri) => {
      void refreshUri(uri);
    },
    () => {
      void refreshVisible();
    },
    readConfig().debounceMs
  );
  watcher.start();

  context.subscriptions.push(
    decorations,
    statusBar,
    watcher,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration(CONFIG_SECTION)) {
        return;
      }
      applyConfig();
      void refreshVisible();
    }),
    vscode.commands.registerCommand("aggressiveGitDiff.enable", async () => {
      await setEnabled(true);
    }),
    vscode.commands.registerCommand("aggressiveGitDiff.disable", async () => {
      await setEnabled(false);
      decorations.clearAll();
    }),
    vscode.commands.registerCommand("aggressiveGitDiff.toggle", async () => {
      const enabled = readConfig().enabled;
      await setEnabled(!enabled);
      if (enabled) {
        decorations.clearAll();
      } else {
        void refreshVisible();
      }
    }),
    vscode.commands.registerCommand("aggressiveGitDiff.refresh", () => {
      void refreshVisible();
    })
  );

  void refreshVisible();
}

export function deactivate(): void {
  // Disposables registered on the extension context are cleaned up by VS Code.
}

function readConfig() {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    enabled: config.get<boolean>("enabled", true),
    addedBackground: config.get<string>("addedBackground", "rgba(40, 200, 90, 0.28)"),
    modifiedBackground: config.get<string>(
      "modifiedBackground",
      "rgba(40, 200, 90, 0.22)"
    ),
    deletedBackground: config.get<string>(
      "deletedBackground",
      "rgba(255, 70, 70, 0.32)"
    ),
    opacity: config.get<number>("opacity", 0.25),
    showDeletedIndicators: config.get<boolean>("showDeletedIndicators", true),
    showDeletedContent: config.get<boolean>("showDeletedContent", true),
    highlightWholeLine: config.get<boolean>("highlightWholeLine", true),
    debounceMs: config.get<number>("debounceMs", 200),
    maxFileSizeKb: config.get<number>("maxFileSizeKb", 1024),
  };
}

async function setEnabled(enabled: boolean): Promise<void> {
  await vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .update("enabled", enabled, vscode.ConfigurationTarget.Global);
}

function updateStatusBar(
  statusBar: vscode.StatusBarItem,
  enabled: boolean,
  gitAvailable: boolean
): void {
  if (!gitAvailable) {
    statusBar.text = "$(warning) Git Diff";
    statusBar.tooltip =
      "Aggressive Git Diff paused because Git was not found on PATH.";
    return;
  }
  statusBar.text = enabled ? "$(diff) HEAD" : "$(diff) HEAD off";
  statusBar.tooltip = enabled
    ? "Aggressive Git Diff is highlighting working tree vs HEAD. Click to disable."
    : "Aggressive Git Diff is disabled. Click to enable.";
}
