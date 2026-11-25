import '@/ui/theme.css';
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';
import { browser } from 'wxt/browser';
import { dailyCsv, eventsCsv } from '@/lib/csv';
import { parseSiteInput } from '@/lib/domains';
import { computeFocus } from '@/lib/focus';
import { send } from '@/lib/messages';
import { countEvents, distractingSeconds, siteRows } from '@/lib/stats';
import { getLocal, type LocalData } from '@/lib/store';
import { dayKey, formatDuration, lastNDays } from '@/lib/time';
import type { Settings } from '@/lib/types';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let chart: Chart | null = null;
/** Settings as they are being edited (not yet saved). */
let draft: Settings | null = null;
let saved: Settings | null = null;
let focusActive = false;

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function renderStats(data: LocalData, now: number): void {
  const days = lastNDays(7, now);
  const today = dayKey(now);
  const { sites } = data.settings;
  const weekStart = new Date(days[0] + 'T00:00:00').getTime();

  const perDay = days.map((d) => distractingSeconds(data.daily, d, sites));
  $('t-today').textContent = formatDuration(distractingSeconds(data.daily, today, sites));
  $('t-week').textContent = formatDuration(perDay.reduce((a, b) => a + b, 0));
  $('t-nudges').textContent = String(countEvents(data.events, 'nudge_ignored', weekStart));
  $('t-bypasses').textContent = String(countEvents(data.events, 'bypass', weekStart));
  $('t-ended').textContent = String(countEvents(data.events, 'focus_ended_early', weekStart));

  // Chart
  const labels = days.map((d) =>
    new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric' }),
  );
  const minutes = perDay.map((s) => Math.round(s / 60));
  if (!chart) {
    chart = new Chart($<HTMLCanvasElement>('chart'), {
      type: 'bar',
      data: { labels, datasets: [{ data: minutes, backgroundColor: cssVar('--chart-1'), hoverBackgroundColor: cssVar('--primary'), borderRadius: 6, borderSkipped: false, maxBarThickness: 44 }] },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => formatDuration(Number(ctx.raw) * 60) } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: cssVar('--muted-foreground'), font: { size: 11 } } },
          y: {
            beginAtZero: true,
            grid: { color: cssVar('--border') },
            border: { display: false },
            ticks: { color: cssVar('--muted-foreground'), font: { size: 11 }, callback: (v) => `${v}m`, precision: 0 },
          },
        },
      },
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0]!.data = minutes;
    chart.update();
  }

  // Table
  const rows = siteRows(data.daily, days, sites).filter((r) => r.total >= 60);
  const body = $('sites').querySelector('tbody')!;
  body.replaceChildren(
    ...rows.map((r) => {
      const tr = document.createElement('tr');
      const name = document.createElement('td');
      if (r.distracting) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.title = 'On your distracting list';
        name.append(dot);
      }
      name.append(r.name);
      const cells = [r.perDay[r.perDay.length - 1] ?? 0, r.total, r.total / 7].map((s) => {
        const td = document.createElement('td');
        td.className = 'n';
        td.textContent = formatDuration(s);
        return td;
      });
      tr.append(name, ...cells);
      return tr;
    }),
  );
  $('sites-empty').hidden = rows.length > 0;
}

function renderSettings(): void {
  if (!draft || !saved) return;
  $('locked').hidden = !focusActive;
  const list = $('site-list');
  list.replaceChildren(
    ...draft.sites.map((site) => {
      const li = document.createElement('li');
      li.append(site);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = '×';
      rm.setAttribute('aria-label', `Remove ${site}`);
      // During focus, only sites added in this edit can be removed again.
      rm.disabled = focusActive && saved!.sites.includes(site);
      rm.addEventListener('click', () => {
        readForm();
        draft!.sites = draft!.sites.filter((s) => s !== site);
        renderSettings();
      });
      li.append(rm);
      return li;
    }),
  );
  $<HTMLInputElement>('nudge').value = String(draft.nudgeMinutes);
  $<HTMLInputElement>('badge').value = String(draft.badgeThresholdMinutes);
  $<HTMLInputElement>('focus-enabled').checked = draft.focusSchedule.enabled;
  $<HTMLInputElement>('focus-start').value = draft.focusSchedule.start;
  $<HTMLInputElement>('focus-end').value = draft.focusSchedule.end;
  for (const id of ['focus-enabled', 'focus-start', 'focus-end']) $<HTMLInputElement>(id).disabled = focusActive;
}

function readForm(): void {
  if (!draft) return;
  draft.nudgeMinutes = Number($<HTMLInputElement>('nudge').value);
  draft.badgeThresholdMinutes = Number($<HTMLInputElement>('badge').value);
  draft.focusSchedule = {
    enabled: $<HTMLInputElement>('focus-enabled').checked,
    start: $<HTMLInputElement>('focus-start').value,
    end: $<HTMLInputElement>('focus-end').value,
  };
}

function message(text: string, isError = false): void {
  const el = $('save-msg');
  el.textContent = text;
  el.classList.toggle('error', isError);
}

async function load(resetDraft: boolean, flush = true): Promise<void> {
  if (flush) await send({ type: 'flush' }); // credit the open segment so numbers are current
  const data = await getLocal();
  const now = Date.now();
  focusActive = computeFocus(data.settings.focusSchedule, data.focus, now).active;
  const pill = $('focus-pill');
  pill.classList.toggle('on', focusActive);
  pill.textContent = focusActive ? 'Focus on' : 'Focus off';
  renderStats(data, now);
  saved = structuredClone(data.settings);
  if (resetDraft || !draft) draft = structuredClone(data.settings);
  renderSettings();
}

function addSite(): void {
  const input = $<HTMLInputElement>('add-site');
  const site = parseSiteInput(input.value);
  if (!site) {
    message("That doesn't look like a site. Try something like twitch.tv.", true);
    return;
  }
  readForm();
  if (!draft!.sites.includes(site)) draft!.sites.push(site);
  input.value = '';
  message('Added. Save to apply.');
  renderSettings();
}

$('add-btn').addEventListener('click', addSite);
$<HTMLInputElement>('add-site').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addSite();
  }
});

$('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  readForm();
  const res = await send({ type: 'settings:save', settings: draft });
  if (!res.ok) {
    message(res.error, true);
    return;
  }
  message('Saved.');
  await load(true);
});

function download(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('export').addEventListener('click', async () => {
  await send({ type: 'flush' });
  const data = await getLocal();
  const stamp = dayKey(Date.now());
  download(`tether-daily-${stamp}.csv`, dailyCsv(data.daily, data.settings.sites));
  download(`tether-events-${stamp}.csv`, eventsCsv(data.events));
});

$('delete').addEventListener('click', async () => {
  const ok = window.confirm(
    'Delete all tracked time and the event log? Your settings and focus hours stay. This cannot be undone.',
  );
  if (!ok) return;
  const res = await send({ type: 'data:delete' });
  if (!res.ok) window.alert(res.error);
  await load(false);
});

// Keep numbers fresh while the dashboard is open. Storage changes re-render
// without flushing (a flush writes storage, which would loop); a slow timer
// flushes so the open segment shows up.
let pending: number | undefined;
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(changes.daily || changes.events || changes.focus || changes.settings)) return;
  window.clearTimeout(pending);
  pending = window.setTimeout(() => void load(Boolean(changes.settings), false), 300);
});
setInterval(() => void load(false), 60_000);
void load(true);
