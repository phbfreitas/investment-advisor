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

import {
  normalizeStrategyType,
  normalizeSecurityType,
  normalizeCall,
  normalizeManagementStyle,
} from "../allowlists";

describe("normalizeStrategyType", () => {
  it("returns canonical when input is canonical", () => {
    expect(normalizeStrategyType("Dividend")).toBe("Dividend");
    expect(normalizeStrategyType("Growth")).toBe("Growth");
    expect(normalizeStrategyType("Mix")).toBe("Mix");
  });
  it("matches case-insensitively", () => {
    expect(normalizeStrategyType("dividend")).toBe("Dividend");
    expect(normalizeStrategyType("MIX")).toBe("Mix");
  });
  it("maps legacy 'Pure X' / 'The Mix' labels to canonical", () => {
    expect(normalizeStrategyType("Pure Dividend")).toBe("Dividend");
    expect(normalizeStrategyType("Pure Growth")).toBe("Growth");
    expect(normalizeStrategyType("The Mix")).toBe("Mix");
  });
  it("returns Not Found for unknown / null / empty", () => {
    expect(normalizeStrategyType("ecnquote")).toBe("Not Found");
    expect(normalizeStrategyType(null)).toBe("Not Found");
    expect(normalizeStrategyType(undefined)).toBe("Not Found");
    expect(normalizeStrategyType("")).toBe("Not Found");
  });
});

describe("normalizeSecurityType", () => {
  it("returns canonical when input is canonical", () => {
    expect(normalizeSecurityType("Company")).toBe("Company");
    expect(normalizeSecurityType("ETF")).toBe("ETF");
    expect(normalizeSecurityType("Fund")).toBe("Fund");
  });
  it("maps Yahoo quoteType enums to canonical", () => {
    expect(normalizeSecurityType("EQUITY")).toBe("Company");
    expect(normalizeSecurityType("CLOSED_END_FUND")).toBe("Company");
    expect(normalizeSecurityType("MUTUALFUND")).toBe("Fund");
    expect(normalizeSecurityType("ETF")).toBe("ETF");
  });
  it("returns Not Found for ecnquote / unknown / null", () => {
    expect(normalizeSecurityType("ecnquote")).toBe("Not Found");
    expect(normalizeSecurityType("INDEX")).toBe("Not Found");
    expect(normalizeSecurityType(null)).toBe("Not Found");
  });
});

describe("normalizeCall", () => {
  it("returns Yes/No when canonical (case-insensitive)", () => {
    expect(normalizeCall("Yes")).toBe("Yes");
    expect(normalizeCall("yes")).toBe("Yes");
    expect(normalizeCall("No")).toBe("No");
    expect(normalizeCall("NO")).toBe("No");
  });
  it("defaults to No for unknown / null / empty", () => {
    expect(normalizeCall("maybe")).toBe("No");
    expect(normalizeCall(null)).toBe("No");
    expect(normalizeCall("")).toBe("No");
  });
});

describe("normalizeManagementStyle", () => {
  it("returns canonical when input is canonical (case-insensitive)", () => {
    expect(normalizeManagementStyle("Active")).toBe("Active");
    expect(normalizeManagementStyle("passive")).toBe("Passive");
    expect(normalizeManagementStyle("N/A")).toBe("N/A");
    expect(normalizeManagementStyle("n/a")).toBe("N/A");
  });
  it("returns N/A for unknown / null / empty", () => {
    expect(normalizeManagementStyle("Hybrid")).toBe("N/A");
    expect(normalizeManagementStyle(null)).toBe("N/A");
    expect(normalizeManagementStyle("")).toBe("N/A");
  });
});
