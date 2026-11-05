import type { SessionMeta, SessionGroup } from "./types";

export type DateBucket = "today" | "yesterday" | "prev7" | "prev30" | "older";

const DAY_MS = 86_400_000;

/** Classify a file mtime into a date bucket relative to nowMs (local calendar day). */
export function bucketOf(mtimeMs: number, nowMs: number): DateBucket {
  const d = new Date(nowMs);
  const startOfToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (mtimeMs >= startOfToday) return "today";
  if (mtimeMs >= startOfToday - DAY_MS) return "yesterday";
  if (mtimeMs >= startOfToday - 7 * DAY_MS) return "prev7";
  if (mtimeMs >= startOfToday - 30 * DAY_MS) return "prev30";
  return "older";
}

const DATE_GROUPS: { key: DateBucket; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "prev7", label: "Previous 7 Days" },
  { key: "prev30", label: "Previous 30 Days" },
  { key: "older", label: "Older" },
];

/**
 * Build an ordered list of groups. Archived sessions are removed from the normal
 * groups and collected into a trailing "Archived" group. Pinned sessions come first
 * (if any) and never appear elsewhere. If any non-pinned session has a custom group,
 * switch to group mode (custom groups alphabetically, then Ungrouped); otherwise use
 * date buckets. Items within every group are mtime-descending.
 */
export function buildGroups(
  sessions: SessionMeta[],
  pinned: Set<string>,
  nowMs: number,
  groupOf: (sessionId: string) => string | undefined = () => undefined,
  archived: Set<string> = new Set<string>(),
): SessionGroup[] {
  const sorted = [...sessions].sort((a, b) => b.mtimeMs - a.mtimeMs);
  const live = sorted.filter((s) => !archived.has(s.sessionId));
  const groups: SessionGroup[] = [];

  const pinnedItems = live.filter((s) => pinned.has(s.sessionId));
  if (pinnedItems.length > 0) groups.push({ key: "pinned", label: "Pinned", items: pinnedItems });

  const rest = live.filter((s) => !pinned.has(s.sessionId));

  if (rest.some((s) => groupOf(s.sessionId))) {
    const names = [...new Set(rest.map((s) => groupOf(s.sessionId)).filter((g): g is string => !!g))].sort();
    for (const name of names) {
      const items = rest.filter((s) => groupOf(s.sessionId) === name);
      if (items.length > 0) groups.push({ key: `group:${name}`, label: name, items });
    }
    const ungrouped = rest.filter((s) => !groupOf(s.sessionId));
    if (ungrouped.length > 0) groups.push({ key: "ungrouped", label: "Ungrouped", items: ungrouped });
  } else {
    for (const { key, label } of DATE_GROUPS) {
      const items = rest.filter((s) => bucketOf(s.mtimeMs, nowMs) === key);
      if (items.length > 0) groups.push({ key, label, items });
    }
  }

  const archivedItems = sorted.filter((s) => archived.has(s.sessionId));
  if (archivedItems.length > 0) groups.push({ key: "archived", label: "Archived", items: archivedItems });

  return groups;
}

/** Split sessions into date buckets (Today, Yesterday, …), omitting empty ones. */
export function byDate(sessions: SessionMeta[], nowMs: number): SessionGroup[] {
  const sorted = [...sessions].sort((a, b) => b.mtimeMs - a.mtimeMs);
  const out: SessionGroup[] = [];
  for (const { key, label } of DATE_GROUPS) {
    const items = sorted.filter((s) => bucketOf(s.mtimeMs, nowMs) === key);
    if (items.length > 0) out.push({ key, label, items });
  }
  return out;
}

/** A top-level section of the tree. `closed` holds a custom group's sessions that are not open. */
export interface Section extends SessionGroup {
  closed?: SessionMeta[];
}

/**
 * Build the tree when Claude Code's live registry is available, so open and
 * closed sessions can be told apart:
 * - Pinned (open or closed), first;
 * - each custom group (alphabetical) with its open sessions, closed ones in `closed`;
 * - Ungrouped: open sessions with no group;
 * - History: closed sessions with no group;
 * - Archived, last.
 * Empty sections are omitted. Items are mtime-descending.
 */
export function buildSections(
  sessions: SessionMeta[],
  pinned: Set<string>,
  isOpen: (sessionId: string) => boolean,
  groupOf: (sessionId: string) => string | undefined = () => undefined,
  archived: Set<string> = new Set<string>(),
): Section[] {
  const sorted = [...sessions].sort((a, b) => b.mtimeMs - a.mtimeMs);
  const live = sorted.filter((s) => !archived.has(s.sessionId));
  const out: Section[] = [];

  const pinnedItems = live.filter((s) => pinned.has(s.sessionId));
  if (pinnedItems.length > 0) out.push({ key: "pinned", label: "Pinned", items: pinnedItems });

  const rest = live.filter((s) => !pinned.has(s.sessionId));
  const names = [...new Set(rest.map((s) => groupOf(s.sessionId)).filter((g): g is string => !!g))].sort();
  for (const name of names) {
    const inGroup = rest.filter((s) => groupOf(s.sessionId) === name);
    out.push({
      key: `group:${name}`,
      label: name,
      items: inGroup.filter((s) => isOpen(s.sessionId)),
      closed: inGroup.filter((s) => !isOpen(s.sessionId)),
    });
  }

  const ungrouped = rest.filter((s) => !groupOf(s.sessionId));
  const openUngrouped = ungrouped.filter((s) => isOpen(s.sessionId));
  if (openUngrouped.length > 0) out.push({ key: "ungrouped", label: "Ungrouped", items: openUngrouped });
  const history = ungrouped.filter((s) => !isOpen(s.sessionId));
  if (history.length > 0) out.push({ key: "history", label: "History", items: history });

  const archivedItems = sorted.filter((s) => archived.has(s.sessionId));
  if (archivedItems.length > 0) out.push({ key: "archived", label: "Archived", items: archivedItems });

  return out;
}

/**
 * Sessions to archive in bulk: not used for more than `days` days, and not
 * open, pinned or already archived.
 */
export function staleSessions(
  sessions: SessionMeta[],
  days: number,
  nowMs: number,
  isOpen: (sessionId: string) => boolean,
  pinned: Set<string>,
  archived: Set<string>,
): SessionMeta[] {
  const cutoff = nowMs - days * DAY_MS;
  return sessions.filter((s) =>
    s.mtimeMs < cutoff && !isOpen(s.sessionId) && !pinned.has(s.sessionId) && !archived.has(s.sessionId));
}
