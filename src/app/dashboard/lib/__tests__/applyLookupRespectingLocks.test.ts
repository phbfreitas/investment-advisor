import { applyLookupRespectingLocks, type LookupData } from "../applyLookupRespectingLocks";
import type { Asset } from "@/types";

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

    it("preserves previous live-data values when the lookup is silent on those fields", () => {
        const prev = {
            yield: 0.055,
            oneYearReturn: 0.12,
            threeYearReturn: 0.30,
            beta: 1.1,
            exDividendDate: "2026-03-15",
            analystConsensus: "Buy",
            externalRating: "AA",
            riskFlag: "Medium",
            liveTickerPrice: 100,
        };
        // Lookup returns ONLY classification (no live data fields).
        const data: LookupData = { sector: "Healthcare" };

        const next = applyLookupRespectingLocks(prev, data);

        expect(next.yield).toBe(0.055);
        expect(next.oneYearReturn).toBe(0.12);
        expect(next.threeYearReturn).toBe(0.30);
        expect(next.beta).toBe(1.1);
        expect(next.exDividendDate).toBe("2026-03-15");
        expect(next.analystConsensus).toBe("Buy");
        expect(next.externalRating).toBe("AA");
        expect(next.riskFlag).toBe("Medium");
        expect(next.liveTickerPrice).toBe(100);
    });
});

describe("applyLookupRespectingLocks — marketComputedAt", () => {
  it("forwards data.marketComputedAt when market is unlocked", async () => {
    const prev: Partial<Asset> = {
      market: "Not Found",
      marketComputedAt: undefined,
      userOverrides: {},
    };
    const result = applyLookupRespectingLocks(prev, {
      market: "USA",
      marketComputedAt: "2026-04-30T12:00:00Z",
    });

    expect(result.market).toBe("USA");
    expect(result.marketComputedAt).toBe("2026-04-30T12:00:00Z");
  });

  it("preserves prev.marketComputedAt when market is locked", async () => {
    const prev: Partial<Asset> = {
      market: "Canada",
      marketComputedAt: null,  // manual-set sentinel
      userOverrides: { market: true },
    };
    const result = applyLookupRespectingLocks(prev, {
      market: "USA",
      marketComputedAt: "2026-04-30T12:00:00Z",
    });

    expect(result.market).toBe("Canada");
    expect(result.marketComputedAt).toBeNull();
  });

  it("when unlocked and lookup omits marketComputedAt, falls back to prev", async () => {
    const prev: Partial<Asset> = {
      market: "USA",
      marketComputedAt: "2026-01-01T00:00:00Z",
      userOverrides: {},
    };
    const result = applyLookupRespectingLocks(prev, {
      market: "USA",
      // marketComputedAt omitted from lookup response
    });

    expect(result.marketComputedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("when unlocked and lookup explicitly sends null, writes null", async () => {
    const prev: Partial<Asset> = {
      market: "USA",
      marketComputedAt: "2026-01-01T00:00:00Z",
      userOverrides: {},
    };
    const result = applyLookupRespectingLocks(prev, {
      market: "USA",
      marketComputedAt: null,
    });

    expect(result.marketComputedAt).toBeNull();
  });
});

describe("exchange field locking", () => {
  it("preserves exchangeSuffix and exchangeName when exchange is locked", () => {
    const prev: Partial<Asset> = {
      exchangeSuffix: ".NE",
      exchangeName: "Cboe Canada",
      userOverrides: { exchange: true },
    };
    const data = { exchangeSuffix: ".TO", exchangeName: "TSX" };
    const result = applyLookupRespectingLocks(prev, data);
    expect(result.exchangeSuffix).toBe(".NE");
    expect(result.exchangeName).toBe("Cboe Canada");
  });

  it("overwrites exchangeSuffix and exchangeName when exchange is not locked", () => {
    const prev: Partial<Asset> = {
      exchangeSuffix: "",
      exchangeName: "Nasdaq",
      userOverrides: {},
    };
    const data = { exchangeSuffix: ".NE", exchangeName: "Cboe Canada" };
    const result = applyLookupRespectingLocks(prev, data);
    expect(result.exchangeSuffix).toBe(".NE");
    expect(result.exchangeName).toBe("Cboe Canada");
  });

  it("falls back to prev values when data fields are absent", () => {
    const prev: Partial<Asset> = { exchangeSuffix: ".TO", exchangeName: "TSX", userOverrides: {} };
    const data = {};
    const result = applyLookupRespectingLocks(prev, data);
    expect(result.exchangeSuffix).toBe(".TO");
    expect(result.exchangeName).toBe("TSX");
  });
});
