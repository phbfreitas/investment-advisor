import { db, TABLE_NAME } from "@/lib/db";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { PriceAnomalyPayload, PriceAnomalyRecord } from "@/types/priceAnomaly";

/**
 * Build the DynamoDB item from an anomaly payload. Pure function for testability.
 */
export function buildPriceAnomalyItem(
    householdId: string,
    payload: PriceAnomalyPayload,
    detectedAt: string
): PriceAnomalyRecord {
    return {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `ANOMALY#${detectedAt}#${payload.ticker}`,
        type: "PRICE_ANOMALY",
        ticker: payload.ticker,
        assetId: payload.assetId,
        priorPrice: payload.priorPrice,
        newPrice: payload.newPrice,
        deltaPct: payload.deltaPct,
        deltaAbs: payload.deltaAbs,
        source: payload.source,
        detectedAt,
        rawYahooQuote: payload.rawYahooQuote,
    };
}

/**
 * Writes a price-anomaly record to DynamoDB. Best-effort — caller catches
 * failures and treats logging as non-critical.
 */
export async function insertPriceAnomalyLog(
    householdId: string,
    payload: PriceAnomalyPayload
): Promise<string> {
    const detectedAt = new Date().toISOString();
    const item = buildPriceAnomalyItem(householdId, payload, detectedAt);
    await db.send(
        new PutCommand({
            TableName: TABLE_NAME,
            Item: item,
        })
    );
    return item.SK;
}
