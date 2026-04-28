export const NOT_FOUND = "Not Found" as const;

export const STRATEGY_TYPES = ["Dividend", "Growth", "Mix", "Not Found"] as const;
export const SECURITY_TYPES = ["Company", "ETF", "Fund", "Not Found"] as const;
export const CALL_VALUES = ["Yes", "No"] as const;
export const SECTOR_VALUES = [
  "Financials", "Healthcare", "IT", "Energy", "Real Estate",
  "Consumer Discretionary", "Consumer Staples", "Materials",
  "Industrials", "Communication", "Utilities", "Diversified",
  "Not Found",
] as const;
export const MARKET_VALUES = ["USA", "Canada", "North America", "Global", "Not Found"] as const;
export const CANONICAL_CURRENCIES = ["USD", "CAD"] as const;
export const MGMT_STYLES = ["Active", "Passive", "N/A"] as const;

export type StrategyType = typeof STRATEGY_TYPES[number];
export type SecurityType = typeof SECURITY_TYPES[number];
export type CallValue = typeof CALL_VALUES[number];
export type Sector = typeof SECTOR_VALUES[number];
export type Market = typeof MARKET_VALUES[number];
export type ManagementStyle = typeof MGMT_STYLES[number];

function casefold(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

export function normalizeStrategyType(raw: string | null | undefined): StrategyType {
  const v = casefold(raw);
  if (!v) return NOT_FOUND;
  if (v === "dividend" || v === "pure dividend") return "Dividend";
  if (v === "growth" || v === "pure growth") return "Growth";
  if (v === "mix" || v === "the mix") return "Mix";
  return NOT_FOUND;
}

export function normalizeSecurityType(raw: string | null | undefined): SecurityType {
  const v = casefold(raw);
  if (!v) return NOT_FOUND;
  if (v === "company" || v === "equity" || v === "closed_end_fund") return "Company";
  if (v === "etf") return "ETF";
  if (v === "fund" || v === "mutualfund") return "Fund";
  return NOT_FOUND;
}

export function normalizeCall(raw: string | null | undefined): CallValue {
  const v = casefold(raw);
  if (v === "yes") return "Yes";
  return "No";
}

export function normalizeManagementStyle(raw: string | null | undefined): ManagementStyle {
  const v = casefold(raw);
  if (v === "active") return "Active";
  if (v === "passive") return "Passive";
  return "N/A";
}

const SECTOR_CONSOLIDATION_MAP: Record<string, Sector> = {
  // Financials
  "banking": "Financials",
  "bank": "Financials",
  "financial services": "Financials",
  "financials": "Financials",
  "financial": "Financials",
  "insurance": "Financials",
  // Healthcare
  "healthcare": "Healthcare",
  "health care": "Healthcare",
  "pharmaceutical": "Healthcare",
  "biotechnology": "Healthcare",
  // IT
  "technology": "IT",
  "it": "IT",
  "information technology": "IT",
  "software": "IT",
  "semiconductor": "IT",
  "tech": "IT",
  // Energy
  "energy": "Energy",
  "oil": "Energy",
  "gas": "Energy",
  "renewable": "Energy",
  // Real Estate
  "real estate": "Real Estate",
  "reit": "Real Estate",
  "realty": "Real Estate",
  // Consumer Discretionary
  "consumer discretionary": "Consumer Discretionary",
  "consumer cyclical": "Consumer Discretionary",
  "cyclical": "Consumer Discretionary",
  "retail": "Consumer Discretionary",
  "consumer": "Consumer Discretionary", // ambiguous default
  // Consumer Staples
  "consumer staples": "Consumer Staples",
  "consumer defensive": "Consumer Staples",
  "defensive": "Consumer Staples",
  // Materials
  "mining": "Materials",
  "gold": "Materials",
  "precious metals": "Materials",
  "materials": "Materials",
  "basic materials": "Materials",
  // Industrials
  "industrials": "Industrials",
  "industrial": "Industrials",
  // Communication
  "communication": "Communication",
  "communication services": "Communication",
  "telecom": "Communication",
  // Utilities
  "utilities": "Utilities",
  "utility": "Utilities",
  // Diversified
  "mix": "Diversified",
  "diversified": "Diversified",
  "multi-sector": "Diversified",
};

export function normalizeSector(raw: string | null | undefined): Sector {
  const v = casefold(raw);
  if (!v) return NOT_FOUND;
  return SECTOR_CONSOLIDATION_MAP[v] ?? NOT_FOUND;
}
