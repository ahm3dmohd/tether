import type { HideSite } from '../types';

export const x: HideSite = {
  domains: ['x.com', 'twitter.com'],
  css: `
    /* "What's happening" / trends in the sidebar */
    [data-testid="sidebarColumn"] section:has([aria-label^="Timeline: Trending"]),
    [data-testid="sidebarColumn"] div:has(> [aria-label^="Timeline: Trending"])
    { display: none !important; }

    /* Home timeline and Explore */
    html[data-tether-feed] [data-testid="primaryColumn"] section,
    html[data-tether-feed] [aria-label^="Timeline: Your Home Timeline"],
    html[data-tether-feed] [aria-label^="Timeline: Explore"]
    { display: none !important; }
  `,
  isFeed: (url) => /^\/(home|explore)(\/|$)/.test(url.pathname) || url.pathname === '/',
};
