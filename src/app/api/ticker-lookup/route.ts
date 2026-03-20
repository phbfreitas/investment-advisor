import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

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
    const quote = await yahooFinance.quote(symbol.toUpperCase());
    const summaryDetail = await yahooFinance.quoteSummary(symbol.toUpperCase(), {
      modules: ['summaryDetail', 'assetProfile'],
    });

    return NextResponse.json({
      sector: summaryDetail.assetProfile?.sector || '',
      market: quote.exchange || '',
      securityType: quote.quoteType || '',
      currentPrice: quote.regularMarketPrice || 0,
      dividendYield: summaryDetail.summaryDetail?.dividendYield
        ? summaryDetail.summaryDetail.dividendYield * 100
        : 0,
      oneYearReturn: quote.fiftyTwoWeekChangePercent || 0,
      fiveYearReturn: 0,
      currency: quote.currency || 'USD',
      name: quote.shortName || quote.longName || symbol,
    });
  } catch (error) {
    console.error(`[ticker-lookup] Failed for ${symbol}:`, error);
    return NextResponse.json(
      { error: `Could not find ticker: ${symbol}` },
      { status: 404 }
    );
  }
}
