import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // Fixed zone so midnight-split and schedule tests mean the same thing everywhere.
    env: { TZ: 'Asia/Bahrain' },
  },
});
