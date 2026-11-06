# Session Desk for Claude Code

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A desk for your Claude Code sessions in VS Code: see which ones are working, which need you and which have an unread reply, and keep them in groups with their own color and emoji.

> **Unofficial add-on**, not affiliated with Anthropic. It runs alongside the official Claude Code extension and never modifies its files.

![Sessions sidebar](media/screenshots/sessions.png)

## Features

- 🏷️ **Real names**: each session shows the title Claude Code gave it (or the one you set).
- 🟢 **Live status**: working / needs you / idle, from Claude Code's live registry; the status bar counts them across all windows.
- 🔵 **Unread replies**: a session that finished while you weren't looking gets a blue dot until you open it.
- 📂 **Open and closed apart**: each group lists its open sessions, with the closed ones in a collapsed "Closed" section.
- 🌫️ **Fade**: closed sessions and sessions idle for a while are drawn faded, so the ones in use stand out.
- 📁 **Groups** with emoji and color; drag a session onto a group to move it.
- 📌 **Pin**, ✏️ **rename**, 🎨 **color**, 😀 **emoji**, 🔍 **search**, 🗑️ **delete** (to the trash), 📋 **copy** ID / transcript path.
- 🗄️ **Archive** sessions, or archive everything older than a date in one go.

## Requirements

The official **Claude Code** extension (`anthropic.claude-code`) must be installed and enabled; Session Desk reuses its "open session" command.

## Install

Not on the Marketplace. Build and install the `.vsix`:

```
npm install
npx @vscode/vsce package
code --install-extension session-desk-1.0.0.vsix
```

## Coming from Claude Session Organizer

Session Desk has a new extension ID, so VS Code gives it empty storage. To bring over your pins, names, groups and colors, put the old extension's state (the JSON stored in VS Code's `state.vscdb` under `sssooonnnggg.claude-session-organizer`) in `import.json` inside Session Desk's global storage folder (`.../globalStorage/lamimwork.session-desk/`). It is imported on the next start and renamed to `imported.json`. Settings moved from `claudeSessionOrganizer.*` to `sessionDesk.*`.

## How it works

It reads Claude Code's local transcripts from `~/.claude/projects/<encoded-workspace>/*.jsonl` and the live registry in `~/.claude/sessions` (read-only). Your pins, names, colors, emojis and groups are stored in this extension's own VS Code storage.

## Privacy

Everything stays on your machine: it only reads local files under `~/.claude`, stores its settings locally and makes **no network requests**.

## Credits

Session Desk started as a fork of [Claude Session Organizer](https://github.com/sssooonnnggg/claude-session-organizer) by sssooonnnggg (MIT), up to its version 0.7.6. Live status, real names, unread replies, open/closed split, fading, group colors and the rest since then are Session Desk's own.

## License

[MIT](LICENSE)
