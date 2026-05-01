import YahooFinance from "yahoo-finance2";
import type { Market } from "./allowlists";

const yahooFinance = new YahooFinance();

type Country = "USA" | "Canada" | "Both" | "Other" | "Unknown";

const GUARD_TOKENS = [
  "global", "world", "international", "intl",
  "emerging", "foreign", "ex-us", "ex us", "ex-usa",
  "developed", "all-country", "all country",
  "msci eafe", "acwi",
];

const CA_SUFFIX_RE = /\.(TO|V|NE|CN)$/i;
const US_EXPLICIT_RE = /\.US$/i;
const ANY_SUFFIX_RE = /\.[A-Z]{1,4}$/;

const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;

export function isClassificationExpired(ts: string | null | undefined): boolean {
  if (ts == null) return true;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > ONE_YEAR_MS;
}

function resolveByExchangeSuffix(symbol: string): Country {
  if (CA_SUFFIX_RE.test(symbol)) return "Canada";
  if (US_EXPLICIT_RE.test(symbol)) return "USA";
  if (!symbol.includes(".")) return "USA";
  if (ANY_SUFFIX_RE.test(symbol)) return "Other";
  return "Unknown";
}

function nameOrCategoryMatchesGuard(name: string, category: string): boolean {
  const haystack = (name + " " + category).toLowerCase();
  return GUARD_TOKENS.some(t => haystack.includes(t));
}

async function resolveHoldingCountry(
  symbol: string,
  quoteType: string,
  parentDepth: number,
): Promise<Country> {
  const isFund = quoteType === "ETF" || quoteType === "MUTUALFUND";

  // Recursion FIRST for sub-funds — their suffix tells where they're
  // listed, not what they hold.
  if (isFund && parentDepth < 1) {
    const sub = await classifyMarketByHoldings(symbol, parentDepth + 1);
    if (sub === "USA") return "USA";
    if (sub === "Canada") return "Canada";
    if (sub === "North America") return "Both";
    if (sub === "Global") return "Other";
    // sub === "Not Found" → fall through to suffix.
  }

  return resolveByExchangeSuffix(symbol);
}

export async function classifyMarketByHoldings(
  symbol: string,
  depth: number,
): Promise<Market> {
  if (depth > 1) return "Not Found";

  let summary: any;
  try {
    summary = await yahooFinance.quoteSummary(symbol, {
      modules: ["topHoldings", "price", "fundProfile"],
    });
  } catch {
    return "Not Found";
  }

  const holdings = summary?.topHoldings?.holdings ?? [];
  if (!Array.isArray(holdings) || holdings.length === 0) return "Not Found";

  if (depth === 0) {
    const fundName = String(summary?.price?.shortName ?? "") + " " + String(summary?.price?.longName ?? "");
    const fundCategory = String(summary?.fundProfile?.categoryName ?? "");
    if (nameOrCategoryMatchesGuard(fundName, fundCategory)) return "Not Found";
  }

  const symbols: string[] = holdings.map((h: any) => String(h.symbol)).filter(Boolean);

  let quoteTypeBySymbol = new Map<string, string>();
  try {
    const quotes = await yahooFinance.quote(symbols);
    const arr = Array.isArray(quotes) ? quotes : [quotes];
    quoteTypeBySymbol = new Map(arr.map((q: any) => [String(q.symbol), String(q.quoteType ?? "EQUITY")]));
  } catch {
    // Fall back to treating everything as EQUITY.
  }

  const countries: Country[] = [];
  for (const sym of symbols) {
    const qt = quoteTypeBySymbol.get(sym) ?? "EQUITY";
    countries.push(await resolveHoldingCountry(sym, qt, depth));
  }

  const resolved = countries.filter(c => c !== "Unknown");
  if (resolved.length === 0) return "Not Found";

  const hasUS = resolved.some(c => c === "USA" || c === "Both");
  const hasCA = resolved.some(c => c === "Canada" || c === "Both");
  const hasOther = resolved.some(c => c === "Other");

  if (hasOther) return "Global";
  if (hasUS && hasCA) return "North America";
  if (hasUS) return "USA";
  if (hasCA) return "Canada";
  return "Not Found";
}
