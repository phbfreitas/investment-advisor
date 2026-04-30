import { applyLookupRespectingLocks, type LookupData } from "../applyLookupRespectingLocks";

describe("applyLookupRespectingLocks", () => {
    it("applies all lookup classification fields when nothing is locked", () => {
        const prev = { sector: "OldSector", call: "No" };
        const data: LookupData = { sector: "NewSector", call: "Yes" };

        const next = applyLookupRespectingLocks(prev, data);

        expect(next.sector).toBe("NewSector");
        expect(next.call).toBe("Yes");
    });

    it("preserves a locked classification field even when lookup returns a different value", () => {
        const prev = {
            sector: "Diversified",
            call: "No",
            userOverrides: { sector: true },
        };
        const data: LookupData = { sector: "Healthcare", call: "Yes" };

        const next = applyLookupRespectingLocks(prev, data);

        expect(next.sector).toBe("Diversified");  // locked → preserved
        expect(next.call).toBe("Yes");              // unlocked → updated
    });

    it("preserves a locked currency", () => {
        const prev = {
            currency: "USD",
            userOverrides: { currency: true },
        };
        const data: LookupData = { currency: "CAD" };

        const next = applyLookupRespectingLocks(prev, data);

        expect(next.currency).toBe("USD");
    });

    it("preserves a locked managementFee even when lookup returns a number", () => {
        const prev = {
            managementFee: 0.05,
            userOverrides: { managementFee: true },
        };
        const data: LookupData = { managementFee: 0.20 };

        const next = applyLookupRespectingLocks(prev, data);

        expect(next.managementFee).toBe(0.05);
    });

    it("always updates live data fields regardless of any classification lock", () => {
        const prev = {
            sector: "Diversified",
            yield: 0.01,
            userOverrides: { sector: true },
        };
        const data: LookupData = {
            sector: "Healthcare",
            currentPrice: 123.45,
            dividendYield: 0.05,
        };

        const next = applyLookupRespectingLocks(prev, data);

        expect(next.sector).toBe("Diversified");        // locked classification preserved
        expect(next.liveTickerPrice).toBe(123.45);      // live data refreshed
        expect(next.yield).toBe(0.05);                  // live data refreshed
    });

    it("never returns userOverrides — the lookup must not mutate lock state", () => {
        const prev = {
            userOverrides: { sector: true },
        };
        const data: LookupData = {};

        const next = applyLookupRespectingLocks(prev, data);

        expect("userOverrides" in next).toBe(false);
    });

    it("falls back to prev when lookup returns undefined for an unlocked field", () => {
        const prev = { sector: "OldSector" };
        const data: LookupData = {};

        const next = applyLookupRespectingLocks(prev, data);

        expect(next.sector).toBe("OldSector");
    });
});
