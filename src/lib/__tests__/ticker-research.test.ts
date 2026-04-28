import {
  classifyStrategyType,
} from "../ticker-research";

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
