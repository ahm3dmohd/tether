/**
 * Tether background service worker: the single source of truth.
 *
 * Everything that changes state goes through `serial()`, so two events that
 * arrive together (say a tab switch and the 1-minute tick) can't both read the
 * old daily totals and overwrite each other.
 *
 * MV3 kills this worker after ~30 s of inactivity, so it keeps no state in
 * memory between events. Every run of `sync()` reads storage, works out what
 * happened since the last run, and writes the result back.
 */
import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  BYPASS_ALARM_PREFIX,
  BYPASS_MINUTES,
  IDLE_SECONDS,
  RETENTION_DAYS,
  TICK_ALARM,
} from '@/lib/constants';
import { hostFromUrl, matchSite } from '@/lib/domains';
import { computeFocus, endFocusEarly, startManualFocus, type FocusStatus } from '@/lib/focus';
import type { NudgeShow, Request, Response, Status } from '@/lib/messages';
import { buildRules } from '@/lib/rules';
import { checkSettingsChange, sanitizeSettings } from '@/lib/settings';
import { distractingSeconds, prune, secondsForHost, secondsForSite, siteRows, totalSeconds } from '@/lib/stats';
import { getLocal, getSession, setLocal, setSession, type LocalData } from '@/lib/store';
import { dayKey, formatBadge } from '@/lib/time';
import {
  advance,
  applyCredits,
  rearmNudge,
  shouldNudge,
  trackedHost,
  updateStreak,
  type Context,
  type IdleState,
} from '@/lib/tracker';
import type { EventType, Settings, TetherEvent } from '@/lib/types';

const BADGE_NORMAL = '#5f6368';
const BADGE_OVER = '#d93025';

// ---------------------------------------------------------------------------
// Serialisation

let chain: Promise<unknown> = Promise.resolve();

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch((err) => console.error('[tether]', err));
  return run;
}

// ---------------------------------------------------------------------------
// Reading the browser's state

interface FullContext extends Context {
  tabId?: number;
}

async function readContext(): Promise<FullContext> {
  const idleState = (await browser.idle.queryState(IDLE_SECONDS)) as IdleState;
  let win: Browser.windows.Window | undefined;
  try {
    win = await browser.windows.getLastFocused({ windowTypes: ['normal'] });
  } catch {
    win = undefined;
  }
  if (!win || !win.focused || win.id === undefined) {
    return { windowFocused: false, url: null, incognito: false, audible: false, idleState };
  }
  const [tab] = await browser.tabs.query({ active: true, windowId: win.id });
  return {
    windowFocused: true,
    url: tab?.url ?? null,
    incognito: Boolean(tab?.incognito || win.incognito),
    audible: Boolean(tab?.audible),
    idleState,
    tabId: tab?.id,
  };
}

function event(type: EventType, now: number, site?: string, detail?: string): TetherEvent {
  const e: TetherEvent = { t: now, type };
  if (site) e.site = site;
  if (detail) e.detail = detail;
  return e;
}

// ---------------------------------------------------------------------------
// Side effects

/** Reloads open tabs on the given sites so they hit the block rules. */
async function reloadTabsOn(sites: readonly string[]): Promise<void> {
  if (sites.length === 0) return;
  const tabs = await browser.tabs.query({});
  await Promise.all(
    tabs
      .filter((t) => t.id !== undefined && !t.incognito && matchSite(hostFromUrl(t.url), sites))
      .map((t) => browser.tabs.reload(t.id!).catch(() => undefined)),
  );
}

async function applyRules(local: LocalData, focus: FocusStatus, now: number): Promise<void> {
  const desired = buildRules({
    focusActive: focus.active,
    sites: local.settings.sites,
    bypasses: local.bypasses,
    now,
    blockedPageUrl: browser.runtime.getURL('/blocked.html'),
  });
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  const key = (rules: Array<{ id: number; priority?: number; action: unknown; condition: unknown }>) =>
    JSON.stringify(rules.map((r) => [r.id, r.priority, r.action, r.condition]).sort());
  if (key(existing) === key(desired)) return;
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: desired as unknown as Parameters<typeof browser.declarativeNetRequest.updateDynamicRules>[0]['addRules'],
  });
}

async function updateBadge(ctx: FullContext, local: LocalData, now: number): Promise<void> {
  // When the browser is in the background, leave the last badge as it was.
  if (!ctx.windowFocused) return;
  const host = ctx.incognito ? null : hostFromUrl(ctx.url);
  if (!host) {
    await browser.action.setBadgeText({ text: '' });
    return;
  }
  const today = dayKey(now);
  const { sites, badgeThresholdMinutes } = local.settings;
  const site = matchSite(host, sites);
  const seconds = site ? secondsForSite(local.daily, today, site, sites) : secondsForHost(local.daily, today, host);
  const over = site !== null && seconds >= badgeThresholdMinutes * 60;
  await browser.action.setBadgeText({ text: formatBadge(seconds) });
  await browser.action.setBadgeBackgroundColor({ color: over ? BADGE_OVER : BADGE_NORMAL });
  await browser.action.setTitle({
    title: site
      ? `Tether: ${Math.floor(seconds / 60)} min on ${site} today${over ? ' (over your limit)' : ''}`
      : `Tether: ${Math.floor(seconds / 60)} min on ${host} today`,
  });
}

/** Injects the nudge overlay into a tab. Returns false if the page can't take scripts. */
async function showNudge(tabId: number, site: string, seconds: number): Promise<boolean> {
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: ['/nudge.js'] });
    const msg: NudgeShow = { type: 'nudge:show', site, minutes: Math.max(1, Math.round(seconds / 60)) };
    await browser.tabs.sendMessage(tabId, msg);
    return true;
  } catch (err) {
    console.warn('[tether] could not show nudge', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// The main loop

/**
 * Brings everything up to date: credits time since the last run, updates the
 * nudge streak, works out focus, expires bypasses, swaps block rules, updates
 * the badge and shows a nudge if one is due. Safe to call at any time and as
 * often as you like.
 */
async function sync(): Promise<LocalData> {
  const now = Date.now();
  const today = dayKey(now);
  const local = await getLocal();
  const session = await getSession();
  const ctx = await readContext();
  const { settings } = local;
  const nudgeSeconds = settings.nudgeMinutes * 60;

  // 1. Time accounting
  const { closed, credits, segment } = advance(session.segment, ctx, now);
  local.daily = applyCredits(local.daily, credits);
  let streak = updateStreak(session.streak, closed, settings.sites, nudgeSeconds);

  // 2. Focus transitions
  const focus = computeFocus(settings.focusSchedule, local.focus, now);
  const focusJustStarted = focus.active && !local.focus.wasActive;
  if (focus.active !== local.focus.wasActive) {
    local.events = [
      ...local.events,
      event(focus.active ? 'focus_started' : 'focus_ended', now, undefined, focus.reason ?? undefined),
    ];
    local.focus = { ...local.focus, wasActive: focus.active };
  }

  // 3. Bypass expiry
  const expired = Object.entries(local.bypasses)
    .filter(([, until]) => until <= now)
    .map(([site]) => site);
  for (const site of expired) delete local.bypasses[site];

  // 4. Retention
  if (local.lastPruneDay !== today) {
    const pruned = prune(local.daily, local.events, now, RETENTION_DAYS);
    local.daily = pruned.daily;
    local.events = pruned.events;
    local.lastPruneDay = today;
  }

  // 5. Nudge
  const current = trackedHost(ctx);
  const currentSite = matchSite(current, settings.sites);
  if (streak && ctx.tabId !== undefined && shouldNudge(streak, currentSite, now)) {
    if (await showNudge(ctx.tabId, streak.site, streak.seconds)) {
      streak = { ...streak, nudgeShownAt: now };
      local.events = [...local.events, event('nudge_shown', now, streak.site)];
    } else {
      // Page refused scripts (e.g. a browser error page). Try again in a minute.
      streak = { ...streak, nextNudgeAt: streak.seconds + 60 };
    }
  }

  await setLocal({
    daily: local.daily,
    events: local.events,
    focus: local.focus,
    bypasses: local.bypasses,
    lastPruneDay: local.lastPruneDay,
  });
  await setSession({ segment, streak });

  // 6. Blocking and badge
  await applyRules(local, focus, now);
  if (focusJustStarted) await reloadTabsOn(settings.sites);
  else if (focus.active && expired.length) await reloadTabsOn(expired);
  await updateBadge(ctx, local, now);

  return local;
}

function buildStatus(local: LocalData, now: number): Status {
  const today = dayKey(now);
  const { sites } = local.settings;
  return {
    focus: computeFocus(local.settings.focusSchedule, local.focus, now),
    today: {
      totalSeconds: totalSeconds(local.daily, today),
      distractingSeconds: distractingSeconds(local.daily, today, sites),
      top: siteRows(local.daily, [today], sites)
        .slice(0, 3)
        .map((r) => ({ name: r.name, seconds: r.total, distracting: r.distracting })),
    },
  };
}

// ---------------------------------------------------------------------------
// Requests from the popup, block page, dashboard and nudge overlay

async function handle(req: Request, sender: { tab?: { id?: number } }): Promise<Response> {
  const now = Date.now();
  switch (req.type) {
    case 'status':
    case 'flush': {
      const local = await sync();
      return { ok: true, status: buildStatus(local, now) };
    }

    case 'focus:start': {
      const minutes = Math.round(Number(req.minutes));
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60) {
        return { ok: false, error: 'Invalid focus length.' };
      }
      const local = await getLocal();
      await setLocal({ focus: startManualFocus(local.focus, minutes, now) });
      const after = await sync();
      return { ok: true, status: buildStatus(after, now) };
    }

    case 'focus:end': {
      // The friction (typed sentence + wait) happens on the page that sends
      // this. The worker only records it.
      const local = await getLocal();
      const before = computeFocus(local.settings.focusSchedule, local.focus, now);
      if (!before.active) return { ok: false, error: 'Focus is not on.' };
      const focus = { ...endFocusEarly(local.settings.focusSchedule, local.focus, now), wasActive: false };
      await setLocal({
        focus,
        events: [...local.events, event('focus_ended_early', now, undefined, before.reason ?? undefined)],
      });
      const after = await sync();
      return { ok: true, status: buildStatus(after, now) };
    }

    case 'bypass': {
      const local = await getLocal();
      const site = matchSite(req.site, local.settings.sites);
      if (!site) return { ok: false, error: 'That site is not on your list.' };
      if (!computeFocus(local.settings.focusSchedule, local.focus, now).active) {
        return { ok: true }; // Focus already ended; nothing to unlock.
      }
      const until = now + BYPASS_MINUTES * 60_000;
      await setLocal({
        bypasses: { ...local.bypasses, [site]: until },
        events: [...local.events, event('bypass', now, site)],
      });
      await browser.alarms.create(BYPASS_ALARM_PREFIX + site, { when: until + 500 });
      await sync();
      return { ok: true };
    }

    case 'settings:save': {
      await sync(); // credit time under the old site list first
      const local = await getLocal();
      const next: Settings = sanitizeSettings(req.settings as Partial<Settings>);
      const focus = computeFocus(local.settings.focusSchedule, local.focus, now);
      const check = checkSettingsChange(local.settings, next, focus.active);
      if (!check.ok) return { ok: false, error: check.reason };
      await setLocal({ settings: next });
      const after = await sync();
      return { ok: true, status: buildStatus(after, now) };
    }

    case 'data:delete': {
      await setLocal({ daily: {}, events: [] });
      const ctx = await readContext();
      const host = trackedHost(ctx);
      await setSession({ streak: null, segment: host ? { host, since: now } : null });
      const after = await sync();
      return { ok: true, status: buildStatus(after, now) };
    }

    case 'nudge:choice': {
      const tabId = sender.tab?.id;
      const local = await getLocal();
      const session = await getSession();
      const streak = session.streak;
      const site = streak?.site;
      if (req.choice === 'leave') {
        await setLocal({ events: [...local.events, event('nudge_left', now, site)] });
        await setSession({ streak: null });
        if (tabId !== undefined) await browser.tabs.remove(tabId).catch(() => undefined);
      } else {
        await setLocal({ events: [...local.events, event('nudge_ignored', now, site)] });
        if (streak) await setSession({ streak: rearmNudge(streak, local.settings.nudgeMinutes * 60) });
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: 'Unknown request.' };
  }
}

// ---------------------------------------------------------------------------
// Wiring

async function ensureSetup(): Promise<void> {
  browser.idle.setDetectionInterval(IDLE_SECONDS);
  const tick = await browser.alarms.get(TICK_ALARM);
  if (!tick) await browser.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
}

export default defineBackground(() => {
  // Listeners must be registered synchronously so Chrome can wake the worker for them.
  const kick = () => void serial(sync);

  browser.runtime.onInstalled.addListener(() => {
    void serial(async () => {
      const raw = await browser.storage.local.get('settings');
      if (!raw.settings) await setLocal({ settings: sanitizeSettings(undefined) });
      await ensureSetup();
      return sync();
    });
  });
  browser.runtime.onStartup.addListener(() => {
    // A new browser session: drop any segment left over from before the restart.
    void serial(async () => {
      await setSession({ segment: null, streak: null });
      await ensureSetup();
      return sync();
    });
  });

  browser.tabs.onActivated.addListener(kick);
  browser.tabs.onRemoved.addListener(kick);
  browser.tabs.onUpdated.addListener((_id, change, tab) => {
    if (tab.active && (change.url !== undefined || change.audible !== undefined)) kick();
  });
  browser.windows.onFocusChanged.addListener(kick);
  browser.idle.onStateChanged.addListener(kick);
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TICK_ALARM || alarm.name.startsWith(BYPASS_ALARM_PREFIX)) kick();
  });

  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return false;
    serial(() => handle(msg as Request, sender)).then(sendResponse, (err: unknown) =>
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
    );
    return true; // keep the channel open for the async answer
  });

  void serial(async () => {
    await ensureSetup();
    return sync();
  });
});
