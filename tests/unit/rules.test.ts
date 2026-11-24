import { describe, expect, it } from 'vitest';
import { buildRules, parseBlockedUrl } from '@/lib/rules';

const base = {
  focusActive: true,
  sites: ['youtube.com', 'reddit.com'],
  bypasses: {},
  now: 1_000_000,
  blockedPageUrl: 'chrome-extension://abc/blocked.html',
};

describe('buildRules', () => {
  it('blocks nothing outside focus', () => {
    expect(buildRules({ ...base, focusActive: false })).toEqual([]);
  });

  it('redirects each listed site to the block page during focus', () => {
    const rules = buildRules(base);
    expect(rules).toHaveLength(2);
    const yt = rules.find((r) => r.condition.requestDomains[0] === 'youtube.com')!;
    expect(yt.action).toEqual({
      type: 'redirect',
      redirect: { regexSubstitution: 'chrome-extension://abc/blocked.html?site=youtube.com&url=\\0' },
    });
    expect(yt.condition.resourceTypes).toEqual(['main_frame']);
  });

  it('gives every rule a unique id', () => {
    const rules = buildRules({ ...base, bypasses: { 'youtube.com': base.now + 1, 'reddit.com': base.now + 1 } });
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
  });

  it('adds a higher-priority allow rule for a live bypass only', () => {
    const rules = buildRules({ ...base, bypasses: { 'youtube.com': base.now + 60_000, 'reddit.com': base.now - 1 } });
    const allows = rules.filter((r) => r.action.type === 'allow');
    expect(allows).toHaveLength(1);
    expect(allows[0]!.condition.requestDomains).toEqual(['youtube.com']);
    expect(allows[0]!.priority).toBeGreaterThan(rules.find((r) => r.action.type === 'redirect')!.priority);
  });

  it('is deterministic regardless of site order and duplicates', () => {
    expect(buildRules({ ...base, sites: ['reddit.com', 'youtube.com', 'reddit.com'] })).toEqual(buildRules(base));
  });
});

describe('parseBlockedUrl', () => {
  it('recovers the site and the original URL, query string and all', () => {
    const original = 'https://www.youtube.com/watch?v=abc&t=10s';
    const r = parseBlockedUrl(`chrome-extension://abc/blocked.html?site=youtube.com&url=${original}`);
    expect(r).toEqual({ site: 'youtube.com', url: original, mode: null });
  });
  it('refuses non-web URLs', () => {
    expect(parseBlockedUrl('chrome-extension://abc/blocked.html?site=x.com&url=javascript:alert(1)').url).toBeNull();
  });
  it('reads end-focus mode', () => {
    expect(parseBlockedUrl('chrome-extension://abc/blocked.html?mode=end').mode).toBe('end');
  });
});
