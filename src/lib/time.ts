/** Local-day helpers. Everything is in the browser's local time zone. */

/** `YYYY-MM-DD` for the local day containing `ts` (ms since epoch). */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Timestamp of the next local midnight strictly after `ts`. DST-safe. */
export function nextMidnight(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

/**
 * Splits the interval [start, end) at local midnights and returns the seconds
 * that fall on each day. Used so a session from 23:50 to 00:10 counts 10
 * minutes on each day.
 */
export function splitByDay(start: number, end: number): Array<{ day: string; seconds: number }> {
  const out: Array<{ day: string; seconds: number }> = [];
  let cur = start;
  while (cur < end) {
    const boundary = Math.min(nextMidnight(cur), end);
    const seconds = (boundary - cur) / 1000;
    if (seconds > 0) out.push({ day: dayKey(cur), seconds });
    cur = boundary;
  }
  return out;
}

/** The last `n` local days ending with the day of `now`, oldest first. */
export function lastNDays(n: number, now: number): string[] {
  const d = new Date(now);
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i, 12).getTime()));
  }
  return days;
}

/** Formats seconds as `0m`, `23m`, `1h 05m`. */
export function formatDuration(seconds: number): string {
  const totalMin = Math.floor(Math.max(0, seconds) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/**
 * Formats seconds for the toolbar badge, which fits about four characters:
 * `0m`, `23m`, `59m`, `1h05`, `12h`.
 */
export function formatBadge(seconds: number): string {
  const totalMin = Math.floor(Math.max(0, seconds) / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h >= 10 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/** Parses `HH:MM` into minutes after midnight. Returns null if invalid. */
export function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}
