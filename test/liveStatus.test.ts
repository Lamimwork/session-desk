import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseRegistryEntry, readLiveStatuses, statusKey } from "../src/liveStatus";

describe("parseRegistryEntry", () => {
  it("maps Claude Code statuses to live states", () => {
    expect(parseRegistryEntry(JSON.stringify({ sessionId: "a", status: "busy" }))?.status).toEqual({ state: "working" });
    expect(parseRegistryEntry(JSON.stringify({ sessionId: "a", status: "idle" }))?.status).toEqual({ state: "idle" });
    expect(parseRegistryEntry(JSON.stringify({ sessionId: "a", status: "waiting", waitingFor: "permission" }))?.status)
      .toEqual({ state: "waiting", waitingFor: "permission" });
  });
  it("rejects malformed entries and unknown statuses", () => {
    expect(parseRegistryEntry("{not json")).toBeUndefined();
    expect(parseRegistryEntry(JSON.stringify({ status: "busy" }))).toBeUndefined();
    expect(parseRegistryEntry(JSON.stringify({ sessionId: "a", status: "something-new" }))).toBeUndefined();
  });
});

describe("readLiveStatuses", () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "csl-")); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it("returns undefined when there is no registry", async () => {
    expect(await readLiveStatuses(path.join(dir, "nope"))).toBeUndefined();
  });

  it("keeps entries of running processes and drops dead ones", async () => {
    fs.writeFileSync(path.join(dir, "1.json"), JSON.stringify({ pid: process.pid, sessionId: "alive", status: "busy" }));
    fs.writeFileSync(path.join(dir, "2.json"), JSON.stringify({ pid: 2 ** 30, sessionId: "dead", status: "idle" }));
    fs.writeFileSync(path.join(dir, "3.key"), "ignored");
    const out = await readLiveStatuses(dir);
    expect([...out!.keys()]).toEqual(["alive"]);
    expect(out!.get("alive")).toEqual({ state: "working" });
  });
});

describe("statusKey", () => {
  it("is independent of insertion order", () => {
    const a = new Map([["x", { state: "idle" as const }], ["y", { state: "working" as const }]]);
    const b = new Map([["y", { state: "working" as const }], ["x", { state: "idle" as const }]]);
    expect(statusKey(a)).toBe(statusKey(b));
  });
});
