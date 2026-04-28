export type DriftSeverity = "red" | "warning" | "info";

export interface DriftSignal {
  id: string;
  severity: DriftSeverity;
  title: string;
  thresholdLabel: string;
  /** Tickers (or labels) of contributing assets, for accordion expansion. */
  contributors: Array<{ label: string; value: number; percent: number }>;
}

export interface BreakdownSlice {
  label: string;
  value: number;
  percent: number;
}

export interface DimensionBreakdown {
  /** Display title, e.g. "By Sector". */
  title: string;
  /** Field key the breakdown was computed from, e.g. "sector". */
  field: string;
  slices: BreakdownSlice[];
  totalValue: number;
}

export interface TopHoldings {
  top: Array<{ ticker: string; marketValue: number; percent: number; call: string; account: string; sector: string; currency: string }>;
  /** Aggregated "+ N other" entry. Null when N = 0. */
  others: { count: number; marketValue: number; percent: number } | null;
  totalValue: number;
}
