import * as vscode from "vscode";
import { PinStore } from "./pinStore";
import { SessionsTreeProvider } from "./treeProvider";

export interface TabSync {
  /** Map the currently active Claude tab to the session we just opened. */
  track(sessionId: string): void;
  /**
   * Sessions shown in a visible Claude editor tab (the active tab of each editor
   * group). Tabs opened through this list are known; others are matched by title.
   */
  visibleSessions(lookup: (tabLabel: string) => string | undefined): string[];
}

/** True only when a tab just went from unpinned to pinned. */
export function isPinTransition(was: boolean, now: boolean): boolean {
  return now && !was;
}

function isClaudeTab(tab: vscode.Tab): boolean {
  return tab.input instanceof vscode.TabInputWebview && tab.input.viewType.includes("claudeVSCodePanel");
}

/**
 * One-directional sync: when the user pins a Claude session's editor tab, pin the
 * matching session in the list. Unpinning a tab does nothing. Only works for
 * sessions opened through this extension (we learn the tab↔session mapping then).
 */
export function registerTabSync(
  context: vscode.ExtensionContext,
  pins: PinStore,
  provider: SessionsTreeProvider,
): TabSync {
  const tabToSession = new WeakMap<vscode.Tab, string>();
  const pinnedState = new WeakMap<vscode.Tab, boolean>();

  context.subscriptions.push(
    vscode.window.tabGroups.onDidChangeTabs(async (e) => {
      for (const tab of [...e.opened, ...e.changed]) {
        if (!isClaudeTab(tab)) continue;
        const was = pinnedState.get(tab) ?? false;
        const now = tab.isPinned;
        pinnedState.set(tab, now);
        if (isPinTransition(was, now)) {
          const id = tabToSession.get(tab);
          if (id && !pins.has(id)) {
            await pins.pin(id);
            provider.refresh();
          }
        }
      }
    }),
  );

  return {
    visibleSessions(lookup) {
      const out: string[] = [];
      for (const group of vscode.window.tabGroups.all) {
        const tab = group.activeTab;
        if (!tab || !isClaudeTab(tab)) continue;
        const id = tabToSession.get(tab) ?? lookup(tab.label);
        if (id) out.push(id);
      }
      return out;
    },
    track(sessionId: string): void {
      const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (tab && isClaudeTab(tab)) {
        tabToSession.set(tab, sessionId);
        pinnedState.set(tab, tab.isPinned);
      }
    },
  };
}
