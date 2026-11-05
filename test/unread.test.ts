import { describe, it, expect } from "vitest";
import { finishedTurns, sessionForTabLabel } from "../src/unread";
import type { LiveStatus } from "../src/liveStatus";

const m = (o: Record<string, LiveStatus["state"]>) =>
  new Map(Object.entries(o).map(([k, state]) => [k, { state }] as [string, LiveStatus]));

describe("finishedTurns", () => {
  it("reports sessions that went from working to idle or waiting", () => {
    const prev = m({ a: "working", b: "working", c: "idle", d: "working" });
    const next = m({ a: "idle", b: "waiting", c: "idle", d: "working" });
    expect(finishedTurns(prev, next).sort()).toEqual(["a", "b"]);
  });
  it("ignores the first reading and sessions that just appeared", () => {
    expect(finishedTurns(undefined, m({ a: "idle" }))).toEqual([]);
    expect(finishedTurns(m({}), m({ a: "idle" }))).toEqual([]);
  });
});

describe("sessionForTabLabel", () => {
  const titles = [
    { sessionId: "1", title: "Fix the login" },
    { sessionId: "2", title: "Same name" },
    { sessionId: "3", title: "Same name" },
  ];
  it("matches a unique title", () => {
    expect(sessionForTabLabel(" Fix the login ", titles)).toBe("1");
  });
  it("matches titles cut short with an ellipsis", () => {
    const long = [{ sessionId: "9", title: "A rather long session title that got trunc…" }];
    expect(sessionForTabLabel("A rather long session title that got truncated here", long)).toBe("9");
  });
  it("gives up on ambiguous or empty labels", () => {
    expect(sessionForTabLabel("Same name", titles)).toBeUndefined();
    expect(sessionForTabLabel("", titles)).toBeUndefined();
  });
});
