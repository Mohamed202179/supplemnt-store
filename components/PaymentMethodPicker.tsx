"use client";

import { PAYMENT_METHODS, PaymentMethod } from "@/lib/types";
import PaymentMethodIcon from "@/components/PaymentMethodIcon";

// اختيار طريقة الدفع (مدمج) — بيتستخدم في تسجيل دفعات الديون.
export default function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PAYMENT_METHODS.map((m) => {
        const active = value === m.value;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            aria-pressed={active}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2 text-xs font-bold ${
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            }`}
          >
            <PaymentMethodIcon method={m.value} className="h-7 w-7" />
            <span className="max-w-full truncate">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
