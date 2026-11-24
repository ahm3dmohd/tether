import type { HideSite } from '../types';

const FEED_PATHS = ['/', '/feed/trending', '/feed/explore', '/gaming'];

export const youtube: HideSite = {
  domains: ['youtube.com'],

  css: `
    /* Recommendations next to / under the video */
    #related, ytd-watch-next-secondary-results-renderer,
    ytm-item-section-renderer[section-identifier="related-items"],
    /* End-screen suggestions and cards */
    .ytp-endscreen-content, .ytp-ce-element, .videowall-endscreen,
    .ytp-fullscreen-grid, .ytp-autonav-endscreen,
    /* Shorts everywhere */
    ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts],
    ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
    grid-shelf-view-model:has(ytm-shorts-lockup-view-model),
    ytd-video-renderer:has(a[href^="/shorts/"]),
    ytd-guide-entry-renderer:has(a[title="Shorts"]),
    ytd-mini-guide-entry-renderer[aria-label="Shorts"],
    ytm-pivot-bar-item-renderer:has(.pivot-shorts),
    yt-tab-shape[tab-title="Shorts"]
    { display: none !important; }

    /* Home / trending / explore feed. The masthead (search) stays. */
    html[data-tether-feed] ytd-page-manager,
    html[data-tether-feed] ytm-browse,
    html[data-tether-feed] #chips-wrapper
    { visibility: hidden !important; }
  `,

  isFeed: (url) => FEED_PATHS.includes(url.pathname.replace(/\/$/, '') || '/'),

  redirect(url) {
    // /shorts/<id> -> /watch?v=<id>: same video, no endless swipe feed.
    const m = /^\/shorts\/([\w-]+)/.exec(url.pathname);
    return m ? `${url.origin}/watch?v=${m[1]}` : null;
  },

  onTick(url) {
    if (url.pathname !== '/watch') return;
    // Autoplay: switch the "next video" toggle off whenever it is on.
    const desktop = document.querySelector<HTMLElement>('.ytp-autonav-toggle-button[aria-checked="true"]');
    if (desktop) desktop.click();
    const mobile = document.querySelector<HTMLElement>('.ytm-autonav-toggle-button-container[aria-pressed="true"]');
    if (mobile) mobile.click();
  },
};
