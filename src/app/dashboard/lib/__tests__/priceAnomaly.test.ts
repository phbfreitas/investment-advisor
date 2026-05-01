import { detectAnomaly, detectAnomaliesForTicker } from "../priceAnomaly";

describe("detectAnomaly", () => {
    it("returns isAnomaly=false when prior is 0 (no baseline)", () => {
        expect(detectAnomaly(0, 100).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=false when prior is null", () => {
        expect(detectAnomaly(null as unknown as number, 100).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=false when prior is undefined", () => {
        expect(detectAnomaly(undefined as unknown as number, 100).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=false when next is 0", () => {
        expect(detectAnomaly(100, 0).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=false when delta is below threshold", () => {
        expect(detectAnomaly(100, 109).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=true at exactly 10% (boundary)", () => {
        const result = detectAnomaly(100, 110);
        expect(result.isAnomaly).toBe(true);
        expect(result.deltaPct).toBeCloseTo(10);
    });

    it("returns isAnomaly=true on a 100% jump (the JEPQ-style 2x case)", () => {
        const result = detectAnomaly(58, 116);
        expect(result.isAnomaly).toBe(true);
        expect(result.deltaPct).toBeCloseTo(100);
    });

    it("returns isAnomaly=true on a -11% drop (sign-agnostic)", () => {
        const result = detectAnomaly(100, 89);
        expect(result.isAnomaly).toBe(true);
        expect(result.deltaPct).toBeCloseTo(-11);
    });

    it("respects a custom threshold", () => {
        expect(detectAnomaly(100, 105, 0.05).isAnomaly).toBe(true);
        expect(detectAnomaly(100, 104.99, 0.05).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=false when prior is NaN", () => {
        expect(detectAnomaly(NaN, 100).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=false when prior is Infinity", () => {
        expect(detectAnomaly(Infinity, 100).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=false when next is Infinity", () => {
        expect(detectAnomaly(100, Infinity).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=false when prior is negative", () => {
        expect(detectAnomaly(-100, 100).isAnomaly).toBe(false);
    });
});

describe("detectAnomaliesForTicker", () => {
    const asset = (id: string, ticker: string, liveTickerPrice: number) => ({
        id,
        ticker,
        liveTickerPrice,
    });

    it("returns empty array when no asset matches the ticker", () => {
        const result = detectAnomaliesForTicker(
            { ticker: "JEPQ", currentPrice: 116 },
            [asset("a1", "AAPL", 150)],
        );
        expect(result).toEqual([]);
    });

    it("returns empty array when the only matching asset is not anomalous", () => {
        const result = detectAnomaliesForTicker(
            { ticker: "AAPL", currentPrice: 150 },
            [asset("a1", "AAPL", 148)],
        );
        expect(result).toEqual([]);
    });

    it("returns one detection when the only matching asset is anomalous", () => {
        const result = detectAnomaliesForTicker(
            { ticker: "JEPQ", currentPrice: 116 },
            [asset("a1", "JEPQ", 58)],
        );
        expect(result).toHaveLength(1);
        expect(result[0].assetId).toBe("a1");
        expect(result[0].ticker).toBe("JEPQ");
        expect(result[0].prior).toBe(58);
        expect(result[0].next).toBe(116);
        expect(result[0].deltaPct).toBeCloseTo(100);
    });

    it("evaluates two assets with the same ticker INDEPENDENTLY (both anomalous)", () => {
        // Both accounts hold VFV.TO at the same stored price, Yahoo reports half.
        const result = detectAnomaliesForTicker(
            { ticker: "VFV.TO", currentPrice: 25 },
            [asset("tfsa-vfv", "VFV.TO", 50), asset("rrsp-vfv", "VFV.TO", 50)],
        );
        expect(result).toHaveLength(2);
        expect(result.map(d => d.assetId).sort()).toEqual(["rrsp-vfv", "tfsa-vfv"]);
    });

    it("evaluates two assets with the same ticker INDEPENDENTLY (only one anomalous)", () => {
        // TFSA stored price was manually corrected to the real value; RRSP wasn't.
        const result = detectAnomaliesForTicker(
            { ticker: "VFV.TO", currentPrice: 50 },
            [asset("tfsa-vfv", "VFV.TO", 50), asset("rrsp-vfv", "VFV.TO", 25)],
        );
        expect(result).toHaveLength(1);
        expect(result[0].assetId).toBe("rrsp-vfv");
    });

    it("ignores non-matching tickers when other tickers in the list", () => {
        const result = detectAnomaliesForTicker(
            { ticker: "AAPL", currentPrice: 300 },
            [
                asset("a1", "AAPL", 150),
                asset("a2", "MSFT", 200), // would be anomalous IF the quote applied, but it's a different ticker
            ],
        );
        expect(result).toHaveLength(1);
        expect(result[0].assetId).toBe("a1");
    });
});
