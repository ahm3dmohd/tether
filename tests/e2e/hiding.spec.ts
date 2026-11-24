/// <reference types="chrome" />
import { expect, scheduleOff, test } from './fixtures';

test('YouTube: the home feed is flagged for hiding, a video is not, and Shorts open in the normal player', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await scheduleOff(page);
  await page.goto('https://www.youtube.com/');
  await expect(page.locator('html')).toHaveAttribute('data-tether-feed', '');
  await expect(page.locator('style#tether-hide')).toHaveCount(1);

  await page.goto('https://www.youtube.com/watch?v=abc');
  await expect(page.locator('html')).not.toHaveAttribute('data-tether-feed', '');

  await page.goto('https://www.youtube.com/shorts/Short_1');
  await expect(page).toHaveURL('https://www.youtube.com/watch?v=Short_1');
});

test('sites not on the built-in list get no hiding script', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://example.org/');
  await expect(page.locator('style#tether-hide')).toHaveCount(0);
});
