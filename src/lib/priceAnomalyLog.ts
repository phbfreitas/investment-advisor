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
        // Deterministic fingerprint: same (assetId, priorPrice, newPrice, source) maps to the same SK,
        // so DDB idempotent-put dedupes recurring identical anomalies. Prices are .toFixed(4) so
        // small float-format jitter (e.g., 58.1 vs 58.10) doesn't generate distinct keys.
        SK: `ANOMALY#${payload.assetId}#${payload.priorPrice.toFixed(4)}#${payload.newPrice.toFixed(4)}#${payload.source}`,
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
 * Writes a price-anomaly record to DynamoDB. The SK is a deterministic
 * fingerprint of (assetId, priorPrice, newPrice, source) so recurring
 * identical anomalies dedupe to one record (the first detection wins;
 * detectedAt records that first time). Returns the SK in both
 * fresh-insert and idempotent-skip cases. Rejects (throws on await) on
 * any DDB error other than ConditionalCheckFailedException — callers
 * MUST wrap with .catch() to honor the best-effort logging contract
 * (logging is instrumentation, not critical path).
 */
export async function insertPriceAnomalyLog(
    householdId: string,
    payload: PriceAnomalyPayload
): Promise<string> {
    const detectedAt = new Date().toISOString();
    const item = buildPriceAnomalyItem(householdId, payload, detectedAt);
    try {
        await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: item,
                // Idempotent insert: if a record with this SK already exists,
                // the put is silently rejected (we already logged this exact anomaly).
                ConditionExpression: "attribute_not_exists(SK)",
            })
        );
    } catch (err: unknown) {
        if (
            err !== null &&
            typeof err === "object" &&
            "name" in err &&
            (err as { name: string }).name === "ConditionalCheckFailedException"
        ) {
            // Duplicate fingerprint — same anomaly already logged. Silently OK.
            return item.SK;
        }
        throw err;
    }
    return item.SK;
}
