import { detectAnomaly } from "../priceAnomaly";

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
});
