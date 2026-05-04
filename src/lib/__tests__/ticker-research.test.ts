const mockYahooQuote = jest.fn();
const mockYahooQuoteSummary = jest.fn();
const mockClassifyMarketByHoldings = jest.fn();

jest.mock("yahoo-finance2", () => ({
  __esModule: true,
  default: class {
    quote = mockYahooQuote;
    quoteSummary = mockYahooQuoteSummary;
  },
}));

jest.mock("../classification/holdings-market", () => ({
  __esModule: true,
  classifyMarketByHoldings: mockClassifyMarketByHoldings,
  isClassificationExpired: jest.requireActual("../classification/holdings-market").isClassificationExpired,
}));

import { classifyStrategyType, researchTicker } from "../ticker-research";

describe("classifyStrategyType returns canonical labels", () => {
  it("returns 'Growth' for low-yield index fund", () => {
    expect(classifyStrategyType(0.01, 1.1, "S&P 500 index fund", "Fund", "VOO")).toBe("Growth");
  });
  it("returns 'Mix' for high-yield options fund", () => {
    expect(classifyStrategyType(0.10, 0.9, "covered call options strategy", "ETF", "JEPQ")).toBe("Mix");
  });
  it("returns 'Dividend' for moderate-yield, low-beta dividend stock", () => {
    expect(classifyStrategyType(0.04, 0.8, "dividend bank stock", "Company", "BAC")).toBe("Dividend");
  });
  it("falls back to 'Mix' for ambiguous", () => {
    expect(classifyStrategyType(0.04, 1.2, "tech growth", "Company", "AAPL")).toBe("Mix");
  });
});

// Build a baseline Yahoo response that resolves an ETF on a US exchange with
// market = "Not Found" (the trigger for the new classifier path).
function mockEtfResponses() {
  mockYahooQuote.mockResolvedValue({
    quoteType: "ETF",
    exchange: "PCX",  // not in US_EXCHANGES set in normalizeMarket → returns Not Found for ETFs
    regularMarketPrice: 100,
    currency: "USD",
    shortName: "Test ETF",
  });
  mockYahooQuoteSummary.mockImplementation(async (_sym: string, opts: any) => {
    if (opts?.modules?.includes("summaryDetail")) {
      return {
        summaryDetail: { dividendYield: 0.02, managementFee: null },
        assetProfile: { longBusinessSummary: "" },
        fundProfile: {},
        defaultKeyStatistics: { beta: 1.0 },
        recommendationTrend: { trend: [{ recommendationMean: "Buy" }] },
      };
    }
    return {};
  });
}

describe("researchTicker orchestration — 3C classifier integration", () => {
  beforeEach(() => {
    mockYahooQuote.mockReset();
    mockYahooQuoteSummary.mockReset();
    mockClassifyMarketByHoldings.mockReset();
  });

  it("ETF with no existingAsset → calls classifier; returns fresh marketComputedAt", async () => {
    mockEtfResponses();
    mockClassifyMarketByHoldings.mockResolvedValue("USA");

    const result = await researchTicker("VOO");

    expect(mockClassifyMarketByHoldings).toHaveBeenCalledWith("VOO", 0);
    expect(result?.market).toBe("USA");
    expect(typeof result?.marketComputedAt).toBe("string");
    expect(Date.parse(result!.marketComputedAt as string)).toBeGreaterThan(Date.now() - 5000);
  });

  it("ETF with fresh marketComputedAt (< 365 days) → classifier skipped, prior market preserved", async () => {
    mockEtfResponses();
    mockClassifyMarketByHoldings.mockResolvedValue("USA");
    const fresh = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();

    const result = await researchTicker("VOO", {
      userOverrides: undefined,
      marketComputedAt: fresh,
      market: "USA",  // previously classified
    });

    expect(mockClassifyMarketByHoldings).not.toHaveBeenCalled();
    expect(result?.market).toBe("USA");           // preserved, NOT downgraded to Not Found
    expect(result?.marketComputedAt).toBe(fresh);
  });

  it("ETF with expired marketComputedAt (> 365 days) → classifier runs", async () => {
    mockEtfResponses();
    mockClassifyMarketByHoldings.mockResolvedValue("USA");
    const stale = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString();

    const result = await researchTicker("VOO", {
      userOverrides: undefined,
      marketComputedAt: stale,
      market: "USA",
    });

    expect(mockClassifyMarketByHoldings).toHaveBeenCalledWith("VOO", 0);
    expect(result?.market).toBe("USA");
    expect(result?.marketComputedAt).not.toBe(stale);
  });

  it("ETF with userOverrides.market === true → classifier skipped, manual market preserved", async () => {
    mockEtfResponses();
    mockClassifyMarketByHoldings.mockResolvedValue("USA");
    const stale = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString();

    const result = await researchTicker("VOO", {
      userOverrides: { market: true },
      marketComputedAt: stale,
      market: "Canada",  // user manually set to Canada
    });

    expect(mockClassifyMarketByHoldings).not.toHaveBeenCalled();
    expect(result?.market).toBe("Canada");        // manual value preserved
    expect(result?.marketComputedAt).toBe(stale);
  });

  it("Codex adversarial review #1 — ETF with no prior classified market still returns Not Found on fresh cache hit", async () => {
    // The preservation guard requires a non-Not-Found prior market. If the
    // asset was somehow saved with a fresh marketComputedAt but market="Not Found"
    // (e.g., classifier returned Not Found legitimately, like a Total World fund),
    // the fresh cache should still suppress reclassification but the result should
    // remain "Not Found" — there's no real prior value to preserve.
    mockEtfResponses();
    mockClassifyMarketByHoldings.mockResolvedValue("USA");
    const fresh = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();

    const result = await researchTicker("VT", {
      userOverrides: undefined,
      marketComputedAt: fresh,
      market: "Not Found",  // legitimately unclassified before
    });

    expect(mockClassifyMarketByHoldings).not.toHaveBeenCalled();
    expect(result?.market).toBe("Not Found");
    expect(result?.marketComputedAt).toBe(fresh);
  });

  it("Company (non-ETF/Fund) → classifier never runs", async () => {
    mockYahooQuote.mockResolvedValue({
      quoteType: "EQUITY",
      exchange: "NYQ",
      regularMarketPrice: 150,
      currency: "USD",
      shortName: "Apple",
    });
    mockYahooQuoteSummary.mockResolvedValue({
      summaryDetail: { dividendYield: 0.005 },
      assetProfile: { longBusinessSummary: "Apple makes phones." },
      fundProfile: {},
      defaultKeyStatistics: { beta: 1.2 },
      recommendationTrend: { trend: [{ recommendationMean: "Buy" }] },
    });
    mockClassifyMarketByHoldings.mockResolvedValue("USA");

    const result = await researchTicker("AAPL");

    expect(mockClassifyMarketByHoldings).not.toHaveBeenCalled();
    expect(result?.market).toBe("USA");
  });

  it("Codex round-2 #2 — classifier returning Not Found does NOT stamp marketComputedAt", async () => {
    // Transient Yahoo failure: classifier returns "Not Found". The cache
    // timestamp must NOT be refreshed, so the next refresh retries.
    mockEtfResponses();
    mockClassifyMarketByHoldings.mockResolvedValue("Not Found");

    const result = await researchTicker("VOO");

    expect(mockClassifyMarketByHoldings).toHaveBeenCalledWith("VOO", 0);
    expect(result?.market).toBe("Not Found");
    // marketComputedAt should be null (no existingAsset to echo from), NOT a fresh ISO timestamp.
    expect(result?.marketComputedAt).toBeNull();
  });

  it("Codex round-2 #2 — successful classification still stamps marketComputedAt", async () => {
    // Sanity check: when the classifier returns a real bucket, the
    // timestamp DOES update (existing behavior, not regressed by Fix #2).
    mockEtfResponses();
    mockClassifyMarketByHoldings.mockResolvedValue("USA");

    const result = await researchTicker("VOO");

    expect(result?.market).toBe("USA");
    expect(typeof result?.marketComputedAt).toBe("string");
    expect(Date.parse(result!.marketComputedAt as string)).toBeGreaterThan(Date.now() - 5000);
  });
});

describe("exchange routing", () => {
  beforeEach(() => {
    mockYahooQuote.mockReset();
    mockYahooQuoteSummary.mockReset();
    mockClassifyMarketByHoldings.mockReset();
    // Default quoteSummary stub — avoids TypeError inside researchTicker
    mockYahooQuoteSummary.mockResolvedValue({
      summaryDetail: { dividendYield: 0.02, managementFee: null },
      assetProfile: { longBusinessSummary: "" },
      fundProfile: {},
      defaultKeyStatistics: { beta: 1.0 },
      recommendationTrend: { trend: [{ recommendationMean: "Buy" }] },
    });
  });

  it("uses stored exchangeSuffix when exchange is locked", async () => {
    mockYahooQuote.mockResolvedValue({
      regularMarketPrice: 26.56,
      currency: "CAD",
      exchange: "NEO",
      fullExchangeName: "Cboe Canada",
      quoteType: "ETF",
      shortName: "JPMorgan NASDAQ Active ETF",
    });

    const result = await researchTicker("JEPQ", {
      userOverrides: { exchange: true },
      exchangeSuffix: ".NE",
      currency: "CAD",
      market: "Canada",
      marketComputedAt: null,
    });

    // Should have called Yahoo with JEPQ.NE
    expect(mockYahooQuote).toHaveBeenCalledWith("JEPQ.NE");
    expect(result?.exchangeSuffix).toBe(".NE");
    expect(result?.exchangeName).toBe("Cboe Canada");
    expect(result?.currencyMismatch).toBeUndefined();
  });

  it("sets currencyMismatch when Yahoo returns different currency than stored", async () => {
    mockYahooQuote.mockResolvedValue({
      regularMarketPrice: 55.52,
      currency: "USD",
      exchange: "NMS",
      fullExchangeName: "Nasdaq",
      quoteType: "ETF",
      shortName: "JPMorgan NASDAQ ETF",
    });

    const result = await researchTicker("JEPQ", {
      userOverrides: {},
      exchangeSuffix: "",
      currency: "CAD",
      market: "Not Found",
      marketComputedAt: null,
    });

    expect(result?.currencyMismatch).toBe(true);
    expect(result?.detectedCurrency).toBe("USD");
    expect(result?.exchangeSuffix).toBe("");
    expect(result?.exchangeName).toBe("Nasdaq");
  });

  it("does not set currencyMismatch when currencies match", async () => {
    mockYahooQuote.mockResolvedValue({
      regularMarketPrice: 55.52,
      currency: "USD",
      exchange: "NMS",
      fullExchangeName: "Nasdaq",
      quoteType: "ETF",
      shortName: "JPMorgan NASDAQ ETF",
    });

    const result = await researchTicker("JEPQ", {
      userOverrides: {},
      exchangeSuffix: "",
      currency: "USD",
      market: "USA",
      marketComputedAt: null,
    });

    expect(result?.currencyMismatch).toBeUndefined();
  });

  it("does not set currencyMismatch due to case differences in stored currency", async () => {
    // Simulate stored currency being lowercase "usd" (not normalised at write time)
    // Yahoo returns "USD" — these should be treated as matching
    mockYahooQuote.mockResolvedValueOnce({
      regularMarketPrice: 55.52,
      currency: "USD",
      exchange: "NMS",
      fullExchangeName: "Nasdaq",
      quoteType: "ETF",
      shortName: "Test ETF",
      summaryDetail: {},
    });

    const result = await researchTicker("TEST", {
      userOverrides: {},
      exchangeSuffix: "",
      currency: "usd",  // lowercase — not normalised
      market: "USA",
      marketComputedAt: null,
    });

    expect(result?.currencyMismatch).toBeUndefined();
  });
});
