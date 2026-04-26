import type { Asset } from "@/types";
import { computeTopHoldings } from "../computeTopHoldings";

const a = (overrides: Partial<Asset>): Asset => ({
  PK: "", SK: "", id: "", profileId: "", type: "ASSET",
  account: "Brokerage", ticker: "", securityType: "Company", strategyType: "",
  call: "Mix", sector: "Mixed", market: "USA", currency: "USD",
  managementStyle: "", externalRating: "", managementFee: 0,
  quantity: 0, liveTickerPrice: 0, bookCost: 0, marketValue: 0,
  profitLoss: 0, yield: 0, oneYearReturn: 0, fiveYearReturn: 0,
  threeYearReturn: 0, exDividendDate: "", analystConsensus: "",
  beta: 0, riskFlag: "", accountNumber: "", accountType: "",
  risk: "", volatility: 0, expectedAnnualDividends: 0, updatedAt: "",
  ...overrides,
});

describe("computeTopHoldings", () => {
  it("returns all holdings sorted descending when count <= 10", () => {
    const assets = [
      a({ ticker: "AAA", marketValue: 100 }),
      a({ ticker: "BBB", marketValue: 300 }),
      a({ ticker: "CCC", marketValue: 200 }),
    ];
    const r = computeTopHoldings(assets);
    expect(r.top.map(h => h.ticker)).toEqual(["BBB", "CCC", "AAA"]);
    expect(r.others).toBeNull();
    expect(r.totalValue).toBe(600);
  });

  it("rolls up holdings beyond top 10 into 'others'", () => {
    const assets = Array.from({ length: 12 }, (_, i) =>
      a({ ticker: `T${i}`, marketValue: 100 - i })
    );
    const r = computeTopHoldings(assets);
    expect(r.top).toHaveLength(10);
    expect(r.others).toEqual({
      count: 2,
      marketValue: 90 + 89,
      percent: ((90 + 89) / r.totalValue) * 100,
    });
  });

  it("computes percent of portfolio for each holding", () => {
    const assets = [
      a({ ticker: "AAA", marketValue: 250 }),
      a({ ticker: "BBB", marketValue: 750 }),
    ];
    const r = computeTopHoldings(assets);
    expect(r.top[0].percent).toBeCloseTo(75, 5);
    expect(r.top[1].percent).toBeCloseTo(25, 5);
  });

  it("excludes assets with zero or NaN marketValue", () => {
    const assets = [
      a({ ticker: "AAA", marketValue: 100 }),
      a({ ticker: "BBB", marketValue: 0 }),
      a({ ticker: "CCC", marketValue: NaN }),
    ];
    const r = computeTopHoldings(assets);
    expect(r.top).toHaveLength(1);
    expect(r.top[0].ticker).toBe("AAA");
  });

  it("returns empty result for empty input", () => {
    const r = computeTopHoldings([]);
    expect(r.top).toEqual([]);
    expect(r.others).toBeNull();
    expect(r.totalValue).toBe(0);
  });

  it("preserves call/account/sector/currency on each holding", () => {
    const assets = [
      a({ ticker: "AAA", marketValue: 100, call: "Dividend", account: "TFSA", sector: "Banking", currency: "CAD" }),
    ];
    const r = computeTopHoldings(assets);
    expect(r.top[0]).toMatchObject({ call: "Dividend", account: "TFSA", sector: "Banking", currency: "CAD" });
  });
});
