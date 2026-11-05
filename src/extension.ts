import * as vscode from "vscode";
import * as os from "node:os";
import * as path from "node:path";
import { encodeProjectDir } from "./pathEncoder";
import { scanSessions } from "./sessionScanner";
import { PinStore } from "./pinStore";
import { NameStore } from "./nameStore";
import { EmojiStore, ColorStore, GroupStore, ArchiveStore } from "./sessionStores";
import type { SessionStores } from "./sessionStores";
import { SessionsTreeProvider } from "./treeProvider";
import { registerCommands } from "./commands";
import { registerTabSync } from "./tabSync";
import { readLiveStatuses, statusKey, type LiveStatus } from "./liveStatus";

/** How often to re-check the live registry, so sessions whose process died drop out. */
const LIVE_POLL_MS = 5_000;

function projectsDirFor(workspacePath: string): string {
  return path.join(os.homedir(), ".claude", "projects", encodeProjectDir(workspacePath));
}

export function activate(context: vscode.ExtensionContext): void {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const dir = folder ? projectsDirFor(folder.uri.fsPath) : undefined;

  const stores: SessionStores = {
    pins: new PinStore(context.globalState),
    names: new NameStore(context.globalState),
    emojis: new EmojiStore(context.globalState),
    colors: new ColorStore(context.globalState),
    groups: new GroupStore(context.globalState),
    archive: new ArchiveStore(context.globalState),
  };
  const load = () => (dir ? scanSessions(dir) : Promise.resolve([]));
  let liveStatuses = new Map<string, LiveStatus>();
  const provider = new SessionsTreeProvider(load, stores, undefined, (id) => liveStatuses.get(id));

  const treeView = vscode.window.createTreeView("claudeSessionOrganizer.sessions", {
    treeDataProvider: provider,
    dragAndDropController: provider,
    canSelectMany: true,
  });
  treeView.onDidExpandElement((e) => { if (e.element.kind === "group") provider.setGroupExpanded(e.element.key, true); });
  treeView.onDidCollapseElement((e) => { if (e.element.kind === "group") provider.setGroupExpanded(e.element.key, false); });
  context.subscriptions.push(treeView);

  const tabSync = registerTabSync(context, stores.pins, provider);
  registerCommands(context, stores, provider, load, tabSync.track);

  if (dir) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(dir, "*.jsonl"),
    );
    watcher.onDidCreate(() => provider.refresh());
    watcher.onDidChange(() => provider.refresh());
    watcher.onDidDelete(() => provider.refresh());
    context.subscriptions.push(watcher);
  }

  // Live state (working / needs you / idle) from the registry Claude Code keeps
  // in ~/.claude/sessions. Counted across all workspaces in the status bar.
  const sessionsDir = path.join(os.homedir(), ".claude", "sessions");
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  statusBar.command = "workbench.view.extension.claudeSessionOrganizer";
  context.subscriptions.push(statusBar);

  let lastKey = "";
  const updateLive = async () => {
    const next = await readLiveStatuses(sessionsDir);
    const key = statusKey(next);
    if (key === lastKey) return;
    lastKey = key;
    liveStatuses = next;
    const states = [...next.values()].map((s) => s.state);
    const working = states.filter((s) => s === "working").length;
    const waiting = states.filter((s) => s === "waiting").length;
    const parts: string[] = [];
    if (working) parts.push(`$(loading~spin) ${working} working`);
    if (waiting) parts.push(`$(bell-dot) ${waiting} need${waiting === 1 ? "s" : ""} you`);
    if (parts.length) {
      statusBar.text = parts.join("  ");
      statusBar.tooltip = "Claude sessions — click to open the organizer";
      statusBar.show();
    } else {
      statusBar.hide();
    }
    provider.refresh();
  };
  void updateLive();
  const liveWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(sessionsDir), "*.json"),
  );
  liveWatcher.onDidCreate(() => void updateLive());
  liveWatcher.onDidChange(() => void updateLive());
  liveWatcher.onDidDelete(() => void updateLive());
  const poll = setInterval(() => void updateLive(), LIVE_POLL_MS);
  context.subscriptions.push(liveWatcher, { dispose: () => clearInterval(poll) });
}

export function deactivate(): void {}
