# Changelog

## Unreleased

- **Hide Closed Sessions** / **Show Closed Sessions** in the view's "…" menu (setting `sessionDesk.showClosed`): hides the "Closed" sub-section inside each group. Closed sessions stay in Search and History.
- More colors: groups gain Pink, Magenta, Teal, Cyan, Lime, Gold, Brown, Indigo and Gray (contributed theme colors, overridable by themes); sessions gain Black, White, Pink, Light Blue and Gray markers.
- Pinned sessions are never faded, whether idle or closed.
- Set Group: typing a new name in the group list now offers "Create group …" (before, Enter closed the list and nothing happened, or picked a near-matching group). The new-group name box no longer closes when focus moves away.

## 1.0.0

- Now **Session Desk for Claude Code**, an independent project (publisher `lamimwork`, ID `lamimwork.session-desk`). Commands, view and settings moved from `claudeSessionOrganizer.*` to `sessionDesk.*`.
- One-time import of the old extension's pins, names, groups and colors from `import.json` in the global storage folder (see README).
- 0.7.6 and earlier are the original Claude Session Organizer; 0.7.7 to 0.7.11 were this fork's builds under the old name.

## 0.7.11

- Fix: group names and the "Closed" sections no longer flash without their color or fade for an instant. The extension used to tell VS Code that every decoration had changed on each refresh (every message written by any session); now it only re-sends the ones that really changed.

## 0.7.10

- Faded rows: closed sessions, and sessions idle for more than 10 minutes, have their name drawn in the theme's disabled color, so the sessions really in use stand out. The delay is the setting `claudeSessionOrganizer.fadeIdleAfterMinutes` (0 = don't fade idle sessions). A session with an unread reply is never faded. A group's "Closed" sub-section header is faded too.

## 0.7.9

- Unread replies: when a session finishes working and you are not looking at it, it gets a blue dot, its group header shows "N unread", and the status bar counts them. Opening the session (from the list or by switching to its editor tab) clears it; there is also "Mark as Read" on a session and "Mark All as Read" in the view menu.
- Group look: right-click a custom group → "Set Group Emoji" or "Set Group Color" (colors the folder icon and the name, following the theme). Font, size and background can't be changed by extensions.
- "Hide Group Counts" / "Show Group Counts" in the view menu (setting `claudeSessionOrganizer.showGroupCounts`): hides the "(5)" and "2 open · 7 closed" next to group names. Unread counts stay.

## 0.7.8

- Split open and closed sessions, using Claude Code's live registry: each custom group lists its open sessions, with the closed ones in a collapsed "Closed" sub-section; open sessions without a group go to "Ungrouped", closed ones to a collapsed "History" (by date). Pinned and Archived are unchanged. Without the registry, the previous layout is kept.
- Load much less: the list is built from file dates only, and titles are read when a section is expanded, then cached until the transcript changes. Refreshes triggered by transcript writes are batched.
- New "Archive Old Sessions…" button: archive sessions not used for more than 7, 14, 30, 60 or a custom number of days, after a confirmation with the count. Open and pinned sessions are never archived, and archived sessions keep their group.

## 0.7.7

- Show the session's real name: the one set by the user (`custom-title`), else Claude Code's auto title (`ai-title`), else the first prompt. Also skip the `<local-command-caveat>` and `<browser_instruction>` blocks the VS Code extension injects, which were showing up as titles.
- Show live state per session (working / needs you / idle), read from the registry Claude Code keeps in `~/.claude/sessions`, plus a status-bar count of sessions working or waiting for you.

## 0.7.6

- Remove the list ↔ editor-tab selection sync entirely (it kept fighting with clicking to open). Clicking a session just opens it now; the list selection is left to VS Code's native behavior, so it no longer jumps to a different session.

## 0.7.5

- Fix: clicking a session in the list no longer has its selection stolen by another. The active-tab→list sync (added in 0.7.3) fought with clicking to open — when opening a session didn't focus its editor tab, the list jumped to whatever tab was active. Removed it; opening or searching a session still reveals and selects it.

## 0.7.4

- Fix: clicking a session in the list could select a different one. The list↔active-tab sync now follows the globally active tab (debounced) instead of misfiring on per-group active state.

## 0.7.3

- Opening or switching to a session now reveals it in the list: its group expands and the row is selected.

## 0.7.2

- Add a New Session (➕) button in the view title to start a fresh Claude Code session.

## 0.7.1

- Fix: expanded groups no longer collapse when the list refreshes (e.g. while a session is being written). Each group's expand/collapse state is now preserved across refreshes.

## 0.7.0

- Archive sessions: right-click → Archive moves a session into a collapsed "Archived" group at the bottom (keeping its pin, group, color, and emoji); Unarchive restores it.

## 0.6.3

- Drag sessions onto a group (or Ungrouped) to organize them.
- Show the session count in each group header.

## 0.6.2

- Expand the Pinned and Today groups by default; collapse the others.
- Add a 📌 to the view title.

## 0.6.1

- Renamed to **Claude Session Organizer** (formerly "Toolkit for Claude Code") to better reflect its focus on organizing sessions.

## 0.6.0

- Pin sync: pinning a session's editor tab now also pins it in the list (one-way; unpinning the tab does nothing). Works for sessions opened from the Toolkit list.

## 0.5.2

- Rewrite the README and add a screenshot of the session sidebar.

## 0.5.1

- Unify the pin icon across the activity bar, the session list, and the Marketplace icon (now the native VS Code pushpin).

## 0.5.0

- Set a **color dot** and an **emoji** per session, shown at the start of its label.
- Organize sessions into **custom groups** — when any group is used, the list groups by your groups (Pinned → groups → Ungrouped) instead of by date.

## 0.4.0

- Search sessions by name (search icon in the view title, or "Search Sessions" in the command palette).
- Rename and delete are now inline hover buttons on each session row.

## 0.3.0

- Rename sessions with custom names (right-click → Rename; empty resets to auto title).
- Group sessions by date: Pinned, Today, Yesterday, Previous 7 Days, Previous 30 Days, Older.
- Delete a session (moved to the OS trash, with confirmation).
- Copy a session's ID or transcript path.

## 0.1.1

- Add a Marketplace icon.
- Add a Simplified Chinese README with a language switcher.

## 0.1.0

- Initial release.
- 📌 Session pinning: a sidebar view listing the current workspace's Claude Code
  sessions, with a **Pinned** group that keeps important sessions on top.
- Click a session to open it via the official Claude Code extension.
- Auto-refresh on session changes, plus a manual refresh button.
