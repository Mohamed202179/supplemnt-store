"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export interface DayPoint {
  label: string;
  sales: number;
  profit: number;
}

export default function SalesChart({ data }: { data: DayPoint[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "currentColor" }}
            axisLine={false}
            tickLine={false}
            className="text-gray-400 dark:text-gray-500"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "currentColor" }}
            axisLine={false}
            tickLine={false}
            width={40}
            className="text-gray-400 dark:text-gray-500"
          />
          <Tooltip
            formatter={(value: number) => value.toLocaleString()}
            contentStyle={{
              borderRadius: 12,
              border: "none",
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          />
          <Bar dataKey="sales" fill="#302cb7" radius={[6, 6, 0, 0]} maxBarSize={18} name="المبيعات" />
          <Bar dataKey="profit" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={18} name="الأرباح" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
