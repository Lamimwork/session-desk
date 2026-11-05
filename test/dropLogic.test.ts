import { describe, it, expect } from "vitest";
import { resolveDropAction } from "../src/dropLogic";

describe("resolveDropAction", () => {
  it("ignores when there is no target", () => {
    expect(resolveDropAction(undefined)).toEqual({ type: "ignore" });
  });
  it("sets the group when dropped on a custom group header", () => {
    expect(resolveDropAction({ kind: "group", key: "group:Backend" })).toEqual({ type: "set", group: "Backend" });
  });
  it("clears when dropped on the Ungrouped header", () => {
    expect(resolveDropAction({ kind: "group", key: "ungrouped" })).toEqual({ type: "clear" });
  });
  it("sets the group when dropped on a group's Closed sub-section", () => {
    expect(resolveDropAction({ kind: "group", key: "closed:Backend" })).toEqual({ type: "set", group: "Backend" });
  });
  it("clears when dropped on History or one of its date buckets", () => {
    expect(resolveDropAction({ kind: "group", key: "history" })).toEqual({ type: "clear" });
    expect(resolveDropAction({ kind: "group", key: "history:today" })).toEqual({ type: "clear" });
  });
  it("ignores drops on pinned / date headers", () => {
    expect(resolveDropAction({ kind: "group", key: "pinned" })).toEqual({ type: "ignore" });
    expect(resolveDropAction({ kind: "group", key: "today" })).toEqual({ type: "ignore" });
    expect(resolveDropAction({ kind: "group", key: "prev7" })).toEqual({ type: "ignore" });
  });
  it("adopts the target session's group", () => {
    expect(resolveDropAction({ kind: "session", group: "Frontend" })).toEqual({ type: "set", group: "Frontend" });
  });
  it("clears when dropped on an ungrouped session", () => {
    expect(resolveDropAction({ kind: "session", group: undefined })).toEqual({ type: "clear" });
  });
});
