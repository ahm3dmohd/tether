import '@/ui/theme.css';
import './style.css';
import { browser } from 'wxt/browser';
import { send, type Status } from '@/lib/messages';
import { formatDuration } from '@/lib/time';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function render(status: Status): void {
  const { today, focus } = status;
  $('distracting').textContent = formatDuration(today.distractingSeconds);
  $('total').textContent = formatDuration(today.totalSeconds);

  const list = $('top');
  list.replaceChildren(
    ...today.top.map((s) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'name';
      if (s.distracting) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.title = 'On your distracting list';
        name.append(dot);
      }
      name.append(s.name);
      const time = document.createElement('span');
      time.textContent = formatDuration(s.seconds);
      li.append(name, time);
      return li;
    }),
  );

  const pill = $('focus-pill');
  pill.classList.toggle('on', focus.active);
  pill.textContent = focus.active ? 'Focus on' : 'Focus off';
  $('focus-text').textContent = focus.active
    ? `${focus.reason === 'schedule' ? 'Scheduled focus' : 'Focus session'} until ${clock(focus.endsAt!)}. Your listed sites are blocked.`
    : 'Block your listed sites for a while:';
  $('start-row').hidden = focus.active;
  $('end-focus').hidden = !focus.active;
}

function showError(message: string): void {
  const el = $('error');
  el.textContent = message;
  el.hidden = false;
}

async function refresh(): Promise<void> {
  const res = await send({ type: 'status' });
  if (res.ok && res.status) render(res.status);
  else if (!res.ok) showError(res.error);
}

document.querySelectorAll<HTMLButtonElement>('[data-minutes]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const res = await send({ type: 'focus:start', minutes: Number(btn.dataset.minutes) });
    if (res.ok && res.status) render(res.status);
    else if (!res.ok) showError(res.error);
  });
});

$('end-focus').addEventListener('click', async () => {
  // Ending early costs the same as a bypass, and 30 s of waiting doesn't fit
  // in a popup that closes when you click away, so it gets a full tab.
  await browser.tabs.create({ url: browser.runtime.getURL('/blocked.html?mode=end') });
  window.close();
});

$('dashboard').addEventListener('click', async (e) => {
  e.preventDefault();
  await browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
  window.close();
});

void refresh();
