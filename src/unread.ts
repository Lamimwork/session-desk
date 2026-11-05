import type { LiveStatus } from "./liveStatus";

/**
 * Sessions that just finished a turn: they were working and are now idle or
 * waiting for the user. These are the replies the user may not have read yet.
 */
export function finishedTurns(
  prev: Map<string, LiveStatus> | undefined,
  next: Map<string, LiveStatus> | undefined,
): string[] {
  if (!prev || !next) return [];
  const out: string[] = [];
  for (const [id, now] of next) {
    if (prev.get(id)?.state === "working" && now.state !== "working") out.push(id);
  }
  return out;
}

const strip = (t: string) => t.trim().replace(/(…|\.\.\.)$/, "").trim();

/** Same title, allowing either side to be cut short with an ellipsis. */
function sameTitle(label: string, title: string): boolean {
  const a = strip(label), b = strip(title);
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.length >= 20 && long.startsWith(short);
}

/** Find the session whose title matches a Claude editor tab's label (only if exactly one does). */
export function sessionForTabLabel(
  label: string,
  titles: { sessionId: string; title: string }[],
): string | undefined {
  const hits = titles.filter((t) => sameTitle(label, t.title));
  return hits.length === 1 ? hits[0].sessionId : undefined;
}
