/// <reference types="chrome" />
import { dayKey } from '../../src/lib/time';
import { expect, test } from './fixtures';

test('time on the active tab is tracked, and a due nudge appears and is answered', async ({
  context,
  extensionId,
}) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const flush = () =>
    popup.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'flush' });
      return {
        daily: (await chrome.storage.local.get<Record<string, any>>('daily')).daily ?? {},
        events: (await chrome.storage.local.get<Record<string, any>>('events')).events ?? [],
        segment: (await chrome.storage.session.get<Record<string, any>>('segment')).segment ?? null,
      };
    });
  await popup.evaluate(async () => {
    const { settings } = await chrome.storage.local.get<Record<string, any>>('settings');
    await chrome.storage.local.set({ settings: { ...settings, focusSchedule: { ...settings.focusSchedule, enabled: false } } });
  });
  await flush();

  // Tracking: the active YouTube tab accrues time.
  const page = await context.newPage();
  await page.goto('https://www.youtube.com/watch?v=abc');
  await page.bringToFront();
  await expect.poll(async () => (await flush()).segment?.host).toBe('youtube.com');
  await page.waitForTimeout(2_500);
  const after = await flush();
  const seconds = after.daily[dayKey(Date.now())]?.['youtube.com'] ?? 0;
  expect(seconds).toBeGreaterThan(2);
  expect(seconds).toBeLessThan(30);

  // Nudge: pretend 15 continuous minutes have passed.
  const seedStreak = () =>
    popup.evaluate(() =>
      chrome.storage.session.set({
        streak: { site: 'youtube.com', seconds: 900, lastAt: Date.now(), nextNudgeAt: 900, nudgeShownAt: 0 },
      }),
    );
  await seedStreak();
  await flush();
  const overlay = page.locator('tether-nudge');
  await expect(overlay.getByRole('heading')).toHaveText(/^15 minutes on youtube\.com\.$/);
  await overlay.getByRole('button', { name: 'Keep going' }).click();
  await expect(overlay).toHaveCount(0);
  await expect.poll(async () => (await flush()).events.map((e: { type: string }) => e.type)).toEqual(
    expect.arrayContaining(['nudge_shown', 'nudge_ignored']),
  );

  // "Leave" closes the tab.
  await page.bringToFront();
  await seedStreak();
  await flush();
  const closed = page.waitForEvent('close');
  await overlay.getByRole('button', { name: 'Leave' }).click();
  await closed;
  expect((await flush()).events.map((e: { type: string }) => e.type)).toContain('nudge_left');
});
