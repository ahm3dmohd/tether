/**
 * The nudge overlay. Not a content script: the worker injects it into the
 * active tab with chrome.scripting only when a nudge is due, so Tether runs no
 * code on pages it has no reason to touch.
 *
 * It renders inside a shadow root so the page's CSS can't restyle it
 * and its CSS can't leak into the page.
 */
import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import type { NudgeShow } from '@/lib/messages';

const CSS = `
  :host { all: initial; }
  .backdrop {
    position: fixed; inset: 0; z-index: 2147483647;
    display: grid; place-items: center;
    background: rgba(15, 23, 42, 0.72);
    backdrop-filter: blur(6px);
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .card {
    width: min(420px, calc(100vw - 32px));
    padding: 28px; border-radius: 16px;
    background: #ffffff; color: #0f172a;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
    text-align: center;
  }
  h2 { margin: 0 0 6px; font-size: 22px; line-height: 1.3; font-weight: 650; }
  p { margin: 0 0 22px; color: #475569; }
  .row { display: flex; gap: 10px; }
  button {
    flex: 1; padding: 12px 14px; border-radius: 10px; cursor: pointer;
    font: inherit; font-weight: 600; border: 1px solid transparent;
  }
  .leave { background: #0f766e; color: #fff; }
  .leave:hover { background: #115e59; }
  .stay { background: transparent; color: #475569; border-color: #cbd5e1; }
  .stay:hover { background: #f1f5f9; }
  button:focus-visible { outline: 3px solid #5eead4; outline-offset: 2px; }
  @media (prefers-color-scheme: dark) {
    .card { background: #0f172a; color: #e2e8f0; }
    p { color: #94a3b8; }
    .stay { color: #cbd5e1; border-color: #334155; }
    .stay:hover { background: #1e293b; }
  }
`;

let host: HTMLElement | null = null;
let paused: HTMLMediaElement[] = [];

function close(): void {
  host?.remove();
  host = null;
}

function show(site: string, minutes: number): void {
  close();

  // Pause anything playing so the question gets an answer.
  paused = [...document.querySelectorAll<HTMLMediaElement>('video, audio')].filter((m) => !m.paused);
  paused.forEach((m) => m.pause());

  host = document.createElement('tether-nudge');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>${CSS}</style>
    <div class="backdrop" role="dialog" aria-modal="true" aria-labelledby="t">
      <div class="card">
        <h2 id="t"></h2>
        <p>Keep going or leave?</p>
        <div class="row">
          <button class="leave" type="button">Leave</button>
          <button class="stay" type="button">Keep going</button>
        </div>
      </div>
    </div>`;
  root.getElementById('t')!.textContent = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} on ${site}.`;

  const leave = root.querySelector<HTMLButtonElement>('.leave')!;
  const stay = root.querySelector<HTMLButtonElement>('.stay')!;
  leave.addEventListener('click', () => {
    void browser.runtime.sendMessage({ type: 'nudge:choice', choice: 'leave' });
  });
  stay.addEventListener('click', () => {
    close();
    paused.forEach((m) => void m.play().catch(() => undefined));
    paused = [];
    void browser.runtime.sendMessage({ type: 'nudge:choice', choice: 'continue' });
  });

  // Keep keyboard events from reaching the page (YouTube's "k" to play, etc.).
  host.addEventListener('keydown', (e) => e.stopPropagation(), true);

  document.documentElement.appendChild(host);
  leave.focus();
}

export default defineUnlistedScript(() => {
  const w = window as unknown as { __tetherNudge?: boolean };
  if (w.__tetherNudge) return; // already injected into this page
  w.__tetherNudge = true;

  browser.runtime.onMessage.addListener((msg: unknown) => {
    const m = msg as NudgeShow;
    if (m?.type === 'nudge:show') show(m.site, m.minutes);
  });
});
