/**
 * Wire payload from the dashboard client to the price-anomaly-log endpoint.
 * Captured during a refresh or edit-form ticker lookup whenever the
 * detectAnomaly helper returns isAnomaly=true.
 */
export interface PriceAnomalyPayload {
    ticker: string;
    assetId: string;
    priorPrice: number;
    newPrice: number;
    deltaPct: number;       // signed percentage (+100.3 or -10.9)
    deltaAbs: number;       // signed dollars
    source: "refresh" | "edit-form-lookup";
    rawYahooQuote: unknown; // forwarded verbatim from /api/market-data response
}

/**
 * DynamoDB item shape for an anomaly record (for type safety in the writer).
 */
export interface PriceAnomalyRecord {
    PK: string;             // HOUSEHOLD#<id>
    SK: string;             // ANOMALY#<isoTimestamp>#<ticker>
    type: "PRICE_ANOMALY";
    ticker: string;
    assetId: string;
    priorPrice: number;
    newPrice: number;
    deltaPct: number;
    deltaAbs: number;
    source: PriceAnomalyPayload["source"];
    detectedAt: string;     // ISO timestamp
    rawYahooQuote: unknown;
}
