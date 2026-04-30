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

        // Live data — never locked, always taken from lookup if present.
        liveTickerPrice: data.currentPrice ?? prev.liveTickerPrice,
        yield: data.dividendYield ?? null,
        oneYearReturn: data.oneYearReturn ?? null,
        threeYearReturn: data.threeYearReturn ?? null,
        exDividendDate: data.exDividendDate ?? "",
        analystConsensus: data.analystConsensus ?? "",
        externalRating: data.externalRating ?? "",
        beta: data.beta ?? 0,
        riskFlag: data.riskFlag ?? "",

        // userOverrides itself is never written by the lookup.
    };
}

export { LOCKABLE_FIELDS };
