/**
 * Typed access to browser.storage.
 *
 * - storage.local survives browser restarts: settings, daily totals, events,
 *   focus state, bypasses.
 * - storage.session lives until the browser closes: the open tracking segment
 *   and the nudge streak. It survives the MV3 service worker being killed,
 *   which is the point. Nothing important is kept only in worker memory.
 */
import { browser } from 'wxt/browser';
import { emptyFocusState } from './focus';
import { sanitizeSettings } from './settings';
import type { Bypasses, DailyData, FocusState, Segment, Settings, Streak, TetherEvent } from './types';

export interface LocalData {
  settings: Settings;
  daily: DailyData;
  events: TetherEvent[];
  focus: FocusState;
  bypasses: Bypasses;
  lastPruneDay: string;
}

export interface SessionData {
  segment: Segment | null;
  streak: Streak | null;
}

export async function getLocal(): Promise<LocalData> {
  const raw = (await browser.storage.local.get(null)) as Partial<LocalData>;
  return {
    settings: sanitizeSettings(raw.settings),
    daily: raw.daily ?? {},
    events: raw.events ?? [],
    focus: { ...emptyFocusState(), ...(raw.focus ?? {}) },
    bypasses: raw.bypasses ?? {},
    lastPruneDay: raw.lastPruneDay ?? '',
  };
}

export async function setLocal(patch: Partial<LocalData>): Promise<void> {
  await browser.storage.local.set(patch);
}

export async function getSession(): Promise<SessionData> {
  const raw = (await browser.storage.session.get(['segment', 'streak'])) as Partial<SessionData>;
  return { segment: raw.segment ?? null, streak: raw.streak ?? null };
}

export async function setSession(patch: Partial<SessionData>): Promise<void> {
  await browser.storage.session.set(patch);
}
