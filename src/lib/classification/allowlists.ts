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
