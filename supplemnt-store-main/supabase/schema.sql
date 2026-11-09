-- ============================================
-- Supplement Store — Phase 1 Schema
-- ============================================

create extension if not exists "uuid-ossp";

-- CATEGORIES
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- PRODUCTS
create table products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category_id uuid references categories(id) on delete set null,
  brand text,
  flavor text,
  size text,
  barcode text unique,
  purchase_price numeric(12,2) not null default 0 check (purchase_price >= 0),
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  current_stock numeric(12,2) not null default 0 check (current_stock >= 0),
  min_stock numeric(12,2) not null default 0 check (min_stock >= 0),
  expiry_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_name on products using gin (to_tsvector('simple', name));
create index idx_products_category on products(category_id);
create index idx_products_active on products(is_active);

-- CUSTOMERS
create table customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  notes text,
  current_debt numeric(12,2) not null default 0,
  total_purchases numeric(12,2) not null default 0,
  last_transaction_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_customers_phone on customers(phone);

-- SALES (invoice header)
create table sales (
  id uuid primary key default uuid_generate_v4(),
  invoice_number serial,
  customer_id uuid references customers(id) on delete set null, -- null = walk-in
  customer_name_snapshot text, -- for walk-in customers without an account
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  remaining_amount numeric(12,2) not null default 0,
  payment_status text not null default 'paid' check (payment_status in ('paid','partial','unpaid')),
  status text not null default 'completed' check (status in ('completed','cancelled')),
  profit numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create index idx_sales_status on sales(status);
create index idx_sales_created on sales(created_at);
create index idx_sales_customer on sales(customer_id);

-- SALE ITEMS
create table sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name_snapshot text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  unit_cost numeric(12,2) not null default 0,
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index idx_sale_items_sale on sale_items(sale_id);
create index idx_sale_items_product on sale_items(product_id);

-- PAYMENTS (debt payments toward customer balance)
create table payments (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id) on delete cascade,
  sale_id uuid references sales(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

create index idx_payments_customer on payments(customer_id);

-- STOCK MOVEMENTS
create table stock_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  type text not null check (type in ('sale','sale_cancellation','manual_adjustment','purchase','purchase_cancellation')),
  quantity numeric(12,2) not null, -- positive = stock in, negative = stock out
  reference text, -- e.g. sale invoice number
  previous_stock numeric(12,2) not null,
  new_stock numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index idx_stock_movements_product on stock_movements(product_id);

-- ============================================
-- updated_at trigger for products
-- ============================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_products_updated_at
before update on products
for each row execute function set_updated_at();

-- ============================================
-- Row Level Security
-- Phase 1 has no login screen yet, so policies allow the public
-- (anon) key to read/write. Before putting real data online, add
-- Supabase Auth and change these policies to `auth.role() = 'authenticated'`.
-- ============================================
alter table categories enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table payments enable row level security;
alter table stock_movements enable row level security;

create policy "public full access" on categories for all using (true) with check (true);
create policy "public full access" on products for all using (true) with check (true);
create policy "public full access" on customers for all using (true) with check (true);
create policy "public full access" on sales for all using (true) with check (true);
create policy "public full access" on sale_items for all using (true) with check (true);
create policy "public full access" on payments for all using (true) with check (true);
create policy "public full access" on stock_movements for all using (true) with check (true);
