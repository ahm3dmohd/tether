import { describe, expect, it } from 'vitest';
import { dayKey, formatBadge, formatDuration, lastNDays, parseClock, splitByDay } from '@/lib/time';

// vitest.config.ts pins TZ=Asia/Bahrain (UTC+3, no DST).
const at = (s: string) => new Date(s).getTime();

describe('dayKey', () => {
  it('uses the local day', () => {
    expect(dayKey(at('2026-11-24T23:30:00'))).toBe('2026-11-24');
    expect(dayKey(at('2026-11-25T00:00:00'))).toBe('2026-11-25');
  });
});

describe('splitByDay', () => {
  it('keeps a same-day interval whole', () => {
    expect(splitByDay(at('2026-11-24T10:00:00'), at('2026-11-24T10:01:00'))).toEqual([
      { day: '2026-11-24', seconds: 60 },
    ]);
  });
  it('splits across midnight', () => {
    expect(splitByDay(at('2026-11-24T23:59:30'), at('2026-11-25T00:00:45'))).toEqual([
      { day: '2026-11-24', seconds: 30 },
      { day: '2026-11-25', seconds: 45 },
    ]);
  });
  it('handles an interval spanning several days', () => {
    const parts = splitByDay(at('2026-11-24T23:00:00'), at('2026-11-26T01:00:00'));
    expect(parts.map((p) => p.day)).toEqual(['2026-11-24', '2026-11-25', '2026-11-26']);
    expect(parts.map((p) => p.seconds)).toEqual([3600, 86400, 3600]);
  });
  it('returns nothing for empty or backwards intervals', () => {
    expect(splitByDay(10, 10)).toEqual([]);
    expect(splitByDay(20, 10)).toEqual([]);
  });
});

describe('lastNDays', () => {
  it('lists days oldest first, across a month boundary', () => {
    expect(lastNDays(3, at('2026-12-01T09:00:00'))).toEqual(['2026-11-29', '2026-11-30', '2026-12-01']);
  });
});

describe('formatting', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(59)).toBe('0m');
    expect(formatDuration(23 * 60 + 5)).toBe('23m');
    expect(formatDuration(65 * 60)).toBe('1h 05m');
  });
  it('fits the badge in four characters', () => {
    expect(formatBadge(23 * 60)).toBe('23m');
    expect(formatBadge(65 * 60)).toBe('1h05');
    expect(formatBadge(12 * 3600 + 60)).toBe('12h');
    for (const s of [0, 59 * 60, 9 * 3600 + 59 * 60, 30 * 3600]) expect(formatBadge(s).length).toBeLessThanOrEqual(4);
  });
  it('parses clock times', () => {
    expect(parseClock('06:00')).toBe(360);
    expect(parseClock('6:30')).toBe(390);
    expect(parseClock('23:59')).toBe(1439);
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('nope')).toBeNull();
  });
});
