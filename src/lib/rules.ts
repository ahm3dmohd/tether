/**
 * declarativeNetRequest rule building, as a pure function.
 *
 * The worker always computes the full desired rule set from current state and
 * swaps it in, rather than patching rules incrementally. That keeps blocking
 * correct even after the worker has been killed and restarted mid-change.
 */

/** The subset of chrome.declarativeNetRequest.Rule that Tether uses. */
export interface DnrRule {
  id: number;
  priority: number;
  action:
    | { type: 'allow' }
    | { type: 'redirect'; redirect: { regexSubstitution: string } };
  condition: {
    regexFilter?: string;
    requestDomains: string[];
    resourceTypes: ['main_frame'];
  };
}

export interface RuleInput {
  focusActive: boolean;
  sites: readonly string[];
  /** Bypass expiry per site, ms. Expired entries are ignored. */
  bypasses: Record<string, number>;
  now: number;
  /** Full URL of the block page, e.g. chrome-extension://<id>/blocked.html */
  blockedPageUrl: string;
}

const BLOCK_ID_BASE = 1;
const ALLOW_ID_BASE = 10_000;

/**
 * During focus: one redirect rule per listed site sends top-level page loads
 * to the block page, with the site and original URL in the query string. A
 * live bypass adds a higher-priority allow rule for that site. Outside focus:
 * no rules at all, so nothing is ever blocked by accident.
 *
 * `requestDomains` matches the domain and all its subdomains, and nothing
 * else, so `notyoutube.com` is not blocked by `youtube.com`.
 */
export function buildRules(input: RuleInput): DnrRule[] {
  if (!input.focusActive) return [];
  const rules: DnrRule[] = [];
  const sites = [...new Set(input.sites)].sort();
  sites.forEach((site, i) => {
    rules.push({
      id: BLOCK_ID_BASE + i,
      priority: 1,
      action: {
        type: 'redirect',
        // \0 is the whole matched URL. It goes last so the block page can take
        // everything after `url=` without worrying about its own `&`s.
        redirect: { regexSubstitution: `${input.blockedPageUrl}?site=${encodeURIComponent(site)}&url=\\0` },
      },
      condition: { regexFilter: '^https?://.*$', requestDomains: [site], resourceTypes: ['main_frame'] },
    });
    if ((input.bypasses[site] ?? 0) > input.now) {
      rules.push({
        id: ALLOW_ID_BASE + i,
        priority: 2,
        action: { type: 'allow' },
        condition: { requestDomains: [site], resourceTypes: ['main_frame'] },
      });
    }
  });
  return rules;
}

/** Reads `site` and the original `url` back out of a block page URL. */
export function parseBlockedUrl(href: string): { site: string | null; url: string | null; mode: string | null } {
  const u = new URL(href);
  const raw = u.search;
  const idx = raw.indexOf('&url=');
  const original = idx >= 0 ? raw.slice(idx + 5) : null;
  return {
    site: u.searchParams.get('site'),
    url: original && /^https?:\/\//.test(original) ? original : null,
    mode: u.searchParams.get('mode'),
  };
}
