# Kharcha — Expense Manager

Design: a modern *bahi-khata* — warm paper & ink, one vermilion accent, Fraunces + Inter, editorial statement hero, ledger rows. Light and dark, `prefers-reduced-motion` respected.

A fast, private expense manager. Plain HTML/CSS/JS, no build step, no backend.
Your data lives in **your own Google Drive** (`Kharcha/kharcha-data.json`) and is cached in the browser so the app works offline.

## Run it

```bash
cd ~/My/expense-manager
python3 -m http.server 8080
```

Open <http://localhost:8080>. (Google sign-in does not work from `file://`, so always serve it over http.)

The app works immediately in **local-only mode**. Connect Google Drive when you want sync/backup.

## Connect Google Drive (one-time, ~3 min, free)

Free — no billing account or credit card. Use your **personal Gmail**: work/company accounts usually get
*"You do not have the required resourcemanager.projects.create permission"*. Easiest in an Incognito window.

1. **Create the project** — <https://console.cloud.google.com/> → accept terms (skip any free-trial/billing popup) → **New Project** → name `Kharcha` → Location / Parent resource: **No organization** → **Create**. Select it in the top bar.
2. **Enable the Drive API** — **APIs & Services → Library** → **Google Drive API** → **Enable**.
3. **Consent screen** — **APIs & Services → OAuth consent screen** (Google Auth Platform) → **Get started** → app name `Kharcha`, support email = your Gmail → Audience **External** → contact email → **Create**. Then **Audience → Test users → Add users** → your Gmail. Leave it in *Testing*.
4. **Client ID** — **Credentials → Create credentials → OAuth client ID** (or Google Auth Platform → **Clients**) → **Web application** → **Authorized JavaScript origins** = `http://localhost:8080` (exact, no trailing slash) → **Create**. Copy the Client ID; the secret isn't needed.
5. **Connect** — app **Settings → Google Drive** → paste → **Connect Google Drive** → same Gmail → *"Google hasn't verified this app"* → **Continue** → allow.

Troubleshooting: `origin_mismatch` → fix the origin in step 4 · `access_denied` → add yourself as test user · no popup → allow popups. Cloud changes can take a few minutes.

Scope used: `drive.file` — the app can only see the file/folder it created, nothing else in your Drive.

## Features

- Dashboard: month spend, delta vs last month, income, daily average, budget progress, category donut, 6-month trend, recent activity
- Transactions: search, filter by type/category, month or all-time, grouped by day with daily totals, edit/delete with undo
- Budgets: overall + per-category monthly limits with live progress
- **Percentage planner**: pick a base amount (defaults to this month's income), split it across categories with sliders (e.g. 25% rent, 20% savings, 13% investments), see the stacked allocation bar, and apply it to all budgets in one click. The plan is saved and synced, so you can re-apply it every month.
- Categories: custom icons & colors, expense and income types; Savings and Investments are built-in so money set aside can be budgeted
- Google Drive sync: auto-sync after every change, manual sync, conflict-free merge across devices (latest edit wins per record)
- Export CSV / JSON backup, import backup
- Light/dark theme, keyboard shortcuts (`N` new, `[` / `]` change month, `Esc` close), mobile layout with bottom nav

## Files

```
index.html        shell + layout
css/styles.css    design tokens, components, responsive rules
js/app.js         routing, views, forms, sync orchestration
js/store.js       state, localStorage, selectors, merge logic
js/drive.js       Google OAuth (GIS) + Drive REST v3
js/charts.js      SVG donut + bar chart
js/ui.js          helpers: formatting, icons, modal, toast
```
