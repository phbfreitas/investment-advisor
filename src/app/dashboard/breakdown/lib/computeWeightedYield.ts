import type { Asset } from "@/types";
import type { WeightedYield } from "./types";

export function computeWeightedYield(assets: Asset[]): WeightedYield {
  let capital = 0;
  let projectedAnnualIncome = 0;
  let hasYieldData = false;

  for (const asset of assets) {
    const mv = asset.marketValue;
    if (!Number.isFinite(mv) || mv <= 0) continue;
    capital += mv;
    const y = Number.isFinite(asset.yield) ? asset.yield : 0;
    if (y > 0) hasYieldData = true;
    projectedAnnualIncome += mv * (y / 100);
  }

  const yieldPct = capital > 0 ? (projectedAnnualIncome / capital) * 100 : 0;
  return { yieldPct, projectedAnnualIncome, capital, hasYieldData };
}
