import type { Asset, LockableField } from "@/types";

const LOCKABLE_FIELDS: readonly LockableField[] = [
    "sector",
    "market",
    "securityType",
    "strategyType",
    "call",
    "managementStyle",
    "currency",
    "managementFee",
] as const;

export type LookupData = {
    sector?: string;
    market?: string;
    securityType?: string;
    strategyType?: string;
    call?: string;
    managementStyle?: string;
    currency?: string;
    managementFee?: number | null;
    currentPrice?: number;
    dividendYield?: number | null;
    oneYearReturn?: number | null;
    threeYearReturn?: number | null;
    exDividendDate?: string;
    analystConsensus?: string;
    externalRating?: string;
    beta?: number;
    riskFlag?: string;
    marketComputedAt?: string | null;
};

/**
 * Returns the patch to apply to editForm in response to a ticker lookup,
 * skipping any field that the user has explicitly locked.
 */
export function applyLookupRespectingLocks(
    prev: Partial<Asset>,
    data: LookupData,
): Partial<Asset> {
    const overrides = prev.userOverrides ?? {};
    const isLocked = (field: LockableField) => overrides[field] === true;

    return {
        sector: isLocked("sector") ? prev.sector : (data.sector || prev.sector),
        market: isLocked("market") ? prev.market : (data.market || prev.market),
        securityType: isLocked("securityType") ? prev.securityType : (data.securityType || prev.securityType),
        strategyType: isLocked("strategyType") ? prev.strategyType : (data.strategyType || prev.strategyType),
        call: isLocked("call") ? prev.call : (data.call || prev.call),
        managementStyle: isLocked("managementStyle") ? prev.managementStyle : (data.managementStyle || prev.managementStyle),
        currency: isLocked("currency") ? prev.currency : (data.currency || prev.currency),
        managementFee: isLocked("managementFee") ? prev.managementFee : (data.managementFee ?? prev.managementFee),

        // 3C: marketComputedAt rides with the market field's lock. Locked → keep
        // prev timestamp; unlocked → take whatever researchTicker returned (a
        // fresh ISO timestamp on classification, or echoed-existing on cache hit).
        marketComputedAt: isLocked("market")
            ? (prev.marketComputedAt ?? null)
            : (data.marketComputedAt !== undefined ? data.marketComputedAt : (prev.marketComputedAt ?? null)),

        // Live data — never locked. Lookup wins when it returns a value;
        // otherwise the previous edit-form value is preserved (so a
        // partial lookup doesn't wipe manually-entered values).
        liveTickerPrice: data.currentPrice ?? prev.liveTickerPrice ?? 0,
        yield: data.dividendYield ?? prev.yield ?? null,
        oneYearReturn: data.oneYearReturn ?? prev.oneYearReturn ?? null,
        threeYearReturn: data.threeYearReturn ?? prev.threeYearReturn ?? null,
        exDividendDate: data.exDividendDate ?? prev.exDividendDate ?? "",
        analystConsensus: data.analystConsensus ?? prev.analystConsensus ?? "",
        externalRating: data.externalRating ?? prev.externalRating ?? "",
        beta: data.beta ?? prev.beta ?? 0,
        riskFlag: data.riskFlag ?? prev.riskFlag ?? "",

        // userOverrides itself is never written by the lookup.
    };
}

export { LOCKABLE_FIELDS };
