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
    "exchange",
] as const;

export type LookupData = {
    symbol?: string;       // NEW: ticker the lookup was performed for, used to detect symbol changes
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
    exchangeSuffix?: string;
    exchangeName?: string;
};

/**
 * Returns the patch to apply to editForm in response to a ticker lookup,
 * skipping any field that the user has explicitly locked.
 *
 * 5A Item 3: when the user changed the ticker before the lookup ran
 * (data.symbol !== prev.ticker), lookup-derived fields take the new
 * lookup's value verbatim — including null. Without this, AAPL's
 * 1yr-return would survive a switch to SHOP because SHOP's lookup
 * returns null and the old ?? prev.field fallback carried it forward.
 */
export function applyLookupRespectingLocks(
    prev: Partial<Asset>,
    data: LookupData,
): Partial<Asset> {
    const overrides = prev.userOverrides ?? {};
    const isLocked = (field: LockableField) => overrides[field] === true;

    const tickerChanged = typeof data.symbol === "string"
        && typeof prev.ticker === "string"
        && data.symbol.toUpperCase() !== prev.ticker.toUpperCase();

    // For lookup-derived fields (non-lockable): when the ticker changed, take the
    // new lookup's value verbatim (including null). When unchanged, preserve prev
    // for silent refreshes.
    const liveTickerPrice = tickerChanged
        ? (data.currentPrice ?? 0)
        : (data.currentPrice ?? prev.liveTickerPrice ?? 0);
    const yieldVal = tickerChanged
        ? (data.dividendYield ?? null)
        : (data.dividendYield ?? prev.yield ?? null);
    const oneYearReturn = tickerChanged
        ? (data.oneYearReturn ?? null)
        : (data.oneYearReturn ?? prev.oneYearReturn ?? null);
    const threeYearReturn = tickerChanged
        ? (data.threeYearReturn ?? null)
        : (data.threeYearReturn ?? prev.threeYearReturn ?? null);
    const exDividendDate = tickerChanged
        ? (data.exDividendDate ?? "")
        : (data.exDividendDate ?? prev.exDividendDate ?? "");
    const analystConsensus = tickerChanged
        ? (data.analystConsensus ?? "")
        : (data.analystConsensus ?? prev.analystConsensus ?? "");
    const externalRating = tickerChanged
        ? (data.externalRating ?? "")
        : (data.externalRating ?? prev.externalRating ?? "");
    const beta = tickerChanged
        ? (data.beta ?? 0)
        : (data.beta ?? prev.beta ?? 0);
    const riskFlag = tickerChanged
        ? (data.riskFlag ?? "")
        : (data.riskFlag ?? prev.riskFlag ?? "");

    return {
        sector: isLocked("sector") ? prev.sector : (data.sector || prev.sector),
        market: isLocked("market") ? prev.market : (data.market || prev.market),
        securityType: isLocked("securityType") ? prev.securityType : (data.securityType || prev.securityType),
        strategyType: isLocked("strategyType") ? prev.strategyType : (data.strategyType || prev.strategyType),
        call: isLocked("call") ? prev.call : (data.call || prev.call),
        managementStyle: isLocked("managementStyle") ? prev.managementStyle : (data.managementStyle || prev.managementStyle),
        currency: isLocked("currency") ? prev.currency : (data.currency || prev.currency),
        managementFee: isLocked("managementFee") ? prev.managementFee : (data.managementFee ?? prev.managementFee),

        exchangeSuffix: isLocked("exchange") ? prev.exchangeSuffix : (data.exchangeSuffix ?? prev.exchangeSuffix ?? ""),
        exchangeName:   isLocked("exchange") ? prev.exchangeName   : (data.exchangeName   ?? prev.exchangeName   ?? ""),

        marketComputedAt: isLocked("market")
            ? (prev.marketComputedAt ?? null)
            : (data.marketComputedAt !== undefined ? data.marketComputedAt : (prev.marketComputedAt ?? null)),

        liveTickerPrice,
        yield: yieldVal,
        oneYearReturn,
        threeYearReturn,
        exDividendDate,
        analystConsensus,
        externalRating,
        beta,
        riskFlag,
    };
}

export { LOCKABLE_FIELDS };
