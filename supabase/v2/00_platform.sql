-- ============================================================
-- 00_platform.sql  —  الطبقة المشتركة بين البراندات الجديدة
-- كل حاجة هنا في schema اسمه "platform" (جديد ومش معروض في الـ API)،
-- يعني مفيش ولا جدول/دالة/سياسة جديدة جوه public ولا أي لمس لـ Daily Dose.
-- شغّله مرة واحدة في Supabase SQL Editor (آمن لو اتشغّل تاني).
-- ============================================================

create schema if not exists platform;
-- مش هنعمل grant usage للـ anon، ومش هنضيف platform في Exposed schemas.
grant usage on schema platform to authenticated;

create table if not exists platform.stores (
  slug        text primary key check (slug ~ '^[a-z][a-z0-9_]{1,30}$'),
  name        text not null,
  schema_name text not null unique,
  bucket      text not null,
  created_at  timestamptz not null default now()
);

create table if not exists platform.store_members (
  user_id    uuid not null references auth.users(id) on delete cascade,
  store_slug text not null references platform.stores(slug) on delete cascade,
  role       text not null check (role in ('owner', 'cashier')),
  full_name  text,
  created_at timestamptz not null default now(),
  primary key (user_id, store_slug)
);

create index if not exists idx_store_members_store on platform.store_members(store_slug);

-- RLS مفعّلة ومفيش أي سياسة ولا صلاحية جداول للمستخدمين: الجدولين مقفولين تمامًا.
-- الدوال التحت (security definer) هي الوحيدة اللي بتقراهم.
alter table platform.stores        enable row level security;
alter table platform.store_members enable row level security;
revoke all on platform.stores, platform.store_members from public, anon, authenticated;

create or replace function platform.is_member(p_store text)
returns boolean
language sql stable security definer
set search_path = platform, pg_temp
as $$
  select exists (
    select 1 from platform.store_members
    where user_id = auth.uid() and store_slug = p_store
  );
$$;

create or replace function platform.is_owner(p_store text)
returns boolean
language sql stable security definer
set search_path = platform, pg_temp
as $$
  select exists (
    select 1 from platform.store_members
    where user_id = auth.uid() and store_slug = p_store and role = 'owner'
  );
$$;

revoke all on function platform.is_member(text) from public, anon;
revoke all on function platform.is_owner(text)  from public, anon;
grant execute on function platform.is_member(text) to authenticated;
grant execute on function platform.is_owner(text)  to authenticated;

-- إضافة عضو لبراند (من SQL Editor فقط). مثال:
--   select platform.add_store_member('owner@example.com', 'bfit', 'owner', 'اسم المالك');
--   select platform.add_store_member('cashier@example.com', 'bfit', 'cashier');
create or replace function platform.add_store_member(
  p_email text, p_store text, p_role text, p_full_name text default null
) returns void
language plpgsql security definer
set search_path = platform, pg_temp
as $$
declare
  v_uid uuid;
begin
  if not exists (select 1 from platform.stores where slug = p_store) then
    raise exception 'البراند % غير موجود. شغّل provision_store الأول.', p_store;
  end if;

  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then
    raise exception 'مفيش مستخدم بالإيميل % — اعمله حساب من Authentication → Users الأول.', p_email;
  end if;

  insert into platform.store_members (user_id, store_slug, role, full_name)
  values (v_uid, p_store, p_role, p_full_name)
  on conflict (user_id, store_slug) do update
    set role = excluded.role,
        full_name = coalesce(excluded.full_name, platform.store_members.full_name);
end;
$$;

revoke all on function platform.add_store_member(text, text, text, text) from public, anon, authenticated;

-- ============================================================
-- التصنيفات الافتراضية: أي براند جديد بيتبني بيتنسخله التصنيفات دي تلقائيًا.
-- (بتتنسخ مرة واحدة وقت إنشاء البراند بس، فمش بترجع لو مسحتها بعد كده.)
-- لتعديل القايمة: عدّل القيم تحت واشغّل الملف تاني (للبراندات الجاية بس).
-- ============================================================
create table if not exists platform.default_categories (
  name text primary key
);
alter table platform.default_categories enable row level security;
revoke all on platform.default_categories from public, anon, authenticated;

insert into platform.default_categories (name) values
  ('Accessories'),
  ('Amino acids'),
  ('Beta-Alanine'),
  ('Carbohydrates'),
  ('Creatine'),
  ('Fat burner'),
  ('ISO protein'),
  ('L-Arginine'),
  ('L-carnitine'),
  ('L-citrulline'),
  ('L-Glutamine'),
  ('Mass gainers'),
  ('Multivitamins'),
  ('Omega3'),
  ('Pre workout'),
  ('Whey protein')
on conflict (name) do nothing;
