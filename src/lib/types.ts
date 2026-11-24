/** Shapes of everything Tether keeps in chrome.storage. */

export interface FocusSchedule {
  /** When false, focus only happens through manual sessions. */
  enabled: boolean;
  /** Local time `HH:MM` the daily focus window starts. */
  start: string;
  /** Local time `HH:MM` it ends. May be earlier than `start` for an overnight window. */
  end: string;
}

export interface Settings {
  /** Distracting sites. Subdomains match. */
  sites: string[];
  /** Continuous minutes on a distracting site before the nudge overlay appears. */
  nudgeMinutes: number;
  /** Daily minutes on a distracting site after which the badge turns red. */
  badgeThresholdMinutes: number;
  focusSchedule: FocusSchedule;
}

/** Seconds per host for one day. Hosts are normalized (no `www.`). */
export type DayTotals = Record<string, number>;

/** Seconds per host per local day (`YYYY-MM-DD`). */
export type DailyData = Record<string, DayTotals>;

export type EventType =
  | 'nudge_shown'
  | 'nudge_ignored'
  | 'nudge_left'
  | 'bypass'
  | 'focus_started'
  | 'focus_ended'
  | 'focus_ended_early';

export interface TetherEvent {
  /** ms since epoch */
  t: number;
  type: EventType;
  site?: string;
  /** Free text, e.g. `manual 60m` or `schedule`. */
  detail?: string;
}

/** Persistent focus state. The active/inactive answer is computed from it plus the schedule. */
export interface FocusState {
  /** A manual session runs until this time (ms). 0 when none. */
  manualUntil: number;
  /** The scheduled window is switched off until this time (ms) because the user ended it early. */
  scheduleSuppressedUntil: number;
  /** Whether focus was active at the last evaluation, to detect transitions. */
  wasActive: boolean;
}

/** Bypass expiry (ms) per site. */
export type Bypasses = Record<string, number>;

/** The open stretch of time being tracked right now. Lives in storage.session. */
export interface Segment {
  host: string;
  /** ms since epoch the segment started (or was last flushed). */
  since: number;
}

/** Continuous time on one distracting site, used for the nudge. Lives in storage.session. */
export interface Streak {
  site: string;
  /** Counted seconds on the site in this run. */
  seconds: number;
  /** ms of the last time any seconds were added. */
  lastAt: number;
  /** Nudge when `seconds` reaches this. */
  nextNudgeAt: number;
  /** ms the current nudge was shown, or 0 when none is waiting for an answer. */
  nudgeShownAt: number;
}
