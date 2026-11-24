import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  // One browser with the extension at a time: tests share extension storage.
  workers: 1,
  reporter: [['list']],
  use: { trace: 'off' },
});
