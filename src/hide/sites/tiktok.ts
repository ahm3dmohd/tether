import type { HideSite } from '../types';

export const tiktok: HideSite = {
  domains: ['tiktok.com'],
  css: `
    html[data-tether-feed] main,
    html[data-tether-feed] [id^="main-content"],
    html[data-tether-feed] [data-e2e="recommend-list-item-container"]
    { display: none !important; }
  `,
  // TikTok is mostly feed. Direct video links (/@user/video/123) and search still work.
  isFeed: (url) => url.pathname === '/' || /^\/(foryou|explore|following|friends|live)(\/|$)/.test(url.pathname),
};
