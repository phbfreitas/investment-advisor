import {
  STRATEGY_TYPES,
  SECURITY_TYPES,
  CALL_VALUES,
  SECTOR_VALUES,
  MARKET_VALUES,
  CANONICAL_CURRENCIES,
  MGMT_STYLES,
  NOT_FOUND,
} from "../allowlists";

describe("allowlists barrel", () => {
  it("exposes the canonical category values", () => {
    expect(NOT_FOUND).toBe("Not Found");
    expect(STRATEGY_TYPES).toEqual(["Dividend", "Growth", "Mix", "Not Found"]);
    expect(SECURITY_TYPES).toEqual(["Company", "ETF", "Fund", "Not Found"]);
    expect(CALL_VALUES).toEqual(["Yes", "No"]);
    expect(SECTOR_VALUES).toEqual([
      "Financials", "Healthcare", "IT", "Energy", "Real Estate",
      "Consumer Discretionary", "Consumer Staples", "Materials",
      "Industrials", "Communication", "Utilities", "Diversified",
      "Not Found",
    ]);
    expect(MARKET_VALUES).toEqual(["USA", "Canada", "North America", "Global", "Not Found"]);
    expect(CANONICAL_CURRENCIES).toEqual(["USD", "CAD"]);
    expect(MGMT_STYLES).toEqual(["Active", "Passive", "N/A"]);
  });
});
