import * as vscode from "vscode";
import { sessionLabel } from "./display";
import { formatRelative } from "./relativeTime";
import type { SessionMeta } from "./types";
import type { SessionStores } from "./sessionStores";
import { SessionsTreeProvider } from "./treeProvider";
import { staleSessions } from "./sessionsModel";
import { GROUP_COLORS } from "./decorations";

const OFFICIAL_OPEN = "claude-vscode.editor.open";
const OFFICIAL_NEW = "claude-vscode.newConversation";

/** Start a new Claude Code session via the official extension (with a fallback). */
export async function openNewSession(): Promise<void> {
  try {
    await vscode.commands.executeCommand(OFFICIAL_NEW);
  } catch {
    try {
      await vscode.commands.executeCommand(OFFICIAL_OPEN);
    } catch {
      void vscode.window.showErrorMessage(
        "Could not start a new session. Make sure the official Claude Code extension is installed and enabled.",
      );
    }
  }
}

/** Open a session by reusing the official Claude Code command. */
export async function openSession(sessionId: string): Promise<void> {
  try {
    await vscode.commands.executeCommand(OFFICIAL_OPEN, sessionId, undefined, vscode.ViewColumn.Active);
  } catch {
    void vscode.window.showErrorMessage(
      "Could not open the session. Make sure the official Claude Code extension is installed and enabled.",
    );
  }
}

export function registerCommands(
  context: vscode.ExtensionContext,
  stores: SessionStores,
  provider: SessionsTreeProvider,
  load: () => Promise<SessionMeta[]>,
  track: (sessionId: string) => void,
  isOpen: (sessionId: string) => boolean = () => false,
  onUnreadChange: () => void = () => {},
): void {
  const { pins, names } = stores;
  const refresh = () => provider.refresh();
  const markRead = async (ids: string[]) => {
    for (const id of ids) await stores.unread.remove(id);
    onUnreadChange();
    refresh();
  };
  const openAndTrack = async (id: string) => {
    await openSession(id);
    track(id);
    if (stores.unread.has(id)) await markRead([id]);
  };
  context.subscriptions.push(
    vscode.commands.registerCommand("sessionDesk.sessions.open", (sessionId: string) => openAndTrack(sessionId)),
    vscode.commands.registerCommand("sessionDesk.sessions.new", () => openNewSession()),
    vscode.commands.registerCommand("sessionDesk.sessions.refresh", () => refresh()),
    vscode.commands.registerCommand("sessionDesk.sessions.pin", async (node: { meta?: { sessionId: string } }) => {
      if (node?.meta) { await pins.pin(node.meta.sessionId); refresh(); }
    }),
    vscode.commands.registerCommand("sessionDesk.sessions.unpin", async (node: { meta?: { sessionId: string } }) => {
      if (node?.meta) { await pins.unpin(node.meta.sessionId); refresh(); }
    }),
    vscode.commands.registerCommand("sessionDesk.sessions.rename", async (node: { meta?: { sessionId: string; title: string } }) => {
      if (!node?.meta) return;
      const current = names.get(node.meta.sessionId) ?? node.meta.title ?? "";
      const input = await vscode.window.showInputBox({ value: current, prompt: "Rename session (leave empty to reset)" });
      if (input === undefined) return;
      if (input.trim() === "") await names.clear(node.meta.sessionId);
      else await names.set(node.meta.sessionId, input);
      refresh();
    }),
    vscode.commands.registerCommand("sessionDesk.sessions.delete", async (node: { meta?: { sessionId: string; title: string; filePath: string } }) => {
      if (!node?.meta) return;
      const label = names.get(node.meta.sessionId) ?? node.meta.title ?? node.meta.sessionId;
      const pick = await vscode.window.showWarningMessage(
        `Delete session "${label}"? It will be moved to the trash.`,
        { modal: true },
        "Delete",
      );
      if (pick !== "Delete") return;
      try {
        await vscode.workspace.fs.delete(vscode.Uri.file(node.meta.filePath), { useTrash: true });
        await pins.unpin(node.meta.sessionId);
        await names.clear(node.meta.sessionId);
        await stores.emojis.clear(node.meta.sessionId);
        await stores.colors.clear(node.meta.sessionId);
        await stores.groups.clear(node.meta.sessionId);
        await stores.archive.remove(node.meta.sessionId);
        await stores.unread.remove(node.meta.sessionId);
      } catch (e) {
        void vscode.window.showErrorMessage(`Could not delete session: ${e instanceof Error ? e.message : String(e)}`);
      }
      refresh();
    }),
    vscode.commands.registerCommand("sessionDesk.sessions.copyId", async (node: { meta?: { sessionId: string } }) => {
      if (node?.meta) await vscode.env.clipboard.writeText(node.meta.sessionId);
    }),
    vscode.commands.registerCommand("sessionDesk.sessions.copyPath", async (node: { meta?: { filePath: string } }) => {
      if (node?.meta) await vscode.env.clipboard.writeText(node.meta.filePath);
    }),
    vscode.commands.registerCommand("sessionDesk.sessions.search", async () => {
      const sessions = await load();
      if (sessions.length === 0) {
        void vscode.window.showInformationMessage("No sessions to search.");
        return;
      }
      const items = sessions.map((sm) => ({
        label: sessionLabel(sm, stores),
        description: formatRelative(sm.mtimeMs, Date.now()),
        sessionId: sm.sessionId,
      }));
      const pick = await vscode.window.showQuickPick(items, { placeHolder: "Search sessions by name" });
      if (pick) await openAndTrack(pick.sessionId);
    }),
    vscode.commands.registerCommand("sessionDesk.sessions.setColor", async (node: { meta?: { sessionId: string } }) => {
      if (!node?.meta) return;
      const options = [
        { label: "🔴 Red", value: "🔴" },
        { label: "🟠 Orange", value: "🟠" },
        { label: "🟡 Yellow", value: "🟡" },
        { label: "🟢 Green", value: "🟢" },
        { label: "🔵 Blue", value: "🔵" },
        { label: "🟣 Purple", value: "🟣" },
        { label: "🟤 Brown", value: "🟤" },
        { label: "⚫ Black", value: "⚫" },
        { label: "⚪ White", value: "⚪" },
        { label: "🩷 Pink", value: "🩷" },
        { label: "🩵 Light Blue", value: "🩵" },
        { label: "🩶 Gray", value: "🩶" },
        { label: "None", value: "" },
      ];
      const pick = await vscode.window.showQuickPick(options, { placeHolder: "Set session color" });
      if (!pick) return;
      await stores.colors.set(node.meta.sessionId, pick.value);
      refresh();
    }),
    vscode.commands.registerCommand("sessionDesk.sessions.setEmoji", async (node: { meta?: { sessionId: string } }) => {
      if (!node?.meta) return;
      const current = stores.emojis.get(node.meta.sessionId) ?? "";
      const input = await vscode.window.showInputBox({ value: current, prompt: "Set emoji (leave empty to clear)" });
      if (input === undefined) return;
      await stores.emojis.set(node.meta.sessionId, input);
      refresh();
    }),
    vscode.commands.registerCommand("sessionDesk.sessions.setGroup", async (node: { meta?: { sessionId: string } }) => {
      if (!node?.meta) return;
      const id = node.meta.sessionId;
      const existing = [...new Set(Object.values(stores.groups.all()))].sort();
      type Pick = vscode.QuickPickItem & { action: "set" | "create" | "remove"; group?: string };
      const base: Pick[] = [
        ...existing.map((g): Pick => ({ label: g, action: "set", group: g })),
        { label: "$(add) Create new group…", action: "create" },
        ...(stores.groups.get(id) ? [{ label: "$(close) Remove from group", action: "remove" } as Pick] : []),
      ];
      // Typing a name that isn't an existing group offers to create it, so Enter
      // never closes the list silently or drops the session in a near-match.
      const choice = await new Promise<Pick | undefined>((resolve) => {
        const qp = vscode.window.createQuickPick<Pick>();
        qp.placeholder = "Pick a group, or type a new group name";
        qp.items = base;
        qp.onDidChangeValue((value) => {
          const name = value.trim();
          const exact = existing.some((g) => g.toLowerCase() === name.toLowerCase());
          qp.items = name && !exact
            ? [{ label: `$(add) Create group "${name}"`, action: "set", group: name, alwaysShow: true }, ...base]
            : base;
        });
        let picked: Pick | undefined;
        qp.onDidAccept(() => { picked = qp.selectedItems[0] ?? qp.activeItems[0]; qp.hide(); });
        qp.onDidHide(() => { qp.dispose(); resolve(picked); });
        qp.show();
      });
      if (!choice) return;
      if (choice.action === "remove") {
        await stores.groups.clear(id);
      } else if (choice.action === "create") {
        const name = await vscode.window.showInputBox({ prompt: "New group name", ignoreFocusOut: true });
        if (name === undefined || name.trim() === "") return;
        await stores.groups.set(id, name.trim());
      } else if (choice.group) {
        await stores.groups.set(id, choice.group);
      }
      refresh();
    }),
    vscode.commands.registerCommand("sessionDesk.sessions.archive", async (node: { meta?: { sessionId: string } }) => {
      if (node?.meta) { await stores.archive.add(node.meta.sessionId); refresh(); }
    }),
    vscode.commands.registerCommand("sessionDesk.sessions.unarchive", async (node: { meta?: { sessionId: string } }) => {
      if (node?.meta) { await stores.archive.remove(node.meta.sessionId); refresh(); }
    }),
    vscode.commands.registerCommand("sessionDesk.sessions.markRead", async (node: { meta?: { sessionId: string } }, all?: { meta?: { sessionId: string } }[]) => {
      const ids = (all ?? [node]).map((n) => n?.meta?.sessionId).filter((id): id is string => !!id);
      if (ids.length) await markRead(ids);
    }),
    vscode.commands.registerCommand("sessionDesk.view.hideCounts", () =>
      vscode.workspace.getConfiguration("sessionDesk").update("showGroupCounts", false, vscode.ConfigurationTarget.Global)),
    vscode.commands.registerCommand("sessionDesk.view.showCounts", () =>
      vscode.workspace.getConfiguration("sessionDesk").update("showGroupCounts", true, vscode.ConfigurationTarget.Global)),
    vscode.commands.registerCommand("sessionDesk.view.hideClosed", () =>
      vscode.workspace.getConfiguration("sessionDesk").update("showClosed", false, vscode.ConfigurationTarget.Global)),
    vscode.commands.registerCommand("sessionDesk.view.showClosed", () =>
      vscode.workspace.getConfiguration("sessionDesk").update("showClosed", true, vscode.ConfigurationTarget.Global)),
    vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration("sessionDesk")) refresh(); }),
    vscode.commands.registerCommand("sessionDesk.sessions.markAllRead", () => markRead(stores.unread.list())),
    vscode.commands.registerCommand("sessionDesk.groups.setEmoji", async (node: { key?: string; label?: string }) => {
      if (!node?.key?.startsWith("group:") || !node.label) return;
      const current = stores.groupEmojis.get(node.label) ?? "";
      const input = await vscode.window.showInputBox({ value: current, prompt: `Emoji for group "${node.label}" (leave empty to clear)` });
      if (input === undefined) return;
      await stores.groupEmojis.set(node.label, input);
      refresh();
    }),
    vscode.commands.registerCommand("sessionDesk.groups.setColor", async (node: { key?: string; label?: string }) => {
      if (!node?.key?.startsWith("group:") || !node.label) return;
      const pick = await vscode.window.showQuickPick(
        [...GROUP_COLORS, { label: "None", value: "" }],
        { placeHolder: `Color for group "${node.label}"` },
      );
      if (!pick) return;
      await stores.groupColors.set(node.label, pick.value);
      refresh();
    }),
    vscode.commands.registerCommand("sessionDesk.sessions.archiveOld", async () => {
      const CUSTOM = "Custom…";
      const pick = await vscode.window.showQuickPick(
        [
          { label: "7 days", days: 7 },
          { label: "14 days", days: 14 },
          { label: "30 days", days: 30 },
          { label: "60 days", days: 60 },
          { label: CUSTOM, days: 0 },
        ],
        { placeHolder: "Archive sessions not used for more than…" },
      );
      if (!pick) return;
      let days = pick.days;
      if (pick.label === CUSTOM) {
        const input = await vscode.window.showInputBox({
          prompt: "Archive sessions not used for more than how many days?",
          validateInput: (v) => (/^\d+$/.test(v.trim()) && Number(v) > 0 ? undefined : "Enter a whole number of days"),
        });
        if (input === undefined) return;
        days = Number(input.trim());
      }
      const stale = staleSessions(
        await load(), days, Date.now(), isOpen,
        new Set(pins.list()), new Set(stores.archive.list()),
      );
      if (stale.length === 0) {
        void vscode.window.showInformationMessage(`No sessions unused for more than ${days} days.`);
        return;
      }
      const ARCHIVE = "Archive";
      const confirm = await vscode.window.showWarningMessage(
        `Archive ${stale.length} session${stale.length === 1 ? "" : "s"} not used for more than ${days} days? ` +
          "Open and pinned sessions are kept. Archived sessions keep their group and can be unarchived.",
        { modal: true },
        ARCHIVE,
      );
      if (confirm !== ARCHIVE) return;
      await stores.archive.addMany(stale.map((x) => x.sessionId));
      refresh();
    }),
  );
}
