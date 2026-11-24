import { describe, expect, it } from 'vitest';
import { DEFAULT_SITES } from '@/lib/constants';
import { hostFromUrl, isDistracting, matchSite, normalizeHost, parseSiteInput } from '@/lib/domains';

describe('normalizeHost', () => {
  it('lower-cases and strips www.', () => {
    expect(normalizeHost('WWW.YouTube.com')).toBe('youtube.com');
    expect(normalizeHost('m.youtube.com')).toBe('m.youtube.com');
    expect(normalizeHost('example.com.')).toBe('example.com');
  });
});

describe('hostFromUrl', () => {
  it('returns the host for web pages', () => {
    expect(hostFromUrl('https://www.youtube.com/watch?v=1')).toBe('youtube.com');
    expect(hostFromUrl('http://old.reddit.com/r/x')).toBe('old.reddit.com');
  });
  it('ignores non-web pages', () => {
    for (const url of [
      'chrome://newtab/',
      'chrome-extension://abc/dashboard.html',
      'edge://settings',
      'about:blank',
      'file:///home/me/a.html',
      'not a url',
      '',
      undefined,
      null,
    ]) {
      expect(hostFromUrl(url)).toBeNull();
    }
  });
});

describe('matchSite', () => {
  const sites = [...DEFAULT_SITES];
  it('matches the site and its subdomains', () => {
    expect(matchSite('youtube.com', sites)).toBe('youtube.com');
    expect(matchSite('m.youtube.com', sites)).toBe('youtube.com');
    expect(matchSite('old.reddit.com', sites)).toBe('reddit.com');
    expect(matchSite('www.x.com', sites)).toBe('x.com');
    expect(matchSite('mobile.twitter.com', sites)).toBe('twitter.com');
  });
  it('does not match lookalike domains', () => {
    expect(matchSite('notyoutube.com', sites)).toBeNull();
    expect(matchSite('youtube.com.evil.net', sites)).toBeNull();
    expect(matchSite('box.com', sites)).toBeNull(); // must not match x.com
    expect(matchSite('github.com', sites)).toBeNull();
  });
  it('prefers the most specific listed site', () => {
    expect(matchSite('music.youtube.com', ['youtube.com', 'music.youtube.com'])).toBe('music.youtube.com');
  });
  it('handles empty input', () => {
    expect(matchSite(null, sites)).toBeNull();
    expect(matchSite('youtube.com', [])).toBeNull();
    expect(isDistracting('youtube.com', sites)).toBe(true);
  });
});

describe('parseSiteInput', () => {
  it('accepts bare domains and full URLs', () => {
    expect(parseSiteInput('twitch.tv')).toBe('twitch.tv');
    expect(parseSiteInput('  https://www.Twitch.tv/directory ')).toBe('twitch.tv');
    expect(parseSiteInput('news.ycombinator.com')).toBe('news.ycombinator.com');
  });
  it('rejects junk', () => {
    expect(parseSiteInput('')).toBeNull();
    expect(parseSiteInput('hello')).toBeNull();
    expect(parseSiteInput('localhost')).toBeNull();
    expect(parseSiteInput('a b.com')).toBeNull();
  });
});
