import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { researchTicker } from '@/lib/ticker-research';

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
    const data = await researchTicker(symbol);
    if (!data) {
      return NextResponse.json({ error: `Could not find ticker: ${symbol}` }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(`[ticker-lookup] Error for ${symbol}:`, error);
    return NextResponse.json(
      { error: `Could not find ticker: ${symbol}` },
      { status: 404 }
    );
  }
}
