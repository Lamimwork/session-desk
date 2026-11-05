import { describe, it, expect } from "vitest";
import { buildGroups, bucketOf, buildSections, byDate, staleSessions } from "../src/sessionsModel";
import type { SessionMeta } from "../src/types";

const now = new Date(2026, 5, 16, 15, 0, 0).getTime();
const startOfToday = new Date(2026, 5, 16, 0, 0, 0, 0).getTime();
const DAY = 86_400_000;

const s = (id: string, mtimeMs: number): SessionMeta =>
  ({ sessionId: id, mtimeMs, title: id, filePath: `/p/${id}.jsonl` });

describe("buildGroups", () => {
  it("puts pinned into a Pinned group first, mtime desc, excluded from date groups", () => {
    const sessions = [s("a", startOfToday + 10), s("b", startOfToday + 20)];
    const g = buildGroups(sessions, new Set(["a"]), now);
    expect(g[0].key).toBe("pinned");
    expect(g[0].items.map((x) => x.sessionId)).toEqual(["a"]);
    // "b" is today and not pinned
    expect(g[1].key).toBe("today");
    expect(g[1].items.map((x) => x.sessionId)).toEqual(["b"]);
  });

  it("orders date groups today/yesterday/prev7/prev30/older and omits empty ones", () => {
    const sessions = [
      s("today", startOfToday + 5),
      s("yd", startOfToday - DAY),
      s("old", startOfToday - 60 * DAY),
    ];
    const g = buildGroups(sessions, new Set<string>(), now);
    expect(g.map((x) => x.key)).toEqual(["today", "yesterday", "older"]);
    expect(g.map((x) => x.label)).toEqual(["Today", "Yesterday", "Older"]);
  });

  it("sorts items within a group mtime desc", () => {
    const sessions = [s("a", startOfToday + 1), s("b", startOfToday + 3), s("c", startOfToday + 2)];
    const g = buildGroups(sessions, new Set<string>(), now);
    expect(g[0].key).toBe("today");
    expect(g[0].items.map((x) => x.sessionId)).toEqual(["b", "c", "a"]);
  });

  it("returns [] for no sessions", () => {
    expect(buildGroups([], new Set<string>(), now)).toEqual([]);
  });
});

describe("bucketOf", () => {
  it("classifies today (including future)", () => {
    expect(bucketOf(startOfToday, now)).toBe("today");
    expect(bucketOf(now + DAY, now)).toBe("today");
  });
  it("classifies yesterday", () => {
    expect(bucketOf(startOfToday - 1, now)).toBe("yesterday");
    expect(bucketOf(startOfToday - DAY, now)).toBe("yesterday");
  });
  it("classifies previous 7 days", () => {
    expect(bucketOf(startOfToday - DAY - 1, now)).toBe("prev7");
    expect(bucketOf(startOfToday - 7 * DAY, now)).toBe("prev7");
  });
  it("classifies previous 30 days", () => {
    expect(bucketOf(startOfToday - 7 * DAY - 1, now)).toBe("prev30");
    expect(bucketOf(startOfToday - 30 * DAY, now)).toBe("prev30");
  });
  it("classifies older", () => {
    expect(bucketOf(startOfToday - 30 * DAY - 1, now)).toBe("older");
  });
});

describe("buildGroups custom groups", () => {
  const groupOf = (map: Record<string, string>) => (id: string): string | undefined => map[id];

  it("switches to group mode when any session has a group; alpha order, Ungrouped last", () => {
    const sessions = [s("a", startOfToday + 3), s("b", startOfToday + 2), s("c", startOfToday + 1)];
    const g = buildGroups(sessions, new Set<string>(), now, groupOf({ a: "Work", b: "Admin" }));
    expect(g.map((x) => x.label)).toEqual(["Admin", "Work", "Ungrouped"]);
    expect(g[2].items.map((i) => i.sessionId)).toEqual(["c"]);
  });

  it("keeps pinned in the Pinned group even in group mode", () => {
    const sessions = [s("a", startOfToday + 3), s("b", startOfToday + 2)];
    const g = buildGroups(sessions, new Set(["a"]), now, groupOf({ a: "Work", b: "Work" }));
    expect(g[0].key).toBe("pinned");
    expect(g[0].items.map((i) => i.sessionId)).toEqual(["a"]);
    expect(g[1].label).toBe("Work");
    expect(g[1].items.map((i) => i.sessionId)).toEqual(["b"]);
  });

  it("sorts items within a custom group mtime desc", () => {
    const sessions = [s("a", startOfToday + 1), s("b", startOfToday + 3), s("c", startOfToday + 2)];
    const g = buildGroups(sessions, new Set<string>(), now, groupOf({ a: "W", b: "W", c: "W" }));
    expect(g[0].items.map((i) => i.sessionId)).toEqual(["b", "c", "a"]);
  });

  it("stays in date mode when no session has a group", () => {
    const sessions = [s("a", startOfToday + 5)];
    const g = buildGroups(sessions, new Set<string>(), now, groupOf({}));
    expect(g[0].key).toBe("today");
  });
});

describe("buildGroups archived", () => {
  it("moves archived sessions into a trailing Archived group, out of other groups", () => {
    const sessions = [s("a", startOfToday + 3), s("b", startOfToday + 2)];
    const g = buildGroups(sessions, new Set(["a"]), now, () => undefined, new Set(["a"]));
    expect(g.map((x) => x.key)).toEqual(["today", "archived"]);
    expect(g[0].items.map((i) => i.sessionId)).toEqual(["b"]);
    expect(g[1].items.map((i) => i.sessionId)).toEqual(["a"]);
  });
  it("omits the Archived group when nothing is archived", () => {
    const g = buildGroups([s("a", startOfToday + 1)], new Set<string>(), now);
    expect(g.some((x) => x.key === "archived")).toBe(false);
  });
});

describe("buildSections", () => {
  const open = (ids: string[]) => (id: string) => ids.includes(id);
  const groupOf = (map: Record<string, string>) => (id: string): string | undefined => map[id];

  it("splits each custom group into open items and closed ones", () => {
    const sessions = [s("a", startOfToday + 3), s("b", startOfToday + 2), s("c", startOfToday + 1)];
    const g = buildSections(sessions, new Set<string>(), open(["a"]), groupOf({ a: "Work", b: "Work", c: "Admin" }));
    expect(g.map((x) => x.key)).toEqual(["group:Admin", "group:Work"]);
    expect(g[0].items).toEqual([]);
    expect(g[0].closed?.map((i) => i.sessionId)).toEqual(["c"]);
    expect(g[1].items.map((i) => i.sessionId)).toEqual(["a"]);
    expect(g[1].closed?.map((i) => i.sessionId)).toEqual(["b"]);
  });

  it("puts open ungrouped sessions in Ungrouped and closed ones in History", () => {
    const sessions = [s("a", startOfToday + 2), s("b", startOfToday + 1)];
    const g = buildSections(sessions, new Set<string>(), open(["a"]));
    expect(g.map((x) => x.key)).toEqual(["ungrouped", "history"]);
    expect(g[0].items.map((i) => i.sessionId)).toEqual(["a"]);
    expect(g[1].items.map((i) => i.sessionId)).toEqual(["b"]);
  });

  it("keeps pinned first whether open or closed, and archived last", () => {
    const sessions = [s("a", startOfToday + 3), s("b", startOfToday + 2), s("c", startOfToday + 1)];
    const g = buildSections(sessions, new Set(["a"]), open([]), () => undefined, new Set(["c"]));
    expect(g.map((x) => x.key)).toEqual(["pinned", "history", "archived"]);
    expect(g[0].items.map((i) => i.sessionId)).toEqual(["a"]);
    expect(g[2].items.map((i) => i.sessionId)).toEqual(["c"]);
  });
});

describe("byDate", () => {
  it("buckets by date and omits empty buckets", () => {
    const g = byDate([s("old", startOfToday - 60 * DAY), s("today", startOfToday + 5)], now);
    expect(g.map((x) => x.key)).toEqual(["today", "older"]);
  });
});

describe("staleSessions", () => {
  it("returns sessions older than the window that are not open, pinned or archived", () => {
    const sessions = [
      s("fresh", now - 2 * DAY),
      s("stale", now - 20 * DAY),
      s("staleOpen", now - 20 * DAY),
      s("stalePinned", now - 20 * DAY),
      s("staleArchived", now - 20 * DAY),
    ];
    const out = staleSessions(sessions, 14, now, (id) => id === "staleOpen", new Set(["stalePinned"]), new Set(["staleArchived"]));
    expect(out.map((x) => x.sessionId)).toEqual(["stale"]);
  });
});
