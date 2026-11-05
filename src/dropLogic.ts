export type DropTarget =
  | { kind: "group"; key: string }
  | { kind: "session"; group: string | undefined }
  | undefined;

export type DropAction =
  | { type: "set"; group: string }
  | { type: "clear" }
  | { type: "ignore" };

const GROUP_PREFIX = "group:";
const CLOSED_PREFIX = "closed:";   // a custom group's "Closed" sub-section
const HISTORY_PREFIX = "history:"; // date buckets inside History

/** Decide what group change a drop onto `target` implies. */
export function resolveDropAction(target: DropTarget): DropAction {
  if (!target) return { type: "ignore" };
  if (target.kind === "group") {
    if (target.key === "ungrouped" || target.key === "history" || target.key.startsWith(HISTORY_PREFIX)) return { type: "clear" };
    if (target.key.startsWith(GROUP_PREFIX)) return { type: "set", group: target.key.slice(GROUP_PREFIX.length) };
    if (target.key.startsWith(CLOSED_PREFIX)) return { type: "set", group: target.key.slice(CLOSED_PREFIX.length) };
    return { type: "ignore" }; // pinned / date buckets are not custom groups
  }
  // dropped onto a session: adopt that session's group (or clear if it has none)
  return target.group ? { type: "set", group: target.group } : { type: "clear" };
}
