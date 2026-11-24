<p align="center">
  <img src="assets/icon.svg" width="88" height="88" alt="Tether icon" />
</p>

<h1 align="center">Tether</h1>

<p align="center">
  A personal Chrome / Edge extension that stops YouTube and social media from quietly eating your day.
</p>

---

Tether is built around two different ways time goes missing, because one fix doesn't cover both:

1. **You forget.** You open YouTube "for a second" and look up 40 minutes later.
   → Tether keeps you **aware in the moment**: a live minute counter on the toolbar icon, and a nudge on the page after 15 continuous minutes.
2. **You know, and you go anyway.** Awareness doesn't help here.
   → Tether adds **friction**: listed sites are blocked during focus hours, the feeds that pull you deeper are hidden, and every way out (bypassing a block, ending focus early) makes you type a sentence and wait 30 seconds.

Everything runs locally in your browser. There is no server, no account and no sync. Nothing you browse ever leaves your machine.

> **Status:** v0.1, personal and unpublished. You install it from source in developer mode (instructions below). The design it implements is in [`docs/superpowers/specs/2026-11-24-tether-design.md`](docs/superpowers/specs/2026-11-24-tether-design.md).

## Contents

- [What it does](#what-it-does)
- [Install](#install)
- [Using Tether](#using-tether)
- [Settings and defaults](#settings-and-defaults)
- [How time is counted](#how-time-is-counted)
- [Privacy and permissions](#privacy-and-permissions)
- [Known limits](#known-limits)
- [Development](#development)
- [How it works inside](#how-it-works-inside)
- [Troubleshooting](#troubleshooting)

## What it does

| Feature | What you see |
|---|---|
| **Time tracking** | Time per site per day, for every site you visit (hostname, `www.` stripped). Only the tab you're actually looking at counts. |
| **Live badge** | The toolbar icon shows minutes on the current site today, e.g. `23m` or `1h05`. It turns **red** when you're on a distracting site that's over its daily threshold (30 min by default). |
| **Nudge** | After 15 continuous minutes on a distracting site, a full-page overlay asks *"15 minutes on youtube.com. Keep going or leave?"*. Video pauses. **Leave** closes the tab. **Keep going** dismisses it and asks again in another 15 minutes. Every answer is logged. |
| **Focus mode** | Distracting sites are redirected to a Tether block page. Automatic every day 06:00 to 18:00 (editable), plus manual 1h / 2h / 4h sessions from the popup at any time. |
| **Bypass friction** | To open a blocked site anyway: type *"I am choosing to waste this time"* exactly (no pasting), then wait 30 seconds with the page in front of you. That unlocks that one site for 5 minutes. Logged. |
| **Ending focus early** | Costs the same friction as a bypass. Logged. There is deliberately no one-click off switch. |
| **Distraction hiding** | Always on, in and out of focus, for the built-in sites: no YouTube home feed, recommendations sidebar, Shorts, end-screen suggestions or autoplay; no home or explore feeds on Reddit, X, Instagram, Facebook and TikTok. Search and direct links still work. |
| **Dashboard** | Last 7 days chart of distracting time, a per-site table, and counts of nudges ignored, bypasses used and focus sessions ended early. Settings live here too. |
| **Export / delete** | Export everything as two CSV files. Delete all tracked data in one go. |

Default distracting sites: `youtube.com`, `instagram.com`, `tiktok.com`, `x.com`, `twitter.com`, `reddit.com`, `facebook.com`. Subdomains count (`m.youtube.com`, `old.reddit.com`). You can add or remove sites on the dashboard.

## Install

Tether isn't on the Chrome Web Store. You build it once and load it as an "unpacked" extension. It takes about two minutes.

### 1. Build it

You need [Node.js](https://nodejs.org/) 22 or newer.

```bash
git clone https://github.com/ahm3dmohd/tether.git
cd tether
npm install
npm run build
```

This creates the extension in `dist/chrome-mv3/`.

### 2a. Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `dist/chrome-mv3` folder.
4. Click the puzzle-piece icon in the toolbar and **pin** Tether so the badge is always visible. The badge is half the point.

### 2b. Load it in Edge

1. Run `npm run build:edge` (output goes to `dist/edge-mv3/`). The Chrome build also works in Edge if you prefer.
2. Open `edge://extensions`.
3. Turn on **Developer mode** (left sidebar).
4. Click **Load unpacked** and choose the build folder.
5. Pin it from the extensions menu in the toolbar.

Chrome will warn that Tether can "read and change all your data on all websites". That's the `<all_urls>` permission, which is needed so sites you add yourself can be tracked and blocked. See [Privacy and permissions](#privacy-and-permissions) for what each permission is used for.

### Updating

```bash
git pull
npm install
npm run build
```

Then click the reload icon on Tether's card in `chrome://extensions`. Your data and settings are kept.

## Using Tether

### The badge

Glance at the toolbar icon. It shows how long you've spent on the site in the current tab today. On a distracting site, the badge goes red once you pass the daily threshold. Hover it for the full sentence.

### The popup

Click the icon to see:

- **Distracting today**: total time on listed sites today, and total browsing time.
- **Top 3 sites** today. A red dot marks sites on your distracting list.
- **Focus status**, with **Focus 1h / 2h / 4h** buttons when it's off, or **End focus early…** when it's on.
- A link to the **dashboard**.

### Focus mode

When focus is on, opening any listed site (or any of its subdomains) takes you to the block page instead. Tabs that were already open on a listed site are reloaded when focus starts, so they get blocked too.

Focus turns on in two ways:

- **On a schedule**: every day 06:00 to 18:00 by default. Change the hours or switch it off on the dashboard. Overnight windows such as 22:00 to 02:00 work.
- **Manually**: pick 1h, 2h or 4h in the popup. Starting a session never shortens one already running. If a manual session and the schedule overlap, focus lasts until the later of the two.

### The block page and bypass

The block page tells you which site was blocked and how long focus has left. **Close this tab** is the big button. If you really need the site, open **I need it anyway**:

1. Type *I am choosing to waste this time* exactly. Pasting and dropping text are disabled.
2. Wait 30 seconds. The countdown pauses if you switch to another tab, so you can't start it and wander off.
3. Click **Unlock youtube.com for 5 minutes**. You're sent to the page you originally asked for.

After 5 minutes the site is blocked again, and any open tabs on it are reloaded into the block page.

### Ending focus early

In the popup, click **End focus early…**. It opens a full tab with the same sentence and 30-second wait, because a popup closes as soon as you click elsewhere. Ending early:

- cancels any manual session, and
- switches the scheduled window off **until it would have ended anyway**. Tomorrow's schedule runs as normal.

It's logged and counted on the dashboard.

### While focus is on, settings are locked (partly)

If settings could be freely edited during focus, removing YouTube from the list would be a one-click escape. So during focus you **can** add sites and change the nudge and badge thresholds, but you **can't** remove sites or change focus hours. The dashboard says so and the background worker enforces it. Wait for focus to end, or pay the end-early friction first.

### The nudge

After 15 continuous minutes on one distracting site, an overlay covers the page and pauses any video:

- **Leave** closes the tab.
- **Keep going** closes the overlay and resumes playback. You'll be asked again after another 15 minutes.

"Continuous" means time actually counted on that site. A short break of under 5 minutes (going idle, glancing at another app) doesn't reset it. Switching to a non-distracting site does. The nudge can appear up to a minute after the 15-minute mark, because Tether checks once a minute.

### Distraction hiding

On the built-in sites, Tether hides the parts designed to keep you scrolling:

| Site | Hidden | Still works |
|---|---|---|
| YouTube | Home, trending and explore feeds; recommendations next to and after videos; end-screen cards; Shorts shelves and the Shorts tab; autoplay is switched off. `/shorts/…` links open in the normal player instead. | Search, watching a video from a link, subscriptions, your playlists |
| Reddit | Front page, `/r/popular`, `/r/all`, best/hot/new/top/rising, explore | Search, subreddits, posts from links |
| X / Twitter | Home timeline, Explore, the "trending" sidebar | Search, profiles, posts from links |
| Instagram | Home feed, Explore, the Reels feed | Search, profiles, single posts and reels from links |
| Facebook | News feed, Watch, Reels | Search, profiles, groups, pages |
| TikTok | For You, Following, Explore, Live | Search, profiles, videos from links |

Where a feed was, you'll see *"Feed hidden by Tether. Search or open a link to go somewhere on purpose."*

Hiding only applies to these built-in sites. Sites you add yourself get tracking, blocking and nudges, but no feed hiding, because the hiding rules are written per site.

### The dashboard

Open it from the popup. It shows:

- **Tiles**: distracting time today and over 7 days, nudges ignored, bypasses used, focus ended early (all over the last 7 days).
- **Chart**: distracting minutes for each of the last 7 days.
- **Sites table**: every site with at least a minute in the last 7 days. Today, 7-day total, daily average. Subdomains are folded into their listed site.
- **Settings**: the site list, nudge and badge thresholds, focus hours.
- **Your data**: export and delete.

### Export and delete

**Export CSV** downloads two files:

- `tether-daily-YYYY-MM-DD.csv`: one row per day per host.

  ```csv
  date,host,site,distracting,seconds,minutes
  2026-11-24,youtube.com,youtube.com,true,1500,25
  2026-11-24,github.com,,false,900,15
  ```

- `tether-events-YYYY-MM-DD.csv`: one row per logged event.

  ```csv
  timestamp,date,type,site,detail
  2026-11-24T07:00:00.000Z,2026-11-24,focus_started,,schedule
  2026-11-24T09:12:31.000Z,2026-11-24,bypass,youtube.com,
  ```

  Event types: `focus_started`, `focus_ended`, `focus_ended_early`, `bypass`, `nudge_shown`, `nudge_ignored`, `nudge_left`. Timestamps are UTC; `date` is your local day.

**Delete all data…** wipes all tracked time and the event log. Your settings and focus hours stay. It can't be undone.

Data older than 90 days is deleted automatically.

## Settings and defaults

| Setting | Default | Where to change it |
|---|---|---|
| Distracting sites | youtube.com, instagram.com, tiktok.com, x.com, twitter.com, reddit.com, facebook.com | Dashboard |
| Nudge after | 15 continuous minutes | Dashboard |
| Badge turns red after | 30 minutes a day on a site | Dashboard |
| Daily focus hours | On, 06:00 to 18:00 | Dashboard |
| Manual focus lengths | 1h, 2h, 4h | Fixed (`FOCUS_SESSION_OPTIONS` in `src/lib/constants.ts`) |
| Bypass sentence | *I am choosing to waste this time* | Fixed (`BYPASS_SENTENCE`) |
| Bypass wait | 30 seconds | Fixed (`BYPASS_WAIT_SECONDS`) |
| Bypass unlock length | 5 minutes | Fixed (`BYPASS_MINUTES`) |
| Idle after | 60 seconds without input | Fixed (`IDLE_SECONDS`) |
| Data kept for | 90 days | Fixed (`RETENTION_DAYS`) |

The fixed values are starting points from the design. They're constants on purpose: making the friction editable from a settings screen would make it easy to switch off in a weak moment. To change one, edit `src/lib/constants.ts` and rebuild, which is friction of its own.

## How time is counted

If the numbers can't be trusted, the tool is useless, so here are the exact rules:

- **Only one tab counts at a time:** the active tab of the focused, normal browser window.
- **The clock stops when:**
  - the browser loses focus (you switch to another app),
  - the screen is locked, or
  - you've been idle for 60 seconds, **unless the tab is playing audio**. Without that exception, watching a video without touching the mouse would count as idle and YouTube time would be undercounted.
- **Days are local.** A session from 23:50 to 00:10 counts 10 minutes on each day.
- **Not tracked:** `chrome://` and `edge://` pages, extension pages (including Tether's own), the new tab page, local files, and incognito windows.
- **Hosts are stored as-is** (minus `www.`), so `m.youtube.com` and `youtube.com` are separate rows in the export, but the dashboard and badge fold them into the listed site.
- **Sleep and freezes:** time is saved every minute. If more than 2 minutes pass between saves (laptop asleep, browser frozen), Tether credits at most 2 minutes for that gap rather than guessing. You may lose up to a couple of minutes in that case, but you'll never get hours of phantom time.
- **The numbers on the badge are at most a minute behind**, because time is saved on every tab switch and once a minute.

## Privacy and permissions

All data lives in `chrome.storage` inside your browser profile. Tether has no server, makes no network requests of its own, and has no analytics.

| Permission | Why Tether needs it |
|---|---|
| `tabs` | Read the URL of the active tab to know which site you're on; reload tabs on listed sites when focus starts; close the tab when you choose **Leave**. |
| `storage` | Keep your settings, daily totals and event log. |
| `alarms` | A 1-minute tick to save time, refresh the badge and check for nudges; a timer to end each bypass. |
| `idle` | Stop the clock when you're away or the screen is locked. |
| `declarativeNetRequest` | Redirect listed sites to the block page during focus. Chrome applies these rules itself; Tether never sees your requests. |
| `scripting` | Inject the nudge overlay into the current tab only when a nudge is due. |
| `<all_urls>` host access | Needed so sites **you add** can be blocked, tracked and nudged. This is what triggers Chrome's "read and change all your data" warning. |

Tether only runs code inside web pages in two cases: the distraction-hiding script on the seven built-in sites, and the nudge overlay when it's shown. On every other site it injects nothing.

## Known limits

Being honest about where this falls short:

- **You can always uninstall or disable it** from `chrome://extensions`. That's accepted in the design: Tether makes quitting deliberate, not impossible.
- **Hiding selectors will break.** YouTube, Reddit and friends change their markup often. When a feed reappears, the fix is usually one line in `src/hide/sites/<site>.ts`. See [Fixing a broken hiding rule](#fixing-a-broken-hiding-rule).
- **Feed hiding is only for the built-in sites.** Added sites get tracking, blocking and nudges only.
- **Media playing in a background window doesn't count.** Audio only keeps the clock running while that tab is in the focused window (it covers idle, not switching apps).
- **Window focus on Linux** can be reported unreliably by some window managers, which may undercount.
- **The nudge can't appear on pages Chrome protects** (the Web Store, error pages). Tether retries a minute later.
- **One browser profile only.** No sync across devices or profiles, by design.
- **No Firefox build yet.** WXT makes it cheap to add later.

## Development

### Prerequisites

- Node.js 22+
- Chrome or Edge for manual testing
- Chromium for the end-to-end tests (Playwright downloads one with `npx playwright install chromium` if you don't have it)

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts WXT in dev mode: opens a fresh Chrome with Tether loaded and reloads it as you edit. |
| `npm run dev:edge` | Same, in Edge. |
| `npm run build` | Production build to `dist/chrome-mv3/`. |
| `npm run build:edge` | Production build to `dist/edge-mv3/`. |
| `npm run zip` | Build and zip for sharing. |
| `npm run compile` | Type-check everything with `tsc`. |
| `npm test` | Unit tests (Vitest). Fast, no browser needed. |
| `npm run test:watch` | Unit tests in watch mode. |
| `npm run test:e2e` | Builds, then runs the end-to-end tests in Chromium with the real extension loaded (Playwright). Takes about 40 s, mostly the real 30 s bypass wait. |

If Playwright can't find a browser, point it at one: `CHROMIUM_PATH=/path/to/chromium npm run test:e2e`.

### Project layout

```
tether/
├── wxt.config.ts            # Manifest: permissions, web-accessible block page, etc.
├── assets/icon.svg          # Source for the icon
├── public/icon/*.png        # Rendered icon sizes
├── docs/superpowers/specs/  # The design spec this implements
├── src/
│   ├── entrypoints/         # Everything WXT turns into part of the extension
│   │   ├── background.ts    # Service worker: tracking, focus, blocking, badge, nudges
│   │   ├── hide.content.ts  # Content script on the 7 built-in sites: distraction hiding
│   │   ├── nudge.ts         # Overlay, injected on demand (not a content script)
│   │   ├── popup/           # Toolbar popup
│   │   ├── blocked/         # Block page + end-focus-early page
│   │   └── dashboard/       # Stats and settings
│   ├── lib/                 # Logic. Pure functions, no browser APIs, except:
│   │   ├── store.ts         #   typed chrome.storage access
│   │   ├── messages.ts      #   page <-> worker message types
│   │   ├── tracker.ts       # Time accounting: segments, idle/audio rules, streaks
│   │   ├── focus.ts         # Schedule windows, manual sessions, ending early
│   │   ├── rules.ts         # declarativeNetRequest rules
│   │   ├── stats.ts         # Aggregation for popup, badge, dashboard; pruning
│   │   ├── csv.ts           # Export
│   │   ├── settings.ts      # Defaults, validation, the focus lock
│   │   ├── domains.ts       # Hostname matching
│   │   ├── time.ts          # Local days, midnight split, formatting
│   │   ├── types.ts         # Storage shapes
│   │   └── constants.ts     # Fixed thresholds
│   ├── hide/
│   │   ├── index.ts         # Site lookup + placeholder text
│   │   └── sites/*.ts       # One file per site: CSS selectors and feed paths
│   └── ui/
│       ├── theme.css        # Shared light/dark styles
│       └── friction.ts      # Type-the-sentence-then-wait flow
└── tests/
    ├── unit/                # Vitest
    └── e2e/                 # Playwright, real extension in Chromium
```

### Testing

The bugs in a tool like this live in time accounting, so that logic is written as pure functions with no browser APIs and covered by unit tests:

- **Session accounting:** focus changes, idle with and without audio, screen lock, midnight split, the sleep cap, streaks and nudge re-arming.
- **Schedule:** day and overnight windows, manual sessions, overlap, ending early.
- **Domain matching:** subdomains count, lookalikes (`notyoutube.com`, `box.com` vs `x.com`) don't.
- **Rules:** nothing outside focus, one redirect per site, bypass allow rules, unique ids.
- **CSV:** escaping and formula-injection guarding.
- **Settings:** validation and the during-focus lock.
- **Hiding:** which pages count as feeds; Shorts redirect.

The end-to-end tests load the built extension into Chromium and check the whole loop: a listed site is redirected during focus (and an unlisted one isn't), the bypass needs the exact sentence and the full wait before it unlocks the site, real time is tracked on the active tab, the nudge appears and both answers work, the popup shows tracked time, the dashboard refuses to remove a site during focus, and hiding marks feeds and redirects Shorts. No real websites are contacted: requests to them are answered with a stub page.

### Fixing a broken hiding rule

1. Open the site, find the element that's back (right-click → Inspect).
2. Open `src/hide/sites/<site>.ts`.
3. Add or fix a selector in `css`. Use `html[data-tether-feed] <selector>` for things that should only be hidden on feed pages, or a plain selector for things hidden everywhere (sidebars, Shorts shelves).
4. If a new feed page appeared (a new path), add it to `isFeed` and add a case to `tests/unit/hide.test.ts`.
5. `npm test && npm run build`, then reload the extension.

### Adding a built-in hiding site

1. Create `src/hide/sites/<name>.ts` exporting a `HideSite` (see `src/hide/types.ts`).
2. Add it to `HIDE_SITES` in `src/hide/index.ts`.
3. Add its match pattern to `matches` in `src/entrypoints/hide.content.ts`.
4. Add it to `DEFAULT_SITES` in `src/lib/constants.ts` if it should be blocked by default.

## How it works inside

```
                       ┌───────────────────────────────────────────┐
 tab / window / idle   │   Background service worker               │
 events, 1-min alarm ─▶│                                           │
                       │  sync():                                  │
                       │   1. read browser state (Context)         │
                       │   2. tracker.advance → credit seconds     │──▶ chrome.storage.local
                       │   3. update nudge streak                  │      settings, daily, events,
                       │   4. focus.computeFocus → log transitions │      focus, bypasses
                       │   5. expire bypasses, prune old data      │
                       │   6. rules.buildRules → swap DNR rules    │──▶ chrome.storage.session
                       │   7. badge                                │      open segment, streak
                       │   8. inject nudge if due                  │
                       └────▲───────────────┬──────────────────────┘
                            │ messages      │ declarativeNetRequest redirect
           ┌────────────────┴───┐           ▼
           │ popup / dashboard /│     blocked.html?site=…&url=…
           │ block page / nudge │
           └────────────────────┘
```

**The worker is the single source of truth.** Pages and the overlay hold no state. They send messages (`status`, `flush`, `focus:start`, `focus:end`, `bypass`, `settings:save`, `data:delete`, `nudge:choice`) and render what comes back. The dashboard also reads storage directly for its charts.

**Nothing lives only in memory.** Chrome kills an MV3 service worker after about 30 seconds idle. So the open tracking segment and the nudge streak are kept in `chrome.storage.session` (survives the worker restarting, cleared when the browser closes), and everything else in `chrome.storage.local`. Timers use `chrome.alarms`, never `setTimeout`. Every event runs `sync()`, which reads storage, works out what happened since the last run, and writes back. All work is queued so two events arriving together can't overwrite each other's totals.

**Tracking is segment-based.** A segment is "host X since time T". On every event the worker closes the current segment (crediting `now - T` seconds to X, split at midnight, capped at 2 minutes), then opens a new one if the current page should be counted.

**Blocking is rebuilt, not patched.** Whenever focus state, the site list or a bypass changes, the worker computes the full set of dynamic rules from scratch and swaps it in if it differs. Each listed site gets a redirect rule for top-level page loads, using `requestDomains` so subdomains match and lookalike domains don't. A live bypass adds a higher-priority `allow` rule for that site. Outside focus there are no rules at all.

**Storage shape** (`chrome.storage.local`):

```ts
settings:   { sites: string[], nudgeMinutes, badgeThresholdMinutes,
              focusSchedule: { enabled, start: "HH:MM", end: "HH:MM" } }
daily:      { "2026-11-24": { "youtube.com": 1500.2, "github.com": 900 }, ... }
events:     [{ t: 1764000000000, type: "bypass", site: "youtube.com" }, ...]
focus:      { manualUntil, scheduleSuppressedUntil, wasActive }
bypasses:   { "youtube.com": 1764000300000 }
lastPruneDay: "2026-11-24"
```

## Troubleshooting

**The badge is empty.** It's blank on pages that aren't tracked (new tab, `chrome://` pages, extension pages). Open a normal website.

**A site isn't blocked during focus.** Check it's on the list in the dashboard, and that focus is actually on (popup). If you used a bypass in the last 5 minutes, it's unlocked until that runs out. Tabs opened before focus are reloaded automatically; if one slipped through, reload it.

**A feed is showing again.** The site changed its markup. See [Fixing a broken hiding rule](#fixing-a-broken-hiding-rule).

**Numbers look low for a day I was definitely online.** Time only counts while the browser window is focused and you're active (or audio is playing). Time in another app with the browser in the background doesn't count, by design.

**I changed code and nothing happened.** Run `npm run build` and click reload on Tether's card in `chrome://extensions`, or use `npm run dev`, which reloads for you.

**The worker seems stuck.** In `chrome://extensions`, click **service worker** on Tether's card to open its console. Errors are logged with a `[tether]` prefix.
