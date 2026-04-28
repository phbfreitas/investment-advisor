import type { Asset } from "@/types";
import { computeBreakdowns } from "../computeBreakdowns";

const a = (overrides: Partial<Asset>): Asset => ({
  PK: "", SK: "", id: "", profileId: "", type: "ASSET",
  account: "", ticker: "", securityType: "", strategyType: "",
  call: "", sector: "", market: "", currency: "USD",
  managementStyle: "", externalRating: "", managementFee: null,
  quantity: 0, liveTickerPrice: 0, bookCost: 0, marketValue: 0,
  profitLoss: 0, yield: null, oneYearReturn: null, fiveYearReturn: null,
  threeYearReturn: null, exDividendDate: "", analystConsensus: "",
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

  it("rolls up slices below 5% into 'Others'", () => {
    const assets = [
      a({ ticker: "X", sector: "Big",   marketValue: 920 }), // 92%
      a({ ticker: "Y", sector: "Tiny1", marketValue: 30 }),  // 3% — should roll up
      a({ ticker: "Z", sector: "Tiny2", marketValue: 30 }),  // 3% — should roll up
      a({ ticker: "W", sector: "Tiny3", marketValue: 20 }),  // 2% — should roll up
    ]; // total = 1000
    const result = computeBreakdowns(assets).sector;
    expect(result.slices.map(s => s.label)).toEqual(["Big", "Others"]);
    const others = result.slices.find(s => s.label === "Others")!;
    expect(others.value).toBe(80);
    expect(others.percent).toBeCloseTo(8, 5);
  });

  it("preserves Not Found slices (does not silently filter them)", () => {
    const assets: Asset[] = [
      a({ ticker: "X", sector: "Financials", marketValue: 100 }),
      a({ ticker: "Y", sector: "Not Found", marketValue: 50 }),
      a({ ticker: "Z", sector: "IT", marketValue: 50 }),
    ];
    const result = computeBreakdowns(assets);
    const labels = result.sector.slices.map(s => s.label);
    expect(labels).toContain("Not Found");
    const notFound = result.sector.slices.find(s => s.label === "Not Found");
    expect(notFound?.value).toBe(50);
    expect(notFound?.percent).toBe(25);
  });

  it("renders Not Found slice even if it would be < 5% (does not roll into Others)", () => {
    const assets: Asset[] = [
      a({ ticker: "A", sector: "Financials", marketValue: 1000 }),
      a({ ticker: "B", sector: "Not Found",  marketValue: 30 }),
    ];
    const result = computeBreakdowns(assets);
    const labels = result.sector.slices.map(s => s.label);
    expect(labels).toContain("Not Found"); // even though < 5%
  });
});
