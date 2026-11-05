import * as vscode from "vscode";
import * as os from "node:os";
import * as path from "node:path";
import { encodeProjectDir } from "./pathEncoder";
import { listSessions, TitleCache } from "./sessionScanner";
import { PinStore } from "./pinStore";
import { NameStore } from "./nameStore";
import { EmojiStore, ColorStore, GroupStore, ArchiveStore, UnreadStore, GroupEmojiStore, GroupColorStore } from "./sessionStores";
import type { SessionStores } from "./sessionStores";
import { SessionsTreeProvider } from "./treeProvider";
import { registerCommands } from "./commands";
import { registerTabSync } from "./tabSync";
import { readLiveStatuses, statusKey, type LiveStatus } from "./liveStatus";
import { finishedTurns, sessionForTabLabel } from "./unread";
import { SessionDecorations } from "./decorations";

/** How often to re-check the live registry, so sessions whose process died drop out. */
const LIVE_POLL_MS = 5_000;
/** Transcripts are written continuously while a session works; batch the refreshes. */
const REFRESH_DEBOUNCE_MS = 1_000;

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
    unread: new UnreadStore(context.globalState),
    groupEmojis: new GroupEmojiStore(context.globalState),
    groupColors: new GroupColorStore(context.globalState),
  };
  const load = () => (dir ? listSessions(dir) : Promise.resolve([]));
  const titles = new TitleCache();
  const loadWithTitles = async () => titles.fill(await load());
  let liveStatuses: Map<string, LiveStatus> | undefined;
  const provider = new SessionsTreeProvider(load, stores, undefined, () => liveStatuses, titles);

  const treeView = vscode.window.createTreeView("claudeSessionOrganizer.sessions", {
    treeDataProvider: provider,
    dragAndDropController: provider,
    canSelectMany: true,
  });
  treeView.onDidExpandElement((e) => { if (e.element.kind === "group") provider.setGroupExpanded(e.element.key, true); });
  treeView.onDidCollapseElement((e) => { if (e.element.kind === "group") provider.setGroupExpanded(e.element.key, false); });
  context.subscriptions.push(treeView);

  // Label colors and the unread badge are drawn by a decoration provider.
  const decorations = new SessionDecorations(stores);
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(decorations),
    provider.onDidChangeTreeData(() => decorations.refresh()),
  );

  const tabSync = registerTabSync(context, stores.pins, provider);

  /** Of the given sessions, those of this workspace that are on screen right now. */
  const onScreen = async (ids: string[]): Promise<Set<string>> => {
    if (ids.length === 0 || !vscode.window.state.focused) return new Set();
    const wanted = new Set(ids);
    const candidates = await titles.fill((await load()).filter((s) => wanted.has(s.sessionId)));
    return new Set(tabSync.visibleSessions((label) => sessionForTabLabel(label, candidates))
      .filter((id) => wanted.has(id)));
  };
  /** A reply counts as read once its session is on screen. */
  const markVisibleRead = async () => {
    const unread = stores.unread.list();
    if (unread.length === 0) return;
    const seen = await onScreen(unread);
    if (seen.size === 0) return;
    for (const id of seen) await stores.unread.remove(id);
    renderStatus();
    provider.refresh();
  };
  context.subscriptions.push(
    vscode.window.tabGroups.onDidChangeTabs(() => void markVisibleRead()),
    vscode.window.tabGroups.onDidChangeTabGroups(() => void markVisibleRead()),
    vscode.window.onDidChangeWindowState((e) => { if (e.focused) void markVisibleRead(); }),
  );
  registerCommands(context, stores, provider, loadWithTitles, tabSync.track, (id) => liveStatuses?.has(id) ?? false,
    () => renderStatus());

  if (dir) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(dir, "*.jsonl"),
    );
    let pending: ReturnType<typeof setTimeout> | undefined;
    const refreshSoon = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => { pending = undefined; provider.refresh(); }, REFRESH_DEBOUNCE_MS);
    };
    watcher.onDidCreate(refreshSoon);
    watcher.onDidChange(refreshSoon);
    watcher.onDidDelete(refreshSoon);
    context.subscriptions.push(watcher, { dispose: () => { if (pending) clearTimeout(pending); } });
  }

  // Live state (working / needs you / idle) from the registry Claude Code keeps
  // in ~/.claude/sessions. Counted across all workspaces in the status bar.
  const sessionsDir = path.join(os.homedir(), ".claude", "sessions");
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  statusBar.command = "workbench.view.extension.claudeSessionOrganizer";
  context.subscriptions.push(statusBar);

  function renderStatus(): void {
    const states = [...(liveStatuses?.values() ?? [])].map((s) => s.state);
    const working = states.filter((s) => s === "working").length;
    const waiting = states.filter((s) => s === "waiting").length;
    const unread = stores.unread.list().length;
    const parts: string[] = [];
    if (working) parts.push(`$(loading~spin) ${working} working`);
    if (waiting) parts.push(`$(bell-dot) ${waiting} need${waiting === 1 ? "s" : ""} you`);
    if (unread) parts.push(`$(circle-filled) ${unread} unread`);
    if (parts.length) {
      statusBar.text = parts.join("  ");
      statusBar.tooltip = "Claude sessions — click to open the organizer";
      statusBar.show();
    } else {
      statusBar.hide();
    }
  }

  let lastKey = "";
  const updateLive = async () => {
    const next = await readLiveStatuses(sessionsDir);
    const key = statusKey(next);
    if (key === lastKey) return;
    lastKey = key;
    const prev = liveStatuses;
    liveStatuses = next;
    // A session that stopped working has a reply waiting, unless it is on screen.
    const finished = finishedTurns(prev, next);
    if (finished.length > 0) {
      const mine = new Set((await load()).map((s) => s.sessionId));
      const seen = await onScreen(finished);
      await stores.unread.addMany(finished.filter((id) => mine.has(id) && !seen.has(id)));
    }
    renderStatus();
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
