# إضافة براند جديد (3 خطوات)

1. **قاعدة البيانات** (مرة واحدة لكل براند، من SQL Editor):
   ```sql
   select platform.provision_store('myslug', 'اسم البراند');
   select platform.add_store_member('owner@email.com', 'myslug', 'owner', 'الاسم');
   ```
   ثم: Project Settings → Data API → Exposed schemas → ضيف `myslug` (من غير ما تمسح الموجود).

2. **الكود**: في `lib/brand.ts` ضيف عنصر جديد في `BRANDS` (انسخ `bfit`) بـ:
   `slug`, `schema` (= نفس slug), الاسم, الألوان (`palette`), الـ bucket (`assets-<slug>`).
   وحط اللوجو في `public/brands/<slug>/` (icon-192.png, icon-512.png, manifest.json).

3. **النشر**: مشروع Vercel جديد من نفس الريبو بنفس مفاتيح Supabase، ومتغير واحد:
   `NEXT_PUBLIC_BRAND=<slug>` + الدومين الخاص بالبراند.

## قواعد
- `NEXT_PUBLIC_BRAND` غير موجود = Daily Dose (السلوك القديم). قيمة غلط = البناء بيفشل.
- Daily Dose (`mode: "legacy"`) بيستخدم جداول `public` ومنطق العمليات القديم بدون أي تغيير.
- البراندات الجديدة (`mode: "v2"`) كل العمليات المالية فيها عن طريق دوال قاعدة البيانات (`lib/ops.ts`).
- أي تعديل مستقبلي في قالب قاعدة البيانات: عدّل `supabase/v2/01_provision_store.sql`، شغّله، ثم
  `select platform.provision_store('slug', 'الاسم');` لكل براند (آمن، مابيمسحش بيانات).
