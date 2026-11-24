/**
 * Fixed values from the design spec. The ones the owner may want to tune
 * after real use (nudge interval, badge threshold, focus hours, site list)
 * live in Settings instead, so they can be edited from the dashboard.
 */

/** Sites treated as distracting out of the box. Editable on the dashboard. */
export const DEFAULT_SITES: readonly string[] = [
  'youtube.com',
  'instagram.com',
  'tiktok.com',
  'x.com',
  'twitter.com',
  'reddit.com',
  'facebook.com',
];

/** The sentence a user must type, exactly, to bypass a block or end focus early. */
export const BYPASS_SENTENCE = 'I am choosing to waste this time';

/** Seconds the user must wait after typing the sentence. */
export const BYPASS_WAIT_SECONDS = 30;

/** How long a bypass unlocks one site for. */
export const BYPASS_MINUTES = 5;

/** Manual focus session lengths offered in the popup, in minutes. */
export const FOCUS_SESSION_OPTIONS = [60, 120, 240] as const;

/** Seconds without input before Chrome reports the user as idle. */
export const IDLE_SECONDS = 60;

/** Daily data older than this is deleted. */
export const RETENTION_DAYS = 90;

/**
 * Upper bound on the time credited for a single tracking segment.
 *
 * The worker commits the open segment on every 1-minute tick, so a segment is
 * normally ~60 s long. A much longer one means ticks were missed (laptop
 * asleep, browser frozen), and we can't know what happened in that gap, so we
 * credit at most this much instead of hours of phantom time.
 */
export const MAX_SEGMENT_SECONDS = 120;

/**
 * A run of time on one distracting site stays "continuous" across breaks
 * (idle, a quick look at another window) shorter than this.
 */
export const STREAK_GAP_SECONDS = 5 * 60;

/** A nudge that got no answer for this long (tab reloaded, overlay lost) is shown again. */
export const NUDGE_RESHOW_SECONDS = 2 * 60;

/** Name of the 1-minute alarm that flushes time, updates the badge and checks nudges. */
export const TICK_ALARM = 'tether:tick';

/** Prefix for per-site alarms that end a bypass. */
export const BYPASS_ALARM_PREFIX = 'tether:bypass:';
