/** Aggregations for the popup, badge and dashboard. Pure functions. */
import { matchSite } from './domains';
import { dayKey } from './time';
import type { DailyData, EventType, TetherEvent } from './types';

/** Seconds on one host today, as shown on the badge. */
export function secondsForHost(daily: DailyData, day: string, host: string): number {
  return daily[day]?.[host] ?? 0;
}

/** Seconds today across every host belonging to a listed site (`youtube.com` + `m.youtube.com`). */
export function secondsForSite(daily: DailyData, day: string, site: string, sites: readonly string[]): number {
  let total = 0;
  for (const [host, s] of Object.entries(daily[day] ?? {})) {
    if (matchSite(host, sites) === site) total += s;
  }
  return total;
}

export function distractingSeconds(daily: DailyData, day: string, sites: readonly string[]): number {
  let total = 0;
  for (const [host, s] of Object.entries(daily[day] ?? {})) {
    if (matchSite(host, sites)) total += s;
  }
  return total;
}

export function totalSeconds(daily: DailyData, day: string): number {
  return Object.values(daily[day] ?? {}).reduce((a, b) => a + b, 0);
}

export interface SiteRow {
  /** The listed site for distracting hosts, otherwise the host itself. */
  name: string;
  distracting: boolean;
  /** Seconds per requested day, same order as the `days` argument. */
  perDay: number[];
  total: number;
}

/**
 * One row per site over the given days, most time first. Subdomains of a
 * listed site are folded into it.
 */
export function siteRows(daily: DailyData, days: readonly string[], sites: readonly string[]): SiteRow[] {
  const rows = new Map<string, SiteRow>();
  days.forEach((day, i) => {
    for (const [host, s] of Object.entries(daily[day] ?? {})) {
      const site = matchSite(host, sites);
      const name = site ?? host;
      let row = rows.get(name);
      if (!row) {
        row = { name, distracting: site !== null, perDay: days.map(() => 0), total: 0 };
        rows.set(name, row);
      }
      row.perDay[i] = (row.perDay[i] ?? 0) + s;
      row.total += s;
    }
  });
  return [...rows.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export function countEvents(events: readonly TetherEvent[], type: EventType, sinceMs: number): number {
  return events.filter((e) => e.type === type && e.t >= sinceMs).length;
}

/** Drops days and events older than `retentionDays` (counting today as day 1). */
export function prune(
  daily: DailyData,
  events: readonly TetherEvent[],
  now: number,
  retentionDays: number,
): { daily: DailyData; events: TetherEvent[] } {
  const d = new Date(now);
  const cutoffMs = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (retentionDays - 1)).getTime();
  const cutoffDay = dayKey(cutoffMs);
  const keptDaily: DailyData = {};
  for (const [day, totals] of Object.entries(daily)) {
    if (day >= cutoffDay) keptDaily[day] = totals;
  }
  return { daily: keptDaily, events: events.filter((e) => e.t >= cutoffMs) };
}
