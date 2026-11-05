import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SessionMeta } from "./types";

const SYSTEM_PREFIXES = ["<ide_opened_file>", "<ide_selection>", "<system-reminder>", "<command-name>", "<command-message>", "<local-command-stdout>", "<local-command-caveat>", "<browser_instruction>"];
const MAX_TITLE = 60;

function truncate(text: string): string {
  return text.length > MAX_TITLE ? text.slice(0, MAX_TITLE - 1) + "…" : text;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c && typeof c === "object" && (c as { type?: string }).type === "text")
      .map((c) => (c as { text?: string }).text ?? "")
      .join(" ");
  }
  return "";
}

function isSystemInjected(text: string): boolean {
  return SYSTEM_PREFIXES.some((p) => text.startsWith(p));
}

/**
 * Session title as Claude Code shows it: the latest name set by the user
 * (`custom-title`), else the latest auto-generated one (`ai-title`), else the
 * first human-typed prompt. Returns "" if none.
 */
export function titleOf(jsonlText: string): string {
  let customTitle = "";
  let aiTitle = "";
  let firstPrompt = "";
  for (const line of jsonlText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: any;
    try { obj = JSON.parse(trimmed); } catch { continue; }
    if (obj?.type === "custom-title" && typeof obj.customTitle === "string" && obj.customTitle.trim()) {
      customTitle = obj.customTitle.trim();
      continue;
    }
    if (obj?.type === "ai-title" && typeof obj.aiTitle === "string" && obj.aiTitle.trim()) {
      aiTitle = obj.aiTitle.trim();
      continue;
    }
    if (firstPrompt || obj?.type !== "user" || obj?.message?.role !== "user") continue;
    const text = extractText(obj.message.content).replace(/\s+/g, " ").trim();
    if (!text || isSystemInjected(text)) continue;
    firstPrompt = text;
  }
  return truncate(customTitle || aiTitle || firstPrompt);
}

function fallbackTitle(sessionId: string): string {
  return `Session ${sessionId.slice(0, 8)}`;
}

/**
 * List the sessions in a ~/.claude/projects/<encoded> directory, mtime desc,
 * without reading the transcripts: `title` is left empty. Use TitleCache to fill it.
 */
export async function listSessions(projectsDir: string): Promise<SessionMeta[]> {
  let entries: string[];
  try { entries = await fs.readdir(projectsDir); }
  catch { return []; }

  const out: SessionMeta[] = [];
  for (const name of entries) {
    if (!name.endsWith(".jsonl")) continue;
    const sessionId = name.slice(0, -".jsonl".length);
    const full = path.join(projectsDir, name);
    try {
      const stat = await fs.stat(full);
      out.push({ sessionId, mtimeMs: stat.mtimeMs, title: "", filePath: full });
    } catch { /* skip unreadable file */ }
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}

/** Reads titles on demand and keeps them until the transcript changes. */
export class TitleCache {
  private readonly cache = new Map<string, { mtimeMs: number; title: string }>();

  async fill(sessions: SessionMeta[]): Promise<SessionMeta[]> {
    return Promise.all(sessions.map(async (s) => {
      const hit = this.cache.get(s.filePath);
      if (hit && hit.mtimeMs === s.mtimeMs) return { ...s, title: hit.title };
      let title: string;
      try { title = titleOf(await fs.readFile(s.filePath, "utf8")) || fallbackTitle(s.sessionId); }
      catch { title = fallbackTitle(s.sessionId); }
      this.cache.set(s.filePath, { mtimeMs: s.mtimeMs, title });
      return { ...s, title };
    }));
  }
}

/** Scan a ~/.claude/projects/<encoded> directory into session metadata with titles, mtime desc. */
export async function scanSessions(projectsDir: string): Promise<SessionMeta[]> {
  return new TitleCache().fill(await listSessions(projectsDir));
}
