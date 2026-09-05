-- ============================================
-- Demo seed data for Phase 2 additions
-- (Suppliers, Purchases, Expenses)
-- Run after migration_002_full_mvp.sql
-- ============================================

insert into suppliers (name, phone, company, notes, total_purchases, total_paid, current_debt) values
  ('شركة النخبة للمكملات (تجريبي)', '01100000001', 'Elite Supplements Co.', 'مورد رئيسي للبروتين', 0, 0, 0),
  ('مؤسسة الجسم المثالي (تجريبي)', '01100000002', 'Ideal Body Est.', '', 0, 0, 0);

insert into expenses (title, category, amount, expense_date, notes) values
  ('إيجار المحل (تجريبي)', 'rent', 3500, current_date - interval '5 days', ''),
  ('فاتورة كهرباء (تجريبي)', 'electricity', 450, current_date - interval '3 days', ''),
  ('إعلان سوشيال ميديا (تجريبي)', 'marketing', 300, current_date - interval '1 days', '');
