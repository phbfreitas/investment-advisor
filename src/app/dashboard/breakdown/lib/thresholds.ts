export const DEFENSIVE_SECTORS: ReadonlyArray<string> = [
  "Cash",
  "Bond",
  "Bonds",
  "Money Market",
  "Treasury",
  "Treasuries",
];

export const THRESHOLDS = {
  singleStockRed: 0.10,    // > 10% → red flag
  singleStockWarn: 0.05,   // > 5%  → warning
  sectorRed: 0.40,         // > 40% → red flag
  sectorWarn: 0.25,        // > 25% → warning
  regionWarn: 0.70,        // > 70% → warning
  currencyNonBaseWarn: 0.30, // > 30% non-base → warning
  accountSkewInfo: 0.80,   // > 80% in one account → informational
  cashDragInfo: 0.40,      // > 40% in defensive sectors → informational
} as const;

/** Determines the largest-weighted bucket in a value-sum map; treated as "base" for currency/region. */
export function dominantKey(weightedSums: Record<string, number>): string | null {
  let best: string | null = null;
  let bestVal = -Infinity;
  for (const [k, v] of Object.entries(weightedSums)) {
    if (v > bestVal) {
      bestVal = v;
      best = k;
    }
  }
  return best;
}
