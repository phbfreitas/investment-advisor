import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// Known passive ETF fund families
const PASSIVE_FAMILIES = [
  'vanguard', 'ishares', 'spdr', 'bmo', 'horizons',
  'invesco', 'schwab', 'fidelity index',
];

function classifyStrategyType(yieldDecimal: number): string {
  if (yieldDecimal < 0.04) return 'Pure Growth';
  if (yieldDecimal < 0.08) return 'Pure Dividend';
  return 'Mix/Hybrid';
}

function classifyManagementStyle(quoteType: string, fundFamily?: string): string {
  if (quoteType !== 'ETF' && quoteType !== 'MUTUALFUND') return 'N/A';
  if (!fundFamily) return 'Active';
  const lower = fundFamily.toLowerCase();
  return PASSIVE_FAMILIES.some(f => lower.includes(f)) ? 'Passive' : 'Active';
}

function deriveAnalystConsensus(trend: { strongBuy?: number; buy?: number; hold?: number; sell?: number; strongSell?: number } | undefined): { consensus: string; rating: string } {
  if (!trend) return { consensus: '', rating: '' };
  const buy = (trend.strongBuy || 0) + (trend.buy || 0);
  const hold = trend.hold || 0;
  const sell = (trend.sell || 0) + (trend.strongSell || 0);
  if (buy === 0 && hold === 0 && sell === 0) return { consensus: '', rating: '' };

  if (buy >= hold && buy >= sell) {
    return {
      consensus: 'Buy',
      rating: (trend.strongBuy || 0) > (trend.buy || 0) ? 'Strong Buy' : 'Buy',
    };
  }
  if (sell >= hold && sell >= buy) {
    return {
      consensus: 'Sell',
      rating: (trend.strongSell || 0) > (trend.sell || 0) ? 'Strong Sell' : 'Sell',
    };
  }
  return { consensus: 'Hold', rating: 'Hold' };
}

function calculateVolatility(closes: number[]): number {
  if (closes.length < 2) return 0;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  if (returns.length === 0) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * 100; // as percentage
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  try {
    const ticker = symbol.toUpperCase();
    const quote = await yahooFinance.quote(ticker);

    // Fetch expanded modules — each wrapped in optional chaining
    let summary: Record<string, unknown> = {};
    try {
      summary = await yahooFinance.quoteSummary(ticker, {
        modules: [
          'summaryDetail',
          'assetProfile',
          'fundProfile',
          'calendarEvents',
          'fundPerformance',
          'recommendationTrend',
          'defaultKeyStatistics',
        ],
      }) as Record<string, unknown>;
    } catch (e) {
      // Some tickers don't support all modules; fall back to basics
      console.warn(`[ticker-lookup] Extended modules failed for ${ticker}, trying basic:`, e);
      summary = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryDetail', 'assetProfile'],
      }) as Record<string, unknown>;
    }

    const summaryDetail = summary.summaryDetail as Record<string, unknown> | undefined;
    const assetProfile = summary.assetProfile as Record<string, unknown> | undefined;
    const fundProfile = summary.fundProfile as Record<string, unknown> | undefined;
    const calendarEvents = summary.calendarEvents as Record<string, unknown> | undefined;
    const fundPerformance = summary.fundPerformance as Record<string, unknown> | undefined;
    const recommendationTrend = summary.recommendationTrend as { trend?: Array<Record<string, number>> } | undefined;
    const defaultKeyStatistics = summary.defaultKeyStatistics as Record<string, unknown> | undefined;

    // Basic fields (existing)
    const dividendYield = summaryDetail?.dividendYield
      ? (summaryDetail.dividendYield as number)
      : 0;
    const quoteType = (quote.quoteType as string) || '';

    // Strategy Type classification
    const strategyType = classifyStrategyType(dividendYield);

    // Call detection — covered call ETFs typically have "covered call" in their name
    const name = (quote.shortName || quote.longName || ticker) as string;
    const callFlag = quoteType === 'ETF' && /covered.?call|cc|max/i.test(name) ? 'Yes' : 'N/A';

    // Management style & fee
    const fundFamily = (fundProfile as Record<string, unknown>)?.family as string | undefined
      || (assetProfile as Record<string, unknown>)?.fundFamily as string | undefined;
    const managementStyle = classifyManagementStyle(quoteType, fundFamily);

    const feesInvestment = (fundProfile as Record<string, Record<string, unknown>>)?.feesExpensesInvestment;
    const managementFee = feesInvestment?.annualReportExpenseRatio
      ? (feesInvestment.annualReportExpenseRatio as number) * 100
      : (summaryDetail?.expenseRatio ? (summaryDetail.expenseRatio as number) * 100 : 0);

    // Ex-dividend date
    const exDivRaw = calendarEvents?.exDividendDate;
    const exDividendDate = exDivRaw ? new Date(exDivRaw as string | number).toISOString().split('T')[0] : '';

    // 3-year return
    const perfOverview = (fundPerformance as Record<string, Record<string, unknown>>)?.performanceOverview;
    const threeYearReturn = perfOverview?.threeYearAverageReturn
      ? (perfOverview.threeYearAverageReturn as number) * 100
      : 0;

    // Analyst consensus
    const trendData = recommendationTrend?.trend?.[0] as { strongBuy?: number; buy?: number; hold?: number; sell?: number; strongSell?: number } | undefined;
    const { consensus: analystConsensus, rating: externalRating } = deriveAnalystConsensus(trendData);

    // Beta
    const beta = (defaultKeyStatistics?.beta3Year as number) || 0;
    const riskFlag = beta > 1.2 ? 'Risk Spike' : '';

    // 30-day volatility from chart data
    let volatility = 0;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 45); // request 45 days to ensure 30 trading days
      const chartResult = await yahooFinance.chart(ticker, {
        period1: thirtyDaysAgo,
        interval: '1d',
      });
      const closes = (chartResult.quotes || [])
        .map((q: Record<string, unknown>) => q.close as number)
        .filter((c: number) => c != null && c > 0);
      volatility = calculateVolatility(closes);
    } catch (e) {
      console.warn(`[ticker-lookup] Chart fetch failed for ${ticker}:`, e);
    }

    return NextResponse.json({
      // Existing fields
      sector: (assetProfile?.sector as string) || '',
      market: (quote.exchange as string) || '',
      securityType: quoteType,
      currentPrice: (quote.regularMarketPrice as number) || 0,
      dividendYield,
      oneYearReturn: (quote.fiftyTwoWeekChangePercent as number) || 0,
      fiveYearReturn: 0, // kept for backward compat
      currency: (quote.currency as string) || 'USD',
      name,
      // New fields
      strategyType,
      call: callFlag,
      managementStyle,
      managementFee: Math.round(managementFee * 100) / 100,
      exDividendDate,
      threeYearReturn: Math.round(threeYearReturn * 100) / 100,
      analystConsensus,
      externalRating,
      volatility: Math.round(volatility * 100) / 100,
      beta: Math.round(beta * 100) / 100,
      riskFlag,
    });
  } catch (error) {
    console.error(`[ticker-lookup] Failed for ${symbol}:`, error);
    return NextResponse.json(
      { error: `Could not find ticker: ${symbol}` },
      { status: 404 }
    );
  }
}
