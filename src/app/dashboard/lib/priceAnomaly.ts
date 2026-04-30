export interface AnomalyResult {
    isAnomaly: boolean;
    deltaPct: number;
}

/**
 * Detects whether `next` differs from `prior` by at least `threshold`
 * (default 10%). Returns isAnomaly=false when there's no usable baseline
 * (prior <= 0 or null/undefined) or when next is 0/missing.
 *
 * `deltaPct` is signed and expressed as a percentage (e.g., +100.3 or -10.9).
 */
export function detectAnomaly(
    prior: number,
    next: number,
    threshold = 0.1
): AnomalyResult {
    if (!prior || prior <= 0 || !next || next <= 0) {
        return { isAnomaly: false, deltaPct: 0 };
    }
    const ratio = (next - prior) / prior;
    const deltaPct = ratio * 100;
    return {
        isAnomaly: Math.abs(ratio) >= threshold,
        deltaPct,
    };
}
