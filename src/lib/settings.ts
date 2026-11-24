import { DEFAULT_SITES } from './constants';
import { normalizeHost, parseSiteInput } from './domains';
import { parseClock } from './time';
import type { Settings } from './types';

export function defaultSettings(): Settings {
  return {
    sites: [...DEFAULT_SITES],
    nudgeMinutes: 15,
    badgeThresholdMinutes: 30,
    focusSchedule: { enabled: true, start: '06:00', end: '18:00' },
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Fills gaps and fixes bad values in stored or user-submitted settings, so
 * the rest of the code can trust them.
 */
export function sanitizeSettings(input: Partial<Settings> | undefined | null): Settings {
  const d = defaultSettings();
  if (!input) return d;
  const sites = Array.isArray(input.sites)
    ? [...new Set(input.sites.map((s) => parseSiteInput(String(s)) ?? '').filter(Boolean).map(normalizeHost))]
    : d.sites;
  const fs = input.focusSchedule ?? d.focusSchedule;
  return {
    sites,
    nudgeMinutes: clampInt(input.nudgeMinutes, 1, 240, d.nudgeMinutes),
    badgeThresholdMinutes: clampInt(input.badgeThresholdMinutes, 1, 24 * 60, d.badgeThresholdMinutes),
    focusSchedule: {
      enabled: typeof fs.enabled === 'boolean' ? fs.enabled : d.focusSchedule.enabled,
      start: parseClock(String(fs.start)) !== null ? String(fs.start).padStart(5, '0') : d.focusSchedule.start,
      end: parseClock(String(fs.end)) !== null ? String(fs.end).padStart(5, '0') : d.focusSchedule.end,
    },
  };
}

/**
 * While focus is on, settings must not become an easy off switch. Adding sites
 * and tuning the nudge/badge numbers is fine; removing a site or touching the
 * focus schedule waits until focus ends.
 */
export function checkSettingsChange(
  current: Settings,
  next: Settings,
  focusActive: boolean,
): { ok: true } | { ok: false; reason: string } {
  if (!focusActive) return { ok: true };
  const removed = current.sites.filter((s) => !next.sites.includes(s));
  if (removed.length > 0) {
    return { ok: false, reason: `Can't remove ${removed.join(', ')} during focus. Try again after focus ends.` };
  }
  const a = current.focusSchedule;
  const b = next.focusSchedule;
  if (a.enabled !== b.enabled || a.start !== b.start || a.end !== b.end) {
    return { ok: false, reason: "Focus hours can't be changed during focus. Try again after focus ends." };
  }
  return { ok: true };
}
