import type { HideSite } from '../types';

export const facebook: HideSite = {
  domains: ['facebook.com'],
  css: `
    html[data-tether-feed] [role="feed"],
    html[data-tether-feed] [role="main"]
    { display: none !important; }
  `,
  isFeed: (url) =>
    url.pathname === '/' || url.pathname === '/home.php' || /^\/(watch|reels?|gaming)(\/|$)/.test(url.pathname),
};
