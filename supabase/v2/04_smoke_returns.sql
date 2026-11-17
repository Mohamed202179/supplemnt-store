-- ============================================================
-- 04_smoke_returns.sql  —  اختبار المرتجع الجزئي على B-fit (بيتلغي في الآخر تلقائيًا)
-- لازم تكون شغّلت 01_provision_store.sql المحدّث + select platform.provision_store('bfit','B-fit');
-- النجاح = رسالة خطأ بتبدأ بـ TEST_PASSED (ده مقصود علشان الداتا تتلغي). أي رسالة تانية = فشل.
-- ============================================================
begin;

select set_config('request.jwt.claims',
  json_build_object('sub', '2cae6b3b-1dfa-43e2-a627-4023e0755c1e', 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  v_prod uuid; v_cust uuid; v_sale uuid; v_item uuid; v_ret uuid;
  v_stock numeric; v_debt numeric; v_tp numeric; v_n numeric;
begin
  insert into bfit.products (name, selling_price, purchase_price) values ('منتج مرتجع', 200, 100) returning id into v_prod;
  insert into bfit.customers (name) values ('عميل مرتجع') returning id into v_cust;
  perform bfit.create_purchase(null, jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 10, 'unit_cost', 100)), 0, 1000);

  -- بيع 4 × 200 = 800، خصم 80 → إجمالي 720، مدفوع 300، متبقي 420
  v_sale := bfit.create_sale(v_cust, null, jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 4)), 80, 300, null);
  select id into v_item from bfit.sale_items where sale_id = v_sale limit 1;
  select current_debt, total_purchases into v_debt, v_tp from bfit.customers where id = v_cust;
  assert v_debt = 420, 'debt after sale should be 420, got ' || v_debt;

  -- مرتجع 1: وحدة واحدة → قيمة 200، نصيب خصم 20، صافي 180 → كله يتخصم من الدين
  v_ret := bfit.create_sale_return(v_sale, jsonb_build_array(jsonb_build_object('sale_item_id', v_item, 'quantity', 1)), 'تجربة', 'cash');
  select current_stock into v_stock from bfit.products where id = v_prod;
  assert v_stock = 7, 'stock after return 1 should be 7, got ' || v_stock;
  select current_debt, total_purchases into v_debt, v_tp from bfit.customers where id = v_cust;
  assert v_debt = 240, 'debt after return 1 should be 240, got ' || v_debt;
  assert v_tp = 540, 'total_purchases after return 1 should be 540, got ' || v_tp;
  assert (select net_value from bfit.sale_returns where id = v_ret) = 180, 'net 180';
  assert (select refund_amount from bfit.sale_returns where id = v_ret) = 0, 'refund 0';
  assert (select profit_reversed from bfit.sale_returns where id = v_ret) = 80, 'profit reversed 80';

  -- مرتجع 2: وحدتين → صافي 360: 240 يتخصم من الدين و120 يتردّ
  v_ret := bfit.create_sale_return(v_sale, jsonb_build_array(jsonb_build_object('sale_item_id', v_item, 'quantity', 2)), null, 'instapay');
  select current_stock into v_stock from bfit.products where id = v_prod;
  assert v_stock = 9, 'stock after return 2 should be 9, got ' || v_stock;
  select current_debt, total_purchases into v_debt, v_tp from bfit.customers where id = v_cust;
  assert v_debt = 0, 'debt after return 2 should be 0, got ' || v_debt;
  assert v_tp = 180, 'total_purchases after return 2 should be 180, got ' || v_tp;
  assert (select refund_amount from bfit.sale_returns where id = v_ret) = 120, 'refund 120';
  assert (select refund_method from bfit.sale_returns where id = v_ret) = 'instapay', 'refund method';

  -- إرجاع أكتر من المتاح (باقي وحدة واحدة) لازم يفشل
  begin
    perform bfit.create_sale_return(v_sale, jsonb_build_array(jsonb_build_object('sale_item_id', v_item, 'quantity', 2)), null, 'cash');
    raise exception 'over-return was NOT blocked';
  exception when others then
    assert sqlerrm like '%أكبر من المتاح%', 'unexpected error: ' || sqlerrm;
  end;

  -- إلغاء الفاتورة بعد مرتجعات: يرجّع الوحدة الباقية بس، ومايكررش خصم الدين
  perform bfit.cancel_sale(v_sale);
  select current_stock into v_stock from bfit.products where id = v_prod;
  assert v_stock = 10, 'stock after cancel should be 10, got ' || v_stock;
  select current_debt, total_purchases into v_debt, v_tp from bfit.customers where id = v_cust;
  assert v_debt = 0, 'debt after cancel should be 0, got ' || v_debt;
  assert v_tp = 0, 'total_purchases after cancel should be 0, got ' || v_tp;

  -- مرتجع على فاتورة ملغاة لازم يفشل
  begin
    perform bfit.create_sale_return(v_sale, jsonb_build_array(jsonb_build_object('sale_item_id', v_item, 'quantity', 1)), null, 'cash');
    raise exception 'return on cancelled sale was NOT blocked';
  exception when others then
    assert sqlerrm like '%ملغاة%', 'unexpected error: ' || sqlerrm;
  end;

  raise exception 'TEST_PASSED ✅ المرتجع الجزئي شغال (والبيانات اتلغت تلقائيًا)';
end;
$$;

rollback;
