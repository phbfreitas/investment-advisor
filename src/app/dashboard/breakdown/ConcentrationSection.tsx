"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import type { TopHoldings, WeightedYield } from "./lib/types";
import { paletteFor, COLORS } from "./lib/colors";

const fmtCurrency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface ConcentrationSectionProps {
  topHoldings: TopHoldings;
  weightedYield: WeightedYield;
}

interface DetailSheetState {
  open: boolean;
  ticker: string;
  marketValue: number;
  percent: number;
  account: string;
  sector: string;
  currency: string;
  call: string;
}

interface RowItem {
  ticker: string;
  marketValue: number;
  percent: number;
  call: string;
  account: string;
  sector: string;
  currency: string;
  isOther: boolean;
}

export function ConcentrationSection({ topHoldings, weightedYield }: ConcentrationSectionProps) {
  const [sheet, setSheet] = useState<DetailSheetState | null>(null);

  const rows: RowItem[] = [
    ...topHoldings.top.map(h => ({ ...h, isOther: false as const })),
    ...(topHoldings.others
      ? [{
          ticker: `+ ${topHoldings.others.count} other holdings`,
          marketValue: topHoldings.others.marketValue,
          percent: topHoldings.others.percent,
          call: "",
          account: "",
          sector: "",
          currency: "",
          isOther: true as const,
        }]
      : []),
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-4">
        <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">Top 10 Holdings</h3>
        <div style={{ width: "100%", height: Math.max(36 * rows.length + 40, 200) }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 24, top: 8, bottom: 8 }}>
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
                onClick={(payload) => {
                  const row = payload as unknown as RowItem;
                  if (row.isOther) return;
                  setSheet({ open: true, ...row });
                }}
                cursor="pointer"
                radius={[0, 4, 4, 0]}
                barSize={28}
              >
                {rows.map((row) => (
                  <Cell
                    key={row.ticker}
                    fill={row.isOther ? COLORS.uncategorized : paletteFor(row.call || row.ticker)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-4 flex flex-col">
        <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">Weighted Yield</h3>
        <div className="text-3xl font-semibold text-teal-500">{weightedYield.yieldPct.toFixed(1)}%</div>
        {weightedYield.hasYieldData ? (
          <>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Projected annual income: <span className="font-medium text-neutral-800 dark:text-neutral-200">{fmtCurrency(weightedYield.projectedAnnualIncome)}</span>
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {fmtCurrency(weightedYield.projectedAnnualIncome)} income / {fmtCurrency(weightedYield.capital - weightedYield.projectedAnnualIncome)} capital
            </p>
          </>
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">No yield data</p>
        )}
      </div>

      {sheet?.open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${sheet.ticker} details`}
          className="fixed inset-0 z-30 flex items-end md:items-center md:justify-center bg-black/40"
          onClick={() => setSheet(null)}
        >
          <div
            className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl bg-white dark:bg-[#0a0a0a] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-medium">{sheet.ticker}</h4>
              <button
                onClick={() => setSheet(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                aria-label="Close"
              >×</button>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-neutral-500">Value</dt><dd>{fmtCurrency(sheet.marketValue)}</dd>
              <dt className="text-neutral-500">% of portfolio</dt><dd>{sheet.percent.toFixed(2)}%</dd>
              <dt className="text-neutral-500">Account</dt><dd>{sheet.account || "—"}</dd>
              <dt className="text-neutral-500">Sector</dt><dd>{sheet.sector || "—"}</dd>
              <dt className="text-neutral-500">Currency</dt><dd>{sheet.currency || "—"}</dd>
              <dt className="text-neutral-500">Strategy</dt><dd>{sheet.call || "—"}</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
