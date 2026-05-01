import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { researchTicker } from '@/lib/ticker-research';
import { db, TABLE_NAME } from '@/lib/db';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { Asset } from '@/types';

async function findExistingAssetByTicker(
  householdId: string,
  ticker: string,
): Promise<Pick<Asset, "userOverrides" | "marketComputedAt"> | null> {
  try {
    const { Items } = await db.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `HOUSEHOLD#${householdId}`,
          ":prefix": "ASSET#",
        },
      })
    );
    const upper = ticker.toUpperCase();
    const match = (Items ?? []).find((a: any) => String(a.ticker ?? "").toUpperCase() === upper);
    if (!match) return null;
    return {
      userOverrides: match.userOverrides as Asset["userOverrides"],
      marketComputedAt: typeof match.marketComputedAt === "string" || match.marketComputedAt === null
        ? (match.marketComputedAt as string | null)
        : undefined,
    };
  } catch (e) {
    console.warn(`[ticker-lookup] Failed to load existing asset for ${ticker}:`, e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  try {
    const existing = await findExistingAssetByTicker(session.user.householdId, symbol);
    const data = await researchTicker(symbol, existing);
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
