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
    // YYYY-MM-DD slice of the ISO timestamp gives us a daily bucket. Same anomaly
    // detected multiple times on the same day collapses to one record (idempotent
    // put); same anomaly detected on a later day produces a fresh record so
    // operators can see recurrence frequency. See Codex adversarial review #3
    // finding 2 (lifetime dedupe was hiding "this bug is still active" signal).
    const dateBucket = detectedAt.slice(0, 10);
    return {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `ANOMALY#${payload.assetId}#${dateBucket}#${payload.priorPrice.toFixed(4)}#${payload.newPrice.toFixed(4)}#${payload.source}`,
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
 * Writes a price-anomaly record to DynamoDB. The SK is a daily-bucketed
 * fingerprint of (assetId, date, priorPrice, newPrice, source) so identical
 * anomalies within the same day dedupe to one record (first detection wins;
 * detectedAt records that first time), while recurrences on later days each
 * produce their own record (preserving recurrence-frequency signal). Returns
 * the SK in both fresh-insert and idempotent-skip cases. Rejects (throws on
 * await) on any DDB error other than ConditionalCheckFailedException —
 * callers MUST wrap with .catch() to honor the best-effort logging contract
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
