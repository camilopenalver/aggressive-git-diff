import * as vscode from "vscode";
import { findGitRoot } from "../git/gitCommand";

export class WorkspaceWatcher implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly gitWatchers = new Map<string, vscode.Disposable[]>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private debounceMs: number;

  constructor(
    private readonly onFileChange: (uri: vscode.Uri) => void,
    private readonly onGitRefsChange: () => void,
    debounceMs: number
  ) {
    this.debounceMs = debounceMs;
  }

  setDebounceMs(value: number): void {
    this.debounceMs = value;
  }

  start(): void {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.schedule(`editor:${editor.document.uri.toString()}`, () => {
            this.onFileChange(editor.document.uri);
            void this.watchGitRootFor(editor.document.uri);
          });
        }
      }),
      vscode.workspace.onDidSaveTextDocument((document) => {
        this.schedule(`save:${document.uri.toString()}`, () => {
          this.onFileChange(document.uri);
        });
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length === 0) {
          return;
        }
        this.schedule(`doc:${event.document.uri.toString()}`, () => {
          this.onFileChange(event.document.uri);
        });
      }),
      vscode.workspace.onDidCreateFiles((event) => {
        for (const uri of event.files) {
          this.schedule(`create:${uri.toString()}`, () => this.onFileChange(uri));
        }
      }),
      vscode.workspace.onDidDeleteFiles((event) => {
        for (const uri of event.files) {
          this.schedule(`delete:${uri.toString()}`, () => this.onFileChange(uri));
        }
      }),
      vscode.workspace.onDidRenameFiles((event) => {
        for (const file of event.files) {
          this.schedule(`rename:${file.newUri.toString()}`, () => {
            this.onFileChange(file.newUri);
          });
        }
      }),
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) {
          this.schedule("focus", () => this.onGitRefsChange());
        }
      })
    );

    const fsWatcher = vscode.workspace.createFileSystemWatcher("**/*");
    this.disposables.push(
      fsWatcher,
      fsWatcher.onDidChange((uri) => this.onFsEvent(uri)),
      fsWatcher.onDidCreate((uri) => this.onFsEvent(uri)),
      fsWatcher.onDidDelete((uri) => this.onFsEvent(uri))
    );

    for (const editor of vscode.window.visibleTextEditors) {
      void this.watchGitRootFor(editor.document.uri);
    }
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    for (const watchers of this.gitWatchers.values()) {
      for (const watcher of watchers) {
        watcher.dispose();
      }
    }
    this.gitWatchers.clear();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }

  private onFsEvent(uri: vscode.Uri): void {
    const fsPath = uri.fsPath.replace(/\\/g, "/");
    if (fsPath.includes("/.git/")) {
      if (
        fsPath.endsWith("/.git/HEAD") ||
        fsPath.endsWith("/.git/index") ||
        fsPath.includes("/.git/refs/")
      ) {
        this.schedule("git-refs", () => this.onGitRefsChange());
      }
      return;
    }

    const open = vscode.workspace.textDocuments.some(
      (document) => document.uri.toString() === uri.toString()
    );
    const visible = vscode.window.visibleTextEditors.some(
      (editor) => editor.document.uri.toString() === uri.toString()
    );
    if (open || visible) {
      this.schedule(`fs:${uri.toString()}`, () => this.onFileChange(uri));
    }
  }

  private async watchGitRootFor(uri: vscode.Uri): Promise<void> {
    if (uri.scheme !== "file") {
      return;
    }
    const gitRoot = await findGitRoot(uri.fsPath);
    if (!gitRoot || this.gitWatchers.has(gitRoot)) {
      return;
    }

    const patterns = [".git/HEAD", ".git/index", ".git/refs/heads/**", ".git/refs/tags/**"];
    const watchers: vscode.Disposable[] = [];
    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(gitRoot, pattern)
      );
      watchers.push(
        watcher,
        watcher.onDidChange(() => this.schedule("git-refs", () => this.onGitRefsChange())),
        watcher.onDidCreate(() => this.schedule("git-refs", () => this.onGitRefsChange())),
        watcher.onDidDelete(() => this.schedule("git-refs", () => this.onGitRefsChange()))
      );
    }
    this.gitWatchers.set(gitRoot, watchers);
  }

  private schedule(key: string, action: () => void): void {
    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.timers.delete(key);
      action();
    }, this.debounceMs);
    this.timers.set(key, timer);
  }
}
