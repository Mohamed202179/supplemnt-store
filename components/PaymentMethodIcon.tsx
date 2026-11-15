import { Banknote } from "lucide-react";

// أيقونة طريقة الدفع: لوجو إنستا باي / المحفظة (صور في public/payment)، والكاش أيقونة عادية.
export default function PaymentMethodIcon({
  method,
  className = "h-6 w-6",
}: {
  method: string | null | undefined;
  className?: string;
}) {
  if (method === "instapay" || method === "wallet") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/payment/${method}.png`} alt="" aria-hidden="true" className={`${className} shrink-0 rounded-lg object-contain`} />
    );
  }
  return <Banknote className={`${className} shrink-0`} aria-hidden="true" />;
}
