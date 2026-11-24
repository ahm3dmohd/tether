import type { HideSite } from '../types';

export const instagram: HideSite = {
  domains: ['instagram.com'],
  css: `
    html[data-tether-feed] main,
    html[data-tether-feed] [role="main"]
    { display: none !important; }
  `,
  // Home, Explore and the Reels feed. Single posts (/p/...) and single reels (/reel/...) still open.
  isFeed: (url) => url.pathname === '/' || /^\/(explore|reels)(\/|$)/.test(url.pathname),
};
