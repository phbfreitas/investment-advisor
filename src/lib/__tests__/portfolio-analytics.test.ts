import { buildFullUserContext, computePortfolioTotals } from "../portfolio-analytics";
import type { Asset } from "@/types";

function makeAsset(overrides: Partial<Asset>): Asset {
  return {
    PK: "HOUSEHOLD#h1", SK: "ASSET#a1", id: "a1", profileId: "HOUSEHOLD#h1",
    type: "ASSET", account: "", ticker: "X", securityType: "ETF",
    strategyType: "Growth", call: "No", sector: "IT", market: "USA",
    currency: "USD", managementStyle: "Passive", externalRating: "",
    managementFee: null, quantity: 1, liveTickerPrice: 100,
    bookCost: 90, marketValue: 100, profitLoss: 10, yield: null,
    oneYearReturn: null, fiveYearReturn: null, threeYearReturn: null,
    exDividendDate: "", analystConsensus: "", beta: 1, riskFlag: "Normal",
    accountNumber: "", accountType: "", risk: "", volatility: 0,
    expectedAnnualDividends: 0, updatedAt: "",
    ...overrides,
  };
}

describe("computePortfolioTotals", () => {
  it("splits assets by currency and converts USD to CAD for grand total", () => {
    const assets = [
      makeAsset({ id: "a1", currency: "CAD", marketValue: 100_000 }),
      makeAsset({ id: "a2", currency: "USD", marketValue: 10_000 }),
    ];
    const result = computePortfolioTotals(assets, 1.36);
    expect(result.cadTotal).toBe(100_000);
    expect(result.usdTotal).toBe(10_000);
    expect(result.grandTotalCad).toBeCloseTo(113_600);
    expect(result.fxUnavailable).toBe(false);
  });

  it("sets fxUnavailable and grandTotalCad equals cadTotal when rate is null", () => {
    const assets = [
      makeAsset({ id: "a1", currency: "CAD", marketValue: 50_000 }),
      makeAsset({ id: "a2", currency: "USD", marketValue: 5_000 }),
    ];
    const result = computePortfolioTotals(assets, null);
    expect(result.fxUnavailable).toBe(true);
    expect(result.grandTotalCad).toBe(50_000);
  });

  it("handles all-CAD portfolio", () => {
    const assets = [makeAsset({ id: "a1", currency: "CAD", marketValue: 75_000 })];
    const result = computePortfolioTotals(assets, 1.36);
    expect(result.cadTotal).toBe(75_000);
    expect(result.usdTotal).toBe(0);
    expect(result.grandTotalCad).toBe(75_000);
  });
});

const baseAsset = {
  PK: "p#1", SK: "a#1", id: "a1", profileId: "p1", type: "ASSET",
  account: "Acct", ticker: "TST", securityType: "ETF", strategyType: "Dividend",
  call: "No", sector: "it", market: "usa", currency: "USD",
  managementStyle: "Passive", externalRating: "", managementFee: 0,
  quantity: 10, liveTickerPrice: 100, bookCost: 1000, marketValue: 1000,
  profitLoss: 0, exDividendDate: "", analystConsensus: "Buy",
  beta: 1, riskFlag: "", accountNumber: "", accountType: "TFSA",
  risk: "", volatility: 0, expectedAnnualDividends: 0, updatedAt: "",
  yield: null as number | null,
  oneYearReturn: null as number | null,
  threeYearReturn: null as number | null,
  fiveYearReturn: null as number | null,
};

describe("buildFullUserContext: yield/return unit conversion", () => {
  it("renders decimal-stored yield as percentage (0.05 → 5.00%)", () => {
    const asset = { ...baseAsset, yield: 0.05 };
    const ctx = buildFullUserContext({}, [asset], null);
    expect(ctx).toContain("Yield: 5.00%");
    expect(ctx).not.toContain("Yield: 0.05%");
  });

  it("renders decimal-stored oneYearReturn as percentage (0.072 → 7.2%)", () => {
    const asset = { ...baseAsset, oneYearReturn: 0.072 };
    const ctx = buildFullUserContext({}, [asset], null);
    expect(ctx).toContain("1yr: 7.2%");
    expect(ctx).not.toContain("1yr: 0.1%");
  });

  it("still emits 'Not Found' for null yield/return", () => {
    const ctx = buildFullUserContext({}, [baseAsset], null);
    expect(ctx).toContain("Yield: Not Found");
    expect(ctx).toContain("1yr: Not Found");
  });

  it("renders 0 yield/return as 0.00%/0.0% (genuine zero, not Not Found)", () => {
    const asset = { ...baseAsset, yield: 0, oneYearReturn: 0 };
    const ctx = buildFullUserContext({}, [asset], null);
    expect(ctx).toContain("Yield: 0.00%");
    expect(ctx).toContain("1yr: 0.0%");
  });
});
