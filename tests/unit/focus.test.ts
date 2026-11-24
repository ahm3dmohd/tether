import { describe, expect, it } from 'vitest';
import { computeFocus, emptyFocusState, endFocusEarly, scheduleWindowAt, startManualFocus } from '@/lib/focus';
import type { FocusSchedule } from '@/lib/types';

const at = (s: string) => new Date(s).getTime();
const day: FocusSchedule = { enabled: true, start: '06:00', end: '18:00' };
const night: FocusSchedule = { enabled: true, start: '22:00', end: '02:00' };
const off: FocusSchedule = { ...day, enabled: false };

describe('scheduleWindowAt', () => {
  it('finds the daytime window', () => {
    expect(scheduleWindowAt(day, at('2026-11-24T05:59:59'))).toBeNull();
    expect(scheduleWindowAt(day, at('2026-11-24T06:00:00'))).toEqual({
      start: at('2026-11-24T06:00:00'),
      end: at('2026-11-24T18:00:00'),
    });
    expect(scheduleWindowAt(day, at('2026-11-24T17:59:59'))).not.toBeNull();
    expect(scheduleWindowAt(day, at('2026-11-24T18:00:00'))).toBeNull();
  });
  it('handles overnight windows on both sides of midnight', () => {
    expect(scheduleWindowAt(night, at('2026-11-24T23:00:00'))?.end).toBe(at('2026-11-25T02:00:00'));
    expect(scheduleWindowAt(night, at('2026-11-25T01:00:00'))?.start).toBe(at('2026-11-24T22:00:00'));
    expect(scheduleWindowAt(night, at('2026-11-25T03:00:00'))).toBeNull();
  });
  it('is off when disabled or empty', () => {
    expect(scheduleWindowAt(off, at('2026-11-24T10:00:00'))).toBeNull();
    expect(scheduleWindowAt({ enabled: true, start: '09:00', end: '09:00' }, at('2026-11-24T09:00:00'))).toBeNull();
  });
});

describe('computeFocus', () => {
  const s = emptyFocusState();
  it('is on during scheduled hours', () => {
    expect(computeFocus(day, s, at('2026-11-24T10:00:00'))).toEqual({
      active: true,
      reason: 'schedule',
      endsAt: at('2026-11-24T18:00:00'),
    });
    expect(computeFocus(day, s, at('2026-11-24T20:00:00')).active).toBe(false);
  });

  it('runs manual sessions any time', () => {
    const now = at('2026-11-24T20:00:00');
    const st = startManualFocus(s, 60, now);
    expect(computeFocus(off, st, now + 1000)).toEqual({ active: true, reason: 'manual', endsAt: now + 3600_000 });
    expect(computeFocus(off, st, now + 3600_000).active).toBe(false);
  });

  it('never shortens a running session', () => {
    const now = at('2026-11-24T20:00:00');
    const st = startManualFocus(startManualFocus(s, 240, now), 60, now);
    expect(st.manualUntil).toBe(now + 240 * 60_000);
  });

  it('uses the later end when manual and schedule overlap', () => {
    const now = at('2026-11-24T17:00:00');
    expect(computeFocus(day, startManualFocus(s, 120, now), now)).toMatchObject({ reason: 'manual', endsAt: now + 7200_000 });
    expect(computeFocus(day, startManualFocus(s, 30, now), now)).toMatchObject({ reason: 'schedule' });
  });

  it('ending early switches the schedule off until its window ends, then it returns tomorrow', () => {
    const now = at('2026-11-24T10:00:00');
    const st = endFocusEarly(day, startManualFocus(s, 60, now), now);
    expect(st.manualUntil).toBe(0);
    expect(computeFocus(day, st, now + 1000).active).toBe(false);
    expect(computeFocus(day, st, at('2026-11-24T17:59:00')).active).toBe(false);
    expect(computeFocus(day, st, at('2026-11-25T06:00:00')).active).toBe(true);
  });
});
