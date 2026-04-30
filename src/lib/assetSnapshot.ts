import type { AssetSnapshot } from "@/types/audit";

const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

/**
 * Extracts an AssetSnapshot from a DynamoDB asset record.
 * Used by audit logging to capture before/after state.
 */
export function toSnapshot(asset: Record<string, unknown>): AssetSnapshot {
  return {
    quantity: Number(asset.quantity) || 0,
    marketValue: Number(asset.marketValue) || 0,
    bookCost: Number(asset.bookCost) || 0,
    profitLoss: Number(asset.profitLoss) || 0,
    liveTickerPrice: Number(asset.liveTickerPrice) || 0,
    currency: String(asset.currency || ""),
    account: String(asset.account || ""),
    accountNumber: String(asset.accountNumber || ""),
    accountType: String(asset.accountType || ""),
    sector: String(asset.sector || ""),
    market: String(asset.market || ""),
    securityType: String(asset.securityType || ""),
    strategyType: String(asset.strategyType || ""),
    call: String(asset.call || ""),
    managementStyle: String(asset.managementStyle || ""),
    externalRating: String(asset.externalRating || ""),
    managementFee: numOrNull(asset.managementFee),
    yield: numOrNull(asset.yield),
    oneYearReturn: numOrNull(asset.oneYearReturn),
    threeYearReturn: numOrNull(asset.threeYearReturn),
    fiveYearReturn: numOrNull(asset.fiveYearReturn),
    exDividendDate: String(asset.exDividendDate || ""),
    analystConsensus: String(asset.analystConsensus || ""),
    beta: Number(asset.beta) || 0,
    riskFlag: String(asset.riskFlag || ""),
    risk: String(asset.risk || ""),
    volatility: Number(asset.volatility) || 0,
    expectedAnnualDividends: Number(asset.expectedAnnualDividends) || 0,
    importSource: String(asset.importSource || ""),
    createdAt: String(asset.createdAt || ""),
    updatedAt: String(asset.updatedAt || ""),
    userOverrides: (asset.userOverrides && typeof asset.userOverrides === "object")
        ? (asset.userOverrides as unknown) as AssetSnapshot["userOverrides"]
        : undefined,
  };
}
