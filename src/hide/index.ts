import { facebook } from './sites/facebook';
import { instagram } from './sites/instagram';
import { reddit } from './sites/reddit';
import { tiktok } from './sites/tiktok';
import { x } from './sites/x';
import { youtube } from './sites/youtube';
import type { HideSite } from './types';
import { matchSite } from '@/lib/domains';

export const HIDE_SITES: HideSite[] = [youtube, reddit, x, instagram, facebook, tiktok];

/** Shown in place of a hidden feed. Pure CSS, so nothing is added to the page's DOM. */
export const PLACEHOLDER_CSS = `
  html[data-tether-feed] body::after {
    content: "Feed hidden by Tether. Search or open a link to go somewhere on purpose.";
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    max-width: min(420px, 80vw); text-align: center;
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #64748b; pointer-events: none; z-index: 2147483646;
  }
`;

export function hideSiteFor(hostname: string): HideSite | null {
  return HIDE_SITES.find((s) => matchSite(hostname, s.domains) !== null) ?? null;
}
