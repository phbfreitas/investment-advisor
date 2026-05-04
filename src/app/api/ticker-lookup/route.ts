import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { researchTicker } from '@/lib/ticker-research';
import { db, TABLE_NAME } from '@/lib/db';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Asset } from '@/types';

export async function findExistingAssetById(
  householdId: string,
  assetId: string,
  symbol: string,
): Promise<Pick<Asset, "userOverrides" | "marketComputedAt" | "market" | "exchangeSuffix" | "currency"> | null> {
  try {
    const { Item } = await db.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `HOUSEHOLD#${householdId}`,
          SK: `ASSET#${assetId}`,
        },
      })
    );
    if (!Item) return null;

    // Codex round-3 #1: if the user changed the ticker on this asset, the
    // stored cache/lock state was for the OLD ticker and does not apply
    // to the new symbol being looked up. Return null so researchTicker
    // runs as a fresh classification — otherwise we'd carry over the
    // prior market/timestamp/lock and silently corrupt the new ticker's
    // classification (e.g., switching VOO to VT would freeze VT as USA).
    const storedTicker = String(Item.ticker ?? "").toUpperCase();
    const requestedTicker = symbol.toUpperCase();
    if (storedTicker && storedTicker !== requestedTicker) {
      return null;
    }

    return {
      userOverrides: Item.userOverrides as Asset["userOverrides"],
      marketComputedAt: typeof Item.marketComputedAt === "string" || Item.marketComputedAt === null
        ? (Item.marketComputedAt as string | null)
        : undefined,
      market: typeof Item.market === "string" ? Item.market : "",
      exchangeSuffix: typeof Item.exchangeSuffix === "string" ? Item.exchangeSuffix : "",
      currency: typeof Item.currency === "string" ? Item.currency : "",
    };
  } catch (e) {
    console.warn(`[ticker-lookup] Failed to load asset ${assetId}:`, e);
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

  const assetId = request.nextUrl.searchParams.get('assetId');
  const exchangeSuffixParam = request.nextUrl.searchParams.get('exchangeSuffix');

  try {
    // Asset-specific lookup (Codex adversarial review #1, round 2): never
    // borrow lock/cache state from a sibling holding by ticker alone.
    const existing = assetId
      ? await findExistingAssetById(session.user.householdId, assetId, symbol)
      : null;

    const assetForLookup = exchangeSuffixParam !== null
      ? {
          market: existing?.market ?? "",
          currency: existing?.currency ?? "",
          marketComputedAt: existing?.marketComputedAt,
          exchangeSuffix: exchangeSuffixParam,
          userOverrides: { ...(existing?.userOverrides ?? {}), exchange: true as const },
        }
      : existing;

    const data = await researchTicker(symbol, assetForLookup);
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
