import type { Asset } from "@/types";

/**
 * 5A Source of Truth: merge live `marketData` prices into each asset and
 * recompute derived totals so EVERY consumer (Holdings totals, Breakdown
 * charts, drift signals) reads from one canonical array.
 *
 * Rules:
 *   - liveTickerPrice = marketData[id].currentPrice when it's a positive
 *     finite number; otherwise asset.liveTickerPrice (the server-known last
 *     value).
 *   - marketValue   = quantity x livePrice when both are positive; otherwise
 *     asset.marketValue (preserves server value when live data is missing).
 *   - profitLoss    = marketValue - (bookCost ?? 0).
 *   - All other fields are copied verbatim.
 *
 * Pure function — same inputs, same output. Suitable for `useMemo` callers.
 */
export function liveMergeAssets(
  assets: Asset[],
  marketData: Record<string, { currentPrice?: number }>,
): Asset[] {
  return assets.map(asset => {
    const liveCandidate = marketData[asset.id]?.currentPrice;
    const livePrice =
      typeof liveCandidate === "number" && Number.isFinite(liveCandidate) && liveCandidate > 0
        ? liveCandidate
        : asset.liveTickerPrice;
    const qty = asset.quantity ?? 0;
    const marketValue =
      qty > 0 && typeof livePrice === "number" && livePrice > 0
        ? qty * livePrice
        : asset.marketValue;
    return {
      ...asset,
      liveTickerPrice: livePrice,
      marketValue,
      profitLoss: marketValue - (asset.bookCost ?? 0),
    };
  });
}
