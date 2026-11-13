// Kharcha — app shell: routing, views, forms, Drive sync orchestration.
import * as S from './store.js';
import * as D from './drive.js';
import { donut, bars } from './charts.js';
import {
  $, $$, esc, ico, hydrateIcons, fmtMoney, fmtCompact, currencySymbol, fmtDate, monthLabel, shiftMonth, monthKey, todayISO,
  toast, openModal, closeModal, isModalOpen, confirmDialog, downloadFile, hexAlpha,
} from './ui.js';

const PALETTE = ['#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e', '#84cc16', '#eab308', '#64748b'];
const EMOJIS = ['🍜', '☕', '🛒', '🚕', '⛽', '🛍️', '💡', '🏠', '💊', '🎬', '🎮', '✈️', '📚', '🎁', '🐶', '💅', '🏋️', '📱', '🧾', '💼', '💰', '🏦', '📦', '🏷️'];

/* ───────────────────────── money helpers ───────────────────────── */
const cur = () => S.settings().currency;
const loc = () => S.settings().locale;
const money = (n) => fmtMoney(n, cur(), loc());
const compact = (n) => fmtCompact(n, cur(), loc());

/* ───────────────────────── theme ───────────────────────── */
const mq = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const pref = S.getPrefs().theme;
  const dark = pref === 'dark' || (pref === 'system' && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const btn = $('[data-action="toggle-theme"]');
  if (btn) btn.innerHTML = dark ? ico('sun') : ico('moon');
  $('meta[name=theme-color]')?.setAttribute('content', dark ? '#121829' : '#6d5dfc');
}
mq.addEventListener('change', applyTheme);

/* ───────────────────────── routing ───────────────────────── */
const ROUTES = {
  dashboard: { title: 'Overview', render: renderDashboard, month: true },
  transactions: { title: 'Ledger', render: renderTransactions, month: true },
  budgets: { title: 'Budgets', render: renderBudgets, month: true },
  settings: { title: 'Settings', render: renderSettings, month: false },
};
const route = () => { const h = location.hash.replace(/^#\/?/, '').split('?')[0]; return ROUTES[h] ? h : 'dashboard'; };

function render() {
  const r = route();
  const def = ROUTES[r];
  $('#page-title').textContent = def.title;
  $('#month-nav').hidden = !def.month;
  $('#month-label').textContent = monthLabel(S.getPrefs().month, loc());
  $$('[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === r));
  const view = $('#view');
  view.innerHTML = def.render();
  hydrateIcons(view);
  requestAnimationFrame(() => $$('[data-w]', view).forEach((s) => { s.style.width = s.dataset.w; }));
  $$('[data-count]', view).forEach(countUp);
}
/** Count a number up from 0 with power4.out easing. Skipped under prefers-reduced-motion. */
function countUp(el) {
  const target = Number(el.dataset.count) || 0;
  const fmt = (v) => fmtMoney(v, cur(), loc(), { style: 'decimal' });
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || target === 0) { el.textContent = fmt(target); return; }
  const t0 = performance.now(); const dur = 1100;
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - t, 4);
    el.textContent = fmt(Math.round(target * e));
    if (t < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ───────────────────────── views: dashboard ───────────────────────── */
function renderDashboard() {
  const month = S.getPrefs().month;
  const s = S.summary(month);
  const prev = S.summary(shiftMonth(month, -1));
  const cats = S.byCategory(month);
  const budget = S.totalBudget();
  const recent = S.transactions({ month }).slice(0, 6);
  const all = S.transactions();
  const mLabel = monthLabel(month, loc());
  const mShort = monthLabel(month, loc(), true).split(' ')[0];

  if (!all.length) {
    return `
      <section class="hero">
        <p class="eyebrow">Welcome <span class="sep"></span> your ledger is empty</p>
        <h2 class="hero-amount"><span class="cur">${esc(currencySymbol(cur(), loc()))}</span>0</h2>
        <p class="hero-line">Every rupee, in your own words, in your own Drive. Start with what you spent today.</p>
        <div style="margin-top:24px;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" data-action="new-tx" type="button">${ico('plus')} Add your first expense</button>
          ${D.isConfigured() ? '' : '<a class="btn btn-ghost" href="#/settings">Connect Google Drive</a>'}
        </div>
        <p class="hint" style="margin-top:16px">Press <kbd>N</kbd> anywhere to add a transaction.</p>
      </section>`;
  }

  const delta = prev.expense ? (s.expense - prev.expense) / prev.expense : null;
  const prevLabel = monthLabel(shiftMonth(month, -1), loc(), true).split(' ')[0];
  const deltaText = delta === null ? `No spending recorded in ${esc(prevLabel)} to compare.`
    : Math.abs(delta) < 0.005 ? `About the same as ${esc(prevLabel)}.`
    : `<span class="${delta > 0 ? 'up' : 'down'}"><b>${Math.abs(delta * 100).toFixed(0)}% ${delta > 0 ? 'more' : 'less'}</b></span> than ${esc(prevLabel)}.`;
  const budgetPct = budget ? s.expense / budget : 0;
  const budgetClass = budgetPct >= 1 ? 'over' : budgetPct >= 0.8 ? 'warn' : '';
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const isCurrent = month === monthKey();
  const dayOfMonth = isCurrent ? new Date().getDate() : daysInMonth;
  const perDay = Math.round(s.expense / Math.max(1, dayOfMonth));
  const paceMark = isCurrent ? Math.min(100, (dayOfMonth / daysInMonth) * 100) : 100;
  const leftDays = Math.max(0, daysInMonth - dayOfMonth);

  const topCats = cats.slice(0, 6);
  const restTotal = cats.slice(6).reduce((x, c) => x + c.total, 0);
  const donutItems = topCats.map((c) => ({ label: c.cat.name, value: c.total, color: c.cat.color }));
  if (restTotal) donutItems.push({ label: 'Everything else', value: restTotal, color: '#94a3b8' });

  return `
    <section class="hero">
      <p class="eyebrow">${esc(mLabel)} <span class="sep"></span> ${s.count} transaction${s.count === 1 ? '' : 's'}${isCurrent ? `<span class="hide-sm"><span class="sep"></span>day ${dayOfMonth} of ${daysInMonth}</span>` : ''}</p>
      <h2 class="hero-amount"><span class="cur">${esc(currencySymbol(cur(), loc()))}</span><span data-count="${s.expense}">${esc(fmtMoney(s.expense, cur(), loc(), { style: 'decimal' }))}</span></h2>
      <p class="hero-line">spent ${isCurrent ? 'so far in' : 'in'} ${esc(mShort)}, about <b>${esc(money(perDay))}</b> a day. ${deltaText}</p>
      ${budget ? `
        <div class="hero-track">
          <div class="track ${budgetClass}"><span data-w="${Math.min(100, budgetPct * 100)}%"></span>${isCurrent && paceMark < 100 ? `<i class="mark" style="left:${paceMark}%" data-l="today"></i>` : ''}</div>
          <div class="meta">
            <span>${budgetPct >= 1 ? `<b>Over budget</b> by ${esc(money(s.expense - budget))}` : `<b>${esc(money(budget - s.expense))}</b> left of ${esc(money(budget))} budget`}</span>
            <span>${budgetPct >= 1 ? '' : isCurrent && leftDays ? `${esc(money(Math.round((budget - s.expense) / leftDays)))} a day for the next ${leftDays} days` : `${Math.round(budgetPct * 100)}% used`}</span>
          </div>
        </div>`
      : `<div class="hero-track"><div class="meta"><span>No monthly budget yet.</span><a class="link" href="#/budgets">Plan this month by percentage →</a></div></div>`}
    </section>

    <div class="bento">
      <article class="tile tile-7">
        <div class="card-head"><div><p class="eyebrow">Where it went</p><h2 class="serif" style="margin-top:6px">By category</h2></div></div>
        ${cats.length ? `
          <div class="donut-wrap">
            ${donut(donutItems, { size: 176, stroke: 18, centerHtml: `<div><b>${esc(compact(s.expense))}</b><small>${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}</small></div>` })}
            <div class="legend">
              ${donutItems.map((i) => `<div class="legend-item"><span class="sw" style="background:${i.color}"></span><span class="nm">${esc(i.label)}</span><span><span class="amt">${esc(money(i.value))}</span><span class="pct">${Math.round((i.value / s.expense) * 100)}%</span></span></div>`).join('')}
            </div>
          </div>` : `<div class="empty" style="padding:30px 0"><div class="em">🍃</div><h3>Nothing spent</h3><p>No expenses in ${esc(mLabel)}.</p></div>`}
      </article>

      <article class="tile tile-5 tile-ink">
        <p class="eyebrow">This month</p>
        <div class="kpi-list" style="margin-top:14px">
          <div class="kpi"><span class="k">Income</span><span class="v income">${esc(money(s.income))}</span></div>
          <div class="kpi"><span class="k">Spent</span><span class="v">${esc(money(s.expense))}</span></div>
          <div class="kpi"><span class="k">${s.net >= 0 ? 'Kept' : 'Short'}</span><span class="v">${esc(money(Math.abs(s.net)))}<small>${s.income ? Math.round((s.net / s.income) * 100) + '% of income' : ''}</small></span></div>
          <div class="kpi"><span class="k">Daily average</span><span class="v">${esc(money(perDay))}</span></div>
        </div>
      </article>

      ${budgetTile(month)}

      <article class="tile tile-12">
        <div class="card-head"><div><p class="eyebrow">Six months</p><h2 class="serif" style="margin-top:6px">Spend against income</h2></div>
          <div class="bar-legend"><span>Spent</span><span class="inc">Income</span></div></div>
        ${bars(S.trend(6, month), { currentKey: month, fmt: money, height: 150 })}
        <div class="bars-foot"></div>
      </article>
    </div>

    <section class="section">
      <div class="section-head"><h2>Recent entries</h2><a href="#/transactions" class="btn btn-ghost btn-sm">Open ledger</a></div>
      ${recent.length ? `<div class="tx-list compact">${recent.map(txRow).join('')}</div>` : `<div class="empty"><div class="em">🗒️</div><h3>Nothing in ${esc(mShort)} yet</h3><p>Add a transaction to get started.</p></div>`}
    </section>`;
}

/* ───────── per-category budget progress (Overview) ───────── */
function budgetState(b) {
  if (b.left < 0) return { cls: 'over', text: `Over by ${money(-b.left)}` };
  if (b.left === 0) return { cls: 'full', text: 'Fully used' };
  if (b.used >= 0.8) return { cls: 'warn', text: `${money(b.left)} left` };
  return { cls: 'ok', text: `${money(b.left)} left` };
}
function budgetTile(month) {
  const list = S.categoryBudgets(month);
  if (!list.length) {
    return `<article class="tile tile-12 cb-empty">
      <div><p class="eyebrow">Category budgets</p><h2 class="serif" style="margin-top:6px">No category budgets yet</h2>
      <p class="hint" style="margin-top:6px">Plan your month by percentage (e.g. 7% groceries) and see each category's progress here.</p></div>
      <a class="btn btn-primary" href="#/budgets">Plan budgets</a></article>`;
  }
  const over = list.filter((b) => b.left < 0).length;
  const near = list.filter((b) => b.left >= 0 && b.used >= 0.8 && b.used < 1).length;
  const [y, m] = month.split('-').map(Number);
  const isCurrent = month === monthKey();
  const pace = isCurrent ? new Date().getDate() / new Date(y, m, 0).getDate() : 1;
  const rows = list.map((b) => {
    const st = budgetState(b);
    const ahead = isCurrent && b.used < 1 && b.used > pace + 0.15 && b.used >= 0.25; // spending faster than the month is passing
    return `<a class="cb-row ${st.cls}" href="#/transactions" data-cat-filter="${b.id}">
      <span class="tx-ico" style="background:${hexAlpha(b.cat.color, 0.16)}">${esc(b.cat.icon)}</span>
      <span class="cb-main">
        <span class="cb-top"><span class="cb-name">${esc(b.cat.name)}${b.planPct ? `<span class="cb-pct">${b.planPct}%</span>` : ''}</span><span class="cb-state">${esc(st.text)}</span></span>
        <span class="progress ${st.cls}"><span data-w="${Math.min(100, b.used * 100)}%"></span>${isCurrent && pace < 1 ? `<i class="cb-pace" style="left:${pace * 100}%"></i>` : ''}</span>
        <span class="cb-meta"><span><b>${esc(money(b.spent))}</b> of ${esc(money(b.budget))}</span><span>${ahead ? '<span class="cb-flag">spending fast</span>' : `${Math.round(b.used * 100)}% used`}</span></span>
      </span>
    </a>`;
  }).join('');
  return `<article class="tile tile-12">
    <div class="card-head"><div><p class="eyebrow">Category budgets · ${list.length} tracked</p><h2 class="serif" style="margin-top:6px">${over ? `${over} over budget` : near ? `${near} close to the limit` : 'All within budget'}</h2></div>
      <a class="btn btn-ghost btn-sm" href="#/budgets">Edit plan</a></div>
    <div class="cb-grid">${rows}</div>
    ${isCurrent ? '<p class="hint" style="margin-top:12px">The thin mark on each bar is today — a bar past it means that category is being spent faster than the month is passing.</p>' : ''}
  </article>`;
}

function txRow(t, i = 0) {
  const c = S.category(t.category);
  return `<button class="tx" data-action="edit-tx" data-id="${t.id}" type="button" style="animation-delay:${Math.min(i, 14) * 28}ms">
    <span class="tx-ico" style="background:${hexAlpha(c.color, 0.16)}">${esc(c.icon)}</span>
    <span class="tx-body">
      <span class="tx-title">${esc(t.note || c.name)}</span>
      <span class="tx-sub"><span>${esc(c.name)}</span>${t.method ? `<span class="dotsep">${esc(t.method)}</span>` : ''}</span>
    </span>
    <span class="tx-amt ${t.type}">${esc(money(t.amount))}</span>
  </button>`;
}

/* ───────────────────────── views: transactions ───────────────────────── */
const txFilter = { q: '', type: '', category: '' };
function renderTransactions() {
  const p = S.getPrefs();
  const month = p.txScope === 'all' ? '' : p.month;
  const list = S.transactions({ month, type: txFilter.type, categoryId: txFilter.category, q: txFilter.q });
  const groups = new Map();
  for (const t of list) { if (!groups.has(t.date)) groups.set(t.date, []); groups.get(t.date).push(t); }
  const spent = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const earned = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  let i = 0;
  const catOpts = [...S.categories('expense'), ...S.categories('income')].map((c) => `<option value="${c.id}" ${txFilter.category === c.id ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('');

  return `
    <div class="toolbar">
      <div class="search">${ico('search')}<input class="input" id="tx-q" placeholder="Search notes, categories, amounts…" value="${esc(txFilter.q)}"></div>
      <div class="seg" id="tx-type">
        ${[['', 'All'], ['expense', 'Spent'], ['income', 'Earned']].map(([v, l]) => `<button class="seg-btn ${txFilter.type === v ? 'active' : ''}" data-value="${v}" type="button">${l}</button>`).join('')}
      </div>
      <select class="select" id="tx-cat"><option value="">All categories</option>${catOpts}</select>
      <div class="seg" id="tx-scope">
        <button class="seg-btn ${p.txScope !== 'all' ? 'active' : ''}" data-value="month" type="button">${esc(monthLabel(p.month, loc(), true))}</button>
        <button class="seg-btn ${p.txScope === 'all' ? 'active' : ''}" data-value="all" type="button">All time</button>
      </div>
    </div>
    ${list.length ? `
      <div class="ledger-summary"><span class="n">${list.length} entr${list.length === 1 ? 'y' : 'ies'}${earned ? ` · earned <b>${esc(money(earned))}</b>` : ''}</span><span class="t">${esc(money(spent))}<span class="hint" style="margin-left:8px">spent</span></span></div>
      ${[...groups.entries()].map(([date, items]) => {
        const day = items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        return `<div class="tx-group"><div class="tx-date"><span>${esc(fmtDate(date, loc()))}</span><b>${day ? esc(money(day)) : ''}</b></div><div class="tx-list">${items.map((t) => txRow(t, i++)).join('')}</div></div>`;
      }).join('')}`
    : `<div class="empty"><div class="em">🔎</div><h3>Nothing here</h3><p>${txFilter.q || txFilter.type || txFilter.category ? 'Try clearing the filters.' : `No entries for ${esc(monthLabel(p.month, loc()))}.`}</p><button class="btn btn-primary" data-action="new-tx" type="button">${ico('plus')} Add transaction</button></div>`}`;
}

/* ───────────────────────── views: budgets + planner ───────────────────────── */
let plan = null; // draft of the percentage planner (module state, survives re-renders)
function planDraft() {
  if (plan) return plan;
  const saved = S.budgetPlan();
  const month = S.getPrefs().month;
  const income = S.summary(month).income || S.summary(shiftMonth(month, -1)).income || 0;
  plan = { base: saved.base || income || 0, allocations: { ...saved.allocations } };
  return plan;
}
const planSum = () => Object.values(planDraft().allocations).reduce((s, v) => s + (Number(v) || 0), 0);
const planAmt = (pct) => Math.round((planDraft().base * (Number(pct) || 0)) / 100 / 10) * 10;

function renderBudgets() {
  const month = S.getPrefs().month;
  const spentBy = Object.fromEntries(S.byCategory(month).map((c) => [c.cat.id, c.total]));
  const s = S.summary(month);
  const total = S.totalBudget();
  const pct = total ? s.expense / total : 0;
  const cls = pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok';
  const d = planDraft();
  const sum = planSum();
  const cats = S.categories('expense');
  const ordered = [...cats].sort((a, b) => (Number(d.allocations[b.id]) || 0) - (Number(d.allocations[a.id]) || 0));
  const thisIncome = s.income; const lastIncome = S.summary(shiftMonth(month, -1)).income;

  const allocRows = ordered.map((c) => {
    const v = Number(d.allocations[c.id]) || 0;
    return `<div class="alloc-row ${v ? '' : 'zero'}" data-plan-row="${c.id}">
      <span class="tx-ico" style="background:${hexAlpha(c.color, 0.16)}">${esc(c.icon)}</span>
      <span class="a-name">${esc(c.name)}</span>
      <input type="range" min="0" max="70" step="1" value="${v}" data-plan-pct="${c.id}" aria-label="${esc(c.name)} percent">
      <div class="a-pct"><input class="input" type="number" min="0" max="100" step="1" value="${v}" data-plan-num="${c.id}"><span>%</span></div>
      <span class="a-amt" data-plan-amt="${c.id}">${esc(money(planAmt(v)))}</span>
    </div>`;
  }).join('');

  const rows = cats.map((c) => {
    const b = S.budgetFor(c.id); const sp = spentBy[c.id] || 0; const p = b ? sp / b : 0;
    const k = b ? (p >= 1 ? 'over' : p >= 0.8 ? 'warn' : 'ok') : '';
    return `<div class="budget-row ${k === 'over' ? 'over' : ''}">
      <span class="tx-ico" style="background:${hexAlpha(c.color, 0.16)}">${esc(c.icon)}</span>
      <div>
        <div class="b-name">${esc(c.name)}</div>
        <div class="b-meta"><span>Spent <b>${esc(money(sp))}</b>${b ? ` of ${esc(money(b))}` : ''}</span>${b ? `<span>${Math.round(p * 100)}%</span>` : '<span>no limit</span>'}</div>
        <div class="progress ${k}"><span data-w="${b ? Math.min(100, p * 100) : 0}%"></span></div>
      </div>
      <input class="input" type="number" min="0" step="100" inputmode="decimal" placeholder="No limit" value="${b || ''}" data-budget="${c.id}">
    </div>`;
  }).join('');

  const catList = (type) => S.categories(type).map((c) => `<div class="cat-row">
      <span class="tx-ico" style="background:${hexAlpha(c.color, 0.16)}">${esc(c.icon)}</span>
      <div><div class="c-name">${esc(c.name)}</div><div class="c-sub">${S.transactions({ categoryId: c.id }).length} entries</div></div>
      <div class="actions"><button class="btn-icon" data-action="edit-cat" data-id="${c.id}" title="Edit" type="button">${ico('edit')}</button>
      ${DEFAULT_IDS.has(c.id) ? '' : `<button class="btn-icon" data-action="del-cat" data-id="${c.id}" title="Delete" type="button">${ico('trash')}</button>`}</div>
    </div>`).join('');

  return `
    <section class="card planner">
      <div class="planner-head">
        <div><p class="eyebrow">Autofill</p><h2>Plan ${esc(monthLabel(month, loc(), true).split(' ')[0])} by percentage</h2>
          <p class="hint">Set a base amount, split it across categories, and apply it to your budgets in one click. Savings and investments count too, so future-you gets a line in the ledger.</p></div>
        <button class="btn btn-primary" data-action="plan-apply" type="button">${ico('check')} Apply to budgets</button>
      </div>
      <div class="planner-base">
        <label class="field"><span class="label">Base amount</span>
          <div class="amount-wrap"><span class="cur">${esc(currencySymbol(cur(), loc()))}</span><input type="number" min="0" step="500" inputmode="decimal" id="plan-base" value="${d.base || ''}" placeholder="0"></div></label>
        <div class="field"><span class="label">Use</span>
          <div class="chips">
            ${thisIncome ? `<button class="chip ${d.base === thisIncome ? 'active' : ''}" data-action="plan-base" data-value="${thisIncome}" type="button">This month's income · ${esc(money(thisIncome))}</button>` : ''}
            ${lastIncome && lastIncome !== thisIncome ? `<button class="chip ${d.base === lastIncome ? 'active' : ''}" data-action="plan-base" data-value="${lastIncome}" type="button">Last month · ${esc(money(lastIncome))}</button>` : ''}
            ${!thisIncome && !lastIncome ? '<span class="hint">Add an income entry and it will show up here, or type any amount.</span>' : ''}
          </div></div>
      </div>
      <div class="alloc-bar" id="alloc-bar">${ordered.map((c) => `<span data-plan-seg="${c.id}" style="width:${Number(d.allocations[c.id]) || 0}%;background:${c.color}" title="${esc(c.name)}"></span>`).join('')}</div>
      <div class="alloc-meta ${sum > 100 ? 'over' : ''}" id="alloc-meta"><span>Allocated <b id="plan-sum">${sum}%</b> · <b id="plan-sum-amt">${esc(money(planAmt(sum)))}</b></span><span id="plan-left">${planLeftText(d.base, sum)}</span></div>
      <div class="alloc-rows">${allocRows}</div>
      <div class="planner-foot">
        <span class="hint">Amounts round to the nearest 10. Applying overwrites the limits of the categories above.</span>
        <div style="display:flex;gap:8px"><button class="btn btn-ghost btn-sm" data-action="plan-reset" type="button">Reset to default split</button></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>${esc(monthLabel(month, loc()))}</h2>
        <div style="display:flex;align-items:center;gap:10px"><span class="hint">Overall limit</span><input class="input num" style="width:140px;text-align:right;padding:7px 10px" type="number" min="0" step="500" inputmode="decimal" placeholder="Auto (sum)" value="${S.budgets()._total || ''}" data-budget="_total"></div>
      </div>
      ${total ? `
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin:16px 0 10px"><b class="serif" style="font-size:1.9rem;font-variant-numeric:tabular-nums">${esc(money(s.expense))}</b><span class="hint">of ${esc(money(total))} · ${pct >= 1 ? `<b style="color:var(--accent)">over by ${esc(money(s.expense - total))}</b>` : `<b style="color:var(--ink)">${esc(money(total - s.expense))}</b> left`}</span></div>
        <div class="progress progress-lg ${cls}"><span data-w="${Math.min(100, pct * 100)}%"></span></div>`
      : `<p class="hint" style="margin-top:14px">No limits yet. Use the planner above or type a limit per category below.</p>`}
      <div style="margin-top:10px">${rows}</div>
    </section>

    <div class="grid grid-2 section">
      <div class="card">
        <div class="card-head"><h2 class="serif">Expense categories</h2><button class="btn btn-soft btn-sm" data-action="new-cat" data-type="expense" type="button">${ico('plus')} New</button></div>
        ${catList('expense')}
      </div>
      <div class="card">
        <div class="card-head"><h2 class="serif">Income categories</h2><button class="btn btn-soft btn-sm" data-action="new-cat" data-type="income" type="button">${ico('plus')} New</button></div>
        ${catList('income')}
      </div>
    </div>`;
}
const DEFAULT_IDS = new Set(S.DEFAULT_CATEGORIES.map((c) => c.id));
function planLeftText(base, sum) {
  if (sum > 100) return `${sum - 100}% over — trim something`;
  if (sum === 100) return 'Fully allocated';
  return `${100 - sum}% · ${money(Math.round((base * (100 - sum)) / 100 / 10) * 10)} unallocated`;
}
/** Live-update the planner without re-rendering the page (keeps slider focus & feels instant). */
function updatePlanDOM() {
  const d = planDraft(); const sum = planSum();
  for (const [id, v] of Object.entries(d.allocations)) {
    const row = $(`[data-plan-row="${id}"]`); if (!row) continue;
    const n = Number(v) || 0;
    row.classList.toggle('zero', !n);
    const r = $(`[data-plan-pct="${id}"]`, row); if (r && document.activeElement !== r) r.value = n;
    const num = $(`[data-plan-num="${id}"]`, row); if (num && document.activeElement !== num) num.value = n;
    $(`[data-plan-amt="${id}"]`, row).textContent = money(planAmt(n));
    const seg = $(`[data-plan-seg="${id}"]`); if (seg) seg.style.width = `${n}%`;
  }
  $('#plan-sum').textContent = `${sum}%`;
  $('#plan-sum-amt').textContent = money(planAmt(sum));
  $('#plan-left').textContent = planLeftText(d.base, sum);
  $('#alloc-meta').classList.toggle('over', sum > 100);
  $$('[data-action="plan-base"]').forEach((b) => b.classList.toggle('active', Number(b.dataset.value) === d.base));
}

/* ───────────────────────── views: settings ───────────────────────── */
function renderSettings() {
  const p = S.getPrefs();
  const st = S.settings();
  const status = D.getStatus();
  const user = D.getUser();
  const statusText = { off: 'Not connected', connecting: 'Connecting…', connected: 'Connected', syncing: 'Syncing…', error: `Error: ${D.getStatusDetail() || 'sync failed'}`, reconnect: 'Session expired — reconnect' }[status];
  const lastSync = p.lastSync ? new Date(p.lastSync).toLocaleString(loc(), { dateStyle: 'medium', timeStyle: 'short' }) : 'never';
  const origin = location.origin;

  return `
    <div class="settings-grid">
      <div class="card">
        <div class="card-head"><h2 class="serif">Google Drive sync</h2>${ico('cloud')}</div>
        <p class="hint" style="margin-bottom:12px">Your data is stored as <code>${esc(D.fileName())}</code> in your own Google Drive. The app can only access files it created (scope <code>drive.file</code>).</p>
        <div class="status-line" data-status="${status}"><span class="sync-dot"></span><span><b>${esc(statusText)}</b>${user ? ` · ${esc(user.email)}` : ''}<br><span class="hint">Last sync: ${esc(lastSync)}</span></span></div>
        <div class="field" style="margin-top:14px">
          <span class="label">OAuth Client ID</span>
          <input class="input" id="client-id" placeholder="xxxxxxxx.apps.googleusercontent.com" value="${esc(p.clientId)}" autocomplete="off" spellcheck="false">
          <span class="hint">Create one in Google Cloud Console (steps below). It is stored only in this browser.</span>
        </div>
        <div class="chips" style="margin-top:14px">
          ${status === 'connected' || status === 'syncing'
            ? `<button class="btn btn-primary" data-action="sync-now" type="button">${ico('refresh')} Sync now</button>
               <button class="btn btn-ghost" data-action="open-drive" type="button">${ico('cloud')} Open in Drive</button>
               <button class="btn btn-ghost" data-action="disconnect" type="button">Disconnect</button>`
            : `<button class="btn btn-primary" data-action="connect" type="button">${ico('cloud')} ${status === 'reconnect' ? 'Reconnect' : 'Connect Google Drive'}</button>
               ${user ? `<button class="btn btn-ghost" data-action="disconnect" type="button">Forget account</button>` : ''}`}
        </div>
        <details class="steps">
          <summary>How to get a Client ID (one-time, ~3 minutes, free)</summary>
          <p class="hint" style="margin-bottom:10px">Free — no billing or credit card needed. Use your <b>personal Gmail</b> (work / company accounts usually can't create projects: <i>"resourcemanager.projects.create permission"</i> error). Tip: do it in an Incognito window signed in to that Gmail.</p>
          <ol>
            <li><b>Create the project</b> — open <a href="https://console.cloud.google.com/" target="_blank" rel="noopener" class="link">console.cloud.google.com</a> → accept terms (skip any free-trial / billing popup) → project dropdown → <b>New Project</b> → name <code>Kharcha</code> → Location / Parent resource: <b>No organization</b> → <b>Create</b>. Make sure it's selected in the top bar.</li>
            <li><b>Enable the Drive API</b> — <b>APIs &amp; Services → Library</b> → search <b>Google Drive API</b> → <b>Enable</b>.</li>
            <li><b>Consent screen</b> — <b>APIs &amp; Services → OAuth consent screen</b> (Google Auth Platform) → <b>Get started</b> → app name <code>Kharcha</code>, support email = your Gmail → Audience <b>External</b> → contact email → agree → <b>Create</b>. Then <b>Audience → Test users → Add users</b> → add your Gmail → Save. (Leave it in <i>Testing</i>; no publishing or verification needed.)</li>
            <li><b>Create the Client ID</b> — <b>Credentials → Create credentials → OAuth client ID</b> (or Google Auth Platform → <b>Clients</b>) → type <b>Web application</b>, name <code>Kharcha local</code> → <b>Authorized JavaScript origins</b> → add exactly <code>${esc(origin)}</code> (no trailing slash) → leave redirect URIs empty → <b>Create</b>. Copy the Client ID (ends with <code>.apps.googleusercontent.com</code>); the secret isn't needed.</li>
            <li><b>Connect</b> — paste the Client ID above → <b>Connect Google Drive</b> → pick the same Gmail → on <i>"Google hasn't verified this app"</i> click <b>Continue</b> (normal in testing mode) → allow Drive access. A <code>Kharcha</code> folder appears in your Drive.</li>
          </ol>
          <p class="hint" style="margin:0 0 14px"><b>If it fails:</b> <code>origin_mismatch</code> → the origin in step 4 must exactly match <code>${esc(origin)}</code> · <code>access_denied</code> → add your Gmail as a test user (step 3) · nothing opens → allow popups for this site. Changes in Google Cloud can take a few minutes to apply.</p>
        </details>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card">
          <div class="card-head"><h2 class="serif">Preferences</h2></div>
          <div class="setting-row"><div><div class="s-title">Theme</div><div class="s-desc">Follow system or pick one</div></div>
            <select class="select" id="pref-theme">${['system', 'light', 'dark'].map((v) => `<option value="${v}" ${p.theme === v ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select></div>
          <div class="setting-row"><div><div class="s-title">Currency</div><div class="s-desc">Synced with your data</div></div>
            <select class="select" id="pref-currency">${S.CURRENCIES.map((c) => `<option value="${c.code}" ${st.currency === c.code ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>
        </div>
        <div class="card">
          <div class="card-head"><h2 class="serif">Your data</h2></div>
          <div class="setting-row"><div><div class="s-title">Export CSV</div><div class="s-desc">All transactions, for Excel / Sheets</div></div><button class="btn btn-ghost btn-sm" data-action="export-csv" type="button">${ico('download')} CSV</button></div>
          <div class="setting-row"><div><div class="s-title">Backup JSON</div><div class="s-desc">Full backup incl. categories &amp; budgets</div></div><button class="btn btn-ghost btn-sm" data-action="export-json" type="button">${ico('download')} JSON</button></div>
          <div class="setting-row"><div><div class="s-title">Import backup</div><div class="s-desc">Merges a JSON backup into this device</div></div><label class="btn btn-ghost btn-sm" style="cursor:pointer">${ico('upload')} Import<input type="file" id="import-file" accept="application/json,.json" hidden></label></div>
        </div>
        <div class="card danger-zone">
          <div class="card-head"><h2 class="serif">Danger zone</h2></div>
          <div class="setting-row"><div><div class="s-title">Clear local data</div><div class="s-desc">Removes data from this browser only. Drive file is untouched.</div></div><button class="btn btn-danger btn-sm" data-action="clear-local" type="button">${ico('trash')} Clear</button></div>
        </div>
      </div>
    </div>`;
}

/* ───────────────────────── transaction form ───────────────────────── */
function openTxForm(existing) {
  const p = S.getPrefs();
  const t = existing ? { ...existing } : { type: 'expense', amount: '', category: '', date: todayISO(), note: '', method: p.lastMethod || 'UPI' };
  const sym = currencySymbol(cur(), loc());
  const el = openModal({
    title: existing ? 'Edit transaction' : 'New transaction',
    body: `
      <form id="tx-form" class="form" style="display:flex;flex-direction:column;gap:16px" novalidate>
        <div class="seg" style="align-self:flex-start" id="f-type">
          <button type="button" class="seg-btn ${t.type === 'expense' ? 'active' : ''}" data-value="expense">Expense</button>
          <button type="button" class="seg-btn ${t.type === 'income' ? 'active' : ''}" data-value="income">Income</button>
        </div>
        <label class="field"><span class="label">Amount</span>
          <div class="amount-wrap"><span class="cur">${esc(sym)}</span><input name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" placeholder="0" value="${esc(t.amount)}" required autofocus></div>
        </label>
        <div class="field"><span class="label">Category</span><div class="cat-grid" id="f-cats"></div><div class="f-budget" id="f-budget" hidden></div></div>
        <div class="row2">
          <label class="field"><span class="label">Date</span><input class="input" name="date" type="date" value="${esc(t.date)}" required></label>
          <div class="field"><span class="label">Paid via</span><div class="chips" id="f-method">${S.METHODS.map((m) => `<button type="button" class="chip ${t.method === m ? 'active' : ''}" data-value="${m}">${m}</button>`).join('')}</div></div>
        </div>
        <label class="field"><span class="label">Note</span><input class="input" name="note" placeholder="e.g. Lunch with team" value="${esc(t.note)}" maxlength="120"></label>
      </form>`,
    footer: `${existing ? `<button class="btn btn-danger left" data-del type="button">${ico('trash')} Delete</button>` : ''}
      <button class="btn btn-ghost" data-cancel type="button">Cancel</button>
      <button class="btn btn-primary" data-save type="button">${ico('check')} ${existing ? 'Save changes' : 'Add transaction'}</button>`,
  });
  const form = $('#tx-form', el);
  const state = { type: t.type, category: t.category, method: t.method };

  const renderCats = () => {
    const cats = S.categories(state.type);
    if (!cats.some((c) => c.id === state.category)) state.category = cats[0]?.id || '';
    $('#f-cats', el).innerHTML = cats.map((c) => `<button type="button" class="cat-chip ${c.id === state.category ? 'active' : ''}" data-id="${c.id}"><span class="em" style="background:${hexAlpha(c.color, 0.16)}">${esc(c.icon)}</span><span>${esc(c.name)}</span></button>`).join('');
    renderBudgetHint();
  };
  // Live "how does this entry affect my budget" line under the category picker.
  const renderBudgetHint = () => {
    const box = $('#f-budget', el);
    const date = form.date.value || todayISO();
    if (state.type !== 'expense' || !S.budgetFor(state.category)) { box.hidden = true; return; }
    const amt = Number(form.amount.value) || 0;
    const now = S.categoryBudget(state.category, date.slice(0, 7), 0, t.id);
    const after = S.categoryBudget(state.category, date.slice(0, 7), amt, t.id);
    const mName = monthLabel(date.slice(0, 7), loc(), true).split(' ')[0];
    const cls = after.left < 0 ? 'over' : after.used >= 0.8 ? 'warn' : 'ok';
    const verdict = !amt ? `${money(Math.max(0, now.left))} left of ${money(now.budget)}${now.left < 0 ? ` — already over by ${money(-now.left)}` : ''}`
      : after.left >= 0 ? `After this: <b>${money(after.left)}</b> left of ${money(after.budget)}`
      : `This puts ${esc(now.cat.name)} <b>over by ${money(-after.left)}</b>`;
    box.hidden = false;
    box.className = `f-budget ${cls}`;
    box.innerHTML = `<div class="fb-top"><span>${esc(now.cat.icon)} ${esc(now.cat.name)} budget · ${esc(mName)}${now.planPct ? ` · ${now.planPct}% plan` : ''}</span><span>${Math.round(after.used * 100)}%</span></div>
      <div class="progress"><span style="width:${Math.min(100, now.used * 100)}%"></span>${amt ? `<span class="fb-add" style="left:${Math.min(100, now.used * 100)}%;width:${Math.max(0, Math.min(100, after.used * 100) - Math.min(100, now.used * 100))}%"></span>` : ''}</div>
      <div class="fb-text">${verdict}</div>`;
  };
  renderCats();
  form.amount.addEventListener('input', renderBudgetHint);
  form.date.addEventListener('change', renderBudgetHint);

  el.addEventListener('click', (e) => {
    const typeBtn = e.target.closest('#f-type .seg-btn');
    if (typeBtn) { state.type = typeBtn.dataset.value; $$('#f-type .seg-btn', el).forEach((b) => b.classList.toggle('active', b === typeBtn)); renderCats(); return; }
    const cat = e.target.closest('.cat-chip');
    if (cat) { state.category = cat.dataset.id; $$('.cat-chip', el).forEach((b) => b.classList.toggle('active', b === cat)); renderBudgetHint(); return; }
    const m = e.target.closest('#f-method .chip');
    if (m) { state.method = m.dataset.value; $$('#f-method .chip', el).forEach((b) => b.classList.toggle('active', b === m)); return; }
    if (e.target.closest('[data-cancel]')) closeModal();
    if (e.target.closest('[data-save]')) save();
    if (e.target.closest('[data-del]')) del();
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(); } });

  function save() {
    const amount = Number(form.amount.value);
    if (!(amount > 0)) { toast('Enter an amount greater than 0', 'error'); form.amount.focus(); return; }
    if (!form.date.value) { toast('Pick a date', 'error'); form.date.focus(); return; }
    if (!state.category) { toast('Pick a category', 'error'); return; }
    const rec = S.upsertTransaction({ ...t, type: state.type, amount, category: state.category, date: form.date.value, note: form.note.value, method: state.method });
    closeModal();
    const b = rec.type === 'expense' && S.budgetFor(rec.category) ? S.categoryBudget(rec.category, rec.date.slice(0, 7)) : null;
    const tail = b ? (b.left >= 0 ? ` · ${b.cat.name}: ${money(b.left)} left` : ` · ${b.cat.name} over budget by ${money(-b.left)}`) : '';
    toast(`${existing ? 'Updated' : `${money(rec.amount)} added`}${tail}`, b && b.left < 0 ? 'error' : 'success', b ? 3800 : 2800);
  }
  async function del() {
    closeModal();
    const ok = await confirmDialog('This transaction will be removed. You can undo right after.', { title: 'Delete transaction?' });
    if (!ok) return;
    S.removeTransaction(t.id);
    toast('Deleted');
    undoBanner(t.id);
  }
}
function undoBanner(id) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>Transaction deleted</span><button class="btn btn-sm" style="background:rgba(255,255,255,.18);color:inherit;padding:4px 10px" type="button">Undo</button>`;
  el.querySelector('button').onclick = () => { S.restoreTransaction(id); el.remove(); toast('Restored', 'success'); };
  root.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 6000);
}

/* ───────────────────────── category form ───────────────────────── */
function openCatForm(existing, type = 'expense') {
  const c = existing ? { ...existing } : { name: '', icon: EMOJIS[0], color: PALETTE[0], type };
  const el = openModal({
    title: existing ? 'Edit category' : `New ${type} category`, size: 'sm',
    body: `
      <label class="field"><span class="label">Name</span><input class="input" id="c-name" value="${esc(c.name)}" placeholder="e.g. Pets" maxlength="40" autofocus></label>
      <div class="field"><span class="label">Icon</span><div class="chips" id="c-icons">${EMOJIS.map((e) => `<button type="button" class="chip ${c.icon === e ? 'active' : ''}" data-value="${e}" style="font-size:18px;padding:5px 9px">${e}</button>`).join('')}</div></div>
      <div class="field"><span class="label">Color</span><div class="color-row" id="c-colors">${PALETTE.map((p) => `<button type="button" class="color-dot ${c.color === p ? 'active' : ''}" data-value="${p}" style="background:${p}" aria-label="${p}"></button>`).join('')}</div></div>`,
    footer: `<button class="btn btn-ghost" data-cancel type="button">Cancel</button><button class="btn btn-primary" data-save type="button">${ico('check')} Save</button>`,
  });
  el.addEventListener('click', (e) => {
    const ic = e.target.closest('#c-icons .chip'); if (ic) { c.icon = ic.dataset.value; $$('#c-icons .chip', el).forEach((b) => b.classList.toggle('active', b === ic)); }
    const co = e.target.closest('#c-colors .color-dot'); if (co) { c.color = co.dataset.value; $$('#c-colors .color-dot', el).forEach((b) => b.classList.toggle('active', b === co)); }
    if (e.target.closest('[data-cancel]')) closeModal();
    if (e.target.closest('[data-save]')) {
      const name = $('#c-name', el).value.trim();
      if (!name) { toast('Give the category a name', 'error'); return; }
      S.upsertCategory({ ...c, name });
      closeModal(); toast(existing ? 'Category updated' : 'Category added', 'success');
    }
  });
  $('#c-name', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector('[data-save]').click(); });
}

/* ───────────────────────── Drive sync orchestration ───────────────────────── */
let syncTimer = null, syncing = false, pendingSync = false;
function scheduleSync() {
  if (!D.isConfigured() || !['connected', 'syncing'].includes(D.getStatus())) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sync(), 1200);
}
async function sync({ manual = false } = {}) {
  if (!D.isConfigured()) { if (manual) toast('Add your Google Client ID first', 'error'); return; }
  if (syncing) { pendingSync = true; return; }
  syncing = true;
  try {
    const remote = await D.pull();
    const local = S.getData();
    const merged = S.mergeData(local, remote || S.emptyData());
    const sigM = S.signature(merged);
    if (sigM !== S.signature(local)) S.replaceData(merged, { silent: true });
    if (!remote || sigM !== S.signature(remote)) await D.push(merged);
    S.setPrefs({ lastSync: Date.now() });
    if (manual) toast('Synced with Google Drive', 'success');
  } catch (e) {
    console.error('[sync]', e);
    if (manual || !String(e.message).includes('popup')) toast(`Sync failed: ${e.message}`, 'error', 4000);
  } finally {
    syncing = false;
    if (pendingSync) { pendingSync = false; scheduleSync(); }
  }
}
async function connectDrive() {
  const id = $('#client-id')?.value.trim() || S.getPrefs().clientId;
  if (!id) { toast('Paste your OAuth Client ID first', 'error'); $('#client-id')?.focus(); return; }
  if (!/\.apps\.googleusercontent\.com$/.test(id)) { toast('That does not look like a Google OAuth Client ID', 'error'); return; }
  S.setPrefs({ clientId: id }); D.configure(id);
  try {
    await D.signIn();
    toast(`Connected as ${D.getUser()?.email || 'Google user'}`, 'success');
    await sync({ manual: true });
  } catch (e) {
    toast(e.message, 'error', 4500);
  }
}
function renderSyncPill(status, detail) {
  const pill = $('#sync-pill');
  pill.dataset.status = status;
  const user = D.getUser();
  pill.querySelector('.sync-text').textContent = {
    off: D.isConfigured() ? 'Drive: not connected' : 'Local only · set up Drive',
    connecting: 'Connecting to Google…', connected: 'Synced with Drive', syncing: 'Syncing…',
    error: `Sync error${detail ? ' · ' + detail.slice(0, 28) : ''}`, reconnect: 'Tap to reconnect Drive',
  }[status] || status;
  const chip = $('#user-chip');
  if (user) { chip.hidden = false; chip.innerHTML = `${user.picture ? `<img src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">` : ''}<div><div class="u-name">${esc(user.name)}</div><div class="u-mail">${esc(user.email)}</div></div>`; }
  else chip.hidden = true;
  if (route() === 'settings') render();
}

/* ───────────────────────── global actions ───────────────────────── */
const actions = {
  'new-tx': () => openTxForm(),
  'edit-tx': (el) => { const t = S.getData().transactions.find((x) => x.id === el.dataset.id); if (t) openTxForm(t); },
  'month-prev': () => S.setPrefs({ month: shiftMonth(S.getPrefs().month, -1) }),
  'month-next': () => S.setPrefs({ month: shiftMonth(S.getPrefs().month, 1) }),
  'month-today': () => S.setPrefs({ month: monthKey() }),
  'toggle-theme': () => { const cur_ = document.documentElement.dataset.theme; S.setPrefs({ theme: cur_ === 'dark' ? 'light' : 'dark' }); applyTheme(); },
  'new-cat': (el) => openCatForm(null, el.dataset.type),
  'edit-cat': (el) => openCatForm(S.category(el.dataset.id)),
  'del-cat': async (el) => {
    const c = S.category(el.dataset.id);
    if (await confirmDialog(`Transactions in "${c.name}" will move to "${(c.type || 'expense') === 'income' ? 'Other Income' : 'Other'}".`, { title: `Delete ${c.name}?` })) { S.removeCategory(c.id); toast('Category deleted'); }
  },
  'connect': connectDrive,
  'sync-now': () => sync({ manual: true }),
  'disconnect': async () => { if (await confirmDialog('Your data stays in this browser and in Drive. You can reconnect anytime.', { title: 'Disconnect Google Drive?', okLabel: 'Disconnect' })) { D.signOut(); toast('Disconnected'); } },
  'open-drive': async () => { try { const l = await D.fileLink(); if (l) window.open(l, '_blank', 'noopener'); else toast('No file in Drive yet — add a transaction first'); } catch (e) { toast(e.message, 'error'); } },
  'export-csv': () => { downloadFile(`kharcha-${todayISO()}.csv`, S.toCSV(), 'text/csv'); toast('CSV downloaded', 'success'); },
  'export-json': () => { downloadFile(`kharcha-backup-${todayISO()}.json`, JSON.stringify(S.getData(), null, 2), 'application/json'); toast('Backup downloaded', 'success'); },
  'clear-local': async () => { if (await confirmDialog('All transactions, categories and budgets will be removed from this browser.', { title: 'Clear local data?', okLabel: 'Clear' })) { S.clearAll(); plan = null; toast('Local data cleared'); } },
  // ── percentage planner ──
  'plan-base': (el) => { planDraft().base = Number(el.dataset.value) || 0; const i = $('#plan-base'); if (i) i.value = planDraft().base; updatePlanDOM(); },
  'plan-reset': () => { plan = { base: planDraft().base, allocations: { ...S.DEFAULT_PLAN } }; render(); toast('Reset to the default split'); },
  'plan-apply': async () => {
    const d = planDraft(); const sum = planSum();
    if (!(d.base > 0)) { toast('Enter a base amount first', 'error'); $('#plan-base')?.focus(); return; }
    if (sum > 100) { toast(`Allocations add up to ${sum}% — bring it to 100% or less`, 'error'); return; }
    if (sum === 0) { toast('Give at least one category a percentage', 'error'); return; }
    const ok = await confirmDialog(`${sum}% of ${money(d.base)} (${money(planAmt(sum))}) will be split across ${Object.values(d.allocations).filter(Number).length} categories. Existing limits for those categories will be replaced.`, { title: 'Apply this plan?', okLabel: 'Apply', danger: false });
    if (!ok) return;
    const total = S.applyBudgetPlan(d); plan = null;
    toast(`Budgets set · ${money(total)} planned`, 'success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el); }
});
document.addEventListener('keydown', (e) => {
  if (isModalOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.key.toLowerCase() === 'n') { e.preventDefault(); openTxForm(); }
  if (e.key === '[') actions['month-prev']();
  if (e.key === ']') actions['month-next']();
});
// Inputs that live inside views (delegated)
let debounce;
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'tx-q') { txFilter.q = t.value; clearTimeout(debounce); debounce = setTimeout(() => { const pos = t.selectionStart; render(); const n = $('#tx-q'); n.focus(); n.setSelectionRange(pos, pos); }, 180); }
  if (t.dataset.budget) { clearTimeout(debounce); debounce = setTimeout(() => { S.setBudget(t.dataset.budget, t.value); }, 500); }
  // planner: sliders / % inputs / base — update DOM in place, no re-render
  const pid = t.dataset.planPct || t.dataset.planNum;
  if (pid) { planDraft().allocations[pid] = Math.max(0, Math.min(100, Math.round(Number(t.value) || 0))); updatePlanDOM(); }
  if (t.id === 'plan-base') { planDraft().base = Math.max(0, Number(t.value) || 0); updatePlanDOM(); }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'tx-cat') { txFilter.category = t.value; render(); }
  if (t.id === 'pref-theme') { S.setPrefs({ theme: t.value }); applyTheme(); }
  if (t.id === 'pref-currency') { const c = S.CURRENCIES.find((x) => x.code === t.value); S.setSettings({ currency: c.code, locale: c.locale }); toast(`Currency set to ${c.code}`, 'success'); }
  if (t.id === 'client-id') { S.setPrefs({ clientId: t.value.trim() }); D.configure(t.value.trim()); }
  if (t.id === 'import-file' && t.files?.[0]) {
    const f = t.files[0];
    f.text().then((txt) => { const n = S.importJSON(JSON.parse(txt)); toast(`Imported · ${n} new transaction${n === 1 ? '' : 's'}`, 'success'); }).catch((err) => toast(err.message, 'error', 4000));
  }
});
document.addEventListener('click', (e) => {
  const seg = e.target.closest('#tx-type .seg-btn'); if (seg) { txFilter.type = seg.dataset.value; render(); }
  const sc = e.target.closest('#tx-scope .seg-btn'); if (sc) S.setPrefs({ txScope: sc.dataset.value });
  const cf = e.target.closest('[data-cat-filter]'); if (cf) { txFilter.category = cf.dataset.catFilter; txFilter.type = ''; txFilter.q = ''; }
});
$('#sync-pill').addEventListener('click', () => {
  const st = D.getStatus();
  if (st === 'connected') sync({ manual: true });
  else if (st === 'reconnect' || (st === 'off' && D.isConfigured())) connectDrive();
  else location.hash = '#/settings';
});

/* ───────────────────────── boot ───────────────────────── */
S.init();
applyTheme();
hydrateIcons();
S.subscribe(() => render());
S.setPersistHook(scheduleSync);
D.onStatus(renderSyncPill);
D.configure(S.getPrefs().clientId);
window.addEventListener('hashchange', render);
render();
if (new URLSearchParams(location.search).get('open') === 'new') setTimeout(() => openTxForm(), 50); // deep link: /?open=new

if (D.isConfigured() && D.wasConnected()) {
  if (D.restoreSession()) sync();
  else D.signIn({ silent: true }).then(() => sync()).catch(() => { /* user can tap "reconnect" */ });
}
