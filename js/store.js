// State + persistence (localStorage) + merge logic for Drive sync.
import { uid, monthKey } from './ui.js';

const LS_DATA = 'kharcha:data';
const LS_PREFS = 'kharcha:prefs';
const TOMBSTONE_TTL = 45 * 86400000;

export const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Food & Dining', icon: '🍜', color: '#f97316' },
  { id: 'groceries', name: 'Groceries', icon: '🛒', color: '#84cc16' },
  { id: 'transport', name: 'Transport', icon: '🚕', color: '#3b82f6' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#ec4899' },
  { id: 'bills', name: 'Bills & Utilities', icon: '💡', color: '#eab308' },
  { id: 'rent', name: 'Rent & Home', icon: '🏠', color: '#8b5cf6' },
  { id: 'health', name: 'Health', icon: '💊', color: '#10b981' },
  { id: 'fun', name: 'Entertainment', icon: '🎬', color: '#06b6d4' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#14b8a6' },
  { id: 'education', name: 'Education', icon: '📚', color: '#6366f1' },
  { id: 'gifts', name: 'Gifts & Family', icon: '🎁', color: '#f43f5e' },
  { id: 'savings', name: 'Savings', icon: '🏦', color: '#2563eb' },
  { id: 'investments', name: 'Investments', icon: '📈', color: '#059669' },
  { id: 'other', name: 'Other', icon: '📦', color: '#64748b' },
  { id: 'salary', name: 'Salary', icon: '💼', color: '#22c55e', type: 'income' },
  { id: 'freelance', name: 'Freelance', icon: '🧑‍💻', color: '#0ea5e9', type: 'income' },
  { id: 'refund', name: 'Refund', icon: '↩️', color: '#a3e635', type: 'income' },
  { id: 'income_other', name: 'Other Income', icon: '💰', color: '#84cc16', type: 'income' },
];
export const METHODS = ['UPI', 'Card', 'Cash', 'Net Banking', 'Other'];
export const CURRENCIES = [
  { code: 'INR', locale: 'en-IN', label: 'Indian Rupee (₹)' },
  { code: 'USD', locale: 'en-US', label: 'US Dollar ($)' },
  { code: 'EUR', locale: 'de-DE', label: 'Euro (€)' },
  { code: 'GBP', locale: 'en-GB', label: 'British Pound (£)' },
  { code: 'AED', locale: 'en-AE', label: 'UAE Dirham (AED)' },
  { code: 'SGD', locale: 'en-SG', label: 'Singapore Dollar (S$)' },
  { code: 'JPY', locale: 'ja-JP', label: 'Japanese Yen (¥)' },
  { code: 'AUD', locale: 'en-AU', label: 'Australian Dollar (A$)' },
  { code: 'CAD', locale: 'en-CA', label: 'Canadian Dollar (C$)' },
];

// Default percentage split (sums to 100). Needs ~63 / wants ~17 / future-you 20+13.
export const DEFAULT_PLAN = { rent: 25, groceries: 7, food: 8, transport: 5, bills: 4, health: 4, travel: 4, gifts: 6, shopping: 4, fun: 3, education: 2, savings: 13, investments: 15 };

export function emptyData() {
  return {
    version: 1,
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, updatedAt: 0 })),
    budgets: {},
    budgetsUpdatedAt: 0,
    budgetPlan: { base: 0, allocations: { ...DEFAULT_PLAN }, updatedAt: 0 },
    settings: { currency: 'INR', locale: 'en-IN', updatedAt: 0 },
  };
}

let data = emptyData();
let prefs = { theme: 'system', clientId: '', month: monthKey(), lastMethod: 'UPI', lastSync: 0, txScope: 'month' };
const subs = new Set();
let persistHook = null;

/* ───────── lifecycle ───────── */
export function init() {
  try { const raw = localStorage.getItem(LS_DATA); if (raw) data = normalize(JSON.parse(raw)); } catch { /* ignore */ }
  try { const raw = localStorage.getItem(LS_PREFS); if (raw) prefs = { ...prefs, ...JSON.parse(raw) }; } catch { /* ignore */ }
  prefs.month = prefs.month || monthKey();
}
export function normalize(d) {
  const base = emptyData();
  const out = { ...base, ...(d || {}) };
  out.transactions = Array.isArray(out.transactions) ? out.transactions : [];
  out.categories = Array.isArray(out.categories) && out.categories.length ? out.categories : base.categories;
  // make sure defaults exist (new defaults added in later versions)
  const have = new Set(out.categories.map((c) => c.id));
  for (const c of base.categories) if (!have.has(c.id)) out.categories.push(c);
  out.budgets = out.budgets && typeof out.budgets === 'object' ? out.budgets : {};
  out.budgetPlan = { ...base.budgetPlan, ...(out.budgetPlan || {}) };
  if (!out.budgetPlan.allocations || typeof out.budgetPlan.allocations !== 'object') out.budgetPlan.allocations = { ...DEFAULT_PLAN };
  out.settings = { ...base.settings, ...(out.settings || {}) };
  return out;
}
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export const setPersistHook = (fn) => { persistHook = fn; };
const notify = () => subs.forEach((fn) => fn());

function commit({ silent = false } = {}) {
  data.transactions = data.transactions.filter((t) => !t.deleted || t.updatedAt > Date.now() - TOMBSTONE_TTL);
  localStorage.setItem(LS_DATA, JSON.stringify(data));
  notify();
  if (!silent) persistHook?.();
}
export function savePrefs() { localStorage.setItem(LS_PREFS, JSON.stringify(prefs)); }

export const getData = () => data;
export const getPrefs = () => prefs;
export function setPrefs(patch) { prefs = { ...prefs, ...patch }; savePrefs(); notify(); }
export function replaceData(next, { silent = true } = {}) { data = normalize(next); commit({ silent }); }

/* ───────── selectors ───────── */
export const categories = (type) => data.categories.filter((c) => !c.deleted && (!type || (c.type || 'expense') === type));
export const category = (id) => data.categories.find((c) => c.id === id) || { id, name: 'Unknown', icon: '❔', color: '#64748b' };
export const settings = () => data.settings;

export function transactions({ month, type, categoryId, q } = {}) {
  const query = (q || '').trim().toLowerCase();
  return data.transactions
    .filter((t) => !t.deleted)
    .filter((t) => !month || t.date.startsWith(month))
    .filter((t) => !type || t.type === type)
    .filter((t) => !categoryId || t.category === categoryId)
    .filter((t) => !query || `${t.note || ''} ${category(t.category).name} ${t.method || ''} ${t.amount}`.toLowerCase().includes(query))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - a.updatedAt));
}
export function summary(month) {
  const tx = transactions({ month });
  const expense = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  return { expense, income, net: income - expense, count: tx.length };
}
export function byCategory(month, type = 'expense') {
  const map = new Map();
  for (const t of transactions({ month, type })) map.set(t.category, (map.get(t.category) || 0) + t.amount);
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return [...map.entries()].map(([id, total_]) => ({ cat: category(id), total: total_, pct: total ? total_ / total : 0 })).sort((a, b) => b.total - a.total);
}
export function trend(months = 6, endMonth) {
  const out = [];
  let key = endMonth;
  for (let i = 0; i < months; i++) {
    const [y, m] = key.split('-').map(Number);
    const s = summary(key);
    out.unshift({ key, label: new Date(y, m - 1, 1).toLocaleDateString('en', { month: 'short' }), expense: s.expense, income: s.income });
    key = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
  }
  return out;
}
export const budgets = () => data.budgets;
export const budgetFor = (id) => Number(data.budgets[id] || 0);
/** Budget status for one category in a month. `extra` = an amount not yet saved (live preview in the form). */
export function categoryBudget(id, month, extra = 0, excludeTxId = null) {
  const budget = budgetFor(id);
  const spent = transactions({ month, type: 'expense', categoryId: id }).filter((t) => t.id !== excludeTxId).reduce((s, t) => s + t.amount, 0) + extra;
  const plan = data.budgetPlan || {};
  const planPct = plan.base ? Number(plan.allocations?.[id]) || 0 : 0;
  return { id, cat: category(id), budget, spent, left: budget - spent, used: budget ? spent / budget : 0, planPct };
}
/** All categories that have a budget, worst first (over → nearly used → rest). */
export function categoryBudgets(month) {
  return categories('expense').filter((c) => budgetFor(c.id) > 0).map((c) => categoryBudget(c.id, month)).sort((a, b) => b.used - a.used);
}
export function totalBudget() {
  if (data.budgets._total) return Number(data.budgets._total);
  return categories('expense').reduce((s, c) => s + budgetFor(c.id), 0);
}

/* ───────── mutations ───────── */
export function upsertTransaction(t) {
  const now = Date.now();
  const rec = { id: t.id || uid(), type: t.type === 'income' ? 'income' : 'expense', amount: Math.round(Number(t.amount) * 100) / 100,
    category: t.category, date: t.date, note: (t.note || '').trim(), method: t.method || '', updatedAt: now, createdAt: t.createdAt || now };
  const i = data.transactions.findIndex((x) => x.id === rec.id);
  if (i >= 0) data.transactions[i] = { ...data.transactions[i], ...rec, deleted: false }; else data.transactions.push(rec);
  prefs.lastMethod = rec.method; savePrefs();
  commit();
  return rec;
}
export function removeTransaction(id) {
  const t = data.transactions.find((x) => x.id === id);
  if (!t) return;
  t.deleted = true; t.updatedAt = Date.now();
  commit();
}
export function restoreTransaction(id) {
  const t = data.transactions.find((x) => x.id === id);
  if (!t) return;
  t.deleted = false; t.updatedAt = Date.now();
  commit();
}
export function upsertCategory(c) {
  const rec = { id: c.id || uid(), name: c.name.trim(), icon: c.icon || '🏷️', color: c.color || '#64748b', type: c.type === 'income' ? 'income' : 'expense', updatedAt: Date.now() };
  const i = data.categories.findIndex((x) => x.id === rec.id);
  if (i >= 0) data.categories[i] = { ...data.categories[i], ...rec, deleted: false }; else data.categories.push(rec);
  commit();
  return rec;
}
export function removeCategory(id) {
  const c = data.categories.find((x) => x.id === id);
  if (!c) return;
  const fallback = (c.type || 'expense') === 'income' ? 'income_other' : 'other';
  for (const t of data.transactions) if (t.category === id) { t.category = fallback; t.updatedAt = Date.now(); }
  c.deleted = true; c.updatedAt = Date.now();
  if (data.budgets[id] !== undefined) { delete data.budgets[id]; data.budgetsUpdatedAt = Date.now(); }
  commit();
}
export function setBudget(id, amount) {
  const v = Math.max(0, Number(amount) || 0);
  if (v) data.budgets[id] = v; else delete data.budgets[id];
  data.budgetsUpdatedAt = Date.now();
  commit();
}
export const budgetPlan = () => data.budgetPlan;
export function setBudgetPlan(patch) {
  data.budgetPlan = { ...data.budgetPlan, ...patch, updatedAt: Date.now() };
  commit();
}
/** Turn a percentage plan into category budgets. Amounts are rounded to the nearest 10. */
export function applyBudgetPlan({ base, allocations }) {
  const b = Math.max(0, Number(base) || 0);
  let total = 0;
  for (const [id, pct] of Object.entries(allocations)) {
    const amt = Math.round((b * (Number(pct) || 0)) / 100 / 10) * 10;
    if (amt > 0) { data.budgets[id] = amt; total += amt; } else delete data.budgets[id];
  }
  data.budgets._total = total || undefined;
  if (!data.budgets._total) delete data.budgets._total;
  data.budgetsUpdatedAt = Date.now();
  data.budgetPlan = { base: b, allocations: { ...allocations }, updatedAt: Date.now() };
  commit();
  return total;
}
export function setSettings(patch) {
  data.settings = { ...data.settings, ...patch, updatedAt: Date.now() };
  commit();
}
export function clearAll() {
  data = emptyData();
  commit({ silent: true });
}

/* ───────── merge (local ⟷ Drive) ───────── */
const pick = (a, b) => ((a?.updatedAt || 0) >= (b?.updatedAt || 0) ? a : b);
function mergeList(la = [], lb = []) {
  const m = new Map();
  for (const it of [...la, ...lb]) { if (!it?.id) continue; const p = m.get(it.id); m.set(it.id, p ? pick(p, it) : it); }
  return [...m.values()];
}
export function mergeData(a, b) {
  a = normalize(a); b = normalize(b);
  const budgetsFromA = (a.budgetsUpdatedAt || 0) >= (b.budgetsUpdatedAt || 0);
  return normalize({
    version: 1,
    transactions: mergeList(a.transactions, b.transactions),
    categories: mergeList(a.categories, b.categories),
    budgets: budgetsFromA ? a.budgets : b.budgets,
    budgetsUpdatedAt: Math.max(a.budgetsUpdatedAt || 0, b.budgetsUpdatedAt || 0),
    budgetPlan: pick(a.budgetPlan, b.budgetPlan),
    settings: pick(a.settings, b.settings),
  });
}
export function signature(d) {
  d = normalize(d);
  const sortId = (l) => [...l].sort((x, y) => (x.id < y.id ? -1 : 1));
  return JSON.stringify({ t: sortId(d.transactions), c: sortId(d.categories), b: d.budgets, bu: d.budgetsUpdatedAt, p: d.budgetPlan, s: d.settings });
}

/* ───────── import / export ───────── */
export function toCSV() {
  const rows = [['date', 'type', 'category', 'amount', 'method', 'note']];
  for (const t of transactions()) rows.push([t.date, t.type, category(t.category).name, t.amount, t.method || '', t.note || '']);
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}
export function importJSON(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.transactions)) throw new Error('Not a valid Kharcha backup file');
  const merged = mergeData(data, obj);
  const added = merged.transactions.filter((t) => !t.deleted).length - data.transactions.filter((t) => !t.deleted).length;
  data = merged; commit();
  return Math.max(0, added);
}
