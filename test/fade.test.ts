import { describe, it, expect } from "vitest";
import { isFaded } from "../src/fade";
import type { LiveStatus } from "../src/liveStatus";

const MIN = 60_000;
const now = 100 * MIN;
const live = new Map<string, LiveStatus>([
  ["working", { state: "working", since: 0 }],
  ["waiting", { state: "waiting", since: 0 }],
  ["idleOld", { state: "idle", since: now - 15 * MIN }],
  ["idleNew", { state: "idle", since: now - 2 * MIN }],
  ["idleNoTime", { state: "idle" }],
]);

describe("isFaded", () => {
  it("fades closed sessions and long-idle ones", () => {
    expect(isFaded("closed", live, false, now, 10 * MIN)).toBe(true);
    expect(isFaded("idleOld", live, false, now, 10 * MIN)).toBe(true);
  });
  it("keeps active, recently idle and undated sessions", () => {
    for (const id of ["working", "waiting", "idleNew", "idleNoTime"]) {
      expect(isFaded(id, live, false, now, 10 * MIN)).toBe(false);
    }
  });
  it("never fades unread or pinned sessions (keepBright), nor anything without the registry", () => {
    expect(isFaded("closed", live, true, now, 10 * MIN)).toBe(false);
    expect(isFaded("idleOld", live, true, now, 10 * MIN)).toBe(false);
    expect(isFaded("closed", undefined, false, now, 10 * MIN)).toBe(false);
  });
  it("idle fading can be turned off with 0", () => {
    expect(isFaded("idleOld", live, false, now, 0)).toBe(false);
    expect(isFaded("closed", live, false, now, 0)).toBe(true);
  });
});
