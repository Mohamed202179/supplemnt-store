"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

export default function PageHeader({
  title,
  action,
  showBack,
}: {
  title: string;
  action?: React.ReactNode;
  showBack?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
      <div className="flex min-w-0 items-center gap-1">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-gray-500 active:bg-gray-100 dark:text-gray-400 dark:active:bg-gray-800"
            aria-label="رجوع"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
        <h1 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h1>
      </div>
      {action}
    </div>
  );
}
