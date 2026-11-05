import * as vscode from "vscode";
import type { SessionMeta } from "./types";
import { buildGroups, buildSections, byDate } from "./sessionsModel";
import { TitleCache } from "./sessionScanner";
import { formatRelative } from "./relativeTime";
import { sessionLabel, groupLabel } from "./display";
import { sessionUri, groupUri, closedSectionUri } from "./decorations";
import type { SessionStores } from "./sessionStores";
import { resolveDropAction, type DropTarget } from "./dropLogic";
import type { LiveStatus } from "./liveStatus";

const LIVE_ICON: Record<LiveStatus["state"], vscode.ThemeIcon> = {
  working: new vscode.ThemeIcon("loading~spin", new vscode.ThemeColor("charts.green")),
  waiting: new vscode.ThemeIcon("bell-dot", new vscode.ThemeColor("charts.orange")),
  idle: new vscode.ThemeIcon("circle-filled", new vscode.ThemeColor("disabledForeground")),
};
const LIVE_LABEL: Record<LiveStatus["state"], string> = {
  working: "working",
  waiting: "needs you",
  idle: "idle",
};

const DND_MIME = "application/vnd.code.tree.claudeSessionOrganizer";

type Node =
  | { kind: "group"; key: string; label: string; children: SessionMeta[]; closed?: SessionMeta[]; dated?: boolean }
  | { kind: "session"; meta: SessionMeta; pinned: boolean; archived: boolean }
  | { kind: "empty"; label: string };

export class SessionsTreeProvider
  implements vscode.TreeDataProvider<Node>, vscode.TreeDragAndDropController<Node>
{
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  readonly dragMimeTypes = [DND_MIME];
  readonly dropMimeTypes = [DND_MIME];

  /** Remembered per-group expand/collapse state (by group key). */
  private readonly expansion = new Map<string, boolean>();

  constructor(
    private readonly load: () => Promise<SessionMeta[]>,
    private readonly stores: SessionStores,
    private readonly now: () => number = () => Date.now(),
    private readonly liveStatuses: () => Map<string, LiveStatus> | undefined = () => undefined,
    private readonly titles: TitleCache = new TitleCache(),
  ) {}

  refresh(): void { this._onDidChange.fire(); }

  /** Record a group's expand/collapse so a refresh keeps it, instead of resetting to the default. */
  setGroupExpanded(key: string, expanded: boolean): void {
    this.expansion.set(key, expanded);
  }

  handleDrag(source: readonly Node[], dataTransfer: vscode.DataTransfer): void {
    const ids = source
      .filter((n): n is Extract<Node, { kind: "session" }> => n.kind === "session")
      .map((n) => n.meta.sessionId);
    if (ids.length > 0) dataTransfer.set(DND_MIME, new vscode.DataTransferItem(JSON.stringify(ids)));
  }

  async handleDrop(target: Node | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const item = dataTransfer.get(DND_MIME);
    if (!item) return;
    let ids: unknown;
    try { ids = JSON.parse(await item.asString()); } catch { return; }
    if (!Array.isArray(ids) || ids.length === 0) return;
    const dropTarget: DropTarget =
      !target ? undefined
        : target.kind === "group" ? { kind: "group", key: target.key }
          : target.kind === "session" ? { kind: "session", group: this.stores.groups.get(target.meta.sessionId) }
            : undefined;
    const action = resolveDropAction(dropTarget);
    if (action.type === "ignore") return;
    for (const id of ids) {
      if (typeof id !== "string") continue;
      if (action.type === "set") await this.stores.groups.set(id, action.group);
      else await this.stores.groups.clear(id);
    }
    this.refresh();
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === "empty") {
      return new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    }
    if (node.kind === "group") {
      const def = node.key === "pinned" || node.key === "today" || node.key === "ungrouped" || node.key.startsWith("group:");
      const expanded = this.expansion.get(node.key) ?? def;
      const state = expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
      const custom = node.key.startsWith("group:");
      const name = custom ? groupLabel(node.label, this.stores) : node.label;
      // A custom group's header counts its open sessions and its closed ones separately.
      const counts = vscode.workspace.getConfiguration("claudeSessionOrganizer").get<boolean>("showGroupCounts", true);
      const item = node.closed || !counts
        ? new vscode.TreeItem(name, state)
        : new vscode.TreeItem(`${name} (${node.children.length})`, state);
      const parts: string[] = [];
      if (node.closed && counts) parts.push(`${node.children.length} open · ${node.closed.length} closed`);
      const unread = [...node.children, ...(node.closed ?? [])].filter((s) => this.stores.unread.has(s.sessionId)).length;
      if (unread) parts.push(`${unread} unread`);
      if (parts.length) item.description = parts.join(" · ");
      item.id = node.key;
      item.contextValue = custom ? "customGroup" : "group";
      if (custom) {
        const color = this.stores.groupColors.get(node.label);
        item.iconPath = new vscode.ThemeIcon("folder", color ? new vscode.ThemeColor(color) : undefined);
        item.resourceUri = groupUri(node.label);
      }
      // A group's "Closed" sub-section is faded like the closed sessions in it.
      if (node.key.startsWith("closed:")) item.resourceUri = closedSectionUri(node.label);
      return item;
    }
    const item = new vscode.TreeItem(sessionLabel(node.meta, this.stores), vscode.TreeItemCollapsibleState.None);
    item.id = node.meta.sessionId;
    item.resourceUri = sessionUri(node.meta.sessionId);
    const live = this.liveStatuses()?.get(node.meta.sessionId);
    const relative = formatRelative(node.meta.mtimeMs, this.now());
    item.description = live ? `${LIVE_LABEL[live.state]} · ${relative}` : relative;
    item.tooltip = `${node.meta.title}\n${node.meta.sessionId}` +
      (live ? `\n${LIVE_LABEL[live.state]}${live.waitingFor ? ` (${live.waitingFor})` : ""}` : "") +
      (this.stores.unread.has(node.meta.sessionId) ? "\nUnread reply" : "");    item.contextValue = node.archived ? "archivedSession" : node.pinned ? "pinnedSession" : "unpinnedSession";
    item.iconPath = live
      ? LIVE_ICON[live.state]
      : new vscode.ThemeIcon(
        node.archived ? "archive" : node.pinned ? "pinned" : "comment-discussion",
        // Closed (registry known, session not in it): fade the icon along with the name.
        this.liveStatuses() && !this.stores.unread.has(node.meta.sessionId)
          ? new vscode.ThemeColor("disabledForeground") : undefined,
      );
    item.command = { command: "claudeSessionOrganizer.sessions.open", title: "Open Session", arguments: [node.meta.sessionId] };
    return item;
  }

  async getChildren(node?: Node): Promise<Node[]> {
    if (node) {
      if (node.kind !== "group") return [];
      if (node.dated) {
        return byDate(node.children, this.now())
          .map((b) => ({ kind: "group", key: `${node.key}:${b.key}`, label: b.label, children: b.items }));
      }
      // Titles are read only here, when a section is expanded.
      const children = await this.titles.fill(node.children);
      const pinnedSet = new Set(this.stores.pins.list());
      const archivedSet = new Set(this.stores.archive.list());
      const out: Node[] = children.map((meta) => ({
        kind: "session",
        meta,
        pinned: pinnedSet.has(meta.sessionId),
        archived: archivedSet.has(meta.sessionId),
      }));
      if (node.closed && node.closed.length > 0) {
        out.push({ kind: "group", key: `closed:${node.label}`, label: "Closed", children: node.closed });
      }
      return out;
    }
    const sessions = await this.load();
    if (sessions.length === 0) return [{ kind: "empty", label: "No sessions for this workspace" }];
    const pinned = new Set(this.stores.pins.list());
    const groupOf = (id: string) => this.stores.groups.get(id);
    const archived = new Set(this.stores.archive.list());
    const live = this.liveStatuses();
    if (!live) {
      // No live registry: open and closed can't be told apart, keep the original layout.
      return buildGroups(sessions, pinned, this.now(), groupOf, archived)
        .map((g) => ({ kind: "group", key: g.key, label: g.label, children: g.items }));
    }
    return buildSections(sessions, pinned, (id) => live.has(id), groupOf, archived)
      .map((g) => ({
        kind: "group",
        key: g.key,
        label: g.label,
        children: g.items,
        closed: g.closed,
        dated: g.key === "history" || g.key === "archived",
      }));
  }
}
