import type { Asset } from "@/types";
import { computeBreakdowns } from "../computeBreakdowns";

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

describe("computeBreakdowns", () => {
  it("groups by all six dimensions weighted by marketValue", () => {
    const assets: Asset[] = [
      a({ ticker: "X", sector: "Banking", market: "USA", call: "Dividend", securityType: "Company", risk: "Yes", currency: "USD", marketValue: 100 }),
      a({ ticker: "Y", sector: "IT",      market: "Canada", call: "Growth", securityType: "ETF",     risk: "No",  currency: "CAD", marketValue: 300 }),
    ];
    const result = computeBreakdowns(assets);
    const sectorPercents = Object.fromEntries(result.sector.slices.map(s => [s.label, s.percent]));
    expect(sectorPercents).toEqual({ Banking: 25, IT: 75 });
    expect(result.market.totalValue).toBe(400);
  });

  it("groups missing fields under 'Uncategorized'", () => {
    const assets: Asset[] = [
      a({ ticker: "X", sector: "",        marketValue: 50 }),
      a({ ticker: "Y", sector: "Banking", marketValue: 50 }),
    ];
    const sector = computeBreakdowns(assets).sector;
    const labels = sector.slices.map(s => s.label).sort();
    expect(labels).toEqual(["Banking", "Uncategorized"]);
  });

  it("ignores assets with zero or NaN marketValue", () => {
    const assets: Asset[] = [
      a({ ticker: "X", sector: "Banking", marketValue: 0 }),
      a({ ticker: "Y", sector: "IT",      marketValue: NaN }),
      a({ ticker: "Z", sector: "Banking", marketValue: 100 }),
    ];
    const sector = computeBreakdowns(assets).sector;
    expect(sector.slices).toHaveLength(1);
    expect(sector.slices[0].label).toBe("Banking");
  });

  it("returns empty slices for empty input", () => {
    const result = computeBreakdowns([]);
    expect(result.sector.slices).toEqual([]);
    expect(result.sector.totalValue).toBe(0);
  });

  it("sorts slices descending by value", () => {
    const assets: Asset[] = [
      a({ ticker: "A", sector: "Small", marketValue: 10 }),
      a({ ticker: "B", sector: "Big",   marketValue: 90 }),
    ];
    const labels = computeBreakdowns(assets).sector.slices.map(s => s.label);
    expect(labels).toEqual(["Big", "Small"]);
  });
});
