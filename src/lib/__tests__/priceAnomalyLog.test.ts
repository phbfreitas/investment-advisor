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

    it("constructs a PK/SK keyed to the household and ticker", () => {
        const item = buildPriceAnomalyItem("hh-123", samplePayload, "2026-04-29T12:00:00.000Z");
        expect(item.PK).toBe("HOUSEHOLD#hh-123");
        expect(item.SK).toBe("ANOMALY#2026-04-29T12:00:00.000Z#JEPQ");
        expect(item.type).toBe("PRICE_ANOMALY");
    });

    it("preserves payload fields and includes detectedAt", () => {
        const item = buildPriceAnomalyItem("hh-123", samplePayload, "2026-04-29T12:00:00.000Z");
        expect(item.ticker).toBe("JEPQ");
        expect(item.priorPrice).toBe(58.12);
        expect(item.newPrice).toBe(116.40);
        expect(item.deltaPct).toBe(100.3);
        expect(item.detectedAt).toBe("2026-04-29T12:00:00.000Z");
        expect(item.rawYahooQuote).toEqual({
            regularMarketPrice: 116.40,
            currency: "USD",
            symbol: "JEPQ",
        });
    });
});
