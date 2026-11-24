/** Hostname and site-list helpers. Pure functions, no browser APIs. */

/** Lower-cases a hostname and strips a leading `www.`. */
export function normalizeHost(host: string): string {
  const h = host.trim().toLowerCase().replace(/\.$/, '');
  return h.startsWith('www.') ? h.slice(4) : h;
}

/**
 * Returns the tracked hostname for a URL, or null for pages that are never
 * tracked: anything that is not http(s) (chrome://, extension pages, the new
 * tab page, file://, about:blank, ...).
 */
export function hostFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname) return null;
  return normalizeHost(parsed.hostname);
}

/**
 * Finds the listed site a host belongs to. A host matches a site when it is the
 * site itself or any subdomain of it (`m.youtube.com` -> `youtube.com`), but
 * never a different domain that merely ends with the same letters
 * (`notyoutube.com` does not match `youtube.com`).
 *
 * When several listed sites match (`youtube.com` and `music.youtube.com`), the
 * most specific one wins.
 */
export function matchSite(host: string | null | undefined, sites: readonly string[]): string | null {
  if (!host) return null;
  const h = normalizeHost(host);
  let best: string | null = null;
  for (const raw of sites) {
    const site = normalizeHost(raw);
    if (!site) continue;
    if (h === site || h.endsWith('.' + site)) {
      if (!best || site.length > best.length) best = site;
    }
  }
  return best;
}

export function isDistracting(host: string | null | undefined, sites: readonly string[]): boolean {
  return matchSite(host, sites) !== null;
}

const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/;

/**
 * Turns whatever the user typed into the "add site" box into a bare site
 * (`https://www.YouTube.com/watch?v=1` -> `youtube.com`). Returns null if it
 * is not a usable domain.
 */
export function parseSiteInput(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (!/^[a-z]+:\/\//.test(s)) s = 'https://' + s;
  let host: string;
  try {
    host = new URL(s).hostname;
  } catch {
    return null;
  }
  host = normalizeHost(host);
  return HOST_RE.test(host) ? host : null;
}
