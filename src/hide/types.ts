/**
 * One file per site under ./sites. Selectors WILL break as sites change their
 * markup; when one does, the fix should be a one-line edit in that site's file.
 */
export interface HideSite {
  /** Domains this applies to (subdomains included). */
  domains: string[];
  /** CSS that is always applied: sidebars, Shorts shelves, end screens... */
  css: string;
  /**
   * True on feed pages (home, explore...). On those, `<html>` gets a
   * `data-tether-feed` attribute and the site's CSS hides the feed with
   * `html[data-tether-feed] <selector>`.
   */
  isFeed(url: URL): boolean;
  /** Optional: send the page somewhere less sticky (YouTube Shorts -> normal player). */
  redirect?(url: URL): string | null;
  /** Optional: runs every 500 ms (e.g. to keep autoplay switched off). */
  onTick?(url: URL): void;
}
