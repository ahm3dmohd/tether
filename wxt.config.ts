import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  outDir: 'dist',
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Tether',
    description: 'Keeps YouTube and social media from eating your day: live time badge, nudges, focus blocking.',
    permissions: ['tabs', 'storage', 'alarms', 'idle', 'declarativeNetRequest', 'scripting'],
    // <all_urls> is needed so sites you add yourself can be tracked, blocked
    // and nudged. Chrome shows "read and change all your data" for it.
    host_permissions: ['<all_urls>'],
    action: { default_title: 'Tether' },
    // The block page is the target of a declarativeNetRequest redirect from
    // ordinary web pages, which Chrome only allows for web-accessible pages.
    web_accessible_resources: [{ resources: ['blocked.html'], matches: ['<all_urls>'] }],
    // Tracking in incognito is a non-goal.
    incognito: 'not_allowed',
  },
});
