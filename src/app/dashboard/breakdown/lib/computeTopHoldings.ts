import type { Asset } from "@/types";
import type { TopHoldings } from "./types";

const TOP_N = 10;

export function computeTopHoldings(assets: Asset[]): TopHoldings {
  const valid = assets.filter(a => Number.isFinite(a.marketValue) && a.marketValue > 0);
  const total = valid.reduce((s, a) => s + a.marketValue, 0);
  const sorted = [...valid].sort((a, b) => b.marketValue - a.marketValue);

  const topAssets = sorted.slice(0, TOP_N);
  const tail = sorted.slice(TOP_N);

  const top = topAssets.map(a => ({
    ticker: a.ticker,
    marketValue: a.marketValue,
    percent: total > 0 ? (a.marketValue / total) * 100 : 0,
    call: a.call,
    account: a.account,
    sector: a.sector,
    currency: a.currency,
  }));

  const tailValue = tail.reduce((s, a) => s + a.marketValue, 0);
  const others = tail.length > 0
    ? { count: tail.length, marketValue: tailValue, percent: total > 0 ? (tailValue / total) * 100 : 0 }
    : null;

  return { top, others, totalValue: total };
}
