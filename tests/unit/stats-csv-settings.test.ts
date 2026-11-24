import { describe, expect, it } from 'vitest';
import { DEFAULT_SITES } from '@/lib/constants';
import { csvField, dailyCsv, eventsCsv } from '@/lib/csv';
import { checkSettingsChange, defaultSettings, sanitizeSettings } from '@/lib/settings';
import { countEvents, distractingSeconds, prune, secondsForSite, siteRows, totalSeconds } from '@/lib/stats';
import type { DailyData, TetherEvent } from '@/lib/types';

const sites = [...DEFAULT_SITES];
const daily: DailyData = {
  '2026-11-23': { 'youtube.com': 600, 'github.com': 300 },
  '2026-11-24': { 'youtube.com': 1200, 'm.youtube.com': 300, 'github.com': 900, 'old.reddit.com': 60 },
};

describe('stats', () => {
  it('sums distracting and total time', () => {
    expect(distractingSeconds(daily, '2026-11-24', sites)).toBe(1560);
    expect(totalSeconds(daily, '2026-11-24')).toBe(2460);
    expect(secondsForSite(daily, '2026-11-24', 'youtube.com', sites)).toBe(1500);
    expect(distractingSeconds(daily, '2000-01-01', sites)).toBe(0);
  });

  it('folds subdomains into their site and sorts by time', () => {
    const rows = siteRows(daily, ['2026-11-23', '2026-11-24'], sites);
    expect(rows.map((r) => r.name)).toEqual(['youtube.com', 'github.com', 'reddit.com']);
    expect(rows[0]).toEqual({ name: 'youtube.com', distracting: true, perDay: [600, 1500], total: 2100 });
    expect(rows[1]!.distracting).toBe(false);
  });

  it('counts events since a time', () => {
    const events: TetherEvent[] = [
      { t: 10, type: 'bypass', site: 'x.com' },
      { t: 20, type: 'bypass', site: 'x.com' },
      { t: 30, type: 'nudge_ignored' },
    ];
    expect(countEvents(events, 'bypass', 15)).toBe(1);
    expect(countEvents(events, 'nudge_ignored', 0)).toBe(1);
  });

  it('prunes data older than the retention window', () => {
    const now = new Date('2026-11-24T12:00:00').getTime();
    const old = new Date('2026-08-01T12:00:00').getTime();
    const r = prune({ ...daily, '2026-08-01': { 'a.com': 1 } }, [{ t: old, type: 'bypass' }, { t: now, type: 'bypass' }], now, 90);
    expect(Object.keys(r.daily).sort()).toEqual(['2026-11-23', '2026-11-24']);
    expect(r.events).toHaveLength(1);
  });
});

describe('csv', () => {
  it('escapes fields', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField(undefined)).toBe('');
    expect(csvField(-5)).toBe('-5');
  });

  it('writes daily totals', () => {
    const lines = dailyCsv(daily, sites).trim().split('\r\n');
    expect(lines[0]).toBe('date,host,site,distracting,seconds,minutes');
    expect(lines[1]).toBe('2026-11-23,youtube.com,youtube.com,true,600,10');
    expect(lines).toContain('2026-11-24,m.youtube.com,youtube.com,true,300,5');
    expect(lines).toContain('2026-11-24,github.com,,false,900,15');
    expect(lines).toHaveLength(7);
  });

  it('writes events oldest first', () => {
    const t = new Date('2026-11-24T10:00:00Z').getTime();
    const out = eventsCsv([
      { t: t + 1000, type: 'nudge_ignored', site: 'youtube.com' },
      { t, type: 'focus_started', detail: 'manual' },
    ]);
    expect(out).toBe(
      'timestamp,date,type,site,detail\r\n' +
        '2026-11-24T10:00:00.000Z,2026-11-24,focus_started,,manual\r\n' +
        '2026-11-24T10:00:01.000Z,2026-11-24,nudge_ignored,youtube.com,\r\n',
    );
  });
});

describe('settings', () => {
  it('fills defaults and cleans bad input', () => {
    expect(sanitizeSettings(undefined)).toEqual(defaultSettings());
    const s = sanitizeSettings({
      sites: ['https://www.Twitch.tv/x', 'twitch.tv', 'nonsense', 'youtube.com'],
      nudgeMinutes: -3,
      badgeThresholdMinutes: Number.NaN,
      focusSchedule: { enabled: false, start: '9:00', end: '99:00' },
    });
    expect(s.sites).toEqual(['twitch.tv', 'youtube.com']);
    expect(s.nudgeMinutes).toBe(1);
    expect(s.badgeThresholdMinutes).toBe(30);
    expect(s.focusSchedule).toEqual({ enabled: false, start: '09:00', end: '18:00' });
  });

  it('allows anything outside focus', () => {
    const a = defaultSettings();
    expect(checkSettingsChange(a, { ...a, sites: [] }, false)).toEqual({ ok: true });
  });

  it('during focus: adding sites and tuning thresholds is fine', () => {
    const a = defaultSettings();
    expect(checkSettingsChange(a, { ...a, sites: [...a.sites, 'twitch.tv'], nudgeMinutes: 20 }, true).ok).toBe(true);
  });

  it('during focus: removing a site or touching focus hours is refused', () => {
    const a = defaultSettings();
    expect(checkSettingsChange(a, { ...a, sites: a.sites.filter((s) => s !== 'youtube.com') }, true).ok).toBe(false);
    expect(checkSettingsChange(a, { ...a, focusSchedule: { ...a.focusSchedule, enabled: false } }, true).ok).toBe(false);
    expect(checkSettingsChange(a, { ...a, focusSchedule: { ...a.focusSchedule, end: '07:00' } }, true).ok).toBe(false);
  });
});
