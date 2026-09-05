# متجر المكملات الغذائية — Full MVP

A complete, mobile-first POS & inventory management system for a small
supplement store. Next.js, TypeScript, Tailwind CSS, Supabase/PostgreSQL.
Arabic RTL UI, EGP currency, installable as a PWA, responsive on desktop too.

## Features

- **Dashboard** — today's sales, inventory value, customer debts, low-stock
  alerts, this month's net profit/expenses, recent sales
- **Products** — add/edit/search/filter by category/low-stock/deactivate
- **Categories** — add/rename/delete
- **Inventory** — stock levels & status, manual stock adjustments, full
  per-product stock movement history
- **POS / Sales** — 3-step flow (customer → products → payment), blocks
  overselling, sales history list, sale detail view, **cancellation/return**
  (restores stock, reverses customer debt)
- **Customers** — list, detail page, debt tracking, payment recording
- **Suppliers** — list, detail page, debt tracking, payment recording
- **Purchases** — 3-step flow (supplier → products → payment), increases
  stock, purchase detail view, **cancellation** (reverses stock — blocked if
  the stock was already resold — reverses supplier debt)
- **Expenses** — categorized (rent, electricity, transportation, salaries,
  marketing, other), monthly total
- **Reports** — sales by range (today/week/month/custom), profit summary
  (revenue − COGS − expenses), top-selling products, inventory value,
  low/out-of-stock lists, customer debts
- **Authentication** — Supabase Auth email/password login, all routes
  protected, all Supabase tables require an authenticated session (RLS)
- **PWA** — installable on iPhone Home Screen, manifest + service worker
- **Responsive** — mobile-first with bottom nav; desktop/tablet gets a top
  nav bar and wider layout

## 1. Set up Supabase

Run these **in order** in the Supabase SQL Editor:

1. `supabase/schema.sql` — Phase 1 tables (products, categories, customers,
   sales, sale_items, payments, stock_movements)
2. `supabase/seed.sql` — Phase 1 demo data
3. `supabase/migration_002_full_mvp.sql` — adds suppliers, purchases,
   purchase_items, expenses; widens `payments` to support supplier
   payments; **tightens all RLS policies to require an authenticated
   session** (previously public, since there was no login yet)
4. `supabase/seed_002.sql` — Phase 2 demo data (suppliers, expenses)

> If you already ran `schema.sql` + `seed.sql` for Phase 1, just run steps 3
> and 4 now — they're additive and safe to run once on top of what exists.

### Create your login

There's no public sign-up screen (this is a single-store internal tool).
Create your own account manually:

Supabase Dashboard → **Authentication → Users → Add user** → enter an email
and password → this becomes your login for the app.

## 2. Environment variables (unchanged)

Same two variables as before — nothing new required:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

If you already have this deployed on Vercel, **no environment variable
changes are needed.** Just redeploy with the new code.

## 3. Run locally

```bash
npm install
npm run dev
```

## 4. Deploy

Push to GitHub, import into Vercel, keep the same two env vars, deploy.
(See `DEPLOY_FROM_IPHONE.md` from the earlier delivery if deploying from
an iPhone only, with no computer.)

## Project structure

```
supplement-store/
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── login/page.tsx              # Auth
│   ├── more/page.tsx               # "المزيد" hub (mobile)
│   ├── products/                   # list, /new, /[id]/edit
│   ├── categories/page.tsx
│   ├── inventory/                  # list, /[id] (adjust + movement history)
│   ├── customers/                  # list, /[id] (debt + payments)
│   ├── suppliers/                  # list, /[id] (debt + payments)
│   ├── sales/                      # POS, /history, /[id] (detail + cancel)
│   ├── purchases/                  # list, /new, /[id] (detail + cancel)
│   ├── debts/page.tsx              # customer debts overview
│   ├── expenses/page.tsx
│   └── reports/page.tsx
├── components/
│   ├── AuthGate.tsx                # session check + nav chrome
│   ├── BottomNav.tsx / DesktopNav.tsx
│   ├── ProductForm.tsx, PageHeader.tsx, StockBadge.tsx, ServiceWorkerRegister.tsx
├── lib/
│   ├── supabase/client.ts          # env-var only, no hardcoded values
│   └── types.ts                    # shared types + formatEGP/getStockStatus/etc.
├── public/                         # manifest.json, sw.js, icons/
└── supabase/
    ├── schema.sql, seed.sql               # Phase 1
    └── migration_002_full_mvp.sql, seed_002.sql   # Phase 2
```

## How the money & stock stay correct

- **Sales**: decrease stock, log a `stock_movements` row, add
  `remaining_amount` to the customer's `current_debt`. Selling more than
  available stock is blocked both in the UI (button disables) and again
  right before saving.
- **Sale cancellation**: restores the sold quantity to stock, logs a
  `sale_cancellation` movement, marks the sale `cancelled` (never deleted),
  and reverses the customer's debt/total-purchases by the sale's amounts
  (clamped to zero, never negative).
- **Purchases**: increase stock, log a `purchase` movement, add
  `remaining_amount` to the supplier's `current_debt`, and update the
  product's `purchase_price` to the new cost.
- **Purchase cancellation**: reverses stock — but is **blocked** with a
  clear Arabic message if any of that stock has already been resold (i.e.
  reversing it would take stock negative). Reverses supplier debt.
- **Manual stock adjustments**: logged as their own movement type with the
  before/after quantity, viewable per-product.
- **Payments** (customer or supplier): a single `payments` table, with a
  database constraint ensuring each row belongs to exactly one side
  (customer XOR supplier). A payment can never exceed the current debt.
- Nothing is ever hard-deleted from `sales`, `purchases`, or their line
  items — cancellations are a status flag, keeping full history.

## Authentication & access control

- Login is a single shared store-owner account (or add more via Supabase
  Authentication → Users — no separate roles/permissions in this MVP, as
  requested).
- Every table's Row Level Security policy requires
  `auth.role() = 'authenticated'` — the anon key alone can no longer read
  or write any data once you run the migration.
- `AuthGate` (client-side) redirects to `/login` if there's no session, and
  redirects away from `/login` once signed in.

## Known limitations (by design, not bugs)

- Single shared login — no per-user roles/permissions.
- No barcode camera scanning (manual search only) — matches your original
  instruction to defer this.
- No invoice PDF/print export yet.
- Icons in `public/icons/` are simple placeholders — swap for your store
  logo using the same filenames.
