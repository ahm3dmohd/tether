# Tether - design

Date: 2026-11-24
Status: draft, awaiting owner approval

## Intent

Tether is a personal Chrome/Edge extension that stops its owner losing time
to YouTube and social media. The owner has two distinct failure modes and the
design answers both:

1. **Forgetting** - drifting into a site without noticing how long it has been.
   Fix: in-the-moment awareness (live badge, nudge overlay). An after-the-fact
   dashboard alone does not fix this.
2. **Getting dragged in while knowing** - awareness doesn't help here, so the
   fix is friction: block during focus time, hide the feeds that pull you
   deeper, and make every way out cost effort.

The owner rarely uses these sites productively, so there is no "useful
YouTube" carve-out.

Success: the owner uses it daily for two weeks, and the dashboard shows less
time on the listed sites than the first week.

## Goals (v1)

1. **Time tracking** per site (hostname, `www.` stripped), stored per local day.
2. **Live badge** on the toolbar icon: minutes on the current site today
   (e.g. `23m`). Red when the current site is distracting and over its
   threshold (default 30 min/day).
3. **Nudge** after 15 continuous minutes on a distracting site: an overlay on
   the page, "15 minutes on youtube.com. Keep going or leave?". "Leave" closes
   the tab; "Keep going" dismisses it and re-arms for another 15 minutes.
   Every choice is logged.
4. **Focus mode** - distracting sites redirect to a Tether block page.
   - Automatic every day 06:00-18:00 local time (editable).
   - Manual sessions from the popup: 1h / 2h / 4h, usable at any time.
   - Ending focus early costs the same friction as a bypass.
5. **Bypass friction** - to open a blocked site: type a fixed sentence exactly
   ("I am choosing to waste this time"), then wait 30 seconds. Unlocks that one
   site for 5 minutes. Logged.
6. **Distraction hiding** - always on for the built-in sites, in and out of
   focus: no YouTube home feed, recommendations sidebar, Shorts, end-screen
   suggestions or autoplay; no home/explore feeds on Reddit, X, Instagram,
   Facebook, TikTok. Direct links and search still work.
7. **Dashboard** page: last 7 days chart (total distracting time per day),
   per-site table, nudges ignored, bypasses used, focus-ended-early count.
   Settings live here: site list, thresholds, focus hours.
8. **Export** all data to CSV, and **delete all data**.

Default distracting list: `youtube.com`, `instagram.com`, `tiktok.com`,
`x.com` (+ `twitter.com`), `reddit.com`, `facebook.com`. Editable. Subdomains
match (`m.youtube.com`, `old.reddit.com`).

## Non-goals (v1)

- **Ad blocking.** uBlock Origin Lite already does it; it doesn't address the
  problem. Decided with the owner.
- Firefox build, Chrome Web Store publishing, sync across devices, accounts,
  a server of any kind, mobile.
- Per-site daily hard limits, site categories. Candidates after two weeks of use.
- Tracking in incognito windows.

## Anti-goals (failure even if it "works")

- An easy off switch. If disabling focus is one click, the tool is decoration.
  (The owner can always uninstall from `chrome://extensions`; that's accepted.)
- Browsing data leaving the device.
- Breaking sites that are not on the list.
- Counting time wrongly enough that the owner stops trusting the numbers.

## Approaches considered

- **A. WXT + TypeScript (chosen by owner).** Framework handles manifest, MV3
  build and hot reload; Firefox later is cheap. Small extra tool to learn.
- **B. Plain MV3 + TypeScript + esbuild.** Most transparent, but manual reload
  on every change and a weekend of boilerplate.
- **C. Plasmo.** Slowing development, pulls in React for a small UI. Dropped.

UI is plain TypeScript + HTML, Chart.js for the dashboard chart. No React
(small UI, not worth the weight) - builder's call, owner did not object.

## How it works

### Parts

- **Background service worker** - all tracking, focus state, alarms, badge,
  blocking rules. The single source of truth.
- **Content script** on distracting sites - distraction hiding (CSS) and the
  nudge overlay. Talks to the worker by messages; holds no state of its own.
- **Popup** - today's total and top 3 sites, focus status, start-focus
  buttons, end-focus (with friction), link to dashboard.
- **Block page** (extension page) - shows which site was blocked, time left
  in focus, and the bypass flow.
- **Dashboard** (extension page) - stats and settings.

### Tracking rules

- Only the active tab of the focused normal window counts.
- The clock stops when: the browser loses focus, the screen locks, or the
  user is idle for 60 s - **unless the active tab is playing audio**
  (`tab.audible`). Without that exception, watching a video without touching
  the mouse would count as idle, and YouTube time would be undercounted.
- Sessions crossing local midnight are split between the two days.
- Non-web pages (`chrome://`, extension pages, new tab) are not tracked.

### MV3 constraint that shapes the code

The service worker is killed after ~30 s idle, so **no state lives only in
memory**. Current session start, focus state and bypass expiries are kept in
`chrome.storage.session` / `chrome.storage.local` and re-read on wake.
Timers use `chrome.alarms` (1-minute tick for flush, badge, nudge checks),
never `setTimeout`.

### Blocking

`declarativeNetRequest` dynamic rules redirect main-frame requests for listed
domains to `blocked.html?site=<host>`. Rules are added when focus starts and
removed when it ends. A bypass adds a higher-priority allow rule for that
host, removed by an alarm after 5 minutes. Already-open tabs on a listed site
are reloaded when focus starts so they hit the block.

### Storage

`chrome.storage.local`, keyed by date: per-site seconds per day, plus an event
log (nudge shown/ignored/left, bypass, focus started/ended-early). Data older
than 90 days is pruned (builder's call). Export writes one CSV of daily
per-site totals plus one of events.

### Permissions

`tabs`, `storage`, `alarms`, `idle`, `declarativeNetRequest`, `scripting`,
host permissions `<all_urls>` (needed for user-added sites; this triggers
Chrome's "read and change all your data" warning - acceptable for a personal,
unpublished extension).

## Testing

- **Vitest** for the pure logic, which is where the bugs will be: session
  accounting (focus changes, idle, audible, midnight split), schedule
  evaluation, domain matching, rule building, CSV export.
  Logic is written as pure functions with the Chrome APIs injected, so it
  runs without a browser.
- **Playwright** loads the built extension in Chromium for a few end-to-end
  checks: a listed site is redirected during focus, the bypass unlocks it,
  the popup shows tracked time.

## Left to the builder

- Exact CSS selectors for distraction hiding (they will break as sites
  change; keep them in one file per site so fixes are one-line).
- Visual design of popup, block page and dashboard (simple, light and dark).
- Icon.
- Project layout within WXT conventions.

## Open (owner)

- None blocking. Thresholds (15 min nudge, 30 min badge, 5 min bypass, 30 s
  wait) are starting values to adjust after real use.
