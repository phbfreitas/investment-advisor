import type { Asset } from "@/types";
import { computeDriftSignals } from "../computeDriftSignals";

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

describe("computeDriftSignals", () => {
  it("flags a single stock > 10% as red", () => {
    const assets = [
      a({ ticker: "AAPL", marketValue: 150 }),
      a({ ticker: "X", marketValue: 850 }),
    ];
    const sigs = computeDriftSignals(assets);
    const aapl = sigs.find(s => s.title.includes("AAPL"));
    expect(aapl?.severity).toBe("red");
  });

  it("flags a single stock between 5% and 10% as warning", () => {
    const assets = [
      a({ ticker: "AAPL", marketValue: 70 }),
      a({ ticker: "X", marketValue: 930 }),
    ];
    const sigs = computeDriftSignals(assets);
    expect(sigs.find(s => s.title.includes("AAPL"))?.severity).toBe("warning");
  });

  it("flags sector > 40% as red and 25-40% as warning", () => {
    const red = computeDriftSignals([
      a({ ticker: "X", sector: "Banking", marketValue: 500 }),
      a({ ticker: "Y", sector: "IT",      marketValue: 500 }),
    ]).find(s => s.title.includes("Banking"));
    expect(red?.severity).toBe("red");

    const warn = computeDriftSignals([
      a({ ticker: "X", sector: "Banking", marketValue: 300 }),
      a({ ticker: "Y", sector: "IT",      marketValue: 700 }),
    ]).find(s => s.title.includes("Banking"));
    expect(warn?.severity).toBe("warning");
  });

  it("flags region concentration > 70%", () => {
    const sigs = computeDriftSignals([
      a({ ticker: "X", market: "USA",    marketValue: 800 }),
      a({ ticker: "Y", market: "Canada", marketValue: 200 }),
    ]);
    const usa = sigs.find(s => s.title.toLowerCase().includes("usa"));
    expect(usa?.severity).toBe("warning");
  });

  it("flags non-base currency exposure > 30%", () => {
    const sigs = computeDriftSignals([
      a({ ticker: "X", currency: "USD", marketValue: 600 }),
      a({ ticker: "Y", currency: "CAD", marketValue: 400 }),
    ]);
    const cad = sigs.find(s => s.title.includes("CAD"));
    expect(cad?.severity).toBe("warning");
  });

  it("flags account skew > 80% as informational", () => {
    const sigs = computeDriftSignals([
      a({ ticker: "X", account: "TFSA", marketValue: 850 }),
      a({ ticker: "Y", account: "RRSP", marketValue: 150 }),
    ]);
    const skew = sigs.find(s => s.title.includes("TFSA"));
    expect(skew?.severity).toBe("info");
  });

  it("flags cash drag (defensive sectors > 40%) as informational", () => {
    const sigs = computeDriftSignals([
      a({ ticker: "X", sector: "Bond", marketValue: 500 }),
      a({ ticker: "Y", sector: "IT",   marketValue: 500 }),
    ]);
    const drag = sigs.find(s => s.title.toLowerCase().includes("defensive"));
    expect(drag?.severity).toBe("info");
  });

  it("returns empty for a well-diversified portfolio", () => {
    const assets = Array.from({ length: 25 }, (_, i) =>
      a({
        ticker: `T${i}`,
        sector: `S${i % 6}`,
        market: i % 2 === 0 ? "USA" : "Canada",
        currency: i % 4 !== 0 ? "USD" : "CAD",
        account: i % 3 === 0 ? "TFSA" : i % 3 === 1 ? "RRSP" : "Margin",
        marketValue: 40,
      })
    );
    const sigs = computeDriftSignals(assets);
    expect(sigs).toEqual([]);
  });

  it("sorts results red → warning → info", () => {
    const assets = [
      a({ ticker: "AAPL", marketValue: 150 }),                          // red (single stock 15%)
      a({ ticker: "X", sector: "Bond", marketValue: 425, currency: "EUR" }), // info + currency warning
      a({ ticker: "Y", sector: "IT",   marketValue: 425 }),
    ];
    const sigs = computeDriftSignals(assets);
    const order = sigs.map(s => s.severity);
    const reds = order.indexOf("red");
    const warns = order.indexOf("warning");
    const infos = order.indexOf("info");
    if (reds >= 0 && warns >= 0) expect(reds).toBeLessThan(warns);
    if (warns >= 0 && infos >= 0) expect(warns).toBeLessThan(infos);
  });

  it("attaches contributing assets to each signal", () => {
    const sigs = computeDriftSignals([
      a({ ticker: "AAPL", marketValue: 150 }),
      a({ ticker: "X", marketValue: 850 }),
    ]);
    const aapl = sigs.find(s => s.title.includes("AAPL"));
    expect(aapl?.contributors[0]).toMatchObject({ label: "AAPL" });
  });

  it("returns empty for empty input", () => {
    expect(computeDriftSignals([])).toEqual([]);
  });

  it("aggregates single-stock concentration across accounts (4%+4%+4%=12% red flag)", () => {
    const sigs = computeDriftSignals([
      a({ ticker: "AAPL", account: "TFSA",   marketValue: 40 }),
      a({ ticker: "AAPL", account: "RRSP",   marketValue: 40 }),
      a({ ticker: "AAPL", account: "Margin", marketValue: 40 }),
      a({ ticker: "OTHER", account: "TFSA",  marketValue: 880 }),
    ]);
    const aapl = sigs.find(s => s.title.includes("AAPL"));
    expect(aapl?.severity).toBe("red");
    // Combined 120/1000 = 12% of portfolio
    expect(aapl?.title).toContain("12");
    // Contributors should be 3 rows showing per-account breakdown
    expect(aapl?.contributors).toHaveLength(3);
    expect(aapl?.contributors[0].label).toMatch(/TFSA|RRSP|Margin/);
  });

  it("does not duplicate alerts when one ticker spans multiple accounts each above threshold", () => {
    const sigs = computeDriftSignals([
      a({ ticker: "AAPL", account: "TFSA", marketValue: 70 }),  // 7% alone
      a({ ticker: "AAPL", account: "RRSP", marketValue: 70 }),  // 7% alone, 14% combined
      a({ ticker: "X",                       marketValue: 860 }),
    ]);
    const aaplAlerts = sigs.filter(s => s.title.includes("AAPL"));
    expect(aaplAlerts).toHaveLength(1);
    expect(aaplAlerts[0].severity).toBe("red"); // 14% > 10% red threshold
  });

  it("treats single-row positions normally after aggregation refactor", () => {
    // Regression check: a 12% AAPL position in one account should still flag red, contributors=1
    const sigs = computeDriftSignals([
      a({ ticker: "AAPL", account: "TFSA", marketValue: 120 }),
      a({ ticker: "X",                       marketValue: 880 }),
    ]);
    const aapl = sigs.find(s => s.title.includes("AAPL"));
    expect(aapl?.severity).toBe("red");
    expect(aapl?.contributors).toHaveLength(1);
    // Single-row case uses just the ticker label, not "(account)"
    expect(aapl?.contributors[0].label).toBe("AAPL");
  });
});
