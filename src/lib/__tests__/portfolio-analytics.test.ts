import { buildFullUserContext } from "../portfolio-analytics";

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
