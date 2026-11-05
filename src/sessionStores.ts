import type { MementoLike } from "./types";
import { KeyedStore } from "./keyedStore";
import { SetStore } from "./setStore";
import { NameStore } from "./nameStore";
import { PinStore } from "./pinStore";

export class EmojiStore extends KeyedStore {
  constructor(memento: MementoLike) { super(memento, "sessionEmojis"); }
}
export class ColorStore extends KeyedStore {
  constructor(memento: MementoLike) { super(memento, "sessionColors"); }
}
export class GroupStore extends KeyedStore {
  constructor(memento: MementoLike) { super(memento, "sessionGroups"); }
}
export class ArchiveStore extends SetStore {
  constructor(memento: MementoLike) { super(memento, "archivedSessions"); }
}
/** Sessions that finished a reply the user has not opened yet. */
export class UnreadStore extends SetStore {
  constructor(memento: MementoLike) { super(memento, "unreadSessions"); }
}
/** Per-group look, keyed by group name. */
export class GroupEmojiStore extends KeyedStore {
  constructor(memento: MementoLike) { super(memento, "groupEmojis"); }
}
export class GroupColorStore extends KeyedStore {
  constructor(memento: MementoLike) { super(memento, "groupColors"); }
}

/** All per-session stores, passed together to the tree and commands. */
export interface SessionStores {
  pins: PinStore;
  names: NameStore;
  emojis: EmojiStore;
  colors: ColorStore;
  groups: GroupStore;
  archive: ArchiveStore;
  unread: UnreadStore;
  groupEmojis: GroupEmojiStore;
  groupColors: GroupColorStore;
}
