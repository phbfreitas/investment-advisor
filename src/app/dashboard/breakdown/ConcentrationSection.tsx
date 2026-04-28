"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList } from "recharts";
import type { TopHoldings } from "./lib/types";
import { paletteFor, COLORS } from "./lib/colors";

const fmtCurrency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface ConcentrationSectionProps {
  topHoldings: TopHoldings;
}

interface RowItem {
  ticker: string;
  marketValue: number;
  percent: number;
  call: string;
  account: string;
  sector: string;
  currency: string;
}

export function ConcentrationSection({ topHoldings }: ConcentrationSectionProps) {
  const rows: RowItem[] = topHoldings.top.map(h => ({ ...h }));

  return (
    <div>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-4">
        <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">Top 10 Holdings</h3>
        <div style={{ width: "100%", height: Math.max(44 * rows.length + 40, 200) }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 120, top: 8, bottom: 8 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="ticker" width={110} tick={{ fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                formatter={(value, _name, props) => {
                  const numVal = typeof value === "number" ? value : Number(value ?? 0);
                  const p = (props as { payload?: { percent?: number } }).payload?.percent ?? 0;
                  return [`${fmtCurrency(numVal)} · ${p.toFixed(1)}%`, "Value"];
                }}
                contentStyle={{ borderRadius: 6, fontSize: 12 }}
              />
              <Bar
                dataKey="marketValue"
                radius={[0, 4, 4, 0]}
                barSize={36}
              >
                <LabelList
                  dataKey="marketValue"
                  position="right"
                  style={{ fontSize: 11, fill: "var(--foreground, #111)" }}
                  content={(props) => {
                    const { x, y, width, height, value } = props as { x?: number; y?: number; width?: number; height?: number; value?: number; index?: number };
                    const idx = (props as { index?: number }).index ?? 0;
                    const row = rows[idx];
                    if (row === undefined || value === undefined) return null;
                    const pct = row.percent ?? 0;
                    const cx = (x ?? 0) + (width ?? 0) + 6;
                    const cy = (y ?? 0) + (height ?? 0) / 2 + 4;
                    return (
                      <text x={cx} y={cy} fontSize={11} fill="currentColor">
                        {`${fmtCurrency(value)} · ${pct.toFixed(1)}%`}
                      </text>
                    );
                  }}
                />
                {rows.map((row) => (
                  <Cell
                    key={row.ticker}
                    fill={paletteFor(row.call || row.ticker)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <table className="sr-only">
            <caption>Top 10 Holdings</caption>
            <thead><tr><th>Ticker</th><th>Value</th><th>Percent</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.ticker}>
                  <td>{r.ticker}</td>
                  <td>{r.marketValue}</td>
                  <td>{r.percent.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
