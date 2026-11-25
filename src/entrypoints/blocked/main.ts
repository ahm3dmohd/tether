/**
 * The block page. Two modes:
 *   blocked.html?site=youtube.com&url=<original>   a listed site during focus
 *   blocked.html?mode=end                          ending focus early (from the popup)
 * Both put the same friction between the user and the way out.
 */
import '@/ui/theme.css';
import { browser } from 'wxt/browser';
import { BYPASS_MINUTES } from '@/lib/constants';
import type { FocusStatus } from '@/lib/focus';
import { send } from '@/lib/messages';
import { parseBlockedUrl } from '@/lib/rules';
import { formatDuration } from '@/lib/time';
import { mountFriction } from '@/ui/friction';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const { site, url, mode } = parseBlockedUrl(location.href);
const ending = mode === 'end';

async function closeTab(): Promise<void> {
  const tab = await browser.tabs.getCurrent();
  if (tab?.id !== undefined) await browser.tabs.remove(tab.id);
  else window.close();
}

/** `html` must be a fixed string; put user-controlled text in with textContent afterwards. */
function finish(html: string): void {
  $('escape').hidden = true;
  $('actions').hidden = true;
  const done = $('done');
  done.innerHTML = html;
  done.hidden = false;
  done.querySelector('[data-close]')?.addEventListener('click', () => void closeTab());
}

function describe(focus: FocusStatus): string {
  if (!focus.active || focus.endsAt === null) return 'Focus has ended.';
  const left = formatDuration((focus.endsAt - Date.now()) / 1000);
  const until = new Date(focus.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${focus.reason === 'schedule' ? 'Scheduled focus' : 'Focus session'} until ${until} (${left} left).`;
}

let ended = false;

async function poll(): Promise<void> {
  const res = await send({ type: 'status' });
  if (!res.ok || !res.status || ended) return;
  const focus = res.status.focus;
  $('subtitle').textContent = describe(focus);
  if (!focus.active) {
    ended = true;
    if (ending) {
      finish('<p>Focus is already off.</p><button type="button" class="primary" data-close>Close tab</button>');
    } else {
      $('title').textContent = 'Focus is over';
      finish(
        url
          ? '<p>You can go back to where you were.</p><a class="btn primary" id="continue"></a>'
          : '<p>Nothing is blocked now.</p>',
      );
      const cont = document.getElementById('continue') as HTMLAnchorElement | null;
      if (cont && url) {
        cont.textContent = `Continue to ${site ?? 'the site'}`;
        cont.href = url;
      }
    }
  }
}

if (ending) {
  document.title = 'End focus early? - Tether';
  $('title').textContent = 'End focus early?';
  $('close').textContent = 'Keep focusing';
  $('escape-summary').textContent = 'Yes, end it';
  mountFriction($('friction'), {
    actionLabel: 'End focus now',
    async onConfirm() {
      const res = await send({ type: 'focus:end' });
      if (!res.ok) throw new Error(res.error);
      ended = true;
      $('subtitle').textContent = 'Focus is off. Logged as ended early.';
      finish('<p>Your sites are unblocked until the next focus.</p><button type="button" class="primary" data-close>Close tab</button>');
    },
  });
} else {
  const name = site ?? 'This site';
  document.title = `${name} is blocked - Tether`;
  $('title').textContent = `${name} is blocked`;
  mountFriction($('friction'), {
    actionLabel: `Unlock ${name} for ${BYPASS_MINUTES} minutes`,
    async onConfirm() {
      if (!site) throw new Error('No site to unlock.');
      const res = await send({ type: 'bypass', site });
      if (!res.ok) throw new Error(res.error);
      ended = true;
      if (url) location.replace(url);
      else {
        finish('<p id="unlocked"></p>');
        $('unlocked').textContent = `${name} is unlocked for ${BYPASS_MINUTES} minutes.`;
      }
    },
  });
}

$('close').addEventListener('click', () => void closeTab());
// The friction input focuses itself, but the details element starts closed.
$('escape').addEventListener('toggle', () => {
  if (($('escape') as HTMLDetailsElement).open) $('friction').querySelector('input')?.focus();
});

void poll();
setInterval(() => void poll(), 15_000);
