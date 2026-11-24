/**
 * The "make every way out cost effort" flow, shared by the bypass and the
 * end-focus-early screens: type a sentence exactly (no pasting), then wait
 * 30 seconds with the page in front of you. Only then does the button unlock.
 */
import { BYPASS_SENTENCE, BYPASS_WAIT_SECONDS } from '@/lib/constants';

export interface FrictionOptions {
  /** Label of the final button, e.g. "Unlock youtube.com for 5 minutes". */
  actionLabel: string;
  onConfirm(): Promise<void>;
}

/** True when the typed text matches the sentence. Exact, except for surrounding spaces. */
export function sentenceMatches(typed: string, sentence = BYPASS_SENTENCE): boolean {
  return typed.trim() === sentence;
}

export function mountFriction(container: HTMLElement, opts: FrictionOptions): void {
  container.innerHTML = `
    <p class="friction-label">Type this sentence exactly:</p>
    <p class="friction-sentence" aria-hidden="false"></p>
    <input type="text" class="friction-input" autocomplete="off" spellcheck="false"
           aria-label="Type the sentence" />
    <p class="friction-status muted" aria-live="polite"></p>
    <button type="button" class="primary friction-go" disabled></button>
  `;
  const sentenceEl = container.querySelector<HTMLElement>('.friction-sentence')!;
  const input = container.querySelector<HTMLInputElement>('.friction-input')!;
  const status = container.querySelector<HTMLElement>('.friction-status')!;
  const go = container.querySelector<HTMLButtonElement>('.friction-go')!;

  sentenceEl.textContent = `“${BYPASS_SENTENCE}”`;
  go.textContent = opts.actionLabel;

  // Typing it is the point, so no pasting, dropping or autofill shortcuts.
  for (const ev of ['paste', 'drop'] as const) input.addEventListener(ev, (e) => e.preventDefault());
  sentenceEl.addEventListener('copy', (e) => e.preventDefault());

  let remaining = BYPASS_WAIT_SECONDS;
  let timer: number | undefined;

  const stop = () => {
    if (timer !== undefined) window.clearInterval(timer);
    timer = undefined;
  };

  const render = () => {
    if (!sentenceMatches(input.value)) {
      status.textContent = input.value ? 'Not quite. It has to match exactly.' : '';
      go.disabled = true;
      return;
    }
    if (remaining > 0) {
      status.textContent = document.hidden
        ? `Paused. Come back to this tab to keep waiting (${remaining} s left).`
        : `Now wait ${remaining} s. Still sure?`;
      go.disabled = true;
    } else {
      status.textContent = 'Okay. Your call.';
      go.disabled = false;
    }
  };

  input.addEventListener('input', () => {
    stop();
    remaining = BYPASS_WAIT_SECONDS;
    if (sentenceMatches(input.value)) {
      timer = window.setInterval(() => {
        if (document.hidden) return render(); // the clock only runs while you look at it
        remaining -= 1;
        if (remaining <= 0) stop();
        render();
      }, 1000);
    }
    render();
  });
  document.addEventListener('visibilitychange', render);

  go.addEventListener('click', async () => {
    if (go.disabled) return;
    go.disabled = true;
    try {
      await opts.onConfirm();
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : String(err);
      status.classList.add('error');
      go.disabled = false;
    }
  });

  input.focus();
}
