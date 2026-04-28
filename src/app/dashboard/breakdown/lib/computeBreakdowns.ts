import type { Asset } from "@/types";
import type { DimensionBreakdown } from "./types";

const DIMENSIONS = [
  { key: "market" as const,        title: "By Region" },
  { key: "sector" as const,        title: "By Sector" },
  { key: "strategyType" as const,  title: "By Strategy" },
  { key: "securityType" as const,  title: "By Asset Type" },
  { key: "call" as const,          title: "By Call" },
  { key: "currency" as const,      title: "By Currency" },
];

export interface AllBreakdowns {
  market: DimensionBreakdown;
  sector: DimensionBreakdown;
  strategyType: DimensionBreakdown;
  securityType: DimensionBreakdown;
  call: DimensionBreakdown;
  currency: DimensionBreakdown;
}

function group(assets: Asset[], field: keyof Asset): DimensionBreakdown {
  const sums: Record<string, number> = {};
  let total = 0;
  for (const asset of assets) {
    const mv = asset.marketValue;
    if (!Number.isFinite(mv) || mv <= 0) continue;
    const raw = asset[field];
    const label = typeof raw === "string" && raw.trim().length > 0 ? raw : "Uncategorized";
    sums[label] = (sums[label] ?? 0) + mv;
    total += mv;
  }
  const allSlices = Object.entries(sums)
    .map(([label, value]) => ({
      label,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const SMALL_SLICE_THRESHOLD = 5; // percent
  const big = allSlices.filter(s => s.percent >= SMALL_SLICE_THRESHOLD);
  const small = allSlices.filter(s => s.percent < SMALL_SLICE_THRESHOLD);

  const slices = small.length > 0
    ? [
        ...big,
        {
          label: "Others",
          value: small.reduce((sum, s) => sum + s.value, 0),
          percent: small.reduce((sum, s) => sum + s.percent, 0),
        },
      ]
    : big;
  const dim = DIMENSIONS.find(d => d.key === field);
  return {
    title: dim?.title ?? `By ${String(field)}`,
    field: String(field),
    slices,
    totalValue: total,
  };
}

export function computeBreakdowns(assets: Asset[]): AllBreakdowns {
  return {
    market:        group(assets, "market"),
    sector:        group(assets, "sector"),
    strategyType:  group(assets, "strategyType"),
    securityType:  group(assets, "securityType"),
    call:          group(assets, "call"),
    currency:      group(assets, "currency"),
  };
}
