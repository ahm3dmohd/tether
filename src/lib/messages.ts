/** Messages between the extension pages / content scripts and the background worker. */
import { browser } from 'wxt/browser';
import type { FocusStatus } from './focus';

export type Request =
  | { type: 'status' }
  | { type: 'flush' }
  | { type: 'focus:start'; minutes: number }
  | { type: 'focus:end' }
  | { type: 'bypass'; site: string }
  | { type: 'settings:save'; settings: unknown }
  | { type: 'data:delete' }
  | { type: 'nudge:choice'; choice: 'leave' | 'continue' };

export interface Status {
  focus: FocusStatus;
  today: {
    totalSeconds: number;
    distractingSeconds: number;
    top: Array<{ name: string; seconds: number; distracting: boolean }>;
  };
}

export type Response =
  | { ok: true; status?: Status }
  | { ok: false; error: string };

/** Message the worker sends a tab to show the nudge overlay. */
export interface NudgeShow {
  type: 'nudge:show';
  site: string;
  minutes: number;
}

/** Sends a request to the background worker and waits for its answer. */
export async function send(req: Request): Promise<Response> {
  const res = (await browser.runtime.sendMessage(req)) as Response | undefined;
  return res ?? { ok: false, error: 'No response from Tether background worker.' };
}
