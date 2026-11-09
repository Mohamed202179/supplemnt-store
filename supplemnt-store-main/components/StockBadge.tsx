import { StockStatus } from "@/lib/types";

const styles: Record<StockStatus, string> = {
  available: "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100",
  low: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  out: "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

const labels: Record<StockStatus, string> = {
  available: "متوفر",
  low: "مخزون منخفض",
  out: "غير متوفر",
};

export default function StockBadge({ status }: { status: StockStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
