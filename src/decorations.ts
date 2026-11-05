import * as vscode from "vscode";
import type { SessionStores } from "./sessionStores";

const SCHEME = "claude-session-organizer";

export function sessionUri(sessionId: string): vscode.Uri {
  return vscode.Uri.from({ scheme: SCHEME, path: `/session/${sessionId}` });
}
export function groupUri(name: string): vscode.Uri {
  return vscode.Uri.from({ scheme: SCHEME, path: `/group/${encodeURIComponent(name)}` });
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
  private readonly _onDidChange = new vscode.EventEmitter<undefined>();
  readonly onDidChangeFileDecorations = this._onDidChange.event;

  constructor(private readonly stores: SessionStores) {}

  refresh(): void { this._onDidChange.fire(undefined); }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== SCHEME) return undefined;
    const [, kind, rest] = uri.path.split("/");
    if (kind === "session" && this.stores.unread.has(rest)) {
      return new vscode.FileDecoration("●", "Unread reply", new vscode.ThemeColor("charts.blue"));
    }
    if (kind === "group") {
      const color = this.stores.groupColors.get(decodeURIComponent(rest));
      if (color) return new vscode.FileDecoration(undefined, undefined, new vscode.ThemeColor(color));
    }
    return undefined;
  }
}
