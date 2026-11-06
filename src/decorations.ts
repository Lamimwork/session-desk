import * as vscode from "vscode";
import type { SessionStores } from "./sessionStores";
import type { LiveStatus } from "./liveStatus";
import { isFaded } from "./fade";

const SCHEME = "session-desk";

export function sessionUri(sessionId: string): vscode.Uri {
  return vscode.Uri.from({ scheme: SCHEME, path: `/session/${sessionId}` });
}
export function groupUri(name: string): vscode.Uri {
  return vscode.Uri.from({ scheme: SCHEME, path: `/group/${encodeURIComponent(name)}` });
}

export function closedSectionUri(name: string): vscode.Uri {
  return vscode.Uri.from({ scheme: SCHEME, path: `/closed/${encodeURIComponent(name)}` });
}

/** Theme colors offered for groups (they follow the user's theme). */
export const GROUP_COLORS: { label: string; value: string }[] = [
  { label: "Red", value: "charts.red" },
  { label: "Orange", value: "charts.orange" },
  { label: "Yellow", value: "charts.yellow" },
  { label: "Green", value: "charts.green" },
  { label: "Blue", value: "charts.blue" },
  { label: "Purple", value: "charts.purple" },
];

/**
 * Tree items can't style their own label, so the label color and the unread
 * badge come from a decoration provider keyed by a private URI scheme.
 */
export class SessionDecorations implements vscode.FileDecorationProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChange.event;
  /** What each URI VS Code asked about was last given, so a refresh only re-sends what changed. */
  private readonly given = new Map<string, { uri: vscode.Uri; key: string }>();

  constructor(
    private readonly stores: SessionStores,
    private readonly liveStatuses: () => Map<string, LiveStatus> | undefined = () => undefined,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * Tell VS Code about the decorations that changed. Firing "everything changed"
   * makes it drop every decoration and ask again, and the labels flash uncolored
   * in between; so only the URIs whose decoration is now different are sent.
   */
  refresh(): void {
    const changed: vscode.Uri[] = [];
    for (const [id, entry] of this.given) {
      const key = keyOf(this.compute(entry.uri));
      if (key !== entry.key) {
        this.given.set(id, { uri: entry.uri, key });
        changed.push(entry.uri);
      }
    }
    if (changed.length) this._onDidChange.fire(changed);
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== SCHEME) return undefined;
    const decoration = this.compute(uri);
    this.given.set(uri.toString(), { uri, key: keyOf(decoration) });
    return decoration;
  }

  private compute(uri: vscode.Uri): vscode.FileDecoration | undefined {
    const [, kind, rest] = uri.path.split("/");
    if (kind === "session" && this.stores.unread.has(rest)) {
      return new vscode.FileDecoration("●", "Unread reply", new vscode.ThemeColor("charts.blue"));
    }
    if (kind === "session") {
      const minutes = vscode.workspace.getConfiguration("sessionDesk").get<number>("fadeIdleAfterMinutes", 10);
      if (isFaded(rest, this.liveStatuses(), false, this.now(), minutes * 60_000)) {
        return new vscode.FileDecoration(undefined, undefined, new vscode.ThemeColor("disabledForeground"));
      }
    }
    if (kind === "closed") {
      return new vscode.FileDecoration(undefined, undefined, new vscode.ThemeColor("disabledForeground"));
    }
    if (kind === "group") {
      const color = this.stores.groupColors.get(decodeURIComponent(rest));
      if (color) return new vscode.FileDecoration(undefined, undefined, new vscode.ThemeColor(color));
    }
    return undefined;
  }
}

function keyOf(d: vscode.FileDecoration | undefined): string {
  return d ? `${d.badge ?? ""}|${d.color?.id ?? ""}` : "";
}
