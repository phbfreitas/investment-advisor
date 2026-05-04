import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

interface CachedRate {
  rate: number;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const rateCache = new Map<string, CachedRate>();

export async function fetchFxRate(from: string, to: string): Promise<number> {
  const key = `${from}${to}`;
  const cached = rateCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  const symbol = `${from}${to}=X`;
  const quote = await yahooFinance.quote(symbol);
  const rate = (quote as any).regularMarketPrice;
  if (typeof rate !== "number") {
    throw new Error(`Failed to get FX rate for ${symbol}: no price returned`);
  }

  rateCache.set(key, { rate, fetchedAt: Date.now() });
  return rate;
}
