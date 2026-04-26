"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { AllBreakdowns } from "./lib/computeBreakdowns";
import type { DimensionBreakdown } from "./lib/types";
import { paletteFor, COLORS } from "./lib/colors";

const fmtCurrency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface DonutProps {
  dim: DimensionBreakdown;
}

function Donut({ dim }: DonutProps) {
  const data = dim.slices.map(s => ({ name: s.label, value: s.value, percent: s.percent }));
  const largest = dim.slices[0];

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-4">
      <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">{dim.title}</h3>
      <div className="relative" style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={1}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.name === "Uncategorized" ? COLORS.uncategorized : paletteFor(entry.name)}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name, props) => {
                const numVal = typeof value === "number" ? value : Number(value ?? 0);
                const p = (props as { payload?: { percent?: number } }).payload?.percent ?? 0;
                return [`${fmtCurrency(numVal)} · ${p.toFixed(1)}%`, String(name)];
              }}
              contentStyle={{ borderRadius: 6, fontSize: 12 }}
            />
            <Legend
              verticalAlign="bottom"
              wrapperStyle={{ fontSize: 11, marginTop: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">Total</div>
            <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{fmtCurrency(dim.totalValue)}</div>
          </div>
        </div>
      </div>
      {largest && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
          Largest: {largest.label} · {largest.percent.toFixed(1)}% · {fmtCurrency(largest.value)}
        </p>
      )}
      {/* Hidden table for screen readers */}
      <table className="sr-only">
        <caption>{dim.title}</caption>
        <thead><tr><th>Label</th><th>Value</th><th>Percent</th></tr></thead>
        <tbody>
          {dim.slices.map(s => (
            <tr key={s.label}><td>{s.label}</td><td>{s.value}</td><td>{s.percent.toFixed(2)}%</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CompositionSectionProps {
  breakdowns: AllBreakdowns;
}

export function CompositionSection({ breakdowns }: CompositionSectionProps) {
  const order: Array<keyof AllBreakdowns> = ["market", "sector", "call", "securityType", "risk", "currency"];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {order.map(key => (
        <Donut key={key} dim={breakdowns[key]} />
      ))}
    </div>
  );
}
