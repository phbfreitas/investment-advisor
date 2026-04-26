import type { Asset } from "@/types";
import { computeWeightedYield } from "../computeWeightedYield";

const a = (overrides: Partial<Asset>): Asset => ({
  PK: "", SK: "", id: "", profileId: "", type: "ASSET",
  account: "", ticker: "", securityType: "", strategyType: "",
  call: "", sector: "", market: "", currency: "USD",
  managementStyle: "", externalRating: "", managementFee: 0,
  quantity: 0, liveTickerPrice: 0, bookCost: 0, marketValue: 0,
  profitLoss: 0, yield: 0, oneYearReturn: 0, fiveYearReturn: 0,
  threeYearReturn: 0, exDividendDate: "", analystConsensus: "",
  beta: 0, riskFlag: "", accountNumber: "", accountType: "",
  risk: "", volatility: 0, expectedAnnualDividends: 0, updatedAt: "",
  ...overrides,
});

describe("computeWeightedYield", () => {
  it("computes value-weighted yield across holdings", () => {
    const assets = [
      a({ marketValue: 100, yield: 4 }),
      a({ marketValue: 100, yield: 0 }),
    ];
    const r = computeWeightedYield(assets);
    expect(r.yieldPct).toBeCloseTo(2, 5);
    expect(r.projectedAnnualIncome).toBeCloseTo(4, 5);
    expect(r.capital).toBe(200);
    expect(r.hasYieldData).toBe(true);
  });

  it("returns hasYieldData=false when no holding has yield", () => {
    const assets = [
      a({ marketValue: 100, yield: 0 }),
      a({ marketValue: 100, yield: 0 }),
    ];
    expect(computeWeightedYield(assets).hasYieldData).toBe(false);
  });

  it("ignores NaN/missing yield values gracefully", () => {
    const assets = [
      a({ marketValue: 100, yield: NaN }),
      a({ marketValue: 100, yield: 5 }),
    ];
    const r = computeWeightedYield(assets);
    expect(r.yieldPct).toBeCloseTo(2.5, 5);
    expect(r.projectedAnnualIncome).toBeCloseTo(5, 5);
  });

  it("returns zeros for empty input without throwing", () => {
    const r = computeWeightedYield([]);
    expect(r.yieldPct).toBe(0);
    expect(r.projectedAnnualIncome).toBe(0);
    expect(r.capital).toBe(0);
    expect(r.hasYieldData).toBe(false);
  });

  it("handles all-zero marketValue without divide-by-zero", () => {
    const assets = [a({ marketValue: 0, yield: 5 }), a({ marketValue: 0, yield: 3 })];
    const r = computeWeightedYield(assets);
    expect(r.yieldPct).toBe(0);
    expect(r.capital).toBe(0);
  });
});
