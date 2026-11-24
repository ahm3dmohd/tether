/**
 * Distraction hiding for the built-in sites. Always on, in and out of focus.
 * Runs at document_start so feeds never flash on screen.
 */
import { defineContentScript } from 'wxt/utils/define-content-script';
import { hideSiteFor, PLACEHOLDER_CSS } from '@/hide';

export default defineContentScript({
  // Keep in sync with HIDE_SITES in src/hide/index.ts.
  matches: [
    '*://*.youtube.com/*',
    '*://*.reddit.com/*',
    '*://*.x.com/*',
    '*://*.twitter.com/*',
    '*://*.instagram.com/*',
    '*://*.facebook.com/*',
    '*://*.tiktok.com/*',
  ],
  runAt: 'document_start',
  main() {
    const site = hideSiteFor(location.hostname);
    if (!site) return;

    const style = document.createElement('style');
    style.id = 'tether-hide';
    style.textContent = PLACEHOLDER_CSS + site.css;
    document.documentElement.appendChild(style);

    let last = '';
    const check = () => {
      const url = new URL(location.href);
      if (location.href !== last) {
        last = location.href;
        const target = site.redirect?.(url);
        if (target && target !== location.href) {
          location.replace(target);
          return;
        }
        document.documentElement.toggleAttribute('data-tether-feed', site.isFeed(url));
      }
      site.onTick?.(url);
    };

    check();
    // These sites are single-page apps; content scripts can't hook their
    // history.pushState, so watch the URL instead. Cheap at 2 Hz.
    setInterval(check, 500);
  },
});
