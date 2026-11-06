import type { LiveStatus } from "./liveStatus";

/**
 * Whether a session's row should be drawn faded, so the ones really in use
 * stand out: closed sessions (not in the live registry) and sessions idle for
 * at least `idleMs`. `keepBright` (unread replies, pinned sessions) is never
 * faded. Without the registry, open and closed can't be told apart, so nothing
 * is faded. `idleMs <= 0` turns off fading of idle sessions.
 */
export function isFaded(
  sessionId: string,
  live: Map<string, LiveStatus> | undefined,
  keepBright: boolean,
  nowMs: number,
  idleMs: number,
): boolean {
  if (!live || keepBright) return false;
  const s = live.get(sessionId);
  if (!s) return true;
  if (s.state !== "idle" || idleMs <= 0 || s.since === undefined) return false;
  return nowMs - s.since >= idleMs;
}
