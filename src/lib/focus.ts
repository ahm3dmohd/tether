import { parseClock } from './time';
import type { FocusSchedule, FocusState } from './types';

export type FocusReason = 'manual' | 'schedule';

export interface FocusStatus {
  active: boolean;
  reason: FocusReason | null;
  /** ms when the current focus ends, or null when inactive. */
  endsAt: number | null;
}

export function emptyFocusState(): FocusState {
  return { manualUntil: 0, scheduleSuppressedUntil: 0, wasActive: false };
}

/**
 * If `now` is inside the daily focus window, returns the window's [start, end)
 * in ms. Handles overnight windows (22:00-02:00). Returns null outside the
 * window, when the schedule is off, or when start equals end.
 */
export function scheduleWindowAt(schedule: FocusSchedule, now: number): { start: number; end: number } | null {
  if (!schedule.enabled) return null;
  const s = parseClock(schedule.start);
  const e = parseClock(schedule.end);
  if (s === null || e === null || s === e) return null;

  const d = new Date(now);
  const at = (dayOffset: number, minutes: number) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + dayOffset, Math.floor(minutes / 60), minutes % 60).getTime();

  // Check the window that starts today and the one that started yesterday
  // (only relevant for overnight windows).
  for (const offset of [0, -1]) {
    const start = at(offset, s);
    const end = e > s ? at(offset, e) : at(offset + 1, e);
    if (now >= start && now < end) return { start, end };
  }
  return null;
}

/** Works out whether focus is on right now, and why. */
export function computeFocus(schedule: FocusSchedule, state: FocusState, now: number): FocusStatus {
  const manual = state.manualUntil > now ? state.manualUntil : 0;
  const win = scheduleWindowAt(schedule, now);
  const scheduled = win && state.scheduleSuppressedUntil <= now ? win.end : 0;

  if (!manual && !scheduled) return { active: false, reason: null, endsAt: null };
  // When both apply, focus lasts until the later of the two.
  if (manual >= scheduled) return { active: true, reason: 'manual', endsAt: manual };
  return { active: true, reason: 'schedule', endsAt: scheduled };
}

/** Starts (or extends) a manual session. Never shortens one already running. */
export function startManualFocus(state: FocusState, minutes: number, now: number): FocusState {
  return { ...state, manualUntil: Math.max(state.manualUntil, now + minutes * 60_000) };
}

/**
 * Ends focus early: cancels any manual session and switches the scheduled
 * window off until it would have ended anyway.
 */
export function endFocusEarly(schedule: FocusSchedule, state: FocusState, now: number): FocusState {
  const win = scheduleWindowAt(schedule, now);
  return {
    ...state,
    manualUntil: 0,
    scheduleSuppressedUntil: win ? Math.max(state.scheduleSuppressedUntil, win.end) : state.scheduleSuppressedUntil,
  };
}
