import * as fs from "node:fs/promises";
import * as path from "node:path";

/** Live state Claude Code reports for a running session. */
export type LiveState = "working" | "waiting" | "idle";

export interface LiveStatus {
  state: LiveState;
  waitingFor?: string;   // e.g. a permission request, when state is "waiting"
}

/**
 * Parse one ~/.claude/sessions/<pid>.json registry entry written by Claude Code.
 * Returns undefined for entries without a session id or with an unknown status.
 */
export function parseRegistryEntry(text: string): { pid?: number; sessionId: string; status: LiveStatus } | undefined {
  let obj: any;
  try { obj = JSON.parse(text); } catch { return undefined; }
  if (typeof obj?.sessionId !== "string") return undefined;
  const state: LiveState | undefined =
    obj.status === "busy" ? "working"
      : obj.status === "waiting" ? "waiting"
        : obj.status === "idle" ? "idle"
          : undefined;
  if (!state) return undefined;
  const status: LiveStatus = { state };
  if (typeof obj.waitingFor === "string" && obj.waitingFor) status.waitingFor = obj.waitingFor;
  return { pid: typeof obj.pid === "number" ? obj.pid : undefined, sessionId: obj.sessionId, status };
}

function isRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (e: any) { return e?.code === "EPERM"; }
}

/**
 * Read the live-session registry, keyed by session id. Entries whose process
 * is gone are skipped, since Claude Code can leave them behind after a crash.
 */
export async function readLiveStatuses(sessionsDir: string): Promise<Map<string, LiveStatus>> {
  const out = new Map<string, LiveStatus>();
  let entries: string[];
  try { entries = await fs.readdir(sessionsDir); }
  catch { return out; }
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    let text: string;
    try { text = await fs.readFile(path.join(sessionsDir, name), "utf8"); }
    catch { continue; }
    const entry = parseRegistryEntry(text);
    if (!entry) continue;
    if (entry.pid !== undefined && !isRunning(entry.pid)) continue;
    out.set(entry.sessionId, entry.status);
  }
  return out;
}

/** Stable string form, used to skip refreshes when nothing changed. */
export function statusKey(statuses: Map<string, LiveStatus>): string {
  return [...statuses.entries()]
    .map(([id, s]) => `${id}:${s.state}:${s.waitingFor ?? ""}`)
    .sort()
    .join("|");
}
