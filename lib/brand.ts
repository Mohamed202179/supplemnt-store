// ============================================================
// إعدادات البراندات. كل براند = اسم + هوية + مصدر بيانات مستقل.
// البراند بيتحدد بمتغير البيئة NEXT_PUBLIC_BRAND وقت البناء.
//   - مش متحدد  → daily_dose (نفس السلوك الحالي بالظبط)
//   - قيمة غلط → البناء بيفشل (علشان مايتفتحش على بيانات براند تاني بالغلط)
//
// mode:
//   "legacy" → الجداول في schema public، والعمليات المالية بنفس المنطق القديم (Daily Dose)
//   "v2"     → schema مستقل، والعمليات عن طريق دوال قاعدة البيانات (RPC)
// ============================================================

export type BrandMode = "legacy" | "v2";

export interface Palette {
  50: string;
  100: string;
  500: string;
  600: string;
  700: string;
  dark: string;
  darker: string;
}

export interface Brand {
  slug: string;
  mode: BrandMode;
  schema: string;
  name: string; // الاسم الكامل
  shortName: string;
  tagline: string; // سطر صغير تحت الاسم (ممكن فاضي)
  description: string;
  icon192: string;
  icon512: string;
  manifest: string;
  themeColor: string;
  imageBucket: string; // صور المنتجات والتصنيفات
  assetsBucket: string; // صورة الهيدر وخلافه
  palette: Palette;
}

const BRANDS: Record<string, Brand> = {
  daily_dose: {
    slug: "daily_dose",
    mode: "legacy",
    schema: "public",
    name: "Daily Dose Supplements",
    shortName: "Daily Dose",
    tagline: "Supplements",
    description: "نظام إدارة متجر Daily Dose Supplements",
    icon192: "/icons/icon-192.png",
    icon512: "/icons/icon-512.png",
    manifest: "/manifest.json",
    themeColor: "#302cb7",
    imageBucket: "product-images",
    assetsBucket: "app-assets",
    palette: {
      50: "#eef0fb",
      100: "#dbdff7",
      500: "#4641d2",
      600: "#302cb7",
      700: "#24219c",
      dark: "#211b72",
      darker: "#1a1740",
    },
  },
  bfit: {
    slug: "bfit",
    mode: "v2",
    schema: "bfit",
    name: "B-fit",
    shortName: "B-fit",
    tagline: "",
    description: "نظام إدارة متجر B-fit",
    icon192: "/brands/bfit/icon-192.png",
    icon512: "/brands/bfit/icon-512.png",
    manifest: "/brands/bfit/manifest.json",
    themeColor: "#437a0a",
    imageBucket: "assets-bfit",
    assetsBucket: "assets-bfit",
    palette: {
      50: "#f6fee8",
      100: "#e6fbc4",
      500: "#5b9e12",
      600: "#437a0a",
      700: "#335f08",
      dark: "#0b0f06",
      darker: "#12200a",
    },
  },
};

function resolveBaseBrand(): Brand {
  const key = process.env.NEXT_PUBLIC_BRAND;
  if (!key) return BRANDS.daily_dose;
  const found = BRANDS[key];
  if (!found) {
    throw new Error(
      `NEXT_PUBLIC_BRAND="${key}" غير معروف. القيم المتاحة: ${Object.keys(BRANDS).join(", ")}`
    );
  }
  return found;
}

// اختياري: NEXT_PUBLIC_STORE_SCHEMA بيحوّل أي براند لنظام "v2" على schema مخصص.
// بنستخدمه لنقل Daily Dose من جداول public القديمة لـ schema مستقل (daily_dose):
//   - مش موجود  → السلوك الحالي بالظبط (legacy على public).
//   - موجود     → كل العمليات بتروح لدوال قاعدة البيانات على الـ schema ده.
// الرجوع للقديم = شيل المتغير وأعد النشر.
function resolveBrand(): Brand {
  const base = resolveBaseBrand();
  const schema = process.env.NEXT_PUBLIC_STORE_SCHEMA;
  if (!schema) return base;
  if (!/^[a-z][a-z0-9_]{1,30}$/.test(schema) || schema === "public") {
    throw new Error(`NEXT_PUBLIC_STORE_SCHEMA="${schema}" غير صالح`);
  }
  return { ...base, mode: "v2", schema };
}

export const brand: Brand = resolveBrand();

function toTriplet(hex: string): string {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
}

/** متغيرات CSS للألوان (بتتحط على <html>). */
export function brandCssVars(): Record<string, string> {
  const p = brand.palette;
  return {
    "--brand-50": toTriplet(p[50]),
    "--brand-100": toTriplet(p[100]),
    "--brand-500": toTriplet(p[500]),
    "--brand-600": toTriplet(p[600]),
    "--brand-700": toTriplet(p[700]),
    "--brand-dark": toTriplet(p.dark),
    "--brand-darker": toTriplet(p.darker),
  };
}
