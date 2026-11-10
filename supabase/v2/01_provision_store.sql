-- ============================================================
-- 01_provision_store.sql  —  قالب البراند الواحد (Schema مستقل)
-- شغّله بعد 00_platform.sql. بيعمل دالة واحدة:
--
--   select platform.provision_store('bfit', 'B-fit');
--
-- الدالة idempotent: تقدر تشغّلها تاني على نفس البراند في أي وقت
-- (مثلاً بعد تعديل القالب) وهتطبّق آخر نسخة بدون ما تمسح بيانات.
--
-- القواعد اللي بتفرضها قاعدة البيانات نفسها (مش الواجهة):
--   * كل براند Schema مستقل → مفيش تداخل بيانات.
--   * العضو بس (store_members) يقدر يقرأ/يكتب في براندُه.
--   * الفواتير والمخزون والمديونيات بتتعدّل فقط عن طريق الدوال (RPC)
--     اللي بتشتغل في Transaction واحدة وبتقفل الصفوف (لا تضارب ولا بيع زيادة).
--   * الكاشير: بيع + عملاء + تحصيل. الباقي للـ owner.
-- ============================================================

create or replace function platform.provision_store(
  p_slug text, p_name text, p_bucket text default null
) returns void
language plpgsql security definer
set search_path = platform, pg_temp
as $prov$
declare
  v_bucket  text;
  v_tpl     text;
  v_storage text;
  v_is_new  boolean;
begin
  if p_slug !~ '^[a-z][a-z0-9_]{1,30}$'
     or p_slug in ('public','auth','storage','extensions','graphql','graphql_public',
                   'realtime','vault','pgsodium','supabase_functions','net','cron','platform') then
    raise exception 'slug غير صالح: % (حروف إنجليزي صغيرة وأرقام و _ فقط، يبدأ بحرف)', p_slug;
  end if;

  -- براند جديد = الـ schema بتاعه لسه مش موجود (بنستخدمها للتصنيفات الافتراضية بس)
  v_is_new := not exists (select 1 from information_schema.schemata where schema_name = p_slug);

  insert into platform.stores (slug, name, schema_name, bucket)
  values (p_slug, p_name, p_slug, coalesce(p_bucket, 'assets-' || replace(p_slug, '_', '-')))
  on conflict (slug) do update set name = excluded.name;   -- الـ bucket ثابت بعد أول مرة

  select bucket into v_bucket from platform.stores where slug = p_slug;

  v_tpl := $tpl$

  create schema if not exists __S__;
  grant usage on schema __S__ to authenticated;

  create or replace function __S__.set_updated_at()
  returns trigger language plpgsql as $$
  begin new.updated_at = now(); return new; end;
  $$;

  -- ================= TABLES =================
  create table if not exists __S__.categories (
    id         uuid primary key default gen_random_uuid(),
    name       text not null unique,
    image_url  text,
    created_at timestamptz not null default now()
  );

  create table if not exists __S__.product_groups (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    category_id uuid references __S__.categories(id) on delete set null,
    brand       text,
    image_url   text,
    created_at  timestamptz not null default now()
  );

  create table if not exists __S__.products (
    id             uuid primary key default gen_random_uuid(),
    name           text not null,
    category_id    uuid references __S__.categories(id) on delete set null,
    group_id       uuid references __S__.product_groups(id) on delete set null,
    brand          text,
    flavor         text,
    size           text,
    barcode        text unique,
    purchase_price numeric(12,2) not null default 0 check (purchase_price >= 0),
    selling_price  numeric(12,2) not null default 0 check (selling_price >= 0),
    current_stock  numeric(12,2) not null default 0 check (current_stock >= 0),
    min_stock      numeric(12,2) not null default 0 check (min_stock >= 0),
    expiry_date    date,
    image_url      text,
    is_active      boolean not null default true,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
  );

  create table if not exists __S__.customers (
    id                  uuid primary key default gen_random_uuid(),
    name                text not null,
    phone               text,
    notes               text,
    current_debt        numeric(12,2) not null default 0,
    total_purchases     numeric(12,2) not null default 0,
    last_transaction_at timestamptz,
    created_at          timestamptz not null default now()
  );

  create table if not exists __S__.suppliers (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    phone           text,
    company         text,
    notes           text,
    total_purchases numeric(12,2) not null default 0,
    total_paid      numeric(12,2) not null default 0,
    current_debt    numeric(12,2) not null default 0,
    created_at      timestamptz not null default now()
  );

  create table if not exists __S__.sales (
    id                     uuid primary key default gen_random_uuid(),
    invoice_number         serial,
    customer_id            uuid references __S__.customers(id) on delete set null,
    customer_name_snapshot text,
    subtotal               numeric(12,2) not null default 0,
    discount               numeric(12,2) not null default 0,
    total                  numeric(12,2) not null default 0,
    paid_amount            numeric(12,2) not null default 0,
    remaining_amount       numeric(12,2) not null default 0,
    payment_status         text not null default 'paid' check (payment_status in ('paid','partial','unpaid')),
    status                 text not null default 'completed' check (status in ('completed','cancelled')),
    profit                 numeric(12,2) not null default 0,
    created_at             timestamptz not null default now(),
    cancelled_at           timestamptz
  );

  create table if not exists __S__.sale_items (
    id                    uuid primary key default gen_random_uuid(),
    sale_id               uuid not null references __S__.sales(id) on delete cascade,
    product_id            uuid references __S__.products(id) on delete set null,
    product_name_snapshot text not null,
    quantity              numeric(12,2) not null check (quantity > 0),
    unit_price            numeric(12,2) not null,
    unit_cost             numeric(12,2) not null default 0,
    line_total            numeric(12,2) not null,
    created_at            timestamptz not null default now()
  );

  create table if not exists __S__.payments (
    id          uuid primary key default gen_random_uuid(),
    customer_id uuid references __S__.customers(id) on delete cascade,
    supplier_id uuid references __S__.suppliers(id) on delete cascade,
    sale_id     uuid references __S__.sales(id) on delete set null,
    amount      numeric(12,2) not null check (amount > 0),
    note        text,
    created_at  timestamptz not null default now(),
    constraint payments_one_party_check check (
      (customer_id is not null and supplier_id is null)
      or (customer_id is null and supplier_id is not null)
    )
  );

  create table if not exists __S__.stock_movements (
    id             uuid primary key default gen_random_uuid(),
    product_id     uuid not null references __S__.products(id) on delete cascade,
    type           text not null check (type in ('sale','sale_cancellation','manual_adjustment','purchase','purchase_cancellation')),
    quantity       numeric(12,2) not null,
    reference      text,
    previous_stock numeric(12,2) not null,
    new_stock      numeric(12,2) not null,
    created_at     timestamptz not null default now()
  );

  create table if not exists __S__.purchases (
    id                     uuid primary key default gen_random_uuid(),
    purchase_number        serial,
    supplier_id            uuid references __S__.suppliers(id) on delete set null,
    supplier_name_snapshot text,
    subtotal               numeric(12,2) not null default 0,
    discount               numeric(12,2) not null default 0,
    total                  numeric(12,2) not null default 0,
    paid_amount            numeric(12,2) not null default 0,
    remaining_amount       numeric(12,2) not null default 0,
    payment_status         text not null default 'paid' check (payment_status in ('paid','partial','unpaid')),
    status                 text not null default 'completed' check (status in ('completed','cancelled')),
    created_at             timestamptz not null default now(),
    cancelled_at           timestamptz
  );

  create table if not exists __S__.purchase_items (
    id                    uuid primary key default gen_random_uuid(),
    purchase_id           uuid not null references __S__.purchases(id) on delete cascade,
    product_id            uuid references __S__.products(id) on delete set null,
    product_name_snapshot text not null,
    quantity              numeric(12,2) not null check (quantity > 0),
    unit_cost             numeric(12,2) not null,
    line_total            numeric(12,2) not null,
    created_at            timestamptz not null default now()
  );

  create table if not exists __S__.expenses (
    id           uuid primary key default gen_random_uuid(),
    title        text not null,
    category     text not null check (category in ('rent','electricity','transportation','salaries','marketing','other')),
    amount       numeric(12,2) not null check (amount > 0),
    expense_date date not null default current_date,
    notes        text,
    created_at   timestamptz not null default now()
  );

  create table if not exists __S__.app_settings (
    id               int primary key default 1 check (id = 1),
    header_image_url text,
    updated_at       timestamptz not null default now()
  );
  insert into __S__.app_settings (id) values (1) on conflict (id) do nothing;

  -- أعمدة ممكن تكون ناقصة في داتابيز قديمة (Daily Dose الحالية)
  alter table __S__.categories add column if not exists image_url  text;
  alter table __S__.products   add column if not exists image_url  text;
  alter table __S__.products   add column if not exists group_id   uuid references __S__.product_groups(id) on delete set null;
  alter table __S__.payments   add column if not exists supplier_id uuid references __S__.suppliers(id) on delete cascade;

  -- ================= INDEXES / TRIGGERS =================
  create index if not exists idx_products_name     on __S__.products using gin (to_tsvector('simple', name));
  create index if not exists idx_products_category on __S__.products(category_id);
  create index if not exists idx_products_group    on __S__.products(group_id);
  create index if not exists idx_products_active   on __S__.products(is_active);
  create index if not exists idx_customers_phone   on __S__.customers(phone);
  create index if not exists idx_suppliers_phone   on __S__.suppliers(phone);
  create index if not exists idx_sales_status      on __S__.sales(status);
  create index if not exists idx_sales_created     on __S__.sales(created_at);
  create index if not exists idx_sales_customer    on __S__.sales(customer_id);
  create index if not exists idx_sale_items_sale   on __S__.sale_items(sale_id);
  create index if not exists idx_sale_items_prod   on __S__.sale_items(product_id);
  create index if not exists idx_payments_customer on __S__.payments(customer_id);
  create index if not exists idx_payments_supplier on __S__.payments(supplier_id);
  create index if not exists idx_stock_mov_product on __S__.stock_movements(product_id);
  create index if not exists idx_purchases_status  on __S__.purchases(status);
  create index if not exists idx_purchases_created on __S__.purchases(created_at);
  create index if not exists idx_purchases_supplier on __S__.purchases(supplier_id);
  create index if not exists idx_pitems_purchase   on __S__.purchase_items(purchase_id);
  create index if not exists idx_pitems_product    on __S__.purchase_items(product_id);
  create index if not exists idx_expenses_date     on __S__.expenses(expense_date);
  create index if not exists idx_expenses_category on __S__.expenses(category);

  drop trigger if exists trg_products_updated_at on __S__.products;
  create trigger trg_products_updated_at
    before update on __S__.products
    for each row execute function __S__.set_updated_at();

  -- ================= RLS =================
  alter table __S__.categories      enable row level security;
  alter table __S__.product_groups  enable row level security;
  alter table __S__.products        enable row level security;
  alter table __S__.customers       enable row level security;
  alter table __S__.suppliers       enable row level security;
  alter table __S__.sales           enable row level security;
  alter table __S__.sale_items      enable row level security;
  alter table __S__.payments        enable row level security;
  alter table __S__.stock_movements enable row level security;
  alter table __S__.purchases       enable row level security;
  alter table __S__.purchase_items  enable row level security;
  alter table __S__.expenses        enable row level security;
  alter table __S__.app_settings    enable row level security;

  -- نمسح أي سياسات قديمة (بما فيها "authenticated full access") ونعيد بناءها
  do $$
  declare r record;
  begin
    for r in select policyname, tablename from pg_policies where schemaname = '__S__' loop
      execute format('drop policy %I on __S__.%I', r.policyname, r.tablename);
    end loop;
  end;
  $$;

  -- الكتالوج: الكل يقرأ، الـ owner فقط يعدّل
  create policy member_read on __S__.categories     for select to authenticated using (platform.is_member('__SLUG__'));
  create policy owner_write on __S__.categories     for all    to authenticated using (platform.is_owner('__SLUG__')) with check (platform.is_owner('__SLUG__'));
  create policy member_read on __S__.product_groups for select to authenticated using (platform.is_member('__SLUG__'));
  create policy owner_write on __S__.product_groups for all    to authenticated using (platform.is_owner('__SLUG__')) with check (platform.is_owner('__SLUG__'));
  create policy member_read on __S__.products       for select to authenticated using (platform.is_member('__SLUG__'));
  create policy owner_write on __S__.products       for all    to authenticated using (platform.is_owner('__SLUG__')) with check (platform.is_owner('__SLUG__'));
  create policy member_read on __S__.app_settings   for select to authenticated using (platform.is_member('__SLUG__'));
  create policy owner_write on __S__.app_settings   for all    to authenticated using (platform.is_owner('__SLUG__')) with check (platform.is_owner('__SLUG__'));

  -- العملاء: الكاشير يضيف ويعدّل البيانات الأساسية (الأرصدة عبر الدوال فقط)
  create policy member_read   on __S__.customers for select to authenticated using (platform.is_member('__SLUG__'));
  create policy member_insert on __S__.customers for insert to authenticated
    with check (platform.is_member('__SLUG__') and current_debt = 0 and total_purchases = 0 and last_transaction_at is null);
  create policy member_update on __S__.customers for update to authenticated
    using (platform.is_member('__SLUG__')) with check (platform.is_member('__SLUG__'));
  create policy owner_delete  on __S__.customers for delete to authenticated using (platform.is_owner('__SLUG__'));

  -- الحركات المالية: قراءة للأعضاء، والكتابة عبر الدوال فقط (مفيش سياسة كتابة)
  create policy member_read on __S__.sales           for select to authenticated using (platform.is_member('__SLUG__'));
  create policy member_read on __S__.sale_items      for select to authenticated using (platform.is_member('__SLUG__'));
  create policy member_read on __S__.payments        for select to authenticated using (platform.is_member('__SLUG__'));
  create policy member_read on __S__.stock_movements for select to authenticated using (platform.is_member('__SLUG__'));

  -- الموردين والمشتريات والمصروفات: owner فقط
  create policy owner_all on __S__.suppliers       for all    to authenticated using (platform.is_owner('__SLUG__')) with check (platform.is_owner('__SLUG__'));
  create policy owner_all on __S__.expenses        for all    to authenticated using (platform.is_owner('__SLUG__')) with check (platform.is_owner('__SLUG__'));
  create policy owner_read on __S__.purchases      for select to authenticated using (platform.is_owner('__SLUG__'));
  create policy owner_read on __S__.purchase_items for select to authenticated using (platform.is_owner('__SLUG__'));

  -- ================= GRANTS =================
  revoke all on all tables    in schema __S__ from public, anon, authenticated;
  revoke all on all sequences in schema __S__ from public, anon, authenticated;

  grant select on all tables in schema __S__ to authenticated;
  grant usage, select on all sequences in schema __S__ to authenticated;

  grant insert, update, delete on __S__.categories, __S__.product_groups, __S__.products, __S__.expenses to authenticated;
  grant update on __S__.app_settings to authenticated;
  grant insert, delete on __S__.customers to authenticated;
  grant update (name, phone, notes) on __S__.customers to authenticated;
  grant insert, delete on __S__.suppliers to authenticated;
  grant update (name, phone, company, notes) on __S__.suppliers to authenticated;

  -- ================= RPC: العمليات المالية =================

  -- ---- بيع جديد ----
  -- p_items: [{"product_id": "...", "quantity": 2}, ...]
  -- الأسعار والتكلفة بتتاخد من قاعدة البيانات (مش من الواجهة).
  -- p_paid = null → مدفوع بالكامل. لو أكبر من الإجمالي بيتقصّ للإجمالي (الباقي للعميل).
  create or replace function __S__.create_sale(
    p_customer_id  uuid,
    p_walk_in_name text,
    p_items        jsonb,
    p_discount     numeric     default 0,
    p_paid         numeric     default null,
    p_created_at   timestamptz default null
  ) returns uuid
  language plpgsql security definer
  set search_path = __S__, pg_temp
  as $$
  declare
    v_ts        timestamptz := coalesce(p_created_at, now());
    v_discount  numeric := coalesce(p_discount, 0);
    v_agg       record;
    v_prod      record;
    v_lines     jsonb := '[]'::jsonb;
    v_line      jsonb;
    v_subtotal  numeric := 0;
    v_gross     numeric := 0;
    v_total     numeric;
    v_paid      numeric;
    v_remaining numeric;
    v_status    text;
    v_sale_id   uuid;
    v_invoice   int;
    v_name      text;
    v_new_stock numeric;
  begin
    if not platform.is_member('__SLUG__') then raise exception 'غير مصرح'; end if;
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
      raise exception 'أضف منتجًا واحدًا على الأقل';
    end if;
    if v_ts > now() + interval '1 minute' then raise exception 'لا يمكن اختيار تاريخ في المستقبل'; end if;
    if v_discount < 0 then raise exception 'الخصم لا يمكن أن يكون سالبًا'; end if;
    if p_paid is not null and p_paid < 0 then raise exception 'المبلغ المدفوع لا يمكن أن يكون سالبًا'; end if;

    -- دمج الأصناف المتكررة + قفل الصفوف بترتيب ثابت (يمنع التعارض بين جهازين)
    for v_agg in
      select (e->>'product_id')::uuid as product_id, sum((e->>'quantity')::numeric) as qty
      from jsonb_array_elements(p_items) e
      group by 1
      order by 1
    loop
      if v_agg.qty is null or v_agg.qty <= 0 then raise exception 'كمية غير صحيحة'; end if;

      select p.id, p.name, p.flavor, p.size, p.selling_price, p.purchase_price,
             p.current_stock, p.is_active, g.name as group_name
        into v_prod
        from products p
        left join product_groups g on g.id = p.group_id
       where p.id = v_agg.product_id
       for update of p;

      if not found then raise exception 'منتج غير موجود'; end if;
      if not v_prod.is_active then raise exception 'المنتج "%" غير نشط', v_prod.name; end if;

      v_name := case
        when v_prod.group_name is null then v_prod.name
        else v_prod.group_name || coalesce(
               ' — ' || nullif(concat_ws(' ', nullif(v_prod.flavor, ''), nullif(v_prod.size, '')), ''), '')
      end;

      if v_agg.qty > v_prod.current_stock then
        raise exception 'الكمية المطلوبة من "%" غير متوفرة في المخزون (المتاح %)', v_name, v_prod.current_stock;
      end if;

      v_subtotal := v_subtotal + v_prod.selling_price * v_agg.qty;
      v_gross    := v_gross + (v_prod.selling_price - v_prod.purchase_price) * v_agg.qty;
      v_lines := v_lines || jsonb_build_object(
        'product_id', v_prod.id, 'name', v_name, 'qty', v_agg.qty,
        'price', v_prod.selling_price, 'cost', v_prod.purchase_price,
        'prev', v_prod.current_stock);
    end loop;

    if v_discount > v_subtotal then raise exception 'الخصم أكبر من إجمالي الفاتورة'; end if;
    v_total     := v_subtotal - v_discount;
    v_paid      := least(coalesce(p_paid, v_total), v_total);
    v_remaining := v_total - v_paid;
    v_status    := case when v_remaining <= 0 then 'paid' when v_paid <= 0 then 'unpaid' else 'partial' end;

    if p_customer_id is not null then
      perform 1 from customers where id = p_customer_id for update;
      if not found then raise exception 'العميل غير موجود'; end if;
    elsif v_remaining > 0 then
      raise exception 'لا يمكن البيع بالآجل لعميل نقدي — اختر عميلًا مسجلًا أو ادفع المبلغ كاملًا';
    end if;

    insert into sales (customer_id, customer_name_snapshot, subtotal, discount, total,
                       paid_amount, remaining_amount, payment_status, profit, created_at)
    values (p_customer_id,
            case when p_customer_id is null then coalesce(nullif(trim(p_walk_in_name), ''), 'عميل نقدي') end,
            v_subtotal, v_discount, v_total, v_paid, v_remaining, v_status,
            v_gross - v_discount, v_ts)
    returning id, invoice_number into v_sale_id, v_invoice;

    for v_line in select * from jsonb_array_elements(v_lines) loop
      insert into sale_items (sale_id, product_id, product_name_snapshot, quantity, unit_price, unit_cost, line_total)
      values (v_sale_id, (v_line->>'product_id')::uuid, v_line->>'name', (v_line->>'qty')::numeric,
              (v_line->>'price')::numeric, (v_line->>'cost')::numeric,
              (v_line->>'price')::numeric * (v_line->>'qty')::numeric);

      update products set current_stock = current_stock - (v_line->>'qty')::numeric
       where id = (v_line->>'product_id')::uuid
       returning current_stock into v_new_stock;

      insert into stock_movements (product_id, type, quantity, reference, previous_stock, new_stock, created_at)
      values ((v_line->>'product_id')::uuid, 'sale', -(v_line->>'qty')::numeric,
              'فاتورة رقم ' || v_invoice, (v_line->>'prev')::numeric, v_new_stock, v_ts);
    end loop;

    if p_customer_id is not null then
      update customers
         set current_debt = current_debt + v_remaining,
             total_purchases = total_purchases + v_total,
             last_transaction_at = now()
       where id = p_customer_id;
    end if;

    return v_sale_id;
  end;
  $$;

  -- ---- إلغاء بيع (owner) ----
  create or replace function __S__.cancel_sale(p_sale_id uuid)
  returns void
  language plpgsql security definer
  set search_path = __S__, pg_temp
  as $$
  declare
    v_sale record;
    v_item record;
    v_new  numeric;
  begin
    if not platform.is_owner('__SLUG__') then raise exception 'غير مصرح'; end if;

    select * into v_sale from sales where id = p_sale_id for update;
    if not found then raise exception 'الفاتورة غير موجودة'; end if;
    if v_sale.status = 'cancelled' then raise exception 'الفاتورة ملغاة بالفعل'; end if;

    for v_item in
      select product_id, quantity from sale_items
       where sale_id = p_sale_id and product_id is not null
       order by product_id
    loop
      update products set current_stock = current_stock + v_item.quantity
       where id = v_item.product_id
       returning current_stock into v_new;
      if found then
        insert into stock_movements (product_id, type, quantity, reference, previous_stock, new_stock)
        values (v_item.product_id, 'sale_cancellation', v_item.quantity,
                'إلغاء فاتورة رقم ' || v_sale.invoice_number, v_new - v_item.quantity, v_new);
      end if;
    end loop;

    update sales set status = 'cancelled', cancelled_at = now() where id = p_sale_id;

    if v_sale.customer_id is not null then
      update customers
         set current_debt = greatest(0, current_debt - v_sale.remaining_amount),
             total_purchases = greatest(0, total_purchases - v_sale.total)
       where id = v_sale.customer_id;
    end if;
  end;
  $$;

  -- ---- شراء جديد (owner) ----
  -- p_items: [{"product_id": "...", "quantity": 5, "unit_cost": 120}, ...]
  create or replace function __S__.create_purchase(
    p_supplier_id uuid,
    p_items       jsonb,
    p_discount    numeric default 0,
    p_paid        numeric default null
  ) returns uuid
  language plpgsql security definer
  set search_path = __S__, pg_temp
  as $$
  declare
    v_discount  numeric := coalesce(p_discount, 0);
    v_el        jsonb;
    v_prod      record;
    v_qty       numeric;
    v_cost      numeric;
    v_subtotal  numeric := 0;
    v_total     numeric;
    v_paid      numeric;
    v_remaining numeric;
    v_status    text;
    v_pid       uuid;
    v_pnum      int;
    v_new       numeric;
  begin
    if not platform.is_owner('__SLUG__') then raise exception 'غير مصرح'; end if;
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
      raise exception 'أضف منتجًا واحدًا على الأقل';
    end if;
    if v_discount < 0 then raise exception 'الخصم لا يمكن أن يكون سالبًا'; end if;
    if p_paid is not null and p_paid < 0 then raise exception 'المبلغ المدفوع لا يمكن أن يكون سالبًا'; end if;

    -- قفل كل المنتجات بترتيب ثابت
    perform 1 from products
     where id in (select (e->>'product_id')::uuid from jsonb_array_elements(p_items) e)
     order by id for update;

    for v_el in select * from jsonb_array_elements(p_items) loop
      v_qty  := (v_el->>'quantity')::numeric;
      v_cost := (v_el->>'unit_cost')::numeric;
      if v_qty is null or v_qty <= 0 then raise exception 'كمية غير صحيحة'; end if;
      if v_cost is null or v_cost < 0 then raise exception 'تكلفة غير صحيحة'; end if;
      perform 1 from products where id = (v_el->>'product_id')::uuid;
      if not found then raise exception 'منتج غير موجود'; end if;
      v_subtotal := v_subtotal + v_qty * v_cost;
    end loop;

    if v_discount > v_subtotal then raise exception 'الخصم أكبر من إجمالي الفاتورة'; end if;
    v_total     := v_subtotal - v_discount;
    v_paid      := least(coalesce(p_paid, v_total), v_total);
    v_remaining := v_total - v_paid;
    v_status    := case when v_remaining <= 0 then 'paid' when v_paid <= 0 then 'unpaid' else 'partial' end;

    if p_supplier_id is not null then
      perform 1 from suppliers where id = p_supplier_id for update;
      if not found then raise exception 'المورد غير موجود'; end if;
    elsif v_remaining > 0 then
      raise exception 'لا يمكن الشراء بالآجل بدون مورد — اختر موردًا أو ادفع المبلغ كاملًا';
    end if;

    insert into purchases (supplier_id, supplier_name_snapshot, subtotal, discount, total,
                           paid_amount, remaining_amount, payment_status)
    values (p_supplier_id, case when p_supplier_id is null then 'بدون مورد محدد' end,
            v_subtotal, v_discount, v_total, v_paid, v_remaining, v_status)
    returning id, purchase_number into v_pid, v_pnum;

    for v_el in select * from jsonb_array_elements(p_items) loop
      v_qty  := (v_el->>'quantity')::numeric;
      v_cost := (v_el->>'unit_cost')::numeric;

      select id, name, current_stock into v_prod from products where id = (v_el->>'product_id')::uuid;

      insert into purchase_items (purchase_id, product_id, product_name_snapshot, quantity, unit_cost, line_total)
      values (v_pid, v_prod.id, v_prod.name, v_qty, v_cost, v_qty * v_cost);

      update products set current_stock = current_stock + v_qty, purchase_price = v_cost
       where id = v_prod.id returning current_stock into v_new;

      insert into stock_movements (product_id, type, quantity, reference, previous_stock, new_stock)
      values (v_prod.id, 'purchase', v_qty, 'فاتورة شراء رقم ' || v_pnum, v_new - v_qty, v_new);
    end loop;

    if p_supplier_id is not null then
      update suppliers
         set current_debt = current_debt + v_remaining,
             total_purchases = total_purchases + v_total,
             total_paid = total_paid + v_paid
       where id = p_supplier_id;
    end if;

    return v_pid;
  end;
  $$;

  -- ---- إلغاء شراء (owner) — يتمنع لو جزء من الكمية اتباع ----
  create or replace function __S__.cancel_purchase(p_purchase_id uuid)
  returns void
  language plpgsql security definer
  set search_path = __S__, pg_temp
  as $$
  declare
    v_pur  record;
    v_item record;
    v_prod record;
    v_new  numeric;
  begin
    if not platform.is_owner('__SLUG__') then raise exception 'غير مصرح'; end if;

    select * into v_pur from purchases where id = p_purchase_id for update;
    if not found then raise exception 'فاتورة الشراء غير موجودة'; end if;
    if v_pur.status = 'cancelled' then raise exception 'فاتورة الشراء ملغاة بالفعل'; end if;

    perform 1 from products
     where id in (select product_id from purchase_items where purchase_id = p_purchase_id and product_id is not null)
     order by id for update;

    for v_item in
      select product_id, quantity from purchase_items
       where purchase_id = p_purchase_id and product_id is not null
    loop
      select name, current_stock into v_prod from products where id = v_item.product_id;
      if found and v_prod.current_stock - v_item.quantity < 0 then
        raise exception 'لا يمكن إلغاء الشراء: جزء من كمية "%" تم بيعه بالفعل ولا يمكن خصمها من المخزون.', v_prod.name;
      end if;
    end loop;

    for v_item in
      select product_id, quantity from purchase_items
       where purchase_id = p_purchase_id and product_id is not null
    loop
      update products set current_stock = current_stock - v_item.quantity
       where id = v_item.product_id returning current_stock into v_new;
      if found then
        insert into stock_movements (product_id, type, quantity, reference, previous_stock, new_stock)
        values (v_item.product_id, 'purchase_cancellation', -v_item.quantity,
                'إلغاء فاتورة شراء رقم ' || v_pur.purchase_number, v_new + v_item.quantity, v_new);
      end if;
    end loop;

    update purchases set status = 'cancelled', cancelled_at = now() where id = p_purchase_id;

    if v_pur.supplier_id is not null then
      update suppliers
         set total_purchases = greatest(0, total_purchases - v_pur.total),
             total_paid      = greatest(0, total_paid - v_pur.paid_amount),
             current_debt    = greatest(0, current_debt - v_pur.remaining_amount)
       where id = v_pur.supplier_id;
    end if;
  end;
  $$;

  -- ---- تعديل مخزون يدوي (owner) ----
  create or replace function __S__.adjust_stock(p_product_id uuid, p_target numeric, p_reason text default null)
  returns void
  language plpgsql security definer
  set search_path = __S__, pg_temp
  as $$
  declare
    v_prev numeric;
  begin
    if not platform.is_owner('__SLUG__') then raise exception 'غير مصرح'; end if;
    if p_target is null or p_target < 0 then raise exception 'أدخل كمية صحيحة (لا يمكن أن تكون سالبة)'; end if;

    select current_stock into v_prev from products where id = p_product_id for update;
    if not found then raise exception 'المنتج غير موجود'; end if;
    if p_target = v_prev then raise exception 'الكمية الجديدة مطابقة للكمية الحالية'; end if;

    update products set current_stock = p_target where id = p_product_id;
    insert into stock_movements (product_id, type, quantity, reference, previous_stock, new_stock)
    values (p_product_id, 'manual_adjustment', p_target - v_prev,
            coalesce(nullif(trim(p_reason), ''), 'تعديل يدوي للمخزون'), v_prev, p_target);
  end;
  $$;

  -- ---- تحصيل من عميل (أي عضو) ----
  create or replace function __S__.record_customer_payment(p_customer_id uuid, p_amount numeric, p_note text default null)
  returns void
  language plpgsql security definer
  set search_path = __S__, pg_temp
  as $$
  declare
    v_debt numeric;
  begin
    if not platform.is_member('__SLUG__') then raise exception 'غير مصرح'; end if;
    if p_amount is null or p_amount <= 0 then raise exception 'أدخل مبلغًا صحيحًا'; end if;

    select current_debt into v_debt from customers where id = p_customer_id for update;
    if not found then raise exception 'العميل غير موجود'; end if;
    if p_amount > v_debt then raise exception 'المبلغ أكبر من المديونية الحالية (%)', v_debt; end if;

    insert into payments (customer_id, amount, note) values (p_customer_id, p_amount, p_note);
    update customers set current_debt = current_debt - p_amount, last_transaction_at = now()
     where id = p_customer_id;
  end;
  $$;

  -- ---- سداد لمورد (owner) ----
  create or replace function __S__.record_supplier_payment(p_supplier_id uuid, p_amount numeric, p_note text default null)
  returns void
  language plpgsql security definer
  set search_path = __S__, pg_temp
  as $$
  declare
    v_debt numeric;
  begin
    if not platform.is_owner('__SLUG__') then raise exception 'غير مصرح'; end if;
    if p_amount is null or p_amount <= 0 then raise exception 'أدخل مبلغًا صحيحًا'; end if;

    select current_debt into v_debt from suppliers where id = p_supplier_id for update;
    if not found then raise exception 'المورد غير موجود'; end if;
    if p_amount > v_debt then raise exception 'المبلغ أكبر من المديونية الحالية (%)', v_debt; end if;

    insert into payments (supplier_id, amount, note) values (p_supplier_id, p_amount, p_note);
    update suppliers set current_debt = current_debt - p_amount, total_paid = total_paid + p_amount
     where id = p_supplier_id;
  end;
  $$;

  -- ---- دور المستخدم الحالي في البراند (الواجهة بتستخدمه بدل جدول profiles) ----
  create or replace function __S__.my_role()
  returns text
  language sql stable security definer
  set search_path = __S__, pg_temp
  as $$
    select role from platform.store_members
     where user_id = auth.uid() and store_slug = '__SLUG__';
  $$;

  -- صلاحيات تنفيذ الدوال: المسجّلين فقط
  revoke all on all functions in schema __S__ from public, anon;
  grant execute on all functions in schema __S__ to authenticated;

  $tpl$;

  v_tpl := replace(replace(replace(v_tpl, '__S__', p_slug), '__SLUG__', p_slug), '__B__', v_bucket);
  execute v_tpl;

  -- التصنيفات الافتراضية: للبراند الجديد فقط (إعادة تشغيل الدالة مش بترجّع تصنيفات اتمسحت)
  if v_is_new then
    execute format(
      'insert into %I.categories (name) select name from platform.default_categories order by name on conflict (name) do nothing',
      p_slug);
  end if;

  -- ---------- Storage: bucket مستقل لكل براند ----------
  v_storage := $st$
    insert into storage.buckets (id, name, public) values ('__B__', '__B__', true)
      on conflict (id) do nothing;

    drop policy if exists "__S__ assets read"   on storage.objects;
    drop policy if exists "__S__ assets insert" on storage.objects;
    drop policy if exists "__S__ assets update" on storage.objects;
    drop policy if exists "__S__ assets delete" on storage.objects;

    create policy "__S__ assets read" on storage.objects for select to authenticated
      using (bucket_id = '__B__' and platform.is_member('__SLUG__'));
    create policy "__S__ assets insert" on storage.objects for insert to authenticated
      with check (bucket_id = '__B__' and platform.is_owner('__SLUG__'));
    create policy "__S__ assets update" on storage.objects for update to authenticated
      using (bucket_id = '__B__' and platform.is_owner('__SLUG__'))
      with check (bucket_id = '__B__' and platform.is_owner('__SLUG__'));
    create policy "__S__ assets delete" on storage.objects for delete to authenticated
      using (bucket_id = '__B__' and platform.is_owner('__SLUG__'));
  $st$;
  v_storage := replace(replace(replace(v_storage, '__S__', p_slug), '__SLUG__', p_slug), '__B__', v_bucket);

  begin
    execute v_storage;
  exception when others then
    raise warning 'تعذّر إعداد Storage تلقائيًا (%). اعمل bucket باسم % (Public) من لوحة Supabase → Storage وأضف سياسات الرفع للـ owner.', sqlerrm, v_bucket;
  end;

  perform pg_notify('pgrst', 'reload schema');

  raise notice 'تم تجهيز البراند "%" (schema=%, bucket=%). متنساش: Settings → API → Exposed schemas → ضيف % ثم Save.',
    p_name, p_slug, v_bucket, p_slug;
end;
$prov$;

revoke all on function platform.provision_store(text, text, text) from public, anon, authenticated;
