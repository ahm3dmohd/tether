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

// Same tokens as src/ui/theme.css (zinc + teal). Written by hand because the
// overlay lives in a shadow root inside someone else's page.
const CSS = `
  :host { all: initial; }
  .backdrop {
    position: fixed; inset: 0; z-index: 2147483647;
    display: grid; place-items: center; padding: 16px;
    background: oklch(0.141 0.005 285.823 / 0.6);
    backdrop-filter: blur(8px);
    font: 14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    animation: fade 160ms ease-out;
  }
  .card {
    width: min(400px, 100%);
    padding: 24px; border-radius: 16px;
    background: oklch(1 0 0); color: oklch(0.141 0.005 285.823);
    border: 1px solid oklch(0.92 0.004 286.32);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 24px 64px -12px rgb(0 0 0 / 0.35);
    animation: rise 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .brand {
    display: flex; align-items: center; gap: 8px; margin: 0 0 16px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase;
    color: oklch(0.552 0.016 285.938);
  }
  .brand::before {
    content: ""; width: 8px; height: 8px; border-radius: 999px; background: oklch(0.511 0.096 186.391);
  }
  h2 { margin: 0 0 4px; font-size: 20px; line-height: 1.3; font-weight: 600; letter-spacing: -0.01em; }
  p { margin: 0 0 20px; color: oklch(0.552 0.016 285.938); }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  button {
    height: 40px; padding: 0 16px; border-radius: 10px; cursor: pointer;
    font: inherit; font-weight: 500; border: 1px solid transparent;
    transition: background-color 120ms, box-shadow 120ms;
  }
  .leave { background: oklch(0.511 0.096 186.391); color: oklch(0.984 0.014 180.72); }
  .leave:hover { background: oklch(0.437 0.078 188.216); }
  .stay {
    background: oklch(1 0 0); color: oklch(0.141 0.005 285.823);
    border-color: oklch(0.92 0.004 286.32); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
  }
  .stay:hover { background: oklch(0.967 0.001 286.375); }
  button:focus-visible { outline: none; box-shadow: 0 0 0 3px oklch(0.704 0.14 182.503 / 0.5); }
  @keyframes fade { from { opacity: 0; } }
  @keyframes rise { from { opacity: 0; transform: translateY(8px) scale(0.98); } }
  @media (prefers-reduced-motion: reduce) { .backdrop, .card { animation: none; } }
  @media (prefers-color-scheme: dark) {
    .card { background: oklch(0.21 0.006 285.885); color: oklch(0.985 0 0); border-color: oklch(1 0 0 / 10%); }
    .brand, p { color: oklch(0.705 0.015 286.067); }
    .brand::before, .leave { background: oklch(0.777 0.152 181.912); }
    .leave { color: oklch(0.277 0.046 192.524); }
    .leave:hover { background: oklch(0.855 0.138 181.071); }
    .stay { background: transparent; color: oklch(0.985 0 0); border-color: oklch(1 0 0 / 15%); }
    .stay:hover { background: oklch(0.274 0.006 286.033); }
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
        <div class="brand">Tether</div>
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
