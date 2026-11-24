import type { HideSite } from '../types';

const FEED_PATHS = ['/', '/best', '/hot', '/new', '/top', '/rising', '/r/popular', '/r/all', '/explore'];

export const reddit: HideSite = {
  domains: ['reddit.com'],
  css: `
    html[data-tether-feed] shreddit-feed,
    html[data-tether-feed] #main-content,
    html[data-tether-feed] #siteTable,
    html[data-tether-feed] .listing-chooser,
    /* "Popular" / trending carousels */
    html[data-tether-feed] shreddit-gallery-carousel,
    html[data-tether-feed] #popular-communities-list
    { display: none !important; }
  `,
  isFeed: (url) => FEED_PATHS.includes(url.pathname.replace(/\/$/, '') || '/'),
};
