-- ============================================
-- Migration 002 — Full MVP (Suppliers, Purchases,
-- Expenses, Auth-based RLS)
-- Run this AFTER schema.sql + seed.sql have already been run.
-- Safe to run once on a database that already has Phase 1 tables.
-- ============================================

-- ---------- SUPPLIERS ----------
create table if not exists suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  company text,
  notes text,
  total_purchases numeric(12,2) not null default 0,
  total_paid numeric(12,2) not null default 0,
  current_debt numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_suppliers_phone on suppliers(phone);

-- ---------- PURCHASES ----------
create table if not exists purchases (
  id uuid primary key default uuid_generate_v4(),
  purchase_number serial,
  supplier_id uuid references suppliers(id) on delete set null,
  supplier_name_snapshot text,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  remaining_amount numeric(12,2) not null default 0,
  payment_status text not null default 'paid' check (payment_status in ('paid','partial','unpaid')),
  status text not null default 'completed' check (status in ('completed','cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create index if not exists idx_purchases_status on purchases(status);
create index if not exists idx_purchases_created on purchases(created_at);
create index if not exists idx_purchases_supplier on purchases(supplier_id);

-- ---------- PURCHASE ITEMS ----------
create table if not exists purchase_items (
  id uuid primary key default uuid_generate_v4(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name_snapshot text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_cost numeric(12,2) not null,
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_items_purchase on purchase_items(purchase_id);
create index if not exists idx_purchase_items_product on purchase_items(product_id);

-- ---------- EXPENSES ----------
create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  category text not null check (category in ('rent','electricity','transportation','salaries','marketing','other')),
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_date on expenses(expense_date);
create index if not exists idx_expenses_category on expenses(category);

-- ---------- PAYMENTS: extend to support supplier payments ----------
-- Phase 1 payments table only supported customer_id (not null).
-- We widen it so the same table can record a payment toward either
-- a customer's debt OR a supplier's debt, never both on one row.
alter table payments alter column customer_id drop not null;

alter table payments add column if not exists supplier_id uuid references suppliers(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_one_party_check'
  ) then
    alter table payments
      add constraint payments_one_party_check
      check (
        (customer_id is not null and supplier_id is null)
        or (customer_id is null and supplier_id is not null)
      );
  end if;
end $$;

create index if not exists idx_payments_supplier on payments(supplier_id);

-- ---------- Row Level Security for new tables ----------
alter table suppliers enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table expenses enable row level security;

drop policy if exists "public full access" on suppliers;
drop policy if exists "public full access" on purchases;
drop policy if exists "public full access" on purchase_items;
drop policy if exists "public full access" on expenses;

create policy "authenticated full access" on suppliers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on purchases for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on purchase_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on expenses for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- Tighten Phase 1 tables: require login now that auth exists ----------
drop policy if exists "public full access" on categories;
drop policy if exists "public full access" on products;
drop policy if exists "public full access" on customers;
drop policy if exists "public full access" on sales;
drop policy if exists "public full access" on sale_items;
drop policy if exists "public full access" on payments;
drop policy if exists "public full access" on stock_movements;

create policy "authenticated full access" on categories for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on products for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on customers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on sales for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on sale_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on payments for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on stock_movements for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
