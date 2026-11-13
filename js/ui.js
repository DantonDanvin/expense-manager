// Small UI helpers: DOM, formatting, icons, modal, toast.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

export const pad = (n) => String(n).padStart(2, '0');
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const shiftMonth = (key, delta) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + delta, 1)); };
export const monthLabel = (key, locale = 'en-IN', short = false) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: short ? 'short' : 'long', year: 'numeric' });
};

export function fmtMoney(n, currency = 'INR', locale = 'en-IN', opts = {}) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: Number.isInteger(v) ? 0 : 2, ...opts }).format(v);
  } catch { return v.toFixed(2); }
}
export function fmtCompact(n, currency = 'INR', locale = 'en-IN') {
  const v = Number(n) || 0;
  if (Math.abs(v) < 10000) return fmtMoney(v, currency, locale);
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(v); }
  catch { return fmtMoney(v, currency, locale); }
}
export function currencySymbol(currency = 'INR', locale = 'en-IN') {
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(1).find((p) => p.type === 'currency')?.value || currency; }
  catch { return currency; }
}

export function fmtDate(iso, locale = 'en-IN') {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const now = new Date(); const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((t0 - dt) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (dt.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return dt.toLocaleDateString(locale, opts);
}

/* ───────── Icons (Lucide-style, inline SVG) ───────── */
const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const icons = {
  home: I('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  list: I('<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>'),
  target: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  plus: I('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  'chevron-left': I('<path d="m15 18-6-6 6-6"/>'),
  'chevron-right': I('<path d="m9 18 6-6-6-6"/>'),
  moon: I('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  x: I('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  trash: I('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>'),
  edit: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>'),
  cloud: I('<path d="M17.5 19a4.5 4.5 0 0 0 .4-9A7 7 0 0 0 4.3 12.5 3.5 3.5 0 0 0 6 19z"/>'),
  refresh: I('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>'),
  download: I('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>'),
  upload: I('<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M4 3h16"/>'),
  'arrow-up': I('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>'),
  'arrow-down': I('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'),
  check: I('<path d="M20 6 9 17l-5-5"/>'),
  wallet: I('<path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H6a2 2 0 0 0-2 2v2"/><path d="M16 14h4"/>'),
  'trending-up': I('<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>'),
  info: I('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
};
export function hydrateIcons(root = document) {
  $$('i[data-icon]', root).forEach((el) => { const n = el.dataset.icon; if (icons[n] && !el.firstChild) el.innerHTML = icons[n]; });
}
export const ico = (name, cls = '') => `<i data-icon="${name}" class="icon ${cls}">${icons[name] || ''}</i>`;

/* ───────── Toast ───────── */
export function toast(msg, type = 'info', ms = 2800) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? 'check' : type === 'error' ? 'x' : 'info';
  el.innerHTML = `${ico(icon)}<span>${esc(msg)}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, ms);
}

/* ───────── Modal ───────── */
let activeModal = null;
export function openModal({ title, body, footer = '', size = '' , onClose } = {}) {
  closeModal(true);
  const root = $('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="btn-icon" data-close type="button" aria-label="Close">${ico('x')}</button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  root.appendChild(wrap);
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeModal(); });
  wrap.querySelector('[data-close]').addEventListener('click', () => closeModal());
  activeModal = { el: wrap, onClose };
  document.body.style.overflow = 'hidden';
  const focusable = wrap.querySelector('[autofocus], input, select, button');
  setTimeout(() => focusable?.focus(), 30);
  return wrap;
}
export function closeModal(immediate = false) {
  if (!activeModal) return;
  const { el, onClose } = activeModal;
  activeModal = null;
  document.body.style.overflow = '';
  onClose?.();
  if (immediate) { el.remove(); return; }
  el.classList.add('closing');
  setTimeout(() => el.remove(), 190);
}
export function isModalOpen() { return !!activeModal; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && activeModal) closeModal(); });

export function confirmDialog(message, { title = 'Are you sure?', okLabel = 'Delete', danger = true } = {}) {
  return new Promise((resolve) => {
    const el = openModal({
      title, size: 'sm',
      body: `<p style="color:var(--text-2)">${esc(message)}</p>`,
      footer: `<button class="btn btn-ghost" data-cancel type="button">Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok type="button" autofocus>${esc(okLabel)}</button>`,
      onClose: () => resolve(false),
    });
    el.querySelector('[data-cancel]').onclick = () => closeModal();
    el.querySelector('[data-ok]').onclick = () => { activeModal.onClose = null; resolve(true); closeModal(); };
  });
}

export function downloadFile(name, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const hexAlpha = (hex, a) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
