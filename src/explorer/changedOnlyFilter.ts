import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { GitStatusIndex } from "../git/gitStatusIndex";
import { isPathInside } from "../git/gitRoots";
import {
  buildChangedOnlyExcludes,
  restoreInjectedExcludes,
} from "./changedOnlyExcludes";

const STATE_KEY = "changedOnlyFilter";
const CONTEXT_KEY = "aggressiveGitDiff.changedOnly";

interface FolderFilterState {
  injectedKeys: string[];
  originalExclude: Record<string, boolean> | undefined;
}

interface StoredState {
  enabled: boolean;
  byFolder: Record<string, FolderFilterState>;
}

export class ChangedOnlyFilter implements vscode.Disposable {
  private enabled = false;
  private applying = false;
  private readonly byFolder = new Map<string, FolderFilterState>();
  private readonly lastSignature = new Map<string, string>();

  constructor(private readonly context: vscode.ExtensionContext) {
    const stored = context.workspaceState.get<StoredState>(STATE_KEY);
    this.enabled = stored?.enabled === true;
    for (const [key, value] of Object.entries(stored?.byFolder ?? {})) {
      this.byFolder.set(key, {
        injectedKeys: [...(value.injectedKeys ?? [])],
        originalExclude: cloneExclude(value.originalExclude),
      });
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isApplying(): boolean {
    return this.applying;
  }

  async activateContext(): Promise<void> {
    await vscode.commands.executeCommand("setContext", CONTEXT_KEY, this.enabled);
  }

  async toggle(index: GitStatusIndex): Promise<boolean> {
    return this.setEnabled(!this.enabled, index);
  }

  async setEnabled(enabled: boolean, index: GitStatusIndex): Promise<boolean> {
    this.enabled = enabled;
    await vscode.commands.executeCommand("setContext", CONTEXT_KEY, enabled);
    if (enabled) {
      await this.apply(index);
    } else {
      await this.restore();
    }
    await this.persist();
    return this.enabled;
  }

  async sync(index: GitStatusIndex): Promise<void> {
    if (!this.enabled) {
      return;
    }
    await this.apply(index);
    await this.persist();
  }

  dispose(): void {
    void this.restore();
  }

  private async apply(index: GitStatusIndex): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    this.applying = true;
    try {
      const seen = new Set<string>();
      for (const folder of folders) {
        seen.add(folder.uri.toString());
        await this.applyToFolder(folder, index);
      }
      for (const key of [...this.byFolder.keys()]) {
        if (!seen.has(key)) {
          this.byFolder.delete(key);
          this.lastSignature.delete(key);
        }
      }
    } finally {
      this.applying = false;
    }
  }

  private async applyToFolder(
    folder: vscode.WorkspaceFolder,
    index: GitStatusIndex
  ): Promise<void> {
    const key = folder.uri.toString();
    const config = vscode.workspace.getConfiguration("files", folder.uri);
    const inspect = config.inspect<Record<string, boolean>>("exclude");
    const currentWorkspaceValue =
      inspect?.workspaceFolderValue ?? inspect?.workspaceValue;

    let state = this.byFolder.get(key);
    if (!state) {
      state = {
        injectedKeys: [],
        originalExclude: cloneExclude(currentWorkspaceValue),
      };
      this.byFolder.set(key, state);
    }

    const computed = buildChangedOnlyExcludes({
      workspaceRoot: folder.uri.fsPath,
      changedFiles: index
        .changedFilePaths()
        .filter((filePath) => isPathInside(folder.uri.fsPath, filePath)),
      listChildren,
    });
    const signature = JSON.stringify(computed);
    if (this.lastSignature.get(key) === signature) {
      return;
    }

    const merged = {
      ...(state.originalExclude ?? {}),
      ...computed,
    };
    state.injectedKeys = Object.keys(computed);
    this.lastSignature.set(key, signature);

    await config.update(
      "exclude",
      Object.keys(merged).length > 0 ? merged : undefined,
      excludeTarget()
    );
  }

  private async restore(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    this.applying = true;
    try {
      for (const folder of folders) {
        const key = folder.uri.toString();
        const state = this.byFolder.get(key);
        if (!state) {
          continue;
        }
        const config = vscode.workspace.getConfiguration("files", folder.uri);
        const inspect = config.inspect<Record<string, boolean>>("exclude");
        const current = inspect?.workspaceFolderValue ?? inspect?.workspaceValue;
        const restored = restoreInjectedExcludes(
          current,
          state.injectedKeys,
          state.originalExclude
        );
        await config.update("exclude", restored, excludeTarget());
      }
      this.byFolder.clear();
      this.lastSignature.clear();
    } finally {
      this.applying = false;
    }
  }

  private async persist(): Promise<void> {
    const byFolder: Record<string, FolderFilterState> = {};
    for (const [key, value] of this.byFolder) {
      byFolder[key] = {
        injectedKeys: [...value.injectedKeys],
        originalExclude: cloneExclude(value.originalExclude),
      };
    }
    await this.context.workspaceState.update(STATE_KEY, {
      enabled: this.enabled,
      byFolder,
    } satisfies StoredState);
  }
}

function listChildren(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}

function cloneExclude(
  value: Record<string, boolean> | undefined
): Record<string, boolean> | undefined {
  if (!value) {
    return undefined;
  }
  return { ...value };
}

function excludeTarget(): vscode.ConfigurationTarget {
  return (vscode.workspace.workspaceFolders?.length ?? 0) > 1
    ? vscode.ConfigurationTarget.WorkspaceFolder
    : vscode.ConfigurationTarget.Workspace;
}
