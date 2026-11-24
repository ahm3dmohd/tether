/** CSV export. Pure functions returning file contents. */
import { matchSite } from './domains';
import { dayKey } from './time';
import type { DailyData, TetherEvent } from './types';

/** Quotes a CSV field when needed (RFC 4180). Also neutralises spreadsheet formula injection. */
export function csvField(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(fields: Array<string | number | boolean | undefined | null>): string {
  return fields.map(csvField).join(',');
}

/** One line per day per host: date, host, matched site, distracting, seconds, minutes. */
export function dailyCsv(daily: DailyData, sites: readonly string[]): string {
  const lines = [row(['date', 'host', 'site', 'distracting', 'seconds', 'minutes'])];
  for (const day of Object.keys(daily).sort()) {
    const hosts = Object.entries(daily[day] ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    for (const [host, seconds] of hosts) {
      const site = matchSite(host, sites);
      const secs = Math.round(seconds);
      lines.push(row([day, host, site ?? '', site !== null, secs, Math.round((secs / 60) * 10) / 10]));
    }
  }
  return lines.join('\r\n') + '\r\n';
}

/** One line per logged event, oldest first. */
export function eventsCsv(events: readonly TetherEvent[]): string {
  const lines = [row(['timestamp', 'date', 'type', 'site', 'detail'])];
  for (const e of [...events].sort((a, b) => a.t - b.t)) {
    lines.push(row([new Date(e.t).toISOString(), dayKey(e.t), e.type, e.site ?? '', e.detail ?? '']));
  }
  return lines.join('\r\n') + '\r\n';
}
