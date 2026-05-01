export interface AnomalyResult {
    isAnomaly: boolean;
    deltaPct: number;
}

/**
 * Detects whether `next` differs from `prior` by at least `threshold`
 * (default 10%). Returns isAnomaly=false when there's no usable baseline
 * (prior <= 0, NaN, Infinity, null, or undefined) or when next is similarly invalid.
 *
 * `deltaPct` is signed and expressed as a percentage (e.g., +100.3 or -10.9).
 */
export function detectAnomaly(
    prior: number,
    next: number,
    threshold = 0.1
): AnomalyResult {
    if (!Number.isFinite(prior) || prior <= 0 || !Number.isFinite(next) || next <= 0) {
        return { isAnomaly: false, deltaPct: 0 };
    }
    const ratio = (next - prior) / prior;
    const deltaPct = ratio * 100;
    return {
        isAnomaly: Math.abs(ratio) >= threshold,
        deltaPct,
    };
}

export interface AssetForAnomalyCheck {
    id: string;
    ticker: string;
    liveTickerPrice: number;
}

export interface AnomalyDetection {
    assetId: string;
    ticker: string;
    prior: number;
    next: number;
    deltaPct: number;
}

/**
 * For a given Yahoo quote, return one anomaly detection per asset that
 * crosses the threshold. Multiple assets with the same ticker are evaluated
 * INDEPENDENTLY against their own stored liveTickerPrice. Empty array when
 * no asset is anomalous.
 */
export function detectAnomaliesForTicker(
    quote: { ticker: string; currentPrice: number },
    assets: AssetForAnomalyCheck[],
    threshold = 0.1
): AnomalyDetection[] {
    const matching = assets.filter(a => a.ticker === quote.ticker);
    const detections: AnomalyDetection[] = [];
    for (const asset of matching) {
        const prior = asset.liveTickerPrice;
        const next = quote.currentPrice;
        const result = detectAnomaly(prior, next, threshold);
        if (result.isAnomaly) {
            detections.push({
                assetId: asset.id,
                ticker: asset.ticker,
                prior,
                next,
                deltaPct: result.deltaPct,
            });
        }
    }
    return detections;
}
