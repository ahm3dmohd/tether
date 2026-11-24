import { describe, expect, it } from 'vitest';
import { HIDE_SITES, hideSiteFor } from '@/hide';
import { youtube } from '@/hide/sites/youtube';

const u = (s: string) => new URL(s);

describe('distraction hiding', () => {
  it('finds the right site module, subdomains included', () => {
    expect(hideSiteFor('www.youtube.com')).toBe(youtube);
    expect(hideSiteFor('m.youtube.com')).toBe(youtube);
    expect(hideSiteFor('old.reddit.com')?.domains).toContain('reddit.com');
    expect(hideSiteFor('twitter.com')?.domains).toContain('x.com');
    expect(hideSiteFor('github.com')).toBeNull();
  });

  it('every built-in default site has a hiding module', () => {
    for (const d of ['youtube.com', 'instagram.com', 'tiktok.com', 'x.com', 'twitter.com', 'reddit.com', 'facebook.com']) {
      expect(HIDE_SITES.some((s) => s.domains.includes(d))).toBe(true);
    }
  });

  it('YouTube: home is a feed, a video or search is not', () => {
    expect(youtube.isFeed(u('https://www.youtube.com/'))).toBe(true);
    expect(youtube.isFeed(u('https://www.youtube.com/feed/trending'))).toBe(true);
    expect(youtube.isFeed(u('https://www.youtube.com/watch?v=abc'))).toBe(false);
    expect(youtube.isFeed(u('https://www.youtube.com/results?search_query=x'))).toBe(false);
  });

  it('YouTube: Shorts open in the normal player', () => {
    expect(youtube.redirect!(u('https://www.youtube.com/shorts/AbC_123'))).toBe('https://www.youtube.com/watch?v=AbC_123');
    expect(youtube.redirect!(u('https://www.youtube.com/watch?v=x'))).toBeNull();
  });

  it('other sites: feeds hidden, direct links kept', () => {
    const reddit = hideSiteFor('reddit.com')!;
    expect(reddit.isFeed(u('https://www.reddit.com/'))).toBe(true);
    expect(reddit.isFeed(u('https://www.reddit.com/r/popular/'))).toBe(true);
    expect(reddit.isFeed(u('https://www.reddit.com/r/typescript/comments/abc/title/'))).toBe(false);
    const x = hideSiteFor('x.com')!;
    expect(x.isFeed(u('https://x.com/home'))).toBe(true);
    expect(x.isFeed(u('https://x.com/someone/status/1'))).toBe(false);
    const ig = hideSiteFor('instagram.com')!;
    expect(ig.isFeed(u('https://www.instagram.com/'))).toBe(true);
    expect(ig.isFeed(u('https://www.instagram.com/p/abc/'))).toBe(false);
    const tt = hideSiteFor('tiktok.com')!;
    expect(tt.isFeed(u('https://www.tiktok.com/foryou'))).toBe(true);
    expect(tt.isFeed(u('https://www.tiktok.com/@a/video/1'))).toBe(false);
  });
});
