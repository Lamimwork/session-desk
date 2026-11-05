import type { SessionMeta } from "./types";
import type { NameStore } from "./nameStore";
import type { SessionStores } from "./sessionStores";

/** The name shown for a session: custom name, else auto title, else its id. */
export function displayName(meta: SessionMeta, names: NameStore): string {
  return names.get(meta.sessionId) || meta.title || meta.sessionId;
}

/** Full tree label: `[colorDot][emoji] name`. */
export function sessionLabel(meta: SessionMeta, stores: SessionStores): string {
  const name = displayName(meta, stores.names);
  const prefix = [stores.colors.get(meta.sessionId), stores.emojis.get(meta.sessionId)].filter(Boolean).join("");
  return prefix ? `${prefix} ${name}` : name;
}

/** Custom group header label: `[emoji] name`. */
export function groupLabel(name: string, stores: SessionStores): string {
  const emoji = stores.groupEmojis.get(name);
  return emoji ? `${emoji} ${name}` : name;
}
