// Dependency-free charts: SVG donut + CSS bars.
import { esc } from './ui.js';

export function donut(items, { size = 190, stroke = 24, centerHtml = '' } = {}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;
  let offset = 0;
  const gap = items.length > 1 ? 3 : 0;
  let segs = '';
  if (total > 0) {
    for (const it of items) {
      const len = Math.max(0, c * (it.value / total) - gap);
      segs += `<circle class="donut-seg" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(it.label)}</title></circle>`;
      offset += len + gap;
    }
  } else {
    segs = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/>`;
  }
  return `<div class="donut-center"><svg class="donut" viewBox="0 0 ${size} ${size}">${segs}</svg><div class="dc">${centerHtml}</div></div>`;
}

export function bars(items, { height = 170, currentKey = '', fmt = (v) => v } = {}) {
  const max = Math.max(1, ...items.map((i) => Math.max(i.expense || 0, i.income || 0)));
  const cols = items.map((i, idx) => {
    const e = ((i.expense || 0) / max) * 100;
    const inc = ((i.income || 0) / max) * 100;
    return `<div class="bar-col ${i.key === currentKey ? 'current' : ''}">
      <div class="bar-stack">
        <div class="bar" style="height:${Math.max(e, i.expense ? 3 : 1)}%;animation-delay:${idx * 50}ms" data-tip="Spent ${esc(fmt(i.expense || 0))}"></div>
        ${i.income ? `<div class="bar income" style="height:${Math.max(inc, 3)}%;animation-delay:${idx * 50 + 80}ms" data-tip="Income ${esc(fmt(i.income))}"></div>` : ''}
      </div>
      <div class="bar-label">${esc(i.label)}</div>
    </div>`;
  }).join('');
  return `<div class="bars" style="--h:${height}px">${cols}</div>`;
}
