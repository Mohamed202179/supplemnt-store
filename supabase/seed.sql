-- ============================================
-- Demo seed data (clearly labeled as demo)
-- ============================================

insert into categories (name) values
  ('بروتين'), ('كرياتين'), ('بري ورك أوت'), ('فيتامينات'),
  ('أحماض أمينية'), ('ماس جينر'), ('حارق دهون'), ('أخرى');

-- Products (demo)
insert into products (name, category_id, brand, flavor, size, barcode, purchase_price, selling_price, current_stock, min_stock)
select 'واي بروتين - Whey Protein (تجريبي)', id, 'Optimum Nutrition', 'شوكولاتة', '2 كيلو', '1000000000001', 1200, 1650, 18, 5
from categories where name = 'بروتين';

insert into products (name, category_id, brand, flavor, size, barcode, purchase_price, selling_price, current_stock, min_stock)
select 'كرياتين مونوهيدرات (تجريبي)', id, 'MyProtein', 'بدون نكهة', '500 جم', '1000000000002', 250, 380, 30, 8
from categories where name = 'كرياتين';

insert into products (name, category_id, brand, flavor, size, barcode, purchase_price, selling_price, current_stock, min_stock)
select 'بري ورك أوت (تجريبي)', id, 'C4', 'فراولة', '30 سيرفينج', '1000000000003', 400, 600, 4, 5
from categories where name = 'بري ورك أوت';

insert into products (name, category_id, brand, flavor, size, barcode, purchase_price, selling_price, current_stock, min_stock)
select 'BCAA أحماض أمينية (تجريبي)', id, 'Xtend', 'مانجو', '400 جم', '1000000000004', 350, 520, 0, 5
from categories where name = 'أحماض أمينية';

insert into products (name, category_id, brand, flavor, size, barcode, purchase_price, selling_price, current_stock, min_stock)
select 'مالتي فيتامين (تجريبي)', id, 'Centrum', '-', '60 كبسولة', '1000000000005', 180, 280, 25, 10
from categories where name = 'فيتامينات';

insert into products (name, category_id, brand, flavor, size, barcode, purchase_price, selling_price, current_stock, min_stock)
select 'ماس جينر (تجريبي)', id, 'Serious Mass', 'فانيليا', '2.7 كيلو', '1000000000006', 900, 1300, 10, 4
from categories where name = 'ماس جينر';

-- Customers (demo)
insert into customers (name, phone, notes, current_debt, total_purchases) values
  ('محمد أحمد (تجريبي)', '01000000001', 'عميل دائم', 0, 0),
  ('سارة علي (تجريبي)', '01000000002', '', 0, 0),
  ('نادي الحديد (تجريبي)', '01000000003', 'يشتري بالجملة أحيانًا', 0, 0);
