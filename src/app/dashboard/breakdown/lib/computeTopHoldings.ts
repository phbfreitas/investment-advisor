import type { Asset } from "@/types";
import type { TopHoldings } from "./types";

const TOP_N = 10;

export function computeTopHoldings(assets: Asset[]): TopHoldings {
  const valid = assets.filter(a => Number.isFinite(a.marketValue) && a.marketValue > 0);
  const total = valid.reduce((s, a) => s + a.marketValue, 0);

  // Aggregate by ticker so multi-account positions don't occupy separate slots
  const byTicker = new Map<string, { rows: Asset[]; sum: number }>();
  for (const asset of valid) {
    const ticker = typeof asset.ticker === "string" && asset.ticker.trim().length > 0 ? asset.ticker : "Uncategorized";
    const existing = byTicker.get(ticker);
    if (existing) {
      existing.rows.push(asset);
      existing.sum += asset.marketValue;
    } else {
      byTicker.set(ticker, { rows: [asset], sum: asset.marketValue });
    }
  }

  const aggregated = Array.from(byTicker.entries()).map(([ticker, { rows, sum }]) => {
    // Use the first row's classification fields for display (they should be consistent for the same ticker)
    const head = rows[0];
    return {
      ticker,
      marketValue: sum,
      percent: total > 0 ? (sum / total) * 100 : 0,
      call: head.call,
      account: rows.length > 1 ? "Multiple" : head.account,
      sector: head.sector,
      currency: head.currency,
    };
  });

  const sorted = aggregated.sort((a, b) => b.marketValue - a.marketValue);
  const top = sorted.slice(0, TOP_N);
  const tail = sorted.slice(TOP_N);
  const tailValue = tail.reduce((s, h) => s + h.marketValue, 0);
  const others = tail.length > 0
    ? { count: tail.length, marketValue: tailValue, percent: total > 0 ? (tailValue / total) * 100 : 0 }
    : null;

  return { top, others, totalValue: total };
}
