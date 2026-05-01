const mockQuoteSummary = jest.fn();
const mockQuote = jest.fn();

jest.mock("yahoo-finance2", () => ({
  __esModule: true,
  default: class {
    quoteSummary = mockQuoteSummary;
    quote = mockQuote;
  },
}));

import { classifyMarketByHoldings } from "../holdings-market";

// Helper: build a mock quoteSummary response.
function holdingsFor(symbols: string[], category = "Large Blend") {
  return {
    topHoldings: { holdings: symbols.map(s => ({ symbol: s, holdingName: s, holdingPercent: 0.05 })) },
    price: { shortName: "Mocked Fund", longName: "Mocked Fund Long" },
    fundProfile: { categoryName: category },
  };
}

// Helper: build a mock batch quote response treating every symbol as a stock.
function stocksFor(symbols: string[]) {
  return symbols.map(s => ({ symbol: s, quoteType: "EQUITY" as const }));
}

describe("classifyMarketByHoldings — stocks-only happy paths", () => {
  beforeEach(() => {
    mockQuoteSummary.mockReset();
    mockQuote.mockReset();
  });

  it("returns USA when all top-10 holdings have no suffix or .US", async () => {
    mockQuoteSummary.mockResolvedValue(holdingsFor(["AAPL", "MSFT", "NVDA", "AMZN"]));
    mockQuote.mockResolvedValue(stocksFor(["AAPL", "MSFT", "NVDA", "AMZN"]));

    expect(await classifyMarketByHoldings("VOO", 0)).toBe("USA");
  });

  it("returns Canada when all top-10 are .TO/.V/.NE/.CN", async () => {
    mockQuoteSummary.mockResolvedValue(holdingsFor(["RY.TO", "TD.TO", "ENB.TO", "BNS.TO"]));
    mockQuote.mockResolvedValue(stocksFor(["RY.TO", "TD.TO", "ENB.TO", "BNS.TO"]));

    expect(await classifyMarketByHoldings("XIU.TO", 0)).toBe("Canada");
  });

  it("returns North America when top-10 mixes US and Canadian holdings", async () => {
    mockQuoteSummary.mockResolvedValue(holdingsFor(["AAPL", "MSFT", "RY.TO", "TD.TO"]));
    mockQuote.mockResolvedValue(stocksFor(["AAPL", "MSFT", "RY.TO", "TD.TO"]));

    expect(await classifyMarketByHoldings("ZNA.TO", 0)).toBe("North America");
  });

  it("returns Global when any top-10 holding is on a non-NA exchange (.L)", async () => {
    mockQuoteSummary.mockResolvedValue(holdingsFor(["AAPL", "MSFT", "BARC.L", "HSBA.L"]));
    mockQuote.mockResolvedValue(stocksFor(["AAPL", "MSFT", "BARC.L", "HSBA.L"]));

    expect(await classifyMarketByHoldings("VT", 0)).toBe("Global");
  });

  it("returns Not Found when topHoldings is empty", async () => {
    mockQuoteSummary.mockResolvedValue({
      topHoldings: { holdings: [] },
      price: { shortName: "X", longName: "X" },
      fundProfile: { categoryName: "Large Blend" },
    });

    expect(await classifyMarketByHoldings("XYZ", 0)).toBe("Not Found");
  });
});

describe("classifyMarketByHoldings — name/category guard", () => {
  beforeEach(() => {
    mockQuoteSummary.mockReset();
    mockQuote.mockReset();
  });

  it("returns Not Found when fund name contains 'World' even if top-10 is all-US", async () => {
    mockQuoteSummary.mockResolvedValue({
      topHoldings: { holdings: [{ symbol: "AAPL", holdingName: "Apple", holdingPercent: 0.07 }] },
      price: { shortName: "Vanguard Total World", longName: "Vanguard Total World ETF" },
      fundProfile: { categoryName: "Large Blend" },
    });
    mockQuote.mockResolvedValue(stocksFor(["AAPL"]));

    expect(await classifyMarketByHoldings("VT", 0)).toBe("Not Found");
  });

  it("returns Not Found when category contains 'Foreign Large Blend'", async () => {
    mockQuoteSummary.mockResolvedValue({
      topHoldings: { holdings: [{ symbol: "AAPL", holdingName: "Apple", holdingPercent: 0.07 }] },
      price: { shortName: "Mocked", longName: "Mocked Fund" },
      fundProfile: { categoryName: "Foreign Large Blend" },
    });
    mockQuote.mockResolvedValue(stocksFor(["AAPL"]));

    expect(await classifyMarketByHoldings("VEA", 0)).toBe("Not Found");
  });

  it("returns Not Found when name contains 'Emerging Markets'", async () => {
    mockQuoteSummary.mockResolvedValue({
      topHoldings: { holdings: [{ symbol: "TSM", holdingName: "TSMC", holdingPercent: 0.06 }] },
      price: { shortName: "Vanguard Emerging Markets", longName: "Vanguard FTSE Emerging Markets ETF" },
      fundProfile: { categoryName: "Diversified Emerging Markets" },
    });
    mockQuote.mockResolvedValue(stocksFor(["TSM"]));

    expect(await classifyMarketByHoldings("VWO", 0)).toBe("Not Found");
  });

  it("guard does NOT fire at depth > 0 (sub-fund classified by its own holdings)", async () => {
    // A 'World'-named sub-fund encountered during recursion should classify by
    // its top-10 holdings, not be killed by the guard. Verified once recursion
    // is wired in Task 4 — for now we just confirm the guard checks depth.
    mockQuoteSummary.mockResolvedValue({
      topHoldings: { holdings: [{ symbol: "AAPL", holdingName: "Apple", holdingPercent: 0.07 }] },
      price: { shortName: "Sub World Fund", longName: "Sub World Fund" },
      fundProfile: { categoryName: "Large Blend" },
    });
    mockQuote.mockResolvedValue(stocksFor(["AAPL"]));

    expect(await classifyMarketByHoldings("SUBW", 1)).toBe("USA");
  });
});

describe("classifyMarketByHoldings — sub-fund recursion", () => {
  beforeEach(() => {
    mockQuoteSummary.mockReset();
    mockQuote.mockReset();
  });

  it("recurses one level when top-10 contains ETFs", async () => {
    // VBAL.TO holds VTI (US-stock ETF) and VAB.TO (CA-bond ETF).
    mockQuoteSummary
      // First call: VBAL.TO fetched at depth=0
      .mockResolvedValueOnce({
        topHoldings: { holdings: [
          { symbol: "VTI", holdingName: "Vanguard US", holdingPercent: 0.5 },
          { symbol: "VAB.TO", holdingName: "Vanguard CA Bonds", holdingPercent: 0.5 },
        ]},
        price: { shortName: "Vanguard Balanced", longName: "Vanguard Balanced ETF Portfolio" },
        fundProfile: { categoryName: "Allocation--40% to 60% Equity" },
      })
      // Second call: VTI fetched recursively at depth=1
      .mockResolvedValueOnce({
        topHoldings: { holdings: [
          { symbol: "AAPL", holdingName: "Apple", holdingPercent: 0.07 },
          { symbol: "MSFT", holdingName: "Microsoft", holdingPercent: 0.06 },
        ]},
        price: { shortName: "Vanguard Total US", longName: "Vanguard Total Stock Market ETF" },
        fundProfile: { categoryName: "Large Blend" },
      })
      // Third call: VAB.TO fetched recursively at depth=1
      .mockResolvedValueOnce({
        topHoldings: { holdings: [
          { symbol: "GOC.TO", holdingName: "Govt of Canada", holdingPercent: 0.1 },
          { symbol: "TD.TO", holdingName: "TD Corp Bond", holdingPercent: 0.05 },
        ]},
        price: { shortName: "Vanguard CA Bond", longName: "Vanguard Canadian Aggregate Bond" },
        fundProfile: { categoryName: "Canadian Fixed Income" },
      });

    mockQuote
      // batch quote for VBAL.TO's top-10
      .mockResolvedValueOnce([
        { symbol: "VTI", quoteType: "ETF" },
        { symbol: "VAB.TO", quoteType: "ETF" },
      ])
      // batch quote for VTI's top-10 (stocks)
      .mockResolvedValueOnce([
        { symbol: "AAPL", quoteType: "EQUITY" },
        { symbol: "MSFT", quoteType: "EQUITY" },
      ])
      // batch quote for VAB.TO's top-10 (stocks/bonds — quoteType irrelevant for suffix)
      .mockResolvedValueOnce([
        { symbol: "GOC.TO", quoteType: "EQUITY" },
        { symbol: "TD.TO", quoteType: "EQUITY" },
      ]);

    // VBAL holds a US fund (USA) and a Canadian fund (Canada) → North America
    expect(await classifyMarketByHoldings("VBAL.TO", 0)).toBe("North America");
  });

  it("VEQT-style global all-equity classifies as Global, not North America", async () => {
    // Regression test for spec self-review bug: suffix-first would have
    // returned "North America" because all sub-ETFs are .TO-suffixed.
    // The fix recurses INTO each sub-ETF and discovers VIU.TO holds
    // international stocks (.L, .DE) → contributes "Other" → parent = Global.
    mockQuoteSummary
      // VEQT.TO at depth=0
      .mockResolvedValueOnce({
        topHoldings: { holdings: [
          { symbol: "VTI", holdingName: "VTI", holdingPercent: 0.45 },
          { symbol: "VCN.TO", holdingName: "VCN", holdingPercent: 0.30 },
          { symbol: "VIU.TO", holdingName: "VIU", holdingPercent: 0.20 },
          { symbol: "VEE.TO", holdingName: "VEE", holdingPercent: 0.05 },
        ]},
        price: { shortName: "Vanguard All-Equity", longName: "Vanguard All-Equity ETF Portfolio" },
        fundProfile: { categoryName: "Allocation--85% to 100% Equity" },
      })
      // VTI recursion → classifies as USA
      .mockResolvedValueOnce({
        topHoldings: { holdings: [{ symbol: "AAPL", holdingName: "Apple", holdingPercent: 0.07 }] },
        price: { shortName: "Vanguard US", longName: "Vanguard Total Stock Market" },
        fundProfile: { categoryName: "Large Blend" },
      })
      // VCN.TO recursion → classifies as Canada
      .mockResolvedValueOnce({
        topHoldings: { holdings: [{ symbol: "RY.TO", holdingName: "Royal Bank", holdingPercent: 0.07 }] },
        price: { shortName: "Vanguard Canada", longName: "Vanguard FTSE Canada All Cap" },
        fundProfile: { categoryName: "Canada Equity" },
      })
      // VIU.TO recursion → classifies as Global (London + Frankfurt holdings)
      .mockResolvedValueOnce({
        topHoldings: { holdings: [
          { symbol: "BARC.L", holdingName: "Barclays", holdingPercent: 0.02 },
          { symbol: "SAP.DE", holdingName: "SAP", holdingPercent: 0.02 },
        ]},
        price: { shortName: "Vanguard FTSE Developed", longName: "Vanguard FTSE Developed All Cap" },
        fundProfile: { categoryName: "International" },
      })
      // VEE.TO recursion → classifies as Global
      .mockResolvedValueOnce({
        topHoldings: { holdings: [{ symbol: "TSM", holdingName: "TSMC", holdingPercent: 0.06 }] },
        price: { shortName: "Vanguard Emerging", longName: "Vanguard Emerging Markets" },
        fundProfile: { categoryName: "Emerging" },
      });

    mockQuote
      // VEQT batch
      .mockResolvedValueOnce([
        { symbol: "VTI", quoteType: "ETF" },
        { symbol: "VCN.TO", quoteType: "ETF" },
        { symbol: "VIU.TO", quoteType: "ETF" },
        { symbol: "VEE.TO", quoteType: "ETF" },
      ])
      // VTI batch
      .mockResolvedValueOnce([{ symbol: "AAPL", quoteType: "EQUITY" }])
      // VCN.TO batch
      .mockResolvedValueOnce([{ symbol: "RY.TO", quoteType: "EQUITY" }])
      // VIU.TO batch
      .mockResolvedValueOnce([
        { symbol: "BARC.L", quoteType: "EQUITY" },
        { symbol: "SAP.DE", quoteType: "EQUITY" },
      ])
      // VEE.TO batch
      .mockResolvedValueOnce([{ symbol: "TSM", quoteType: "EQUITY" }]);

    // Note: VIU and VEE recurse but their PARENT fund names contain
    // guard tokens — but guard only fires at depth=0, so during recursion
    // they classify by holdings: VIU's stocks → "Other" → Global; VEE's
    // TSM (no suffix) → USA but TSM is unrecognized — actually TSM has
    // no suffix in our mock so it resolves as USA. Adjust expectation:
    // VEQT receives USA (VTI), Canada (VCN), Global (VIU), USA (VEE) →
    // hasUS && hasCA && hasOther → Global.
    expect(await classifyMarketByHoldings("VEQT.TO", 0)).toBe("Global");
  });

  it("does not recurse beyond depth=1", async () => {
    // Depth=2 returns Not Found immediately.
    expect(await classifyMarketByHoldings("ANY", 2)).toBe("Not Found");
    expect(mockQuoteSummary).not.toHaveBeenCalled();
  });

  it("falls back to suffix when sub-fund classification returns Not Found", async () => {
    // Parent's top-10 = one ETF whose own classification returns Not Found
    // (empty top-10). Should fall through to suffix → "Canada" (.TO).
    mockQuoteSummary
      .mockResolvedValueOnce({
        topHoldings: { holdings: [{ symbol: "VEE.TO", holdingName: "Emerging", holdingPercent: 1.0 }]},
        price: { shortName: "Test Parent", longName: "Test Parent ETF" },
        fundProfile: { categoryName: "Allocation" },
      })
      // VEE.TO recursion at depth=1: empty holdings → Not Found.
      // (The depth-only guard from Task 3 doesn't fire at depth>0, so we
      // use empty topHoldings to force Not Found from the recursive call.)
      .mockResolvedValueOnce({
        topHoldings: { holdings: [] },
        price: { shortName: "Vanguard Emerging", longName: "Vanguard FTSE Emerging Markets" },
        fundProfile: { categoryName: "Emerging Markets" },
      });

    mockQuote.mockResolvedValueOnce([{ symbol: "VEE.TO", quoteType: "ETF" }]);

    // After recursion fallback: VEE.TO suffix → Canada → parent = Canada
    expect(await classifyMarketByHoldings("TESTPARENT.TO", 0)).toBe("Canada");
  });
});
