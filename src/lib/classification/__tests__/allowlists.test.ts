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

import { normalizeSector } from "../allowlists";

describe("normalizeSector consolidation", () => {
  const cases: Array<[string, string]> = [
    // Financials
    ["Banking", "Financials"],
    ["Bank", "Financials"],
    ["Financial Services", "Financials"],
    ["Financials", "Financials"],
    ["Insurance", "Financials"],
    // Healthcare
    ["Healthcare", "Healthcare"],
    ["Health Care", "Healthcare"],
    ["Pharmaceutical", "Healthcare"],
    ["Biotechnology", "Healthcare"],
    // IT
    ["Technology", "IT"],
    ["IT", "IT"],
    ["Information Technology", "IT"],
    ["Software", "IT"],
    ["Semiconductor", "IT"],
    ["Tech", "IT"],
    // Energy
    ["Energy", "Energy"],
    ["Oil", "Energy"],
    ["Gas", "Energy"],
    ["Renewable", "Energy"],
    // Real Estate
    ["Real Estate", "Real Estate"],
    ["REIT", "Real Estate"],
    ["Realty", "Real Estate"],
    // Consumer Discretionary
    ["Consumer Discretionary", "Consumer Discretionary"],
    ["Consumer Cyclical", "Consumer Discretionary"],
    ["Cyclical", "Consumer Discretionary"],
    ["Retail", "Consumer Discretionary"],
    // Consumer Staples
    ["Consumer Staples", "Consumer Staples"],
    ["Consumer Defensive", "Consumer Staples"],
    ["Defensive", "Consumer Staples"],
    // Materials
    ["Mining", "Materials"],
    ["Gold", "Materials"],
    ["Precious Metals", "Materials"],
    ["Materials", "Materials"],
    ["Basic Materials", "Materials"],
    // Industrials
    ["Industrials", "Industrials"],
    ["Industrial", "Industrials"],
    // Communication
    ["Communication", "Communication"],
    ["Communication Services", "Communication"],
    ["Telecom", "Communication"],
    // Utilities
    ["Utilities", "Utilities"],
    ["Utility", "Utilities"],
    // Diversified
    ["Mix", "Diversified"],
    ["Diversified", "Diversified"],
    ["Multi-sector", "Diversified"],
  ];

  it.each(cases)("maps %s to %s", (raw, expected) => {
    expect(normalizeSector(raw)).toBe(expected);
  });

  it("defaults plain 'Consumer' (no qualifier) to Consumer Discretionary", () => {
    expect(normalizeSector("Consumer")).toBe("Consumer Discretionary");
  });

  it("returns Not Found for Global, Other, unknown, null, empty", () => {
    expect(normalizeSector("Global")).toBe("Not Found");
    expect(normalizeSector("Other")).toBe("Not Found");
    expect(normalizeSector("Random Garbage")).toBe("Not Found");
    expect(normalizeSector(null)).toBe("Not Found");
    expect(normalizeSector("")).toBe("Not Found");
  });

  it("matches case-insensitively", () => {
    expect(normalizeSector("banking")).toBe("Financials");
    expect(normalizeSector("CONSUMER STAPLES")).toBe("Consumer Staples");
  });
});

import { normalizeMarket } from "../allowlists";

describe("normalizeMarket", () => {
  it("passes through canonical values", () => {
    expect(normalizeMarket("USA")).toBe("USA");
    expect(normalizeMarket("Canada")).toBe("Canada");
    expect(normalizeMarket("North America")).toBe("North America");
    expect(normalizeMarket("Global")).toBe("Global");
  });

  it("maps Yahoo US exchange codes to USA", () => {
    expect(normalizeMarket("NYQ")).toBe("USA");
    expect(normalizeMarket("NMS")).toBe("USA");
    expect(normalizeMarket("NCM")).toBe("USA");
    expect(normalizeMarket("NGM")).toBe("USA");
    expect(normalizeMarket("ASE")).toBe("USA");
    expect(normalizeMarket("PCX")).toBe("USA");
    expect(normalizeMarket("BATS")).toBe("USA");
  });

  it("maps Canadian exchange codes to Canada", () => {
    expect(normalizeMarket("TOR")).toBe("Canada");
    expect(normalizeMarket("VAN")).toBe("Canada");
    expect(normalizeMarket("CVE")).toBe("Canada");
    expect(normalizeMarket("NEO")).toBe("Canada");
  });

  it("returns Global for non-NA exchanges", () => {
    expect(normalizeMarket("LSE")).toBe("Global");
    expect(normalizeMarket("FRA")).toBe("Global");
    expect(normalizeMarket("HKG")).toBe("Global");
  });

  it("returns Not Found for empty/null", () => {
    expect(normalizeMarket(null)).toBe("Not Found");
    expect(normalizeMarket("")).toBe("Not Found");
  });

  it("for ETF/Fund types, defaults to Not Found regardless of exchange", () => {
    expect(normalizeMarket("NYQ", "ETF")).toBe("Not Found");
    expect(normalizeMarket("TOR", "Fund")).toBe("Not Found");
  });

  it("passes canonical values through even for ETF/Fund securityType", () => {
    expect(normalizeMarket("Global", "ETF")).toBe("Global");
    expect(normalizeMarket("USA", "Fund")).toBe("USA");
    expect(normalizeMarket("North America", "MUTUALFUND")).toBe("North America");
  });

  it("for Company type, uses exchange-based mapping", () => {
    expect(normalizeMarket("NYQ", "Company")).toBe("USA");
    expect(normalizeMarket("TOR", "Company")).toBe("Canada");
  });
});
