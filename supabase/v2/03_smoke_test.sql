-- ============================================================
-- 03_smoke_test.sql  —  اختبار دوال البيع/الشراء/الإلغاء (بيتلغي في الآخر: ROLLBACK)
-- 1) استبدل <OWNER-USER-UUID> بـ id مستخدم عضو owner في البراند (من Authentication → Users).
-- 2) استبدل bfit باسم البراند لو بتختبر براند تاني.
-- 3) شغّل الملف كله. لو وصل لآخره من غير error = الدوال سليمة. (بيعمل ROLLBACK فمش بيسيب داتا.)
-- ============================================================
begin;

select set_config('request.jwt.claims',
  json_build_object('sub', '<OWNER-USER-UUID>', 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  v_prod uuid; v_sup uuid; v_cust uuid; v_pur uuid; v_sale uuid; v_stock numeric; v_debt numeric;
begin
  insert into bfit.products (name, selling_price, purchase_price, min_stock) values ('منتج اختبار', 200, 100, 2) returning id into v_prod;
  insert into bfit.suppliers (name) values ('مورد اختبار') returning id into v_sup;
  insert into bfit.customers (name) values ('عميل اختبار') returning id into v_cust;

  -- شراء 10 بتكلفة 120، ندفع 1000 من 1200  → دين مورد 200
  v_pur := bfit.create_purchase(v_sup, jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 10, 'unit_cost', 120)), 0, 1000);
  select current_stock into v_stock from bfit.products where id = v_prod;
  assert v_stock = 10, 'stock after purchase should be 10, got ' || v_stock;
  select current_debt into v_debt from bfit.suppliers where id = v_sup;
  assert v_debt = 200, 'supplier debt should be 200, got ' || v_debt;

  -- بيع 3 بخصم 50 ودفع 300 من 550 → دين عميل 250
  v_sale := bfit.create_sale(v_cust, null, jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 3)), 50, 300, null);
  select current_stock into v_stock from bfit.products where id = v_prod;
  assert v_stock = 7, 'stock after sale should be 7, got ' || v_stock;
  select current_debt into v_debt from bfit.customers where id = v_cust;
  assert v_debt = 250, 'customer debt should be 250, got ' || v_debt;
  assert (select profit from bfit.sales where id = v_sale) = 3*(200-120) - 50, 'profit wrong';

  -- بيع أكتر من المتاح لازم يفشل
  begin
    perform bfit.create_sale(v_cust, null, jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 99)), 0, null, null);
    raise exception 'oversell was NOT blocked';
  exception when others then
    assert sqlerrm like '%غير متوفرة%', 'unexpected error: ' || sqlerrm;
  end;

  -- تحصيل 100
  perform bfit.record_customer_payment(v_cust, 100, 'test');
  select current_debt into v_debt from bfit.customers where id = v_cust;
  assert v_debt = 150, 'debt after payment should be 150, got ' || v_debt;

  -- إلغاء البيع يرجّع المخزون
  perform bfit.cancel_sale(v_sale);
  select current_stock into v_stock from bfit.products where id = v_prod;
  assert v_stock = 10, 'stock after cancel_sale should be 10, got ' || v_stock;

  -- إلغاء الشراء
  perform bfit.cancel_purchase(v_pur);
  select current_stock into v_stock from bfit.products where id = v_prod;
  assert v_stock = 0, 'stock after cancel_purchase should be 0, got ' || v_stock;

  raise notice '✅ كل الاختبارات نجحت';
end;
$$;

rollback;
