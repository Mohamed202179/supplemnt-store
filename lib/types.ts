// Shared app-level types for the full MVP.
// (Kept hand-written and simple instead of full generated Supabase types.)

export type StockStatus = "available" | "low" | "out";

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category_id: string | null;
  brand: string | null;
  flavor: string | null;
  size: string | null;
  barcode: string | null;
  purchase_price: number;
  selling_price: number;
  current_stock: number;
  min_stock: number;
  expiry_date: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  categories?: { name: string } | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  current_debt: number;
  total_purchases: number;
  last_transaction_at: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
  notes: string | null;
  total_purchases: number;
  total_paid: number;
  current_debt: number;
  created_at: string;
}

export type PaymentStatus = "paid" | "partial" | "unpaid";
export type SaleStatus = "completed" | "cancelled";

export interface Sale {
  id: string;
  invoice_number: number;
  customer_id: string | null;
  customer_name_snapshot: string | null;
  subtotal: number;
  discount: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: PaymentStatus;
  status: SaleStatus;
  profit: number;
  created_at: string;
  cancelled_at: string | null;
  customers?: { name: string } | null;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  line_total: number;
  created_at: string;
}

export interface Purchase {
  id: string;
  purchase_number: number;
  supplier_id: string | null;
  supplier_name_snapshot: string | null;
  subtotal: number;
  discount: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: PaymentStatus;
  status: SaleStatus;
  created_at: string;
  cancelled_at: string | null;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  created_at: string;
}

export interface Payment {
  id: string;
  customer_id: string | null;
  supplier_id: string | null;
  sale_id: string | null;
  amount: number;
  note: string | null;
  created_at: string;
}

export type ExpenseCategory =
  | "rent"
  | "electricity"
  | "transportation"
  | "salaries"
  | "marketing"
  | "other";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: "إيجار",
  electricity: "كهرباء",
  transportation: "مواصلات",
  salaries: "رواتب",
  marketing: "تسويق",
  other: "أخرى",
};

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  notes: string | null;
  created_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  type:
    | "sale"
    | "sale_cancellation"
    | "manual_adjustment"
    | "purchase"
    | "purchase_cancellation";
  quantity: number;
  reference: string | null;
  previous_stock: number;
  new_stock: number;
  created_at: string;
}

export const MOVEMENT_TYPE_LABELS: Record<StockMovement["type"], string> = {
  sale: "بيع",
  sale_cancellation: "إلغاء بيع",
  manual_adjustment: "تعديل يدوي",
  purchase: "شراء",
  purchase_cancellation: "إلغاء شراء",
};

export interface CartLine {
  product: Product;
  quantity: number;
}

export interface PurchaseCartLine {
  product: Product;
  quantity: number;
  unitCost: number;
}

// Placeholder to keep supabase-js generics happy without full codegen.
export type Database = any;

export function getStockStatus(product: Pick<Product, "current_stock" | "min_stock">): StockStatus {
  if (product.current_stock <= 0) return "out";
  if (product.current_stock <= product.min_stock) return "low";
  return "available";
}

export function formatEGP(amount: number, lang: "ar" | "en" = "ar"): string {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  if (lang === "en") {
    return `${rounded.toLocaleString("en-US", { maximumFractionDigits: 2 })} EGP`;
  }
  return `${rounded.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ج.م`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return status === "paid" ? "مدفوع بالكامل" : status === "partial" ? "مدفوع جزئيًا" : "غير مدفوع";
}
