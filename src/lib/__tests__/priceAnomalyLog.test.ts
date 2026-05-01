import { buildPriceAnomalyItem } from "../priceAnomalyLog";

describe("buildPriceAnomalyItem", () => {
    const samplePayload = {
        ticker: "JEPQ",
        assetId: "asset-uuid-1",
        priorPrice: 58.12,
        newPrice: 116.40,
        deltaPct: 100.3,
        deltaAbs: 58.28,
        source: "refresh" as const,
        rawYahooQuote: { regularMarketPrice: 116.40, currency: "USD", symbol: "JEPQ" },
    };

    it("constructs PK keyed to household and SK with daily bucket + fingerprint", () => {
        const item = buildPriceAnomalyItem("hh-123", samplePayload, "2026-04-29T12:00:00.000Z");
        expect(item.PK).toBe("HOUSEHOLD#hh-123");
        // SK fingerprint: assetId + YYYY-MM-DD + priorPrice + newPrice + source.
        // Same-day recurrences dedupe; different-day recurrences each log fresh.
        expect(item.SK).toBe("ANOMALY#asset-uuid-1#2026-04-29#58.1200#116.4000#refresh");
        expect(item.type).toBe("PRICE_ANOMALY");
    });

    it("preserves payload fields and records detectedAt as a non-key attribute", () => {
        const item = buildPriceAnomalyItem("hh-123", samplePayload, "2026-04-29T12:00:00.000Z");
        expect(item.ticker).toBe("JEPQ");
        expect(item.priorPrice).toBe(58.12);
        expect(item.newPrice).toBe(116.40);
        expect(item.deltaPct).toBe(100.3);
        expect(item.deltaAbs).toBe(58.28);
        expect(item.assetId).toBe("asset-uuid-1");
        expect(item.source).toBe("refresh");
        expect(item.detectedAt).toBe("2026-04-29T12:00:00.000Z");
        expect(item.rawYahooQuote).toEqual({
            regularMarketPrice: 116.40,
            currency: "USD",
            symbol: "JEPQ",
        });
    });

    it("produces the SAME SK for two detections on the same day at different times", () => {
        // Same-day dedupe: morning and evening detections of the same anomaly
        // collapse to one record via DDB's attribute_not_exists condition.
        const itemA = buildPriceAnomalyItem("hh-123", samplePayload, "2026-04-29T08:00:00.000Z");
        const itemB = buildPriceAnomalyItem("hh-123", samplePayload, "2026-04-29T20:30:00.000Z");
        expect(itemA.SK).toBe(itemB.SK);
        // detectedAt itself differs because it's a non-key field (records FIRST seen).
        expect(itemA.detectedAt).not.toBe(itemB.detectedAt);
    });

    it("produces DIFFERENT SKs for the same anomaly detected on different DAYS (recurrence signal)", () => {
        // This is the value of the daily-bucket key: a recurring bad quote logs
        // once per day so operators see "this anomaly came back."
        const itemA = buildPriceAnomalyItem("hh-123", samplePayload, "2026-04-29T12:00:00.000Z");
        const itemB = buildPriceAnomalyItem("hh-123", samplePayload, "2026-05-15T12:00:00.000Z");
        expect(itemA.SK).not.toBe(itemB.SK);
        // Confirm date buckets are what changed.
        expect(itemA.SK).toContain("#2026-04-29#");
        expect(itemB.SK).toContain("#2026-05-15#");
    });

    it("produces DIFFERENT SKs when the new price changes (a different anomaly)", () => {
        const itemA = buildPriceAnomalyItem("hh-123", samplePayload, "2026-04-29T12:00:00.000Z");
        const itemB = buildPriceAnomalyItem(
            "hh-123",
            { ...samplePayload, newPrice: 200 },
            "2026-04-29T12:00:00.000Z",
        );
        expect(itemA.SK).not.toBe(itemB.SK);
    });

    it("produces DIFFERENT SKs when the source path changes", () => {
        const refreshItem = buildPriceAnomalyItem("hh-123", samplePayload, "2026-04-29T12:00:00.000Z");
        const editItem = buildPriceAnomalyItem(
            "hh-123",
            { ...samplePayload, source: "edit-form-lookup" as const },
            "2026-04-29T12:00:00.000Z",
        );
        expect(refreshItem.SK).not.toBe(editItem.SK);
    });

    it("normalizes prices to 4 decimals so float-format jitter doesn't generate distinct SKs", () => {
        const itemA = buildPriceAnomalyItem("hh-123", { ...samplePayload, priorPrice: 58.12 }, "2026-04-29T12:00:00.000Z");
        const itemB = buildPriceAnomalyItem("hh-123", { ...samplePayload, priorPrice: 58.1200 }, "2026-04-29T12:00:00.000Z");
        expect(itemA.SK).toBe(itemB.SK);
    });
});
