export interface DiffTabInfo {
  isActive: boolean;
  original?: string;
  modified?: string;
  multiDiff?: Array<{ original: string; modified: string }>;
}

export interface DiffGroupInfo {
  viewColumn: number | undefined;
  tabs: DiffTabInfo[];
}

export function isEditorShowingNativeDiff(args: {
  documentUri: string;
  viewColumn: number | undefined;
  groups: DiffGroupInfo[];
}): boolean {
  for (const group of args.groups) {
    if (
      args.viewColumn !== undefined &&
      group.viewColumn !== args.viewColumn
    ) {
      continue;
    }
    for (const tab of group.tabs) {
      if (!tab.isActive) {
        continue;
      }
      if (tabContainsUri(tab, args.documentUri)) {
        return true;
      }
    }
  }
  return false;
}

export function shouldHighlightEditor(args: {
  scheme: string;
  documentUri: string;
  viewColumn: number | undefined;
  groups: DiffGroupInfo[];
}): boolean {
  if (args.scheme !== "file") {
    return false;
  }
  return !isEditorShowingNativeDiff(args);
}

function tabContainsUri(tab: DiffTabInfo, documentUri: string): boolean {
  if (tab.original === documentUri || tab.modified === documentUri) {
    return true;
  }
  return (
    tab.multiDiff?.some(
      (entry) => entry.original === documentUri || entry.modified === documentUri
    ) ?? false
  );
}
