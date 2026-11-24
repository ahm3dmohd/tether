/// <reference types="chrome" />
/**
 * Loads the built extension (dist/chrome-mv3) into Chromium. Run
 * `npm run build` first; `npm run test:e2e` does it for you.
 *
 * Real sites are never contacted: requests to the listed sites are answered
 * with a stub page by Playwright, so the tests work offline and don't depend
 * on YouTube's markup.
 */
import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import path from 'node:path';

const EXTENSION = path.resolve('dist/chrome-mv3');

export const test = base.extend<{ context: BrowserContext; worker: Worker; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await context.route(/^https?:\/\/([^/]*\.)?(youtube\.com|example\.org)\//, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><title>stub</title><h1>Stub page for ${route.request().url()}</h1>`,
      }),
    );
    await use(context);
    await context.close();
  },
  worker: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(worker);
  },
  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },
});

export const expect = test.expect;

/**
 * Turns the daily schedule off so the tests behave the same at any hour.
 * Writes storage directly: through the UI this is (deliberately) refused
 * while scheduled focus is on.
 */
export async function scheduleOff(page: Page) {
  const res = await page.evaluate(async () => {
    const { settings } = await chrome.storage.local.get<Record<string, any>>('settings');
    await chrome.storage.local.set({
      settings: { ...settings, focusSchedule: { enabled: false, start: '06:00', end: '18:00' } },
    });
    return chrome.runtime.sendMessage({ type: 'flush' });
  });
  expect(res.ok).toBe(true);
  expect(res.status.focus.active).toBe(false);
}
