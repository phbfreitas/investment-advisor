import YahooFinance from 'yahoo-finance2';
import {
  normalizeSecurityType,
  normalizeStrategyType,
  normalizeSector,
  normalizeMarket,
  normalizeCurrency,
  normalizeManagementStyle,
  normalizeCall,
  applyCompanyAutoDefaults,
  type StrategyType,
  type SecurityType,
  type Sector,
  type Market,
  type ManagementStyle,
  type CallValue,
} from "./classification/allowlists";

const yahooFinance = new YahooFinance();

// Known passive ETF fund families
const PASSIVE_FAMILIES = [
  'vanguard', 'ishares', 'spdr', 'bmo', 'horizons',
  'invesco', 'schwab', 'fidelity index',
];

export interface TickerMetadata {
  name: string;
  symbol: string;
  securityType: SecurityType;
  strategyType: StrategyType;
  call: CallValue;
  sector: Sector;
  market: Market;
  managementStyle: ManagementStyle;
  managementFee: number | null;
  dividendYield: number | null;
  exDividendDate: string;
  oneYearReturn: number | null;
  threeYearReturn: number | null;
  analystConsensus: string;
  externalRating: string;
  beta: number;
  volatility: number;
  riskFlag: string;
  currency: string;
  currentPrice: number;
}

export function classifyStrategyType(yieldDecimal: number, beta: number, description: string = '', securityType: string = '', name: string = ''): StrategyType {
  const combinedText = (description + ' ' + name).toLowerCase();

  // 1. Pure Growth (Crescimento Puro)
  // Yield: 0.0% to 2.0%
  // Keywords: Index, S&P 500, Nasdaq, Capital Appreciation
  if (yieldDecimal <= 0.02) {
    const growthKeywords = ['index', 's&p 500', 'nasdaq', 'capital appreciation', 'growth', 'equity growth'];
    if (growthKeywords.some(k => combinedText.includes(k))) {
      return 'Growth';
    }
  }

  // 2. The Mix - Path A: High Yield / Options Strategy
  // Yield > 8.0%
  // Required Keywords: Options, Covered Call, Derivative, Distribution
  if (yieldDecimal > 0.08) {
    const optionsKeywords = ['options', 'covered call', 'derivative', 'distribution', 'yield enhancement', 'income generation', 'high yield', 'global strategic', 'enhanced income', 'financials high income'];
    if (optionsKeywords.some(k => combinedText.includes(k))) {
      return 'Mix';
    }
  }

  // 3. Pure Dividend (Dividendos Puros)
  // Yield: 2.1% to 8.0% AND Beta < 1.0
  // Required Keywords: Dividend, Distribution, Realty, Utility, Bank, Financial, Insurance
  if (yieldDecimal > 0.02 && yieldDecimal <= 0.08 && beta < 1.0) {
    const dividendKeywords = ['dividend', 'distribution', 'realty', 'utility', 'real estate', 'bank', 'financial', 'insurance', 'trust'];
    if (dividendKeywords.some(k => combinedText.includes(k)) || securityType === 'Company') {
      return 'Dividend';
    }
  }

  // 4. The Mix - Path B: Hybrid Risk
  // Yield 2.1% to 8.0% AND Beta >= 1.0
  if (yieldDecimal > 0.02 && yieldDecimal <= 0.08 && beta >= 1.0) {
    return 'Mix';
  }

  // Fallback: If AI is uncertain, Mix should be the default fallback.
  return 'Mix';
}

export function inferSector(description: string = '', currentSector: string = ''): Sector {
  if (currentSector && currentSector.trim() !== '' && currentSector !== 'N/A') {
    const normalized = normalizeSector(currentSector);
    if (normalized !== "Not Found") return normalized;
  }
  const desc = description.toLowerCase();
  if (/nasdaq.?100|technology|software|semiconductor|computing/i.test(desc)) return "IT";
  if (/financial services|banks?|insurance|investment/i.test(desc)) return "Financials";
  if (/healthcare|biotechnology|pharmaceutical/i.test(desc)) return "Healthcare";
  if (/energy|oil|gas|renewable/i.test(desc)) return "Energy";
  if (/real estate|reit/i.test(desc)) return "Real Estate";
  if (/consumer staples|defensive/i.test(desc)) return "Consumer Staples";
  if (/consumer|retail|cyclical/i.test(desc)) return "Consumer Discretionary";
  if (/mining|metals|gold/i.test(desc)) return "Materials";
  if (/utility|utilities/i.test(desc)) return "Utilities";
  if (/telecom|communication/i.test(desc)) return "Communication";
  if (/industrial/i.test(desc)) return "Industrials";
  return "Not Found";
}

export async function researchTicker(symbol: string): Promise<Partial<TickerMetadata> | null> {
  let ticker = symbol.toUpperCase();
  try {
    let quote;
    try {
      quote = await yahooFinance.quote(ticker);
    } catch (e) {
      if (!ticker.includes('.') && (ticker.length === 3 || ticker.length === 4)) {
        ticker = `${ticker}.TO`;
        quote = await yahooFinance.quote(ticker);
      } else {
        throw e;
      }
    }

    let summary: any = {};
    try {
      summary = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryDetail', 'assetProfile', 'fundProfile', 'calendarEvents', 'fundPerformance', 'recommendationTrend', 'defaultKeyStatistics'],
      });
    } catch (e) {
      // If full summary fails, try with minimal modules
      try {
        summary = await yahooFinance.quoteSummary(ticker, { modules: ['summaryDetail', 'assetProfile'] });
      } catch (e2) {
        // If it was a 3-4 letter ticker without .TO that managed to get a quote but no summary, try .TO just in case
        if (!ticker.includes('.')) {
          ticker = `${ticker}.TO`;
          summary = await yahooFinance.quoteSummary(ticker, { modules: ['summaryDetail', 'assetProfile'] });
        } else {
          throw e2;
        }
      }
    }

    const summaryDetail = summary.summaryDetail;
    const assetProfile = summary.assetProfile;
    const fundProfile = summary.fundProfile;

    const dividendYield = summaryDetail?.dividendYield || summaryDetail?.yield || summary.defaultKeyStatistics?.yield || 0;
    const description = (assetProfile?.longBusinessSummary) || (fundProfile?.description) || '';
    const quoteType = quote.quoteType || '';
    const beta = summary.defaultKeyStatistics?.beta3Year || summary.defaultKeyStatistics?.beta || 0;

    const name = (quote.shortName || quote.longName || ticker);
    const isCallInName = /covered.?call|cc|max/i.test(name);
    const isCallInDesc = /covered.?call|option.?writing|call.?options|yield.?enhancement/i.test(description);

    const securityType = normalizeSecurityType(quoteType);
    const strategyType: StrategyType = securityType === "Not Found"
      ? "Not Found"
      : classifyStrategyType(dividendYield, beta, description, securityType, name);

    const result = {
      name,
      symbol: ticker,
      currentPrice: quote.regularMarketPrice || 0,
      dividendYield: dividendYield || null,
      securityType,
      strategyType,
      call: (securityType === "Fund" && (isCallInName || isCallInDesc)) ? "Yes" as const : "No" as const,
      sector: inferSector(description, assetProfile?.sector),
      market: normalizeMarket(quote.exchange, securityType),
      managementStyle: normalizeManagementStyle(
        (assetProfile?.longBusinessSummary || "").toLowerCase().includes("index") ? "Passive" : "Active"
      ),
      managementFee: summaryDetail?.managementFee ?? null,
      exDividendDate: summaryDetail?.exDividendDate?.toISOString() || "",
      oneYearReturn: summary.fundPerformance?.trailingReturns?.oneYear ?? null,
      threeYearReturn: summary.fundPerformance?.trailingReturns?.threeYear ?? null,
      analystConsensus: summary.recommendationTrend?.trend?.[0]?.recommendationMean || "N/A",
      volatility: 0,
      riskFlag: "Normal",
      currency: normalizeCurrency(quote.currency || "USD"),
    };

    return applyCompanyAutoDefaults(result);
  } catch (error) {
    console.error(`Error researching ${ticker}:`, error);
    return null;
  }
}
