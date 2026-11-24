/// <reference types="chrome" />
import { BYPASS_SENTENCE } from '../../src/lib/constants';
import { dayKey } from '../../src/lib/time';
import { expect, scheduleOff, test } from './fixtures';

test('a listed site loads outside focus and is redirected to the block page during focus', async ({
  context,
  extensionId,
}) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await scheduleOff(popup);
  await popup.reload();
  await expect(popup.locator('#focus-pill')).toHaveText('Focus off');

  const site = await context.newPage();
  await site.goto('https://www.youtube.com/watch?v=abc');
  await expect(site.locator('h1')).toContainText('Stub page');

  // A site not on the list is never touched.
  const other = await context.newPage();
  await other.goto('https://example.org/');
  await expect(other.locator('h1')).toContainText('Stub page');

  await popup.getByRole('button', { name: 'Focus 1h' }).click();
  await expect(popup.locator('#focus-pill')).toHaveText('Focus on');

  // The open tab is reloaded into the block page; a fresh navigation is redirected too.
  await expect(site).toHaveURL(/blocked\.html\?site=youtube\.com&url=https:\/\/www\.youtube\.com\/watch\?v=abc/);
  const fresh = await context.newPage();
  await fresh.goto('https://m.youtube.com/');
  await expect(fresh).toHaveURL(/blocked\.html\?site=youtube\.com/);
  await expect(fresh.locator('h1')).toHaveText('youtube.com is blocked');

  await other.reload();
  await expect(other.locator('h1')).toContainText('Stub page');
});

test('the bypass takes the exact sentence and a 30 s wait, then unlocks the site', async ({
  context,
  extensionId,
}) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await scheduleOff(popup);
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:start', minutes: 60 }));

  const page = await context.newPage();
  await page.goto('https://www.youtube.com/watch?v=xyz');
  await expect(page).toHaveURL(/blocked\.html/);
  await page.bringToFront();

  await page.getByText('I need it anyway').click();
  const input = page.locator('.friction-input');
  const go = page.locator('.friction-go');

  await input.pressSequentially('I am choosing to waste time');
  await expect(page.locator('.friction-status')).toContainText('Not quite');
  await expect(go).toBeDisabled();

  await input.fill('');
  await input.pressSequentially(BYPASS_SENTENCE);
  await expect(page.locator('.friction-status')).toContainText('Now wait');
  await page.waitForTimeout(5_000);
  await expect(go).toBeDisabled(); // still waiting

  await expect(go).toBeEnabled({ timeout: 40_000 });
  await go.click();
  await expect(page).toHaveURL('https://www.youtube.com/watch?v=xyz');
  await expect(page.locator('h1')).toContainText('Stub page');

  const events = await popup.evaluate(async () => (await chrome.storage.local.get<Record<string, any>>('events')).events);
  expect(events.some((e: { type: string; site?: string }) => e.type === 'bypass' && e.site === 'youtube.com')).toBe(true);
});

test('the popup shows tracked time', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await scheduleOff(popup);
  const today = dayKey(Date.now());
  await popup.evaluate(
    (day) =>
      chrome.storage.local.set({
        daily: { [day]: { 'youtube.com': 23 * 60 + 10, 'm.youtube.com': 120, 'github.com': 600 } },
      }),
    today,
  );
  await popup.reload();
  // youtube.com + m.youtube.com, folded together
  await expect(popup.locator('#distracting')).toHaveText(/^2[56]m$/);
  await expect(popup.locator('#top li').first()).toContainText('youtube.com');
  await expect(popup.locator('#top li')).toHaveCount(2);
});

test('the dashboard renders stats and refuses to remove a site during focus', async ({ context, extensionId }) => {
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await scheduleOff(dash);
  await dash.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:start', minutes: 60 }));
  await dash.reload();
  await expect(dash.locator('#locked')).toBeVisible();
  await expect(dash.locator('button[aria-label="Remove youtube.com"]')).toBeDisabled();

  const res = await dash.evaluate(async () => {
    const { settings } = await chrome.storage.local.get<Record<string, any>>('settings');
    return chrome.runtime.sendMessage({
      type: 'settings:save',
      settings: { ...settings, sites: settings.sites.filter((s: string) => s !== 'youtube.com') },
    });
  });
  expect(res.ok).toBe(false);
  expect(res.error).toContain("Can't remove youtube.com");
});
