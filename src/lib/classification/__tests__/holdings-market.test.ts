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
