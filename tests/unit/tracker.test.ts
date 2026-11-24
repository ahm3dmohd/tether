import { describe, expect, it } from 'vitest';
import { DEFAULT_SITES, MAX_SEGMENT_SECONDS } from '@/lib/constants';
import {
  advance,
  applyCredits,
  closeSegment,
  rearmNudge,
  shouldNudge,
  trackedHost,
  updateStreak,
  type Context,
} from '@/lib/tracker';

const at = (s: string) => new Date(s).getTime();
const sites = [...DEFAULT_SITES];
const yt: Context = {
  windowFocused: true,
  url: 'https://www.youtube.com/watch?v=1',
  incognito: false,
  audible: false,
  idleState: 'active',
};

describe('trackedHost (when the clock runs)', () => {
  it('counts the active tab of a focused window', () => {
    expect(trackedHost(yt)).toBe('youtube.com');
  });
  it('stops when the browser loses focus', () => {
    expect(trackedHost({ ...yt, windowFocused: false })).toBeNull();
  });
  it('stops when idle, unless the tab is playing audio', () => {
    expect(trackedHost({ ...yt, idleState: 'idle' })).toBeNull();
    expect(trackedHost({ ...yt, idleState: 'idle', audible: true })).toBe('youtube.com');
  });
  it('always stops when the screen is locked', () => {
    expect(trackedHost({ ...yt, idleState: 'locked', audible: true })).toBeNull();
  });
  it('ignores incognito and non-web pages', () => {
    expect(trackedHost({ ...yt, incognito: true })).toBeNull();
    expect(trackedHost({ ...yt, url: 'chrome://newtab/' })).toBeNull();
    expect(trackedHost({ ...yt, url: null })).toBeNull();
  });
});

describe('advance', () => {
  const t0 = at('2026-11-24T10:00:00');

  it('opens a segment and credits it on the next event', () => {
    const first = advance(null, yt, t0);
    expect(first.credits).toEqual([]);
    expect(first.segment).toEqual({ host: 'youtube.com', since: t0 });

    const second = advance(first.segment, { ...yt, url: 'https://github.com/' }, t0 + 45_000);
    expect(second.credits).toEqual([{ day: '2026-11-24', host: 'youtube.com', seconds: 45 }]);
    expect(second.segment).toEqual({ host: 'github.com', since: t0 + 45_000 });
  });

  it('closes the segment and opens none when the browser loses focus', () => {
    const r = advance({ host: 'youtube.com', since: t0 }, { ...yt, windowFocused: false }, t0 + 10_000);
    expect(r.credits).toEqual([{ day: '2026-11-24', host: 'youtube.com', seconds: 10 }]);
    expect(r.segment).toBeNull();
  });

  it('splits a segment that crosses midnight', () => {
    const since = at('2026-11-24T23:59:20');
    const r = advance({ host: 'youtube.com', since }, yt, since + 60_000);
    expect(r.credits).toEqual([
      { day: '2026-11-24', host: 'youtube.com', seconds: 40 },
      { day: '2026-11-25', host: 'youtube.com', seconds: 20 },
    ]);
  });

  it('caps segments after missed ticks (sleep) instead of crediting hours', () => {
    const r = advance({ host: 'youtube.com', since: t0 }, yt, t0 + 3 * 3600_000);
    expect(r.credits).toEqual([{ day: '2026-11-24', host: 'youtube.com', seconds: MAX_SEGMENT_SECONDS }]);
  });

  it('credits nothing if the clock went backwards', () => {
    expect(closeSegment({ host: 'youtube.com', since: t0 }, t0 - 5000)).toBeNull();
  });
});

describe('applyCredits', () => {
  it('adds to existing totals without mutating the input', () => {
    const daily = { '2026-11-24': { 'youtube.com': 100 } };
    const out = applyCredits(daily, [
      { day: '2026-11-24', host: 'youtube.com', seconds: 20 },
      { day: '2026-11-24', host: 'github.com', seconds: 5 },
      { day: '2026-11-25', host: 'youtube.com', seconds: 7 },
    ]);
    expect(out).toEqual({
      '2026-11-24': { 'youtube.com': 120, 'github.com': 5 },
      '2026-11-25': { 'youtube.com': 7 },
    });
    expect(daily).toEqual({ '2026-11-24': { 'youtube.com': 100 } });
  });
});

describe('streak and nudge', () => {
  const t0 = at('2026-11-24T10:00:00');
  const nudge = 15 * 60;
  const seg = (host: string, startMin: number, endMin: number) => ({
    host,
    start: t0 + startMin * 60_000,
    end: t0 + endMin * 60_000,
  });

  it('builds a streak minute by minute and nudges at 15 minutes', () => {
    let s = null;
    for (let m = 0; m < 15; m++) s = updateStreak(s, seg('m.youtube.com', m, m + 1), sites, nudge);
    expect(s!.site).toBe('youtube.com');
    expect(s!.seconds).toBe(900);
    expect(shouldNudge(s, 'youtube.com', t0 + 15 * 60_000)).toBe(true);
    expect(shouldNudge(s, 'reddit.com', t0 + 15 * 60_000)).toBe(false);
  });

  it('does not nudge before the threshold', () => {
    const s = updateStreak(null, seg('youtube.com', 0, 14), sites, nudge);
    expect(shouldNudge(s, 'youtube.com', t0)).toBe(false);
  });

  it('survives a short break but not a long one', () => {
    const s1 = updateStreak(null, seg('youtube.com', 0, 10), sites, nudge);
    const s2 = updateStreak(s1, seg('youtube.com', 13, 14), sites, nudge); // 3 min break
    expect(s2!.seconds).toBe(11 * 60);
    const s3 = updateStreak(s2, seg('youtube.com', 30, 31), sites, nudge); // 16 min break
    expect(s3!.seconds).toBe(60);
  });

  it('ends on a non-distracting site and restarts on a different listed one', () => {
    const s1 = updateStreak(null, seg('youtube.com', 0, 10), sites, nudge);
    expect(updateStreak(s1, seg('github.com', 10, 11), sites, nudge)).toBeNull();
    const s2 = updateStreak(s1, seg('reddit.com', 10, 11), sites, nudge);
    expect(s2).toMatchObject({ site: 'reddit.com', seconds: 60 });
  });

  it('leaves the streak alone when nothing was credited', () => {
    const s1 = updateStreak(null, seg('youtube.com', 0, 10), sites, nudge);
    expect(updateStreak(s1, null, sites, nudge)).toBe(s1);
  });

  it('"Keep going" re-arms for another full interval', () => {
    let s = updateStreak(null, seg('youtube.com', 0, 15), sites, nudge)!;
    s = { ...s, nudgeShownAt: t0 + 15 * 60_000 };
    expect(shouldNudge(s, 'youtube.com', t0 + 15.5 * 60_000)).toBe(false); // waiting for an answer
    s = rearmNudge(s, nudge);
    expect(s.nextNudgeAt).toBe(30 * 60);
    expect(shouldNudge(s, 'youtube.com', t0 + 16 * 60_000)).toBe(false);
    s = updateStreak(s, seg('youtube.com', 15, 30), sites, nudge)!;
    expect(shouldNudge(s, 'youtube.com', t0 + 30 * 60_000)).toBe(true);
  });

  it('shows an unanswered nudge again after a while (overlay lost on reload)', () => {
    const s = { ...updateStreak(null, seg('youtube.com', 0, 15), sites, nudge)!, nudgeShownAt: t0 };
    expect(shouldNudge(s, 'youtube.com', t0 + 60_000)).toBe(false);
    expect(shouldNudge(s, 'youtube.com', t0 + 2 * 60_000)).toBe(true);
  });
});
