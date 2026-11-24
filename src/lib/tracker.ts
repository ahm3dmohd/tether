/**
 * Time accounting, as pure functions.
 *
 * The background worker describes the browser's current state as a `Context`,
 * then calls `advance()` on every event (tab switch, URL change, window focus,
 * idle change, 1-minute tick). `advance()` closes the open segment, says how
 * many seconds to credit to which host on which day, and opens a new segment
 * if the current page should be counted.
 */
import { MAX_SEGMENT_SECONDS, NUDGE_RESHOW_SECONDS, STREAK_GAP_SECONDS } from './constants';
import { hostFromUrl, matchSite } from './domains';
import { splitByDay } from './time';
import type { DailyData, Segment, Streak } from './types';

export type IdleState = 'active' | 'idle' | 'locked';

export interface Context {
  /** A normal browser window has OS focus. */
  windowFocused: boolean;
  /** URL of the active tab in that window. */
  url: string | null | undefined;
  incognito: boolean;
  /** The active tab is playing sound. */
  audible: boolean;
  idleState: IdleState;
}

export interface Credit {
  day: string;
  host: string;
  seconds: number;
}

export interface ClosedSegment {
  host: string;
  start: number;
  /** Capped end: never more than MAX_SEGMENT_SECONDS after start. */
  end: number;
}

/**
 * The host whose clock should be running, or null if nothing counts right now.
 *
 * Counting stops when the browser loses focus, the screen is locked, or the
 * user has been idle for 60 s. Idle does not stop the clock while the tab is
 * playing audio, so watching a video hands-off still counts.
 */
export function trackedHost(ctx: Context): string | null {
  if (!ctx.windowFocused || ctx.incognito) return null;
  if (ctx.idleState === 'locked') return null;
  if (ctx.idleState === 'idle' && !ctx.audible) return null;
  return hostFromUrl(ctx.url);
}

/** Ends a segment at `now`, applying the safety cap. Returns null for an empty or backwards segment. */
export function closeSegment(segment: Segment | null, now: number): ClosedSegment | null {
  if (!segment) return null;
  if (now <= segment.since) return null; // clock went backwards or zero length
  const end = Math.min(now, segment.since + MAX_SEGMENT_SECONDS * 1000);
  return { host: segment.host, start: segment.since, end };
}

/** Converts a closed segment to per-day credits, split at local midnight. */
export function creditsFor(closed: ClosedSegment | null): Credit[] {
  if (!closed) return [];
  return splitByDay(closed.start, closed.end).map(({ day, seconds }) => ({ day, host: closed.host, seconds }));
}

export interface AdvanceResult {
  closed: ClosedSegment | null;
  credits: Credit[];
  segment: Segment | null;
}

/** Closes the open segment and opens the next one for the given context. */
export function advance(segment: Segment | null, ctx: Context, now: number): AdvanceResult {
  const closed = closeSegment(segment, now);
  const host = trackedHost(ctx);
  return {
    closed,
    credits: creditsFor(closed),
    segment: host ? { host, since: now } : null,
  };
}

/** Adds credits to the daily totals. Returns a new object; the input is not modified. */
export function applyCredits(daily: DailyData, credits: Credit[]): DailyData {
  if (credits.length === 0) return daily;
  const out: DailyData = { ...daily };
  for (const c of credits) {
    const day = { ...(out[c.day] ?? {}) };
    day[c.host] = Math.round(((day[c.host] ?? 0) + c.seconds) * 1000) / 1000;
    out[c.day] = day;
  }
  return out;
}

/**
 * Updates the run of continuous time on one distracting site.
 *
 * - Time on a non-distracting host ends the run.
 * - A break shorter than STREAK_GAP_SECONDS (idle, another app) does not.
 * - Time on a different distracting site starts a new run.
 */
export function updateStreak(
  streak: Streak | null,
  closed: ClosedSegment | null,
  sites: readonly string[],
  nudgeSeconds: number,
): Streak | null {
  if (!closed) return streak;
  const site = matchSite(closed.host, sites);
  if (!site) return null;
  const seconds = (closed.end - closed.start) / 1000;
  if (streak && streak.site === site && closed.start - streak.lastAt <= STREAK_GAP_SECONDS * 1000) {
    return { ...streak, seconds: streak.seconds + seconds, lastAt: closed.end };
  }
  return { site, seconds, lastAt: closed.end, nextNudgeAt: nudgeSeconds, nudgeShownAt: 0 };
}

/** True when the nudge overlay should be shown on the current page now. */
export function shouldNudge(streak: Streak | null, currentSite: string | null, now: number): boolean {
  if (!streak || !currentSite || streak.site !== currentSite) return false;
  if (streak.seconds < streak.nextNudgeAt) return false;
  return streak.nudgeShownAt === 0 || now - streak.nudgeShownAt >= NUDGE_RESHOW_SECONDS * 1000;
}

/** After "Keep going": re-arm for another full nudge interval. */
export function rearmNudge(streak: Streak, nudgeSeconds: number): Streak {
  return { ...streak, nextNudgeAt: streak.seconds + nudgeSeconds, nudgeShownAt: 0 };
}
