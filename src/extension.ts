import * as vscode from "vscode";
import { DecorationManager } from "./decorations/decorationManager";
import { ExplorerDecorationProvider } from "./explorer/explorerDecorationProvider";
import { GitNotFoundError } from "./git/gitCommand";
import { GitDiffProvider } from "./git/gitDiffProvider";
import { isPathInside } from "./git/gitRoots";
import { GitStatusIndex } from "./git/gitStatusIndex";
import { WorkspaceWatcher } from "./watchers/workspaceWatcher";

const CONFIG_SECTION = "aggressiveGitDiff";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new GitDiffProvider();
  const decorations = new DecorationManager();
  const statusIndex = new GitStatusIndex();
  const explorer = new ExplorerDecorationProvider(statusIndex);
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
    explorer.setEnabled(config.enabled && config.highlightExplorer);
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
        statusIndex.clear();
        explorer.setEnabled(false);
        explorer.notify();
        updateStatusBar(statusBar, config.enabled, false);
        if (!gitWarningShown) {
          gitWarningShown = true;
          void vscode.window.showWarningMessage(
            "Aggressive Git Diff: Git was not found on PATH. Highlighting is paused."
          );
        }
      }
    }
  };

  const refreshExplorer = async (): Promise<void> => {
    const config = readConfig();
    if (!config.enabled || !config.highlightExplorer || !gitAvailable) {
      statusIndex.clear();
      explorer.setEnabled(false);
      explorer.notify();
      return;
    }
    explorer.setEnabled(true);
    const folders =
      vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
    await statusIndex.refreshFromWorkspaceFolders(folders);
    explorer.notify();
  };

  const refreshVisible = async (gitRoot?: string): Promise<void> => {
    if (gitRoot) {
      provider.invalidateUnder(gitRoot);
    } else {
      provider.invalidate();
    }
    const editors = currentEditors().filter((editor) => {
      if (editor.document.uri.scheme !== "file") {
        return false;
      }
      return gitRoot ? isPathInside(gitRoot, editor.document.uri.fsPath) : true;
    });
    await Promise.all([
      ...editors.map((editor) => refreshEditor(editor)),
      refreshExplorer(),
    ]);
  };

  const refreshUri = async (uri: vscode.Uri): Promise<void> => {
    provider.invalidate(uri.fsPath);
    const editors = editorsForUri(uri);
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
    (gitRoot) => {
      void refreshVisible(gitRoot);
    },
    () => {
      void refreshExplorer();
    },
    readConfig().debounceMs
  );
  watcher.start();

  context.subscriptions.push(
    decorations,
    explorer,
    vscode.window.registerFileDecorationProvider(explorer),
    statusBar,
    watcher,
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.uri.scheme === "file") {
        void refreshUri(document.uri);
      }
    }),
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
      statusIndex.clear();
      explorer.setEnabled(false);
      explorer.notify();
    }),
    vscode.commands.registerCommand("aggressiveGitDiff.toggle", async () => {
      const enabled = readConfig().enabled;
      await setEnabled(!enabled);
      if (enabled) {
        decorations.clearAll();
        statusIndex.clear();
        explorer.setEnabled(false);
        explorer.notify();
      } else {
        void refreshVisible();
      }
    }),
    vscode.commands.registerCommand("aggressiveGitDiff.refresh", () => {
      void refreshVisible();
    })
  );

  void refreshVisible();
  const retryFast = setTimeout(() => void refreshVisible(), 400);
  const retrySlow = setTimeout(() => void refreshVisible(), 1600);
  context.subscriptions.push({
    dispose: () => {
      clearTimeout(retryFast);
      clearTimeout(retrySlow);
    },
  });
}

export function deactivate(): void {
  // Disposables registered on the extension context are cleaned up by VS Code.
}

function currentEditors(): vscode.TextEditor[] {
  return uniqueEditors([
    ...vscode.window.visibleTextEditors,
    vscode.window.activeTextEditor,
  ]);
}

function editorsForUri(uri: vscode.Uri): vscode.TextEditor[] {
  const wanted = uri.toString();
  return currentEditors().filter(
    (editor) => editor.document.uri.toString() === wanted
  );
}

function uniqueEditors(
  editors: Array<vscode.TextEditor | undefined>
): vscode.TextEditor[] {
  const seen = new Set<string>();
  const result: vscode.TextEditor[] = [];
  for (const editor of editors) {
    if (!editor) {
      continue;
    }
    const key = `${editor.document.uri.toString()}:${editor.viewColumn ?? "none"}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(editor);
  }
  return result;
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
    highlightExplorer: config.get<boolean>("highlightExplorer", true),
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
