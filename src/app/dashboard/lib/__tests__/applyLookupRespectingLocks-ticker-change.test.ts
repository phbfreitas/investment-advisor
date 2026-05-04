import { applyLookupRespectingLocks, LookupData } from "../applyLookupRespectingLocks";
import type { Asset } from "@/types";

const aaplPrev: Partial<Asset> = {
  ticker: "AAPL",
  oneYearReturn: 0.15,
  threeYearReturn: 0.50,
  beta: 1.2,
  analystConsensus: "Buy",
  exDividendDate: "2026-02-09",
  liveTickerPrice: 180,
  yield: 0.005,
  externalRating: "BBB+",
  riskFlag: "LOW",
};

const shopLookup: LookupData = {
  // SHOP lookup returns mostly nulls for fund-only metrics
  currentPrice: 90,
  oneYearReturn: null,
  threeYearReturn: null,
  beta: undefined,
  analystConsensus: undefined,
  exDividendDate: undefined,
  dividendYield: null,
  externalRating: undefined,
  riskFlag: undefined,
};

describe("applyLookupRespectingLocks — ticker change", () => {
  it("clears lookup-derived fields when the ticker changes", () => {
    // prev still carries AAPL identity (ticker + classification fields). The
    // lookup arrives for SHOP — i.e. the user changed the ticker and the
    // fresh lookup is now landing. Verbatim impl detects the change by
    // comparing prev.ticker !== data.symbol.
    const next = applyLookupRespectingLocks(
      aaplPrev,
      { ...shopLookup, symbol: "SHOP" } as LookupData & { symbol: string },
    );

    expect(next.oneYearReturn).toBeNull();
    expect(next.threeYearReturn).toBeNull();
    expect(next.beta).toBe(0);
    expect(next.analystConsensus).toBe("");
    expect(next.exDividendDate).toBe("");
    expect(next.yield).toBeNull();
    expect(next.externalRating).toBe("");
    expect(next.riskFlag).toBe("");
    expect(next.liveTickerPrice).toBe(90); // new lookup wins
  });

  it("preserves prev values when the ticker is unchanged (silent refresh)", () => {
    const next = applyLookupRespectingLocks(
      aaplPrev,
      { symbol: "AAPL" } as LookupData & { symbol: string }, // empty refresh
    );

    expect(next.oneYearReturn).toBe(0.15);
    expect(next.threeYearReturn).toBe(0.50);
    expect(next.beta).toBe(1.2);
    expect(next.analystConsensus).toBe("Buy");
    expect(next.exDividendDate).toBe("2026-02-09");
    expect(next.liveTickerPrice).toBe(180);
  });

  it("respects locks even on ticker change (locked sector/market preserved)", () => {
    const lockedPrev: Partial<Asset> = {
      ...aaplPrev,
      sector: "Technology",
      market: "US",
      userOverrides: { sector: true, market: true },
    };
    // Same scenario as test 1: prev still has AAPL ticker, fresh lookup for SHOP.
    const next = applyLookupRespectingLocks(
      lockedPrev,
      { sector: "E-Commerce", market: "Canada", symbol: "SHOP" } as LookupData & { symbol: string },
    );
    expect(next.sector).toBe("Technology");
    expect(next.market).toBe("US");
    // lookup-derived still cleared (data.oneYearReturn is undefined → null)
    expect(next.oneYearReturn).toBeNull();
  });
});
