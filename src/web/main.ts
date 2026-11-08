import './style.css';
import { runNotebook, NotebookResult, LineResult, Roast } from '../core';
import { avatarSvg } from './avatars';
import { EXAMPLES } from './examples';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = $<HTMLTextAreaElement>('input');
const gutter = $('gutter');
const results = $('results');
const summary = $('summary');
const select = $<HTMLSelectElement>('examples');
const drops = $('drops');
const avatar = $('avatar');
const quote = $('quote');
const who = $('who');
const explain = $('explain');
const nav = $('nav');
const drama = document.querySelector('.drama') as HTMLElement;

const STORAGE_KEY = 'newton-is-crying.sheet';
let selectedLine: number | null = null;
let lastErrors = 0;
let current: NotebookResult;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// ---------- share links: #sheet=<base64url(utf-8)> ----------
function encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function initialText(): string {
  const m = /sheet=([\w-]+)/.exec(location.hash);
  if (m) {
    try {
      return decode(m[1]);
    } catch {
      /* fall through */
    }
  }
  const example = /example=([\w-]+)/.exec(location.hash)?.[1];
  const ex = EXAMPLES.find((e) => e.id === example);
  if (ex) return ex.text;
  return localStorage.getItem(STORAGE_KEY) ?? EXAMPLES[0].text;
}

// ---------- rendering ----------
function rowHtml(l: LineResult): string {
  const warn = l.warnings.length ? `<span class="warn" title="${esc(l.warnings.join('\n'))}">⚠</span>` : '';
  switch (l.status) {
    case 'blank':
      return `<div class="row blank"></div>`;
    case 'ok':
      return `<div class="row ok" role="listitem" title="${esc(l.detail ?? '')}"><span class="mark">✓</span><span class="val">${esc(l.output ?? '')}</span><span class="det">${esc(l.detail ?? '')}</span>${warn}</div>`;
    case 'skipped':
      return `<div class="row skipped" role="listitem" title="${esc(l.detail ?? '')}">… ${esc(l.output ?? '')}</div>`;
    case 'error':
      return `<div class="row error${selectedLine === l.line ? ' selected' : ''}" role="listitem" data-line="${l.line}" title="${esc(l.error!.message)}"><span>✗</span><span class="val">${esc(shorten(l.error!.message))}</span></div>`;
  }
}

const shorten = (s: string) => (s.length > 60 ? s.slice(0, 57) + '…' : s);

function showRoast(roast: Roast, line?: LineResult): void {
  avatar.innerHTML = avatarSvg(roast.scientist.id, roast.mood);
  quote.textContent = `“${roast.text}”`;
  who.textContent = `— ${roast.scientist.name} (${roast.scientist.years}), ${roast.scientist.knownFor}`;
  if (line?.error) {
    explain.innerHTML = `<div class="line">line ${line.line}: ${esc(line.source.trim())}</div>
      <div class="msg">${esc(line.error.message)}</div>
      ${line.error.hint ? `<div class="hint">💡 ${esc(line.error.hint)}</div>` : ''}`;
  } else {
    const w = current.warnings;
    explain.innerHTML = `<div>All units are consistent${w ? `, with ${w} warning${w === 1 ? '' : 's'} (hover the ⚠)` : ''}. Nice work.</div>`;
  }
}

function render(): void {
  const text = input.value;
  current = runNotebook(text);
  const { lines, errors } = current;

  gutter.innerHTML = lines.map((l) => `<div>${l.line}</div>`).join('');
  const errorLines = lines.filter((l) => l.status === 'error');
  if (selectedLine !== null && !errorLines.some((l) => l.line === selectedLine)) selectedLine = null;
  if (selectedLine === null && errorLines.length) selectedLine = errorLines[0].line;
  results.innerHTML = lines.map(rowHtml).join('');

  const counted = lines.filter((l) => l.status === 'ok' || l.status === 'error').length;
  summary.textContent = errors
    ? `${errors} units error${errors === 1 ? '' : 's'} in ${counted} lines`
    : counted
      ? `${counted} lines · all units check out`
      : 'start typing…';
  summary.className = `summary ${errors ? 'bad' : 'ok'}`;

  drops.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < current.tears ? 'on' : ''}">💧</span>`).join('');

  const sel = errorLines.find((l) => l.line === selectedLine);
  showRoast(sel?.roast ?? current.verdict, sel);

  nav.innerHTML =
    errorLines.length > 1
      ? `<button type="button" data-step="-1">← previous error</button><button type="button" data-step="1">next error →</button>`
      : '';

  if (errors > lastErrors) {
    drama.classList.remove('shake');
    void drama.offsetWidth; // restart the animation
    drama.classList.add('shake');
  }
  lastErrors = errors;
  syncScroll();
}

function syncScroll(): void {
  gutter.scrollTop = input.scrollTop;
  results.scrollTop = input.scrollTop;
}

function selectLine(line: number, moveCaret: boolean): void {
  selectedLine = line;
  render();
  if (moveCaret) {
    const lines = input.value.split('\n');
    const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
    input.focus();
    input.setSelectionRange(start, start + lines[line - 1].length);
  }
}

// ---------- wiring ----------
select.innerHTML =
  `<option value="">Load an example…</option>` + EXAMPLES.map((e) => `<option value="${e.id}">${esc(e.title)}</option>`).join('');
select.addEventListener('change', () => {
  const ex = EXAMPLES.find((e) => e.id === select.value);
  if (!ex) return;
  input.value = ex.text;
  selectedLine = null;
  save();
  render();
  select.value = '';
});

let timer: number | undefined;
function save(): void {
  localStorage.setItem(STORAGE_KEY, input.value);
}
input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    save();
    render();
  }, 120);
});
input.addEventListener('scroll', syncScroll);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    input.setRangeText('  ', input.selectionStart, input.selectionEnd, 'end');
    input.dispatchEvent(new Event('input'));
  }
});

results.addEventListener('click', (e) => {
  const row = (e.target as HTMLElement).closest<HTMLElement>('.row.error');
  if (row) selectLine(Number(row.dataset.line), true);
});
nav.addEventListener('click', (e) => {
  const step = Number((e.target as HTMLElement).dataset.step);
  if (!step) return;
  const errs = current.lines.filter((l) => l.status === 'error').map((l) => l.line);
  const i = errs.indexOf(selectedLine ?? errs[0]);
  selectLine(errs[(i + step + errs.length) % errs.length], false);
});

$('share').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}#sheet=${encode(input.value)}`;
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied — send it to your physics teacher (or don’t).');
  } catch {
    toast('Link is in the address bar.');
  }
});

function toast(msg: string): void {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

input.value = initialText();
render();
